/**
 * Created by panzhichao on 16/8/2.
 */
'use strict';
const net       = require('net');
const hessian   = require('hessian.js');
const url       = require('url');
const zookeeper = require('node-zookeeper-client');
const qs        = require('querystring');
const reg       = require('./libs/register');

require('./utils');
// default body max length
const DEFAULT_LEN  = 8388608; // 8 * 1024 * 1024
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
  const self       = this;
  this.dubboVer    = opt.dubboVer;
  this.application = opt.application;

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
    NZD.prototype[key] = new Service(self.client, self.dubboVer, refs[key]);
  }
};

var Service = function (zk, dubboVer, depend) {
  this._zk    = zk;
  this._hosts = [];
  this._dver  = dubboVer || '2.5.3.6';

  this._interface = depend.interface;
  this._version   = depend.version;
  this._group     = depend.group;
  this._timeout   = depend.timeout || 6000;

  let implicitArg = {interface: this._interface};

  this._version && (implicitArg.version = this._version)
  this._group && (implicitArg.group = this._group);

  this._attachments = {
    $class: 'java.util.HashMap',
    $     : implicitArg
  };

  this._find(this._interface);
};

Service.prototype._find = function (path) {
  const self = this;
  this._zk.getChildren(`/dubbo/${path}/providers`, handleResult);
  function handleResult(err, children) {
    let zoo;
    if (err) {
      if (err.code === -4) {
        console.log(err);
      }
      return console.log(err);
    }
    if (children && !children.length) {
      return console.log(`can\'t find  the zoo: ${path} ,pls check dubbo service!`);
    }

    for (let i = 0, l = children.length; i < l; i++) {
      zoo = qs.parse(decodeURIComponent(children[i]));
      if (zoo.version === self._version && zoo.group === self._group) {
        self._hosts.push(url.parse(Object.keys(zoo)[0]).host);
        const methods = zoo.methods.split(',');
        for (let i = 0, l = methods.length; i < l; i++) {
          self[methods[i]] = (function (method) {
            return function () {
              return self._execute(method, arguments);
            };
          })(methods[i]);
        }
      }
    }
    if (++COUNT == SERVICE_LENGTH) {
      console.log('\x1b[32m%s\x1b[0m', 'Dubbo service init done');
    }
  }
};

Service.prototype._execute = function (method, args) {
  args       = Array.from(args);
  const self = this;

  const typeRef      = {
    boolean: 'Z', int: 'I', short: 'S',
    long   : 'J', double: 'D', float: 'F'
  };
  let parameterTypes = '';
  let buffer, type;

  if (args.length) {
    for (var i = 0, l = args.length; i < l; i++) {
      type = args[i]['$class'];
      parameterTypes += type && ~type.indexOf('.')
        ? 'L' + type.replace(/\./gi, '/') + ';'
        : typeRef[type];
    }

    buffer = this.buffer(method, parameterTypes, args);
  } else {
    buffer = this.buffer(method, '');
  }

  return new Promise(function (resolve, reject) {
    const client   = new net.Socket();
    const host     = self._hosts[Math.random() * self._hosts.length | 0].split(':');
    const hostName = host[0];
    const port     = host[1];
    var bl         = 16;
    var ret        = null;
    var chunks     = [];
    var heap;
    client.connect(port, hostName, function () {
      client.write(buffer);
    });

    client.on('error', function (err) {
      console.log(err);
    });

    client.on('data', function (chunk) {
      if (!chunks.length) {
        var arr = Array.prototype.slice.call(chunk.slice(0, 16));
        var i   = 0;
        while (i < 3) {
          bl += arr.pop() * Math.pow(255, i++);
        }
      }
      chunks.push(chunk);
      heap = Buffer.concat(chunks);

      (heap.length >= bl) && client.destroy();
    });

    client.on('close', function (err) {
      if (err) {
        return console.log('some err occurred, so reconnect, check the err event');
      }
      if (heap[3] !== 20) {
        ret = heap.slice(18, heap.length - 1).toString(); // error捕获
        return reject(ret);
      }
      if (heap[15] === 3 && heap.length < 20) { // 判断是否没有返回值
        return resolve(null);
      }

      try {
        var offset = heap[16] === 145 ? 17 : 18; // 判断传入参数是否有误
        var buf    = new hessian.DecoderV2(heap.slice(offset, heap.length));
        var _ret   = buf.read();
        if (_ret instanceof Error || offset === 18) {
          return reject(_ret);
        }
        ret = _ret;
      } catch (err) {
        return reject(err);
      }
      return resolve(ret);
    });
  });
};

Service.prototype.buffer = function (method, type, args) {
  var bufferBody = this.bufferBody(method, type, args);
  var bufferHead = this.bufferHead(bufferBody.length);
  return Buffer.concat([bufferHead, bufferBody]);
};

Service.prototype.bufferHead = function (length) {
  var head = [0xda, 0xbb, 0xc2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var i    = 15;

  if (length > DEFAULT_LEN) {
    throw new Error(`Data length too large: ${length}, max payload: ${DEFAULT_LEN}`);
  }
  // 构造body长度信息
  if (length - 256 < 0) {
    head.splice(i, 1, length - 256);
  } else {
    while (length - 256 > 0) {
      head.splice(i--, 1, length % 256);
      length = length >> 8;
    }
    head.splice(i, 1, length);
  }
  return new Buffer(head);
};

Service.prototype.bufferBody = function (method, type, args) {
  var encoder = new hessian.EncoderV2();
  encoder.write(this._dver);
  encoder.write(this._interface);
  encoder.write(this._version);
  encoder.write(method);
  encoder.write(type);
  if (args && args.length) {
    for (var i = 0, len = args.length; i < len; ++i) {
      encoder.write(args[i]);
    }
  }
  encoder.write(this._attachments);
  encoder = encoder.byteBuffer._bytes.slice(0, encoder.byteBuffer._offset);
  return encoder;
};

module.exports = NZD;
