let TYPES = require('/config/types.json');

// CONFIGURATION
const SYNC_BASE_URL = process.env.SYNC_BASE_URL;
const SERVICE_NAME = process.env.SERVICE_NAME;
const SYNC_FILES_PATH = process.env.SYNC_FILES_PATH || '/sync/files';
const DOWNLOAD_FILE_PATH = process.env.DOWNLOAD_FILE_PATH || '/files/:id/download';
const INGEST_INTERVAL = process.env.INGEST_INTERVAL || -1;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;
const PUBLIC_GRAPH = process.env.PUBLIC_GRAPH || 'http://mu.semte.ch/graphs/public';
const TMP_INGEST_GRAPH = process.env.TMP_INGEST_GRAPH || `http://mu.semte.ch/graphs/tmp-ingest-${SERVICE_NAME}`;
const START_FROM_DELTA_TIMESTAMP = process.env.START_FROM_DELTA_TIMESTAMP;
const DELTA_FILE_FOLDER = process.env.DELTA_FILE_FOLDER || '/tmp/';
const KEEP_DELTA_FILES = process.env.KEEP_DELTA_FILES == 'true';

if(!SERVICE_NAME){
  throw "SERVICE_NAME is required. Please provide one.";
}

// STATICS
const SYNC_FILES_ENDPOINT = `${SYNC_BASE_URL}${SYNC_FILES_PATH}`;
const DOWNLOAD_FILE_ENDPOINT = `${SYNC_BASE_URL}${DOWNLOAD_FILE_PATH}`;

export {
  SERVICE_NAME,
  INGEST_INTERVAL,
  SYNC_BASE_URL,
  SYNC_FILES_ENDPOINT,
  DOWNLOAD_FILE_ENDPOINT,
  BATCH_SIZE,
  PUBLIC_GRAPH,
  TMP_INGEST_GRAPH,
  START_FROM_DELTA_TIMESTAMP,
  TYPES,
  KEEP_DELTA_FILES,
  DELTA_FILE_FOLDER
};
