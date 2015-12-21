var net       = require('net');
var buffer    = require('buffer');
var hessian   = require('hessian.js');
var url       = require('url');
var zookeeper = require('node-zookeeper-client');
var qs        = require('querystring');

var ZK = function (conn, path, env) {
  this.conn = conn;
  this.path = '/dubbo/' + path + '/providers';
  this.env  = env;
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

  function handleResult(err, children, stat) {
    var zoo, urlparsed;
    if (err) {
      cb(err);
      return;
    }
    if (children && children.length) {
      for (var i = 0, l = children.length; i < l; i++) {
        zoo = qs.parse(decodeURIComponent(children[i]));
        if (zoo.version == self.env) {
          break;
        }
      }
    }
    urlparsed = url.parse(Object.keys(zoo)[0]);
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
    $:      {
      path:      this._path,
      interface: this._path,
      version:   this._env,
      timeout:   '60000'
    }
  };
  this.zoo         = new ZK(opt.conn, this._path, this._env);
};

Service.prototype.excute = function (method, arguments, cb) {

  var _method         = method;
  var _parameterTypes = '';
  var _arguments      = arguments;
  var buffer;

  if (_arguments.length) {
    for (var i = 0, l = arguments.length; i < l; i++) {
      var arg = _arguments[i];
      if (arg.hasOwnProperty('$class')) {
        var type = arg['$class'];
        if (~type.indexOf('.')) {
          _parameterTypes += 'L' + type.replace(/\./gi, '/') + ';';
        }
        else {
          switch (type) {
            case 'boolean':
              _parameterTypes += 'Z';
              break;
            case 'int':
              _parameterTypes += 'I';
              break;
            case 'short':
              _parameterTypes += 'S';
              break;
            case 'long':
              _parameterTypes += 'J';
              break;
            case 'double':
              _parameterTypes += 'D';
              break;
            case 'float':
              _parameterTypes += 'F';
              break;
          }
        }
      }
    }
  }

  if (_arguments.length) {
    buffer = this.buffer(_method, _parameterTypes, _arguments);
  } else {
    buffer = this.buffer(_method, '');
  }


  this.zoo.getZoo(zooData);

  function zooData(err, zoo) {
    var client = new net.Socket();

    var host, port;
    if (err) {

      cb(err);
      return;
    }
    host = zoo.host;
    port = zoo.port;


    client.connect(port, host, function () {
      client.write(buffer);
    });

    client.on('data', function (data) {
      var buf = new hessian.DecoderV2(data.slice(17, data.length - 1));

      cb(null, JSON.stringify(buf.read()));
      client.destroy();
    });

    client.on('close', function () {
    });
  }
};

Service.prototype.buffer = function (method, type, arguments) {
  var bufferBody = this.bufferBody(method, type, arguments);
  var bufferHead = this.bufferHead(bufferBody.length);
  return Buffer.concat([bufferHead, bufferBody]);

};

Service.prototype.bufferHead = function (length) {
  var head = [0xda, 0xbb, 0xc2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  if (length - 256 > 0) {
    head.splice(14, 1, Math.floor(length / 256));
    head.splice(15, 1, length % 256);
  } else {
    head.splice(15, 1, length - 256)
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
      var arg = args[i];
      encoder.write(arg);
    }
  }

  encoder.write(this._attchments);
  encoder = encoder.byteBuffer._bytes.slice(0, encoder.byteBuffer._offset);

  return encoder;
};

module.exports = Service;

