"use strict";
const Pool = require("./pool");
class PoolCluster {
  /**
   * @param {Object.<string, Object>} dependencies - The connections of provides, key is interface name of provider, value is an object.
   */
  constructor() {
    if (PoolCluster.instance) {
      return PoolCluster.instance;
    }

    /** @type {Pool[]} */
    this.pools = Object.create(null);
    PoolCluster.instance = this;
  }

  /**
   * Add dependency to the dependencies.
   * @param {string} dependency - The interface name of the provider.
   * @returns {null}
   */
  addPool(dependency, timeout = 600) {
    if (dependency in this.pools) {
      return;
    }

    this.pools[dependency] = new Pool({ timeout });
  }

  /**
   *
   * @param {string} dependency - The interface name of the provider.
   * @param {string} address -  The address of the provider.
   * @param {Object} connection - The connection instance of the provider.
   * @returns {null}
   */
  addConnection(dependency, host, port) {
    const pool = this.pools[dependency];
    pool.addConnection(host, port);
  }

  /**
   *
   * @param {string} dependency - The interface name of the provider.
   * @returns {null | Object.<string, Connection>} - Returns an object of connections, key is address,
   * and value is the instance of Connection.
   */
  getConnections(dependency) {
    if (!(dependency in this.pools)) {
      return null;
    }
    const pool = this.pools[dependency];
    return [pool.getIdleConnections(), pool.getBusyConnections()];
  }

  getAvailableConnection(dependency) {
    const pool = this.pools[dependency];
    return pool.getAvailableConnection();
  }

  releaseConnectionOfAPool(dependency, conn) {
    const pool = this.pools[dependency];
    pool.release(conn);
  }

  /**
   *
   * @param {string} dependency - The interface name of the provider.
   * @param {string} address -  The address of the provider.
   */
  removePool(dependency) {
    if (!(dependency in this.pools)) {
      return;
    }
    delete this.pools[dependency];
  }

  removeConnectionOfAPool(dependency, conn) {
    if (!(dependency in this.pools)) {
      return;
    }

    const pool = this.pools[dependency];
    pool.removeConnection(conn);
  }
}

module.exports = PoolCluster;
