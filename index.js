'use strict';
var net       = require('net');
var buffer    = require('buffer');
var hessian   = require('hessian.js');
var url       = require('url');
var zookeeper = require('node-zookeeper-client');
var qs        = require('querystring');

var utils = require('./utils');

var ZK = function (conn, path, env) {
  this.conn    = conn;
  this.path    = '/dubbo/' + path + '/providers';
  this.env     = env;
  this.methods = [];
};

ZK.prototype.connect = function (conn) {

  !this.conn && (this.conn = conn);

  this.client = zookeeper.createClient(this.conn);
  this.client.connect();


};

ZK.prototype.getZoo = function (cb) {
  this.connect();
  var self = this;

  this.client.once('connected', connect);

  function connect() {
    self.client.getChildren(self.path, handleEvent, handleResult);
  }

  function handleEvent(event) {
    console.log('Got watcher event: %s', event);
    self.getZoo();
  }

  function handleResult(err, children) {
    var zoo, urlparsed;
    if (err) {
      cb(err);
      return;
    }
    if (children && children.length) {
      for (var i = 0, l = children.length; i < l; i++) {
        zoo = qs.parse(decodeURIComponent(children[i]));
        if (zoo.version === self.env) {
          break;
        }
      }
    }

    urlparsed    = url.parse(Object.keys(zoo)[0]);
    self.methods = zoo.methods.split(',');
    cb(null, {host: urlparsed.hostname, port: urlparsed.port});
    self.client.close();
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
  this.zoo         = new ZK(opt.conn, this._path, this._env);
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
    self.zoo.getZoo(zooData);
    function zooData(err, zoo) {
      var client   = new net.Socket();
      var chunks   = [];
      var bl       = 0;
      var response = null, resData;

      var host, port;
      if (err) {
        reject(err);
        return;
      }
      host = zoo.host;
      port = zoo.port;

      if (!~self.zoo.methods.indexOf(_method)) {
        throw new SyntaxError("can't find this method, pls check it!");
      }

      client.connect(port, host, function () {
        client.write(buffer);
      });

      client.on('drain', function () {
        console.log('fire drain');
      });

      function getLength(arr) {
        var l = arr.pop();
        var i = 0;
        while (l) {
          bl += l * Math.pow(255, i++);
          l = arr.pop();
        }
        bl += 16;
      }

      client.on('data', function (chunk) {
        if (!chunks.length) {
          getLength([].slice.call(chunk.slice(0, 16), 0));
        }
        chunks.push(chunk);
        resData = Buffer.concat(chunks);
        if (resData.length >= bl) {
          client.destroy();
        }
      });
      client.on('close', function () {
        if (resData[3] === 70) {
          response = resData.slice(19, resData.length - 1).toString();
        }
        else if (resData[15] === 3) {
          response = 'void return';
        }
        else {
          var buf  = new hessian.DecoderV2(resData.slice(17, resData.length - 1));
          response = JSON.stringify(buf.read());
        }
        resolve(response);
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

