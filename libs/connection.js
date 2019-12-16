"use strict";
const net = require("net");
const debug = require("debug")("Yoke:connection");
const { isHeartBeat, message: heartBeatMessage } = require("./heartbeat");
const decode = require("./decode");
require("./typedef");
const HEADER_LENGTH = 16;
class Connection {
  /**
   *
   * @param {Options} options
   */
  constructor(options) {
    this.pool = options.pool;
    this.socket = net.connect(options.port, options.host);
    this.socket.on("connect", this.onConnect.bind(this));
    this.socket.on("data", this.onData.bind(this));
    this.socket.on("error", this.onError.bind(this));
    this.socket.on("close", this.onClose.bind(this));

    this.isIdle = true;
    /** interval for sending heart beat message */
    this.heartBeatEvent = null;
    this.chunks = [];
    this.bl = 16;
    this.callback = () => {};
  }

  onConnect() {
    this.heartBeatEvent = setInterval(() => {
      if (this.socket.destroyed) {
        clearInterval(this.heartBeatEvent);
        return;
      }
      if (this.isIdle) {
        this.socket.write(heartBeatMessage);
      }
    }, 5000);
    debug(`Connection to ${this.socket.remoteAddress} is established`);
  }

  onData(data) {
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
  }

  onClose() {
    this.callback("Socket close by peer");
  }

  onError(err) {
    this.callback(err);
    console.log(`Error happens on service ${this.socket.remotePort} -> ${err}`);
    this.isIdle = true;
  }

  deSerialize(heap) {
    if (!isHeartBeat(heap)) {
      decode(heap, (err, res) => {
        this.callback(err, res);
        this.isIdle = true;
      });
    }
  }

  getRemoteHost() {
    return this.socket.remoteAddress;
  }

  getRemotePort() {
    return this.socket.remotePort;
  }

  invoke(buffer, callback) {
    this.callback = callback;
    this.isIdle = false;
    this.socket.write(buffer);
  }
}

module.exports = Connection;
