"use strict";

const qs = require("querystring");
const { Dispatcher, Socket } = require("./socket");
const debug = require("debug")("yoke");
const execute = Symbol("execute");
class Service {
  constructor(dependency, providers, dver) {
    let methods = null;
    this.mdsig = Object.assign({}, dependency.methodSignature);
    this.dispatcher = new Dispatcher();
    for (let i = 0, l = providers.length; i < l; i++) {
      const provider = providers[i];
      const queryObj = qs.parse(provider.query);
      methods = queryObj.methods.split(",");
      this.initSockets(provider.hostname, provider.port);
    }
    debug(`The ${dependency.interface} method list: ${methods.join(", ")}`);
    this.injectMethods(methods);

    this.encodeParam = {
      _dver: dver || "2.5.3.6",
      _interface: dependency.interface,
      _version: dependency.version,
      _group: dependency.group,
      _timeout: dependency.timeout
    };
  }

  initSockets(host, port) {
    this.dispatcher.insert(new Socket(port, host));
    this.dispatcher.insert(new Socket(port, host));
    this.dispatcher.insert(new Socket(port, host));
  }

  injectMethods(methods) {
    for (let i = 0, l = methods.length; i < l; i++) {
      const method = methods[i];

      this[method] = (...args) => {
        if (this.mdsig[method]) {
          args = this.mdsig[method](...args);
        }
        return new Promise((resolve, reject) => this[execute](method, args, resolve, reject));
      };
    }
  }

  [execute](method, args, resolve, reject) {
    const attach = Object.assign({}, this.encodeParam, {
      _method: method,
      _args: args
    });
    const el = { attach, resolve, reject };

    this.dispatcher.gain((err, conn) => {
      if (err) {
        return reject(err);
      }

      conn.invoke(el, err => {
        if (err) {
          reject(err);
        }
        this.dispatcher.release(conn);

        if (conn.isConnect === false) {
          this.dispatcher.purgeConn(conn);
        }
      });
    });
  }
}

module.exports = { Service };
