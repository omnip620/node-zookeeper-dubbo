/**
 * Created by panzhichao on 16/8/2.
 */
'use strict';
const debug = require('debug')('nzd')
const url = require('url')
const zookeeper = require('node-zookeeper-client')
const qs = require('querystring')
const reg = require('./libs/register')
const { Dispatcher, Socket } = require('./libs/socket')

// const EventEmitter = require('events');
// const util = require('util');
let Java = null // require('js-to-java');

require('./utils')

let SERVICE_LENGTH = 0
let COUNT = 0

const NZD = function(opt) {
  Java = opt.java || Java

  this.application = opt.application
  this.group = opt.group
  this.timeout = opt.timeout || 6000
  this.root = opt.root || 'dubbo'
  this.dependencies = opt.dependencies || {}
  SERVICE_LENGTH = Object.keys(this.dependencies).length
  this.client = zookeeper.createClient(opt.register, {
    sessionTimeout: 30000,
    spinDelay: 1000,
    retries: 5,
  })

  this.client.connect()
  this.client.once('connected', () => {
    this._applyServices()
    this._consumer()
  })
}
NZD.prototype._consumer = reg.consumer

NZD.prototype._applyServices = function() {
  const refs = this.dependencies
  const self = this

  for (const key in refs) {
    NZD.prototype[key] = new Service(self.client, refs[key], self)
  }
}

var Service = function(zk, depend, opt) {
  this._zk = zk
  this._hosts = []
  this._version = depend.version
  this._group = depend.group || opt.group
  this._interface = depend.interface
  this._signature = Object.assign({}, depend.methodSignature)
  this._root = opt.root

  this._dispatcher = new Dispatcher()
  this.NO_NODE = true;

  this._encodeParam = {
    _dver: opt.dubboVer || '2.5.3.6',
    _interface: depend.interface,
    _version: depend.version,
    _group: depend.group || opt.group,
    _timeout: depend.timeout || opt.timeout,
  }

  this._find();
}

Service.prototype._find = function() {
  this._zk.getChildren(`/${this._root}/${this._interface}/providers`, this.zooWatcher.bind(this), this.zooHandleRes.bind(this))
}

Service.prototype.zooWatcher = function (event) {
  debug(event, 'watch event')
  this._find();
}

Service.prototype.zooHandleRes = function(err, children) {
  let zoo, host, errMsg;
  if (err) {
    if (err.code === -4) {
      debug(err);
    }

    debug(err);
    throw new Error(err);
  }

  if (children && !children.length) {
    this.NO_NODE = true;
    errMsg = `can\'t find  the service: ${this._root}/${this._interface} ${this._group ? `group:${this._group}` : ''},pls check dubbo service!`;
    debug(errMsg);
    throw new Error(errMsg);
  }

  this.NO_NODE = false;

  for (let i = 0, l = children.length; i < l; i++) {
    zoo = qs.parse(decodeURIComponent(children[i]))
    if (zoo.version === this._version && zoo.group === this._group) {
      host = url.parse(Object.keys(zoo)[0]).host.split(':')
      this._hosts.push(host)

      // init socket
      this._dispatcher.insert(new Socket(host[1], host[0]))

      const methods = zoo.methods.split(',')
      for (let i = 0, l = methods.length; i < l; i++) {
        const method = methods[i]
        this[method] = function() {
          let args = Array.from(arguments)
          if (args.length && this._signature[method]) {
            args = this._signature[method].apply(this, args)
            if (typeof args === 'function') args = args(Java)
          }
          return new Promise((resolve, reject) =>
            this._execute(method, args, resolve, reject)
          )
        }
      }
    }
  }

  if (!this._hosts.length) {
    return console.log(`can\'t find  the service: ${this._root}/${this._interface} ${this._group ? `group:${this._group}` : ''},pls check dubbo service!`)
  }

  if (++COUNT === SERVICE_LENGTH) {
    console.log('\x1b[32m%s\x1b[0m', 'Dubbo service init done')
  }
}

Service.prototype._execute = function(method, args, resolve, reject) {
  if (this.NO_NODE) {
    return reject('can not find zoo, pls check later')
  }

  const attach = Object.assign({}, this._encodeParam, {_method:method, _args:args});
  const el = {attach, resolve, reject};

  this._dispatcher.gain((err, conn) => {
    if (err) {
      return reject(err)
    }
    conn.invoke(el, (err, done) => {
      this._dispatcher.release(conn);
      if (conn.connect === false) {
        this._dispatcher.purgeConn(conn);
      }
    });
  })
}

module.exports = NZD
