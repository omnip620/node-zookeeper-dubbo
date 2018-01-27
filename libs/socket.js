'use strict'
const net = require('net');
const decode = require('./decode');
const Encode = require('./encode').Encode;

const Socket = function(port, host) {
  this.socket = null;
  this.transmiting = false;
  this.error = null;
  this.heartBeatLock = false;
  this.connect = false;
  this.resolve = null;
  this.reject = null;
  this.heartBeatInter = null;
  this.cb = null;

  this.socket = net.connect(port, host);

  this.socket.on('connect', this.onConnect.bind(this));
  this.socket.on('data', this.onData.bind(this));
  this.socket.on('error', this.onError.bind(this));

  return this;
};

Socket.prototype.communicate = function({ attach, resolve, reject, release }, cb) {
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

Socket.prototype.onError = function(err) {
  this.error = err;
  if (!this.reject) {
    throw new Error(err);
  }

  switch (err.code) {
    case 'EADDRINUSE':
      this.reject('Address already in use');
      break;
    case 'ECONNREFUSED':
      this.reject('Connection refused');
      break;
    case 'ECONNRESET':
      this.reject('Connection reset by peer');
      break;
    case 'EPIPE':
      clearInterval(this.heartBeatInter);
      this.socket.destroy();
      this.reject('Broken pipe');
      break;
    case 'ETIMEDOUT':
      this.reject('Operation timed out');
      break;
  }
};

Socket.prototype.onData = function(data) {
  // not a heartbeat event
  if ((data[2] & 0x20) === 0) {
    this.deSerialize(data);
  }
};

Socket.prototype.deSerialize = function(chunk) {
  const self = this;
  if (this.error && this.error.code === 'EPIPE') {
    return;
  }
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
      self.transmiting = false;
      self.heartBeatLock = false;
      if (err) {
        self.reject(err);
      }
      self.resolve(result);
      self.resolve = null;
      self.reject = null;
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

Dispatcher.prototype.get = function(uid) {
  this.queue.get(uid);
};

Dispatcher.prototype.gain = function(cb) {
  let socket = null;

  if (this.queue.length) {
    socket = this.queue.shift();
    this.busyQueue.push(socket);
    cb(null, socket);
  } else {
    this.waitingTasks.push(cb);
  }

  // return socket;
};

Dispatcher.prototype.release = function(conn) {
  removeConn(this.busyQueue, conn);
  this.queue.push(conn);
  if (this.waitingTasks.length) {
    this.gain(this.waitingTasks.shift())
  }

}

function removeConn(arr, conn) {
  let index;
  if ((index = arr.indexOf(conn)) !== -1) {
    arr.splice(index, 1);
  }
}

exports.Dispatcher = Dispatcher;
exports.Socket = Socket;
