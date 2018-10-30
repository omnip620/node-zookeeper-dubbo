"use strict";
const chalk = require("chalk");

let nextTick;
if (typeof setImmediate === "function") {
  nextTick = setImmediate;
} else if (typeof process === "object" && process && process.nextTick) {
  nextTick = process.nextTick;
} else {
  nextTick = cb => {
    setTimeout(cb, 0);
  };
}

function nodeify(promise, cb) {
  if (typeof cb !== "function") {
    return promise;
  }

  return promise
    .then(res => {
      nextTick(() => {
        cb(null, res);
      });
    })
    .catch(err => {
      cb(err);
    });
}
function nodeifySelf(cb) {
  return nodeify(this, cb);
}

Object.assign(Promise.prototype, {
  nodeify: nodeifySelf
});

const co = genfun => {
  const gen = genfun();
  const next = value => {
    const ret = gen.next(value);
    if (ret.done) return;
    ret.value((err, val) => {
      if (err) {
        return console.error(err);
      }
      return next(val);
    });
  };
  next();
};

const log = (color, args) => console.log(chalk[color](args));
const print = Object.create(null);
print.warn = (...args) => log("yellow", args);
print.err = (...args) => log("red", args);
print.info = (...args) => log("green", args);

const noop = () => {};
module.exports = {
  nodeify,
  co,
  print,
  noop
};
