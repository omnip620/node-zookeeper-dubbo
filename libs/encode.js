/**
 * Created by panzhichao on 16/8/18.
 */
"use strict";
const Encoder = require("hessian.js").EncoderV2;
const MAX_LEN = 8388608; // 8 * 1024 * 1024, default maximum length of body

function Encode(opt) {
  this._opt = opt;
  const body = this._body(opt._method, opt._args);
  const head = this._head(body.length);
  return Buffer.concat([head, body]);
}

Encode.prototype._head = function(len) {
  const head = Buffer([0xda, 0xbb, 0xc2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  if (len > MAX_LEN) {
    throw new Error(`Data length too large: ${len}, maximum payload: ${MAX_LEN}`);
  }
  head.writeInt32BE(len, 12);
  return head;
};

Encode.prototype._body = function(method, args) {
  const body = new Encoder();
  const ver = this._opt._dver || "2.5.3.6";
  body.write(ver);
  body.write(this._opt._interface);
  body.write(this._opt._version);
  body.write(this._opt._method);

  if (ver.startsWith("2.8")) {
    body.write(-1); //for dubbox 2.8.X
  }
  body.write(this._argsType(args));
  if (args && args.length) {
    for (let i = 0, len = args.length; i < len; ++i) {
      body.write(args[i]);
    }
  }
  body.write(this._attachments());
  return body.byteBuffer._bytes.slice(0, body.byteBuffer._offset);
};

Encode.prototype._argsType = function(args) {
  if (!(args && args.length)) {
    return "";
  }

  const typeRef = {
    boolean: "Z",
    int: "I",
    short: "S",
    long: "J",
    double: "D",
    float: "F"
  };

  let parameterTypes = "";
  let type;

  for (var i = 0, l = args.length; i < l; i++) {
    type = args[i]["$class"];

    if (type.charAt(0) === "[") {
      parameterTypes += ~type.indexOf(".")
        ? "[L" + type.slice(1).replace(/\./gi, "/") + ";"
        : "[" + typeRef[type.slice(1)];
    } else {
      parameterTypes +=
        type && ~type.indexOf(".") ? "L" + type.replace(/\./gi, "/") + ";" : typeRef[type];
    }
  }

  return parameterTypes;
};

Encode.prototype._attachments = function() {
  const implicitArgs = {
    interface: this._opt._interface,
    path: this._opt._interface,
    timeout: this._opt._timeout
  };
  this._opt._version && (implicitArgs.version = this._opt._version);
  this._opt._group && (implicitArgs.group = this._opt._group);

  return {
    $class: "java.util.HashMap",
    $: implicitArgs
  };
};

module.exports = Encode;
