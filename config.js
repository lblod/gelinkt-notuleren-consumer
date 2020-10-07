// package-lock.json variables
let service = require('./package-lock.json');
const SERVICE_NAME = service.name;
const SERVICE_VERSION = service.version;

// debug
const DEBUG = process.env.DEBUG || false;

// app configuration
const INGEST_INTERVAL = process.env.INGEST_INTERVAL || -1;
const SYNC_BASE_URL = process.env.SYNC_BASE_URL || 'https://leidinggevenden.lblod.info';
const SYNC_FILES_PATH = process.env.SYNC_FILES_PATH || '/sync/functionarissen/files';
const SYNC_FILES_ENDPOINT = `${SYNC_BASE_URL}${SYNC_FILES_PATH}`;
const DOWNLOAD_FILE_PATH = process.env.DOWNLOAD_FILE_PATH || '/files/:id/download';
const DOWNLOAD_FILE_ENDPOINT = `${SYNC_BASE_URL}${DOWNLOAD_FILE_PATH}`;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;
const PUBLIC_GRAPH = process.env.PUBLIC_GRAPH || 'http://mu.semte.ch/graphs/public';
const TMP_INGEST_GRAPH = process.env.TMP_INGEST_GRAPH || 'http://mu.semte.ch/graphs/tmp-ingest-gelinkt-notuleren-functionarissen-consumer';

export {
  SERVICE_NAME,
  SERVICE_VERSION,
  DEBUG,
  INGEST_INTERVAL,
  SYNC_BASE_URL,
  SYNC_FILES_ENDPOINT,
  DOWNLOAD_FILE_ENDPOINT,
  BATCH_SIZE,
  PUBLIC_GRAPH,
  TMP_INGEST_GRAPH
};