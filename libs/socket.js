'use strict'
const debug = require('debug')('nzd')
const net = require('net');
const decode = require('./decode');
const Encode = require('./encode').Encode;

const Socket = function(port, host) {
  this.socket = null;
  this.transmiting = false;
  this.error = null;
  this.connect = false;

  this.heartBeatLock = false;
  this.heartBeatInter = null;

  this.resolve = null;
  this.reject = null;
  this.cb = null;

  this.socket = net.connect(port, host);

  // this.socket.setTimeout(6000);

  this.socket.on('timeout', this.onTimeout.bind(this))
  this.socket.on('connect', this.onConnect.bind(this));
  this.socket.on('data', this.onData.bind(this));
  this.socket.on('error', this.onError.bind(this));

  return this;
};

Socket.prototype.onTimeout = function () {
  debug('socket timeout');
  if (this.reject) {
    this.reject('socket timeout')
  }
  this.socket.end();
}

Socket.prototype.invoke = function({ attach, resolve, reject }, cb) {
  this.resolve = resolve;
  this.reject = reject;
  this.cb = cb;
  this.transmiting = true;
  this.heartBeatLock = true;

  // const {method, args} = this._excuteQueen[0];
  // const attach = Object.assign({} , encodeParam, {_method:method, _args:args});

  // TODO:if invoke fail
  const buffer = new Encode(attach);
  this.socket.write(buffer);
};

Socket.prototype.onConnect = function() {
  this.connect = true;
  this.heartBeatInter = setInterval(() => {
    if (!this.heartBeatLock) {
      this.socket.write(Buffer([0xda, 0xbb, 0xe2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x01, 0x4e]));
    }}, 5000);
};

Socket.prototype.destroy = function (msg) {
  clearInterval(this.heartBeatInter);
  this.socket.destroy();
  this.connect = false;
  this.reject(msg);
}

Socket.prototype.onError = function(err) {
  this.error = err;
  if (this.cb) {
    this.cb(err)
  }
  if (this.reject) {
    switch (err.code) {
      case 'EADDRINUSE':
        this.reject('Address already in use');
        break;
      case 'ECONNREFUSED':
        this.reject('Connection refused');
        break;
      case 'ECONNRESET':
        this.destroy('Connection reset by peer')
        break;
      case 'EPIPE':
        this.destroy('Broken pipe')
        break;
      case 'ETIMEDOUT':
        this.reject('Operation timed out');
        break;
    }
  }
};

Socket.prototype.onData = function(data) {
  // not a heartbeat event
  if ((data[2] & 0x20) === 0) {
    this.deSerialize(data);
  }
};

Socket.prototype.deSerialize = function(chunk) {
  const chunks = [];
  let bl = 16;

  if (!chunks.length) {
    const arr = Array.prototype.slice.call(chunk.slice(0, 16));
    let i = 0;
    while (i < 3) {
      bl += arr.pop() * Math.pow(256, i++);
    }
  }
  chunks.push(chunk);
  const heap = Buffer.concat(chunks);

  if (heap.length === bl) {
    decode(heap, (err, result) => {
      this.transmiting = false;
      this.heartBeatLock = false;

      err ? this.reject(err) : this.resolve(result);

      this.resolve = null;
      this.reject = null;
      this.cb(null, true);
    });
  }
};

const Dispatcher = function() {
  this.queue = [];
  this.waitingTasks = [];
  this.busyQueue = [];
};

Dispatcher.prototype.insert = function(socket) {
  this.queue.push(socket);
};

Dispatcher.prototype.remove = function(connection) {
  removeConn(this.queue, connection)
};

Dispatcher.prototype.purgeConn = function(connection) {
  removeConn(this.queue, connection);
  removeConn(this.busyQueue, connection);
}

Dispatcher.prototype.get = function(uid) {
  this.queue.get(uid);
};

Dispatcher.prototype.gain = function(cb) {
  let socket = null;

  if (this.queue.length) {
    socket = this.queue.shift();
    if (socket.connect === false) {
      this.purgeConn(socket);
      return this.gain(cb);
    }
    this.busyQueue.push(socket);
    cb(null, socket);
  } else {
    this.waitingTasks.push(cb);
  }
};

Dispatcher.prototype.release = function(conn) {
  removeConn(this.busyQueue, conn);
  this.queue.push(conn);
  if (this.waitingTasks.length) {
    this.gain(this.waitingTasks.shift())
  }

}

function removeConn(arr, conn) {
  const index = arr.indexOf(conn);
  if (index  !== -1) {
    arr.splice(index, 1);
  }
}

exports.Dispatcher = Dispatcher;
exports.Socket = Socket;
