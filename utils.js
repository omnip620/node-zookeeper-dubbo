'use strict';

var nextTick;
if (typeof setImmediate === 'function') {
  nextTick = setImmediate;
}
else if (typeof process === 'object' && process && process.nextTick) {
  nextTick = process.nextTick;
}
else {
  nextTick = function (cb) {
    setTimeout(cb, 0);
  };
}

function nodeify(promise, cb) {
  if (typeof cb !== 'function') {
    return promise;
  }

  return promise
    .then(function (res) {
      nextTick(function () {
        cb(null, res);
      });
    })
    .catch(function (err) {
      cb(err);
    });
}
function nodeifySelf(cb) {
  return nodeify(this, cb);
}

Object.assign(Promise.prototype, {
  nodeify: nodeifySelf
});

exports.nodeify = nodeify;


