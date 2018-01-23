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
// const EventEmitter = require('events');
// const util = require('util');
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

  for (const key in refs) {
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
  this._sockets   = [];
  this._excuteQueen = [];


  this._encodeParam = {
    _dver     : dubboVer || '2.5.3.6',
    _interface: depend.interface,
    _version  : depend.version,
    _group    : depend.group || opt.group,
    _timeout  : depend.timeout || opt.timeout
  }

  this._find(depend.interface);
};

var SocketWrapper = function(socket) {
  this.socket = socket;
  this.transmiting = false;
  this.error = null;
}
Service.prototype._initSocket = function(port, host) {
  if(this._sockets.length){
    this._sockets.forEach(s=>{
      s.socket = undefined;
    })
  }
  this._sockets=[];
  
  const socket = net.connect(port, host)
  const socketWrapper = new SocketWrapper(socket);
  let timerHeatBeat= null;
  
  socket.on('connect', () => {
    this._sockets.push(socketWrapper);
    console.log(port, host)
    timerHeatBeat = setInterval(() => {
      if (!socketWrapper.heartBeatLock) {
        socket.write(Buffer([0xda, 0xbb, 0xe2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x01, 0x4e]))
      }
    }, 5000)

  });
  socket.on('data', (data) => {
    if((data[2]&0x20)===0){
      this.ret(data);
    }
  })
  socket.on('error', (err) => {
    console.log(err.code === 'EPIPE','-----')
    if(err.code === 'EPIPE'){
      clearInterval(timerHeatBeat);
      this._sockets = [];
      socket.destroy();
    }
    this._errorHandle(err)
  })
}

Service.prototype._errorHandle = function(err){
 
  if(this._sockets.length){
    let clientWrapper = this._sockets[0];
    clientWrapper.error = err;
  }
  this._excuteQueen.forEach(({reject})=>reject('service not available, pls try latter'));
  delete this._excuteQueen;
  this._excuteQueen = [];
}

Service.prototype.ret = function(chunk){
  let clientWrapper = this._sockets[0];
  if(clientWrapper.error){
    return;
  }
  const chunks = [];
  let heap;
  let bl       = 16;
  let self =this;

  if (!chunks.length) {
    var arr = Array.prototype.slice.call(chunk.slice(0, 16));
    var i   = 0;
    while (i < 3) {
      bl += arr.pop() * Math.pow(256, i++);
    }
  }
  chunks.push(chunk);
  heap = Buffer.concat(chunks);
  (heap.length == bl) && (() => {
    console.log(self._excuteQueen.length)
    decode(heap, function (err, result) {
      const {resolve, reject} = self._excuteQueen.shift();
      clientWrapper.transmiting = false;
      clientWrapper.heartBeatLock = false;
      if (err) {
        reject(err);
      }
     resolve(result);

     if (self._excuteQueen.length) {
      process.nextTick(() => {
        self._write()
      });
    }
    })
  })();
}

Service.prototype._find = function (path, cb) {
  const self  = this;
  let NO_NODE = false;
  self._hosts = [];
  this._zk.getChildren(`/${this._root}/${path}/providers`, watch, handleResult);

  function watch(event) {
    console.log(event,'-------');
    self._find(path)
  }

  function handleResult(err, children) {
    let zoo, host;
    if (err) {
      if (err.code === -4) {
        console.log(err);
      }
      return console.log(err);
    }
    if (children && !children.length) {
      self._sockets = [];
      return console.log(`can\'t find  the zoo: ${path} group: ${self._group},pls check dubbo service!`);
    }

    for (let i = 0, l = children.length; i < l; i++) {
      zoo = qs.parse(decodeURIComponent(children[i]));
      if (zoo.version === self._version && zoo.group === self._group) {
        host = url.parse(Object.keys(zoo)[0]).host.split(':');
        self._hosts.push(host);
        self._initSocket(host[1], host[0]);
        const methods = zoo.methods.split(',');
        for (let i = 0, l = methods.length; i < l; i++) {
          let method = methods[i];
          self[method] = function () {
            var args = Array.from(arguments);
            if (args.length && self._signature[method]) {
              args = self._signature[method].apply(self, args);
              if (typeof args === 'function') args = args(Java);
            }
            return new Promise((resolve, reject) => self._execute(method, args, resolve, reject))
          };
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

Service.prototype._excuteQueenHelper = function(method, args, resolve, reject) {
  this._excuteQueen.push({method, args, resolve, reject})
}

Service.prototype._write = function(){
  const clientWrapper = this._sockets[0];
  if(!clientWrapper.transmiting){
    clientWrapper.transmiting = true;
    clientWrapper.heartBeatLock = true;
    const {method, args} = this._excuteQueen[0];
    const attach = Object.assign({} , this._encodeParam, {_method:method, _args:args});
    const buffer = new Encode(attach);
    clientWrapper.socket.write(buffer);
  }
}


Service.prototype._execute = function (method, args, resolve, reject) {
  if(!this._sockets.length){
    return reject('service not available, pls try latter, OK')
  }
  
  this._excuteQueenHelper(method, args, resolve, reject);
  process.nextTick(()=>this._write())
};

module.exports = NZD;
