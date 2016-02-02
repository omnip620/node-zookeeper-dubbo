'use strict';
const net       = require('net');
const hessian   = require('hessian.js');
const url       = require('url');
const zookeeper = require('node-zookeeper-client');
const qs        = require('querystring');
require('./utils');

/**
 * Create a zookeeper connection
 *
 * @param {String} conn
 * @param {String} env
 * @returns {Object} zoo
 *
 *
 * @constructor
 */
var ZK = function (conn, env) {

  if (typeof ZK.instance === 'object') {
    return ZK.instance;
  }
  this.conn    = conn;
  this.env     = env;
  this.methods = [];
  this.connect();

  ZK.instance = this;
};

ZK.prototype.connect = function (conn) {
  !this.conn && (this.conn = conn);
  this.client = zookeeper.createClient(this.conn);
  this.client.connect();
  this.client.once('connected', function connect() {
    console.log('zookeeper connected');
  });
};

ZK.prototype.close = function () {
  this.client.close();
};

/**
 * Get a zoo
 *
 * @param {String} path
 * @param {Function} cb
 */

ZK.prototype.getZoo = function (path, cb) {
  this.path = '/dubbo/' + path + '/providers';
  var self  = this;

  self.client.getChildren(self.path, handleResult);
  function handleResult(err, children) {
    var zoo, urlParsed;
    if (err) {
      return cb(err);
    }
    if (children && !children.length) {
      return cb('can\'t find zoo');
    }

    for (var i = 0, l = children.length; i < l; i++) {
      zoo = qs.parse(decodeURIComponent(children[i]));
      if (zoo.version === self.env) {
        break;
      }
    }
    //Get the first zoo
    urlParsed    = url.parse(Object.keys(zoo)[0]);
    self.methods = zoo.methods.split(',');
    cb(null, {host: urlParsed.hostname, port: urlParsed.port});


  }
};


var Service = function (opt) {
  this._version = opt.version || '2.5.3.3';
  this._path    = opt.path;
  this._env     = opt.env.toUpperCase();

  this._attchments = {
    $class: 'java.util.HashMap',
    $     : {
      path     : this._path,
      interface: this._path,
      version  : this._env,
      timeout  : '60000'
    }
  };
  this.zoo         = new ZK(opt.conn, this._env);
};

Service.prototype.excute = function (method, args, cb) {
  var _method         = method;
  var _parameterTypes = '';
  var _arguments      = args;
  var buffer, type, typeRef;

  typeRef = {
    boolean: 'Z', int: 'I', short: 'S',
    long   : 'J', double: 'D', float: 'F'
  };

  if (_arguments.length) {
    for (var i = 0, l = _arguments.length; i < l; i++) {
      type = _arguments[i]['$class'];
      _parameterTypes
        += type && ~type.indexOf('.')
        ? 'L' + type.replace(/\./gi, '/') + ';'
        : typeRef[type];
    }
    buffer = this.buffer(_method, _parameterTypes, _arguments);
  } else {
    buffer = this.buffer(_method, '');
  }
  var self = this;

  return new Promise(function (resolve, reject) {
    self.zoo.getZoo(self._path, zooData);
    function zooData(err, zoo) {
      var client = new net.Socket();
      var bl     = 16;
      var host   = zoo.host;
      var port   = zoo.port;
      var ret    = null;
      var chunks = [], heap;

      if (err) {
        return reject(err);
      }

      if (!~self.zoo.methods.indexOf(_method)) {
        throw new SyntaxError("can't find this method, pls check it!");
      }

      client.connect(port, host, function () {
        client.write(buffer);
      });

      client.on('data', function (chunk) {
        if (!chunks.length) {
          var arr  = [].slice.call(chunk.slice(0, 16));
          var l, i = 0;
          while (l = arr.pop()) {
            bl += l * Math.pow(255, i++);
          }
        }
        chunks.push(chunk);
        heap = Buffer.concat(chunks);
        (heap.length >= bl) && client.destroy();
      });
      client.on('close', function () {
        if (heap[3] === 70) {
          ret = heap.slice(19, heap.length - 1).toString();
        }
        else if (heap[15] === 3 && heap.length < 20) {
          ret = 'void return';
        }
        else {
          var offset = heap[16] === 145 ? 17 : 18; //判断传入参数是否有误
          var buf  = new hessian.DecoderV2(heap.slice(offset, heap.length - 1));
          var _ret = buf.read();
          if (_ret instanceof Error || offset === 18) {
            return reject(_ret);
          }
          ret = JSON.stringify(_ret);
        }
        resolve(ret);
      });
    }
  }).nodeify(cb);
};

Service.prototype.buffer = function (method, type, args) {
  var bufferBody = this.bufferBody(method, type, args);
  var bufferHead = this.bufferHead(bufferBody.length);
  return Buffer.concat([bufferHead, bufferBody]);
};

Service.prototype.bufferHead = function (length) {
  var head = [0xda, 0xbb, 0xc2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  if (length - 256 > 0) {
    head.splice(14, 1, length / 256 | 0);
    head.splice(15, 1, length % 256);
  } else {
    head.splice(15, 1, length - 256);
  }
  return new Buffer(head);
};

Service.prototype.bufferBody = function (method, type, args) {
  var encoder = new hessian.EncoderV2();

  encoder.write(this._version);
  encoder.write(this._path);
  encoder.write(this._env);
  encoder.write(method);
  encoder.write(type);
  if (args && args.length) {
    for (var i = 0, len = args.length; i < len; ++i) {
      encoder.write(args[i]);
    }
  }
  encoder.write(this._attchments);
  encoder = encoder.byteBuffer._bytes.slice(0, encoder.byteBuffer._offset);

  return encoder;
};

module.exports = Service;

