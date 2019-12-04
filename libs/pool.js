"use strict";
const Connection = require("./connection");

class Pool {
  constructor({ addresses, timeout }) {
    this.addresses = addresses;
    this.timeout = timeout;
    this.idleConnections = [];
    this.busyConnections = [];
    // this.initConnection();
  }
  initConnection() {
    for (let i = 0; i < this.addresses.length; i++) {
      this.idleConnections.push(
        new Connection({ address: this.addresses[i], timeout: this.timeout })
      );
    }
  }

  addConnection(host, port) {
    this.idleConnections.push(new Connection({ host, port, timeout: this.timeout, pool: this }));
  }

  getIdleConnections() {
    return this.idleConnections;
  }

  getBusyConnections() {
    return this.busyConnections;
  }

  getAvailableConnection() {
    let conn = null;
    if (this.getIdleConnections().length > 0) {
      conn = this.getIdleConnections().shift();
      conn.isIdle = false;
      this.busyConnections.push(conn);
    }
    return conn;
  }

  release(conn) {
    conn.isIdle = true;
    removeConn(this.busyConnections, conn);
    this.idleConnections.push(conn);
  }

  removeConnection(conn) {
    removeConn(this.idleConnections, conn);
    removeConn(this.busyConnections, conn);
  }
}

function removeConn(arr, conn) {
  const index = arr.indexOf(conn);
  if (index !== -1) {
    arr.splice(index, 1);
  }
}

module.exports = Pool;
