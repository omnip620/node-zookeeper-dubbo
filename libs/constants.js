"use strict";
const MAGIC_HI = 0xda;
const MAGIC_LO = 0xbb;
const FLAG_REQUEST = 0x80;
const FLAG_TWOWAY = 0x40;
const FLAG_EVENT = 0x20;

const Response = {
  OK: 20,
  CLIENT_TIMEOUT: 30,
  SERVER_TIMEOUT: 31,
  BAD_REQUEST: 40,
  BAD_RESPONSE: 50,
  SERVICE_NOT_FOUND: 60,
  SERVICE_ERROR: 70,
  SERVER_ERROR: 80,
  CLIENT_ERROR: 90
};

const SERIALIZATION = {
  hessian2: 2
};

module.exports = {
  MAGIC_HI,
  MAGIC_LO,
  FLAG_EVENT,
  FLAG_TWOWAY,
  FLAG_REQUEST,
  Response,
  SERIALIZATION
};
