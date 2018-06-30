/**
 * Different codes match different error type
 * 1xx ConnectionPoolError
 */
"use strict";

const EXCEPTIONS = {
  NO_AVAILABLE_WORKER: "NO_AVAILABLE_WORKER"
};

const EXCEPTIONS_MAP = {
  NO_AVAILABLE_WORKER: { code: "100", message: "no available connection" }
};

class ConnectionPoolError extends Error {
  constructor(key, code, message, name) {
    super();
    const exception = EXCEPTIONS_MAP[key];

    if (!exception) {
      this.name = "Unknown error";
    } else {
      this.code = code || exception.code;
      this.message = message || exception.message;
      this.name = "ConnectionPoolError";
    }
  }
}

module.exports = { EXCEPTIONS, ConnectionPoolError };
