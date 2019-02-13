"use strict";
const debug = require("debug")("yoke");
const net = require("net");
const decode = require("./decode");
const Encode = require("./encode");
const { ConnectionPoolError, EXCEPTIONS } = require("./exception");

const HEADER_LENGTH = 16;
const FLAG_EVENT = 0x20;

const Socket = function(port, host) {
  this.socket = null;
  this.transmiting = false;
  this.error = null;
  this.isConnect = false;

  this.heartBeatLock = false;
  this.heartBeatInter = null;

  this.resolve = null;
  this.reject = null;
  this.cb = null;

  this.chunks = [];
  this.bl = HEADER_LENGTH;

  this.socket = net.connect(port, host);

  // this.socket.setTimeout(6000);

  this.socket.on("timeout", this.onTimeout.bind(this));
  this.socket.on("connect", this.onConnect.bind(this));
  this.socket.on("data", this.onData.bind(this));
  this.socket.on("error", this.onError.bind(this));

  return this;
};

Socket.prototype.onTimeout = function() {
  debug("socket timeout");
  if (this.reject) {
    this.reject("socket timeout");
  }
  this.socket.end();
};

Socket.prototype.invoke = function({ attach, resolve, reject }, cb) {
  this.resolve = resolve;
  this.reject = reject;
  this.cb = cb;
  this.transmiting = true;
  this.heartBeatLock = true;

  // TODO:if invoke fail
  const buffer = new Encode(attach);
  this.socket.write(buffer);
};

Socket.prototype.onConnect = function() {
  this.isConnect = true;
  this.heartBeatInter = setInterval(() => {
    if (!this.heartBeatLock) {
      // prettier-ignore
      this.socket.write(Buffer([0xda, 0xbb, 0xe2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x01, 0x4e]));
    }
  }, 5000);
};

Socket.prototype.destroy = function(msg) {
  this.isConnect = false;
  this.reject && this.reject(msg);
  clearInterval(this.heartBeatInter);
  this.socket.destroy();
};

Socket.prototype.onError = function(err) {
  this.error = err;

  if (this.cb) {
    this.cb(err);
  }

  if (this.reject) {
    switch (err.code) {
      case "EADDRINUSE":
        this.reject("Address already in use");
        break;
      case "ECONNREFUSED":
        this.reject("Connection refused");
        break;
      case "ECONNRESET":
        this.destroy("Connection reset by peer");
        break;
      case "EPIPE":
        this.destroy("Broken pipe");
        break;
      case "ETIMEDOUT":
        this.reject("Operation timed out");
        break;
    }
  }
};

Socket.prototype.onData = function(data) {
  if (!this.chunks.length) {
    this.bl += data.readInt32BE(12);
  }
  this.chunks.push(data);
  const heap = Buffer.concat(this.chunks);
  if (heap.length === this.bl) {
    this.bl = HEADER_LENGTH;
    this.chunks = [];
    this.deSerialize(heap);
  }
};

Socket.prototype.deSerialize = function(heap) {
  // Decoding it if it's not a heartbeat event
  if (!((heap[2] & FLAG_EVENT) !== 0)) {
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
  removeConn(this.queue, connection);
};

Dispatcher.prototype.purgeConn = function(connection) {
  removeConn(this.queue, connection);
  removeConn(this.busyQueue, connection);
};

Dispatcher.prototype.get = function(uid) {
  this.queue.get(uid);
};

Dispatcher.prototype.gain = function(cb) {
  let socket = null;

  if (!this.queue.length && !this.busyQueue.length) {
    return cb(new ConnectionPoolError(EXCEPTIONS.NO_AVAILABLE_WORKER));
  }
  if (this.queue.length) {
    socket = this.queue.shift();
    if (socket.isConnect === false) {
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
    this.gain(this.waitingTasks.shift());
  }
};

function removeConn(arr, conn) {
  const index = arr.indexOf(conn);
  if (index !== -1) {
    arr.splice(index, 1);
  }
}

module.exports = {
  Dispatcher,
  Socket
};
