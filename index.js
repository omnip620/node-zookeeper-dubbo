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

  this.dubboVer = opt.dubboVer
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
    NZD.prototype[key] = new Service(self.client, self.dubboVer, refs[key], self)
  }
}

var Service = function(zk, dubboVer, depend, opt) {
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
    _dver: dubboVer || '2.5.3.6',
    _interface: depend.interface,
    _version: depend.version,
    _group: depend.group || opt.group,
    _timeout: depend.timeout || opt.timeout,
  }

  this._find(depend.interface)
}

Service.prototype._find = function(path, cb) {
  const self = this
  self._hosts = []
  this._zk.getChildren(`/${this._root}/${path}/providers`, watch, handleResult)

  function watch(event) {
    debug(event, 'watch event')
    self._find(path)
  }

  function handleResult(err, children) {
    let zoo, host, errMsg;
    if (err) {
      if (err.code === -4) {
        debug(err);
      }

      debug(err);
      throw new Error(err);
    }

    if (children && !children.length) {
      self.NO_NODE = true;
      errMsg = `can\'t find  the zoo: ${path} group: ${self._group},pls check dubbo service!`;
      debug(errMsg);
      throw new Error(errMsg);
    }

    self.NO_NODE = false;

    for (let i = 0, l = children.length; i < l; i++) {
      zoo = qs.parse(decodeURIComponent(children[i]))
      if (zoo.version === self._version && zoo.group === self._group) {
        host = url.parse(Object.keys(zoo)[0]).host.split(':')
        self._hosts.push(host)

        // 初始化socket
        self._dispatcher.insert(new Socket(host[1], host[0]))

        const methods = zoo.methods.split(',')
        for (let i = 0, l = methods.length; i < l; i++) {
          const method = methods[i]
          self[method] = function() {
            let args = Array.from(arguments)
            if (args.length && self._signature[method]) {
              args = self._signature[method].apply(self, args)
              if (typeof args === 'function') args = args(Java)
            }
            return new Promise((resolve, reject) =>
              self._execute(method, args, resolve, reject)
            )
          }
        }
      }
    }
    if (!self._hosts.length) {
      return console.log(`can\'t find  the zoo: ${path} group: ${self._group}, pls check dubbo service!`)
    }

    if (++COUNT === SERVICE_LENGTH) {
      console.log('\x1b[32m%s\x1b[0m', 'Dubbo service init done')
    }
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
