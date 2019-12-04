"use strict";

/**
 * https://dubbo.apache.org/zh-cn/docs/dev/implementation.html
 *
 * Hessian2 serialization byte-code map
 * http://hessian.caucho.com/doc/hessian-serialization.html#anchor36
 */

const {
  MAGIC_HI,
  MAGIC_LO,
  FLAG_REQUEST,
  FLAG_TWOWAY,
  FLAG_EVENT,
  SERIALIZATION
} = require("./constants");

const isHeartBeat = heap => (heap[2] & FLAG_EVENT) != 0;
const encode = () => {
  // Msg consists of head, and body
  const msg = Buffer.allocUnsafe(17);
  // Set dubbo magic code
  msg.writeUInt8(MAGIC_HI, 0);
  msg.writeUInt8(MAGIC_LO, 1);
  // Build heartbeat info
  const rte = FLAG_REQUEST | FLAG_TWOWAY | FLAG_EVENT | SERIALIZATION.hessian2;
  msg.writeUInt8(rte, 2);
  // Set status code with 0, since this is a request
  msg.writeUInt8(0, 3);
  // Set request id with 0
  msg.fill(0, 4, 12);
  // Set data length with 1, because there is nothing but a null value in the body field
  msg.writeUInt8(0x01, 15);
  // Set body
  msg.writeInt8(0x4e, 16);
  return msg;
};
const message = () => {
  return this.encode();
};

module.exports = { isHeartBeat, encode, message };
