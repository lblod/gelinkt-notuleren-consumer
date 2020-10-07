let service = require('./package-lock.json');
let TYPES = require('/config/types.json');

// CONFIGURATION
const SYNC_BASE_URL = process.env.SYNC_BASE_URL;
const SERVICE_NAME = process.env.SERVICE_NAME || service.name;
const SYNC_FILES_PATH = process.env.SYNC_FILES_PATH || '/sync/files';
const DOWNLOAD_FILE_PATH = process.env.DOWNLOAD_FILE_PATH || '/files/:id/download';
const INGEST_INTERVAL = process.env.INGEST_INTERVAL || -1;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;
const PUBLIC_GRAPH = process.env.PUBLIC_GRAPH || 'http://mu.semte.ch/graphs/public';
const TMP_INGEST_GRAPH = process.env.TMP_INGEST_GRAPH || `http://mu.semte.ch/graphs/tmp-ingest-${SERVICE_NAME}`;
const START_FROM_DELTA_TIMESTAMP = process.env.START_FROM_DELTA_TIMESTAMP;

// STATICS
const SERVICE_VERSION = service.version;
const SYNC_FILES_ENDPOINT = `${SYNC_BASE_URL}${SYNC_FILES_PATH}`;
const DOWNLOAD_FILE_ENDPOINT = `${SYNC_BASE_URL}${DOWNLOAD_FILE_PATH}`;

export {
  SERVICE_NAME,
  SERVICE_VERSION,
  INGEST_INTERVAL,
  SYNC_BASE_URL,
  SYNC_FILES_ENDPOINT,
  DOWNLOAD_FILE_ENDPOINT,
  BATCH_SIZE,
  PUBLIC_GRAPH,
  TMP_INGEST_GRAPH,
  START_FROM_DELTA_TIMESTAMP,
  TYPES,
};