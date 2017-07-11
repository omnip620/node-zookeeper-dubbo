/**
 * Created by panzhichao on 16/8/2.
 */
'use strict';
const net       = require('net');
const url       = require('url');
const zookeeper = require('node-zookeeper-client');
const qs        = require('querystring');
const reg       = require('./libs/register');
const decode    = require('./libs/decode');
const Encode    = require('./libs/encode').Encode;
let Java = null; //require('js-to-java');

require('./utils');

let SERVICE_LENGTH = 0;
let COUNT          = 0;

/**
 * @param {Object} opt {conn:'zk.dev.pajkdc.com:2181',
 * dubbo:{version:PZC,
 *        dversion:2.3.4.6,
 *        group:'xxx'},
 * dependencies:{}}
 * @constructor
 */

var NZD                 = function (opt) { 
  Java = opt.java || Java;
  const self       = this;
  this.dubboVer    = opt.dubboVer;
  this.application = opt.application;
  this.group       = opt.group;
  this.timeout     = opt.timeout || 6000;
  this._root        = opt.root || 'dubbo';
  this.dependencies = opt.dependencies || {};
  SERVICE_LENGTH    = Object.keys(this.dependencies).length;
  this.client       = zookeeper.createClient(opt.register, {
    sessionTimeout: 30000,
    spinDelay     : 1000,
    retries       : 5
  });

  this.client.connect();
  this.client.once('connected', function () {
    self._applyServices();
    self._consumer();
  });
};
NZD.prototype._consumer = reg.consumer;

NZD.prototype._applyServices = function () {
  const refs = this.dependencies;
  const self = this;

  for (let key in refs) { 
    NZD.prototype[key] = new Service(self.client, self.dubboVer, refs[key], self);
  }
};

var Service = function (zk, dubboVer, depend, opt) {
  this._zk        = zk;
  this._hosts     = [];
  this._version   = depend.version;
  this._group     = depend.group || opt.group;
  this._interface = depend.interface;
  this._signature = Object.assign({}, depend.methodSignature);
  this._root      = opt._root;

  this._encodeParam = {
    _dver     : dubboVer || '2.5.3.6',
    _interface: depend.interface,
    _version  : depend.version,
    _group    : depend.group || opt.group,
    _timeout  : depend.timeout || opt.timeout
  }

  this._find(depend.interface);
};

Service.prototype._find = function (path, cb) {
  const self  = this;
  self._hosts = [];
  this._zk.getChildren(`/${this._root}/${path}/providers`, watch, handleResult);

  function watch(event) {
    self._find(path)
  }

  function handleResult(err, children) {
    let zoo;
    if (err) {
      if (err.code === -4) {
        console.log(err);
      }
      return console.log(err);
    }
    if (children && !children.length) {
      return console.log(`can\'t find  the zoo: ${path} group: ${self._group},pls check dubbo service!`);
    }

    for (let i = 0, l = children.length; i < l; i++) {
      zoo = qs.parse(decodeURIComponent(children[i]));
      if (zoo.version === self._version && zoo.group === self._group) {
        self._hosts.push(url.parse(Object.keys(zoo)[0]).host);
        const methods = zoo.methods.split(',');
        for (let i = 0, l = methods.length; i < l; i++) {
          self[methods[i]] = (function (method) {
            return function () {
              var args = Array.from(arguments);
              if(args.length && self._signature[method]){
                args = self._signature[method].apply(self, args);
                if(typeof args === 'function') args = args(Java);
              }
              return self._execute(method, args);
            };
          })(methods[i]);
        } 
      }
    }
    if (!self._hosts.length) {
      return console.log(`can\'t find  the zoo: ${path} group: ${self._group},pls check dubbo service!`);
    }
    if (typeof cb === 'function') {
      return cb();
    }
    if (++COUNT === SERVICE_LENGTH) {
      console.log('\x1b[32m%s\x1b[0m', 'Dubbo service init done');
    }
  }
};

Service.prototype._flush = function (cb) {
  this._find(this._interface, cb)
};

Service.prototype._execute = function (method, args) {
  const self                = this;
  this._encodeParam._method = method;
  this._encodeParam._args   = args;
  const buffer              = new Encode(this._encodeParam);

  return new Promise(function (resolve, reject) {
    const client = new net.Socket();
    let host     = self._hosts[Math.random() * self._hosts.length | 0].split(':');
    const chunks = [];
    let heap;
    let bl       = 16;
    client.connect(host[1], host[0], function () {
      client.write(buffer);
    });

    client.on('error', function (err) {
      self._flush(function () {
        host = self._hosts[Math.random() * self._hosts.length | 0].split(':');
        client.connect(host[1], host[0], function () {
          client.write(buffer);
        });
      })
    });

    client.on('data', function (chunk) {
      if (!chunks.length) {
        var arr = Array.prototype.slice.call(chunk.slice(0, 16));
        var i   = 0;
        while (i < 3) {
          bl += arr.pop() * Math.pow(256, i++);
        }
      }
      chunks.push(chunk);
      heap = Buffer.concat(chunks);
      (heap.length >= bl) && client.destroy();
    });

    client.on('close', function (err) {
      if (!err) {

        decode(heap, function (err, result) {
          if (err) {
            return reject(err);
          }
          return resolve(result);
        })
      }

    });
  });
};

module.exports = NZD;
