/**
 * Created by panzhichao on 16/6/30.
 */
'use strict';

const url = require('url');
const os  = require('os');

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
  return /^(::f{4}:)?127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/
      .test(addr) ||
    /^fe80::1$/.test(addr) ||
    /^::1$/.test(addr) ||
    /^::$/.test(addr);
}

function ip() {
  const interfaces = os.networkInterfaces();
  return Object.keys(interfaces).map(function (nic) {
    const addresses = interfaces[nic].filter(function (details) {
      return details.family.toLowerCase() === 'ipv4' && !isLoopback(details.address);
    });
    return addresses.length ? addresses[0].address : undefined;
  }).filter(Boolean)[0];
}

function consumer() {
  const self  = this;
  const paths = [];
  const host  = ip();

  const dependencies = self.dependencies;
  let serv; //临时存储服务

  const info = {
    protocol: 'consumer',
    slashes : 'true',
    host    : '',
    query   : {
      application: self.application.name,
      category   : 'consumers',
      check      : 'false',
      dubbo      : self.dubboVer,
      interface  : '',
      revision   : '',
      version    : '',
      side       : 'consumer',
      timestamp  : (new Date()).getTime()
    }
  };

  for (const s in dependencies) {
    if (dependencies.hasOwnProperty(s)) {
      serv = dependencies[s];
    }
    info.host = `${host}/${serv.interface}`;

    info.query.interface = serv.interface;
    info.query.revision  = serv.version;
    info.query.version   = serv.version;
    paths.push(`/dubbo/${serv.interface}/consumers/${encodeURIComponent(url.format(info))}`);
  }

  for (let i = 0, l = paths.length; i < l; i++) {
    (function (path) {
      self.client.exists(path, function (err, stat) {
        if (err) {
          console.log(err.stack);
          return;
        }

        if (stat) {
          console.log('Node exists.');
          return;
        }
        self.client.create(path, CREATE_MODES.EPHEMERAL, function (err, node) {
          if (err) {
            console.error('Reg consumer failed:' + err.stack);
          }
        });
      });
    })(paths[i]);
  }
}

exports.consumer = consumer;
