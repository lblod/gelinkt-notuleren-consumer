import { app, errorHandler } from 'mu';
import fetch from 'node-fetch';
import { INGEST_INTERVAL, SERVICE_NAME } from './config';
import { waitForDatabase } from './lib/database';
import { getNextSyncTask, getRunningSyncTask, scheduleSyncTask, setTaskFailedStatus } from './lib/sync-task';

waitForDatabase().then(async () => {
  const runningTask = await getRunningSyncTask();
  if (runningTask) {
    console.log(`Task <${runningTask.uri.value}> is still ongoing at startup. Updating its status to failed.`);
    await setTaskFailedStatus(runningTask.uri.value);
  }
  if (INGEST_INTERVAL > 0) {
    automatedIngestionScheduling();
  }
});

app.get('/', function(req, res) {
  res.send(`Hello, you have reached ${SERVICE_NAME}! I'm doing just fine ^^`);
});

function automatedIngestionScheduling() {
  console.log(`Scheduled ingestion at ${new Date().toISOString()}`);
  fetch('http://localhost/schedule-ingestion/', {method: 'POST'});
  setTimeout(automatedIngestionScheduling, INGEST_INTERVAL)
}

app.post('/schedule-ingestion', async function(req, res, next) {
  await scheduleSyncTask();

  const isRunning = await getRunningSyncTask();

  if (!isRunning) {
    const task = await getNextSyncTask();
    if (task) {
      console.log(`Start ingesting new delta files since ${task.since.toISOString()}`);
      try {
        task.execute();
        return res.status(202).end();
      } catch(e) {
        console.log(`Something went wrong while ingesting. Closing sync task with failure state.`);
        console.trace(e);
        await task.closeWithFailure();
        return next(new Error(e));
      }
    } else {
      console.log(`No scheduled sync task found. Did the insertion of a new task just fail?`);
      return res.status(200).end();
    }
  } else {
    console.log('A sync task is already running. A new task is scheduled and will start when the previous task finishes.');
    return res.status(409).end();
  }
});

app.use(errorHandler);