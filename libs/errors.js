"use strict";
class RpcException extends Error {
  constructor(args) {
    super(args);
    this.name = "RpcException";
  }
}
module.exports = RpcException;
