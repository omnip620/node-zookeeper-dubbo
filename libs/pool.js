"use strict";
const Connection = require("./connection");
class Pool {
  constructor({ addresses, timeout }) {
    this.addresses = addresses;
    this.timeout = timeout;
    this.idleConnections = [];
    this.connectionMap = Object.create(null);
  }

  addConnection(host, port) {
    const key = `${host}:${port}`;
    if (!this.connectionMap[key]) {
      this.connectionMap[key] = new Connection({ host, port, timeout: this.timeout, pool: this });
      this.idleConnections.push(this.connectionMap[key]);
    }
  }

  getIdleConnections() {
    return this.idleConnections;
  }

  getAvailableConnection() {
    let conn = null;
    if (this.getIdleConnections().length > 0) {
      conn = this.getIdleConnections().shift();
      conn.isIdle = false;
    }
    return conn;
  }

  release(conn) {
    conn.isIdle = true;
    this.idleConnections.push(conn);
  }

  removeConnection(conn) {
    removeConn(this.idleConnections, conn);
    const key = conn.getRemoteHost() + ":" + conn.getRemotePort();
    if (this.connectionMap[key]) {
      delete this.connectionMap[key];
    }
  }

  isEmpty() {
    return Object.keys(this.connectionMap).length == 0;
  }
}

function removeConn(arr, conn) {
  const index = arr.indexOf(conn);
  if (index !== -1) {
    arr.splice(index, 1);
  }
}

module.exports = Pool;
