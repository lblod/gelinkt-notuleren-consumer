// package-lock.json variables
let service = require('./package-lock.json');
const SERVICE_NAME = service.name;
const SERVICE_VERSION = service.version;

// debug
const DEBUG = process.env.DEBUG || false;

// configuration
const INGEST_INTERVAL = process.env.INGEST_INTERVAL || -1;

export {
  SERVICE_NAME,
  SERVICE_VERSION,
  DEBUG,
  INGEST_INTERVAL,
};