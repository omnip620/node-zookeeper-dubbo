"use strict";

const qs = require("querystring");
const debug = require("debug")("yoke");
const PoolCluster = require("./pool-cluster");
const Encode = require("./encode");
const Dispatcher = require("./dispatcher");
const execute = Symbol("execute");
class Service {
  constructor(dependency, providers, dver, dkey) {
    let methods = null;
    this.mdsig = Object.assign({}, dependency.methodSignature);
    this.poolCluster = new PoolCluster();
    this.poolCluster.addPool(dkey);
    this.dispatcher = new Dispatcher(dkey);
    for (let i = 0, l = providers.length; i < l; i++) {
      const provider = providers[i];
      const queryObj = qs.parse(provider.query);
      methods = queryObj.methods.split(",");
      this.poolCluster.addConnection(dkey, provider.hostname, provider.port);
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
    const msg = new Encode(attach);
    this.dispatcher.invoke(msg, (err, res) => {
      if (err) {
        return reject(err);
      }
      return resolve(res);
    });
  }
}

module.exports = { Service };
