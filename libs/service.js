const qs = require("querystring");
const { Dispatcher, Socket } = require("./socket");

class Service {
  constructor(dep, providers) {
    let methods = null;
    this.dispatcher = new Dispatcher();
    for (let i = 0, l = providers.length; i < l; i++) {
      const provider = providers[i];
      const queryObj = qs.parse(provider.query);
      methods = queryObj.methods.split(",");
      this.initSockets(provider.hostname, provider.port);
    }

    this.injectMethods(methods);

    this.encodeParam = {
      _dver: "2.5.3.6",
      _interface: dep.interface,
      _version: dep.version,
      _group: dep.group,
      _timeout: dep.timeout
    };
  }

  initSockets(hostName, port) {
    this.dispatcher.insert(new Socket(port, hostName));
  }

  injectMethods(methods) {
    const that = this;
    for (let i = 0, l = methods.length; i < l; i++) {
      const method = methods[i];
      this[method] = (...args) => {
        if (args.length) {
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
        console.log(err, "==");
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
