/**
 * Created by panzhichao on 16/8/2.
 */
"use strict";
const debug = require("debug")("yoke");
const url = require("url");
const zookeeper = require("node-zookeeper-client");
const qs = require("querystring");
const reg = require("./libs/register");
const { Service } = require("./libs/service");
const EventEmitter = require("events");
const { print } = require("./utils");

class Yoke extends EventEmitter {
  constructor(opt) {
    super();
    this.name = opt.application.name;
    this.group = opt.group;
    this.timeout = opt.timeout || 6000;
    this.root = opt.root || "dubbo";
    this.dependencies = opt.dependencies || {};
    this.zkIsConnect = false;
    this.dver = opt.dubboVer;
    if (opt.register) {
      print.warn(
        `WARNING: The attribute 'register' is deprecated and will be removed in the future version. Use registry instead.`
      );
    }
    this.registry = opt.registry || opt.register;

    this.initClient();
  }

  initClient() {
    this.client = zookeeper.createClient(this.registry, {
      sessionTimeout: 30000,
      spinDelay: 1000,
      retries: 5
    });

    this.client.connect();
    this.client.once("connected", this.onOnceConnected.bind(this));

    this.checkConnection();
  }

  checkConnection() {
    const err = `FATAL: It seems that zookeeper cannot be connected, please check registry address or try later.`;
    this.zkConnectTimeout = setTimeout(() => {
      !this.zkIsConnect && print.err(err);
      clearTimeout(this.zkConnectTimeout);
    }, 10000);
  }

  onOnceConnected() {
    debug("zookeeper connect successfully");
    print.info("Dubbo service init done");
    this.zkIsConnect = true;
    this.retrieveServices();
    this.regConsumer();
  }

  retrieveServices() {
    for (const [key, val] of Object.entries(this.dependencies)) {
      const path = `/${this.root}/${val.interface}/providers`;
      this.client.getChildren(
        path,
        this.watchService.bind(this),
        this.resolveService(path, key, val)
      );
    }
  }

  watchService(event) {
    debug(event, "watch event");
    this.retrieveServices();
    this.emit("service:changed", event);
  }

  resolveService(path, depKey, depVal) {
    return (error, children, stat) => {
      if (error) {
        print.err(error);
        return;
      }
      if (children && !children.length) {
        const errMsg = `WARNING: Can\'t find the service: ${path}, please check!`;
        print.warn(errMsg);
        return;
      }
      const size = children.length;
      const providers = [];

      for (let i = 0; i < size; i++) {
        const provider = url.parse(decodeURIComponent(children[i]));
        const queryObj = qs.parse(provider.query);
        if (
          queryObj.version === depVal.version &&
          queryObj.group === depVal.group &&
          provider.protocol === "dubbo:"
        ) {
          providers.push(provider);
        }
      }
      if (!providers.length) {
        print.warn(
          `WARNING: Please check the version、 group、 protocol(must dubbo) of dependency (${depKey}),`,
          `due to they are not matched with any provider service found in zookeeper.`
        );

        return;
      }

      this.determineService(depKey, depVal, providers);
    };
  }

  determineService(depKey, depVal, providers) {
    this[depKey] = new Service(depVal, providers, this.dver);
  }

  regConsumer() {
    reg.consumer.call(this);
  }
}

module.exports = Yoke;
