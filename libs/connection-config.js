"use strict";

class ConnectionConfig {
  constructor(options) {
    this.address = options.address;
    this.timeOut = options.timeOut;
  }
}

module.exports = ConnectionConfig;
