import { app, errorHandler } from 'mu';
import fetch from 'node-fetch';
import { INGEST_INTERVAL, SERVICE_NAME, SERVICE_VERSION } from './statics';
import { waitForDatabase } from './lib/database';

waitForDatabase().then(async () => {
  // TODO if there where running task, we assume they failed mid processing
  if (INGEST_INTERVAL > 0) {
    // If an ingest interval was given, start ingesting at the given interval
    (function ingest() {
      console.log(`Executing scheduled ingestion at ${new Date().toISOString()}`);
      fetch('http://localhost/ingest/', {method: 'POST'});
      setTimeout(ingest, INGEST_INTERVAL)
    })();
  }
});

app.get('/', function(req, res) {
  res.send(`Hello, you have reached ${SERVICE_NAME} v${SERVICE_VERSION}! I'm doing just fine ^^`);
});

app.post('/ingest', async function(req, res, next) {
  console.log('creating a sync-task');
  // TODO Start by creating a sync-task

  // TODO retrieve the first sync-task
  //  - process this sync-task
  //  - if success, set to done
  //  - if failure, set failure
});

app.use(errorHandler);