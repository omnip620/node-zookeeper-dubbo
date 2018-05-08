"use strict";

const qs = require("querystring");
const { Dispatcher, Socket } = require("./socket");
const debug = require("debug")("yoke");

class Service {
  constructor(dependency, providers) {
    let methods = null;
    this.mdsig = Object.assign({}, dependency.methodSignature);
    this.dispatcher = new Dispatcher();
    for (let i = 0, l = providers.length; i < l; i++) {
      const provider = providers[i];
      const queryObj = qs.parse(provider.query);
      methods = queryObj.methods.split(",");
      this.initSockets(provider.hostname, provider.port);
    }
    debug(`the ${dependency.interface} method list: ${methods}`);

    this.injectMethods(methods);

    this.encodeParam = {
      _dver: "2.5.3.6",
      _interface: dependency.interface,
      _version: dependency.version,
      _group: dependency.group,
      _timeout: dependency.timeout
    };
  }

  initSockets(host, port) {
    this.dispatcher.insert(new Socket(port, host));
  }

  injectMethods(methods) {
    for (let i = 0, l = methods.length; i < l; i++) {
      const method = methods[i];

      this[method] = (...args) => {
        if (args.length && this.mdsig[method]) {
          args = this.mdsig[method](...args);
        }

        return new Promise((resolve, reject) => this.execute(method, args, resolve, reject));
      };
    }
  }

  execute(method, args, resolve, reject) {
    const attach = Object.assign({}, this.encodeParam, {
      _method: method,
      _args: args
    });
    const el = { attach, resolve, reject };

    this.dispatcher.gain((err, conn) => {
      if (err) {
        return reject(err);
      }

      conn.invoke(el, (err, done) => {
        this.dispatcher.release(conn);
        if (conn.isConnect === false) {
          this.dispatcher.purgeConn(conn);
        }
      });
    });
  }
}

module.exports = { Service };
