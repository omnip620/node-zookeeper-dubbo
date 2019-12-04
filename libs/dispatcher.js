"use strict";
const PoolCluster = require("./pool-cluster");
const RpcException = require("./errors");
class Dispatcher {
  constructor(depInterface) {
    this.poolCluster = new PoolCluster();
    this.tasks = [];
    this.depInterface = depInterface;
  }
  enqueue(task) {
    this.tasks.push(task);
  }

  execute({ msg, cb }) {
    console.log(msg.length);
    const time = new Date().getTime();
    while (time + 1000 > new Date().getTime()) {}
    const conn = this.poolCluster.getAvailableConnection(this.depInterface);
    if (conn != null) {
      conn.invoke(msg, (err, res) => {
        if (err && !(err instanceof RpcException)) {
          this.poolCluster.removeConnectionOfAPool(this.depInterface, conn);
          cb(err);
        } else {
          this.poolCluster.releaseConnectionOfAPool(this.depInterface, conn);
          cb(err, res);
        }
      });
      return;
    }
    const [idleConnections, busyConnections] = this.poolCluster.getConnections(this.depInterface);
    if (busyConnections.length == 0 && idleConnections.length == 0) {
      this.doNext();
      cb(new RpcException(`No available provider for service ${this.depInterface}`));
      return;
    }
    this.enqueue({ msg, cb });
  }

  doNext() {
    if (this.tasks.length <= 0) {
      return;
    }
    this.execute(this.tasks.shift());
  }

  invoke(msg, cb) {
    if (this.tasks.length > 0) {
      this.enqueue({ msg, cb });
    } else {
      this.execute({ msg, cb });
    }
  }
}
module.exports = Dispatcher;
