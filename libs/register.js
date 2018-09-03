"use strict";

const url = require("url");
const os = require("os");
const Path = require("path");

const CREATE_MODES = {
  /**
   * The znode will not be automatically deleted upon client's disconnect.
   */
  PERSISTENT: 0,

  /**
   * The znode will not be automatically deleted upon client's disconnect,
   * and its name will be appended with a monotonically increasing number.
   */
  PERSISTENT_SEQUENTIAL: 2,

  /**
   * The znode will be deleted upon the client's disconnect.
   */
  EPHEMERAL: 1,

  /**
   * The znode will be deleted upon the client's disconnect, and its name
   * will be appended with a monotonically increasing number.
   */
  EPHEMERAL_SEQUENTIAL: 3
};

function isLoopback(addr) {
  return (
    /^(::f{4}:)?127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/.test(addr) ||
    /^fe80::1$/.test(addr) ||
    /^::1$/.test(addr) ||
    /^::$/.test(addr)
  );
}

function ip() {
  const interfaces = os.networkInterfaces();
  return Object.keys(interfaces)
    .map(function(nic) {
      const addresses = interfaces[nic].filter(function(details) {
        return details.family.toLowerCase() === "ipv4" && !isLoopback(details.address);
      });
      return addresses.length ? addresses[0].address : undefined;
    })
    .filter(Boolean)[0];
}

//检查consumer目录是否存在
function createConsumers(client, path) {
  return new Promise(function(resolve, reject) {
    const cpath = Path.dirname(path);
    client.exists(cpath, function(err, stat) {
      if (err) {
        reject(err);
        return;
      }
      if (stat) {
        //存在直接返回
        resolve();
        return;
      }
      //创建consumers目录节点
      client.create(cpath, CREATE_MODES.PERSISTENT, function(err, node) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  });
}
function consumer() {
  const self = this;
  const paths = [];
  const host = ip();

  const dependencies = self.dependencies;
  let serv; //临时存储服务

  const info = {
    protocol: "consumer",
    slashes: "true",
    host: "",
    query: {
      application: self.name,
      category: "consumers",
      check: "false",
      dubbo: self.dver,
      interface: "",
      revision: "",
      version: "",
      side: "consumer",
      timestamp: new Date().getTime()
    }
  };

  for (const s in dependencies) {
    if (dependencies.hasOwnProperty(s)) {
      serv = dependencies[s];
    }
    info.host = `${host}/${serv.interface}`;

    info.query.interface = serv.interface;
    info.query.revision = serv.version;
    info.query.version = serv.version;
    info.query.group = serv.group;
    paths.push(`/${self.root}/${serv.interface}/consumers/${encodeURIComponent(url.format(info))}`);
  }

  for (let i = 0, l = paths.length; i < l; i++) {
    (function(path) {
      //检查consumers目录状态，确保存在之后再创建consumers目录下面的节点
      createConsumers(self.client, path)
        .then(function() {
          self.client.exists(path, function(err, stat) {
            if (err) {
              console.error("Reg consumer failed:" + err.stack);
              return;
            }

            if (stat) {
              console.log("Node exists.");
              return;
            }
            self.client.create(path, CREATE_MODES.EPHEMERAL, function(err, node) {
              if (err) {
                console.error("Failed to register consumer node:" + err.stack);
              }
            });
          });
        })
        .catch(function(err) {
          //创建consumers失败
          console.error("failed to create consumer node: " + err.stack);
        });
    })(paths[i]);
  }
}

exports.consumer = consumer;
