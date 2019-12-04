"use strict";
const net = require("net");
const debug = require("debug")("Yoke:connection");
const { isHeartBeat, encode } = require("./heartbeat");
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
        this.socket.write(encode());
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

  onError(err) {
    this.callback(err);
    process.nextTick(() => {
      this.isIdle = true;
    });
  }

  deSerialize(heap) {
    if (!isHeartBeat(heap)) {
      decode(heap, (err, res) => {
        this.callback(err, res);
      });
    }
  }

  invoke(buffer, callback) {
    this.callback = callback;
    this.isIdle = false;
    this.socket.write(buffer);
  }
}

module.exports = Connection;
