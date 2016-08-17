/**
 * Created by panzhichao on 16/6/30.
 */
'use strict';

const url = require('url');
const os  = require('os');
const net = require('net');

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
  let self     = this;
  let paths    = [];
  let host     = ip();
  let services = self.services;
  let serv;

  let info = {
    protocol: 'consumer',
    slashes : 'true',
    host    : '',
    query   : {
      application: 'falcon',
      category   : 'consumers',
      check      : 'false',
      dubbo      : self.dubboVer,
      interface  : '',
      revision   : self.env,
      version    : self.env,
      side       : 'consumer',
      timestamp  : (new Date()).getTime()
    }
  };

  for (let s in services) {
    if (services.hasOwnProperty(s)) {
      serv = services[s];
    }
    info.host = `${host}/${serv}`;

    info.query.interface = serv;
    paths.push(`/dubbo/${serv}/consumers/${encodeURIComponent(url.format(info))}`);
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

function provider() {
  const serviceName = 'com.pajk.falcon.service.TestService';
  const self        = this;
  const info        = {
    protocol: 'dubbo',
    slashes : 'true',
    host    : `${ip()}:20880/${serviceName}`,
    query   : {
      application: 'falcon',
      anyhost    : true,
      dubbo      : '2.5.3.6',
      interface  : serviceName,
      methods    : 'test',
      revision   : 'PZC',
      side       : 'provider',
      version    : 'PZC',
      timestamp  : (new Date()).getTime()
    }
  };

  const path = `/dubbo/${serviceName}/providers/${encodeURIComponent(url.format(info))}`;

  self.client.exists(path, function (err, stat) {
    if (err) {
      console.log(err.stack);
      return;
    }

    if (stat) {
      console.log('Node exists.');
      return;
    }

    self.client.mkdirp(`/dubbo/${serviceName}/providers`, function (err, dir) {
      if (err) {
        console.log(err.stack);
        return;
      }
      self.client.create(path, CREATE_MODES.EPHEMERAL, function (err, node) {
        if (err) {
          console.log(err.stack);
          return;
        }

        console.log(`${node} is created`);
        handleProvider.call(self);
      });
    });
  });
}

function handleProvider() {
  const server = net.createServer(function (socket) {
    socket.on('data', function (data) {
      console.log(data);
    });

    socket.on('error', function (data) {
      console.log('error', data);
    })
  });
  server.listen(20880, function () {
    console.log('listen 20880');
  });
}

exports.consumer = consumer;
exports.provider = provider;
