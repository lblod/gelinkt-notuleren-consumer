import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { sparqlEscapeDateTime, sparqlEscapeString, sparqlEscapeUri, uuid } from 'mu';
import {
  DELTA_ERROR_TYPE,
  ERROR_TYPE,
  ERROR_URI_PREFIX,
  JOBS_GRAPH,
  JOB_CREATOR_URI,
  JOB_TYPE,
  JOB_URI_PREFIX,
  PREFIXES,
  SERVICE_NAME,
  STATUS_BUSY,
  MAX_DB_RETRY_ATTEMPTS,
  SLEEP_TIME_AFTER_FAILED_DB_OPERATION
} from '../config.js';


export function exponentialGrowth(initial, rate, interval) {
  return Math.round((initial * Math.pow(1 + rate, interval)));
}

export async function storeError(errorMsg) {
  const id = uuid();
  const uri = ERROR_URI_PREFIX + id;

  const queryError = `
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX oslc: <http://open-services.net/ns/core#>

    INSERT DATA {
      GRAPH ${sparqlEscapeUri(JOBS_GRAPH)} {
        ${sparqlEscapeUri(uri)} a ${sparqlEscapeUri(ERROR_TYPE)}, ${sparqlEscapeUri(DELTA_ERROR_TYPE)} ;
          mu:uuid ${sparqlEscapeString(id)} ;
          oslc:message ${sparqlEscapeString('[' + SERVICE_NAME + '] ' + errorMsg)} .
      }
    }
  `;

  await update(queryError);
}

export async function getJobs(jobOperationUri, statusFilterIn = [], statusFilterNotIn = []){
  let statusFilterInString = '';

  if(statusFilterIn.length){
    const escapedFilters = statusFilterIn.map(s => sparqlEscapeUri(s)).join(', ');
    statusFilterInString = `FILTER(?status IN (${escapedFilters}))`;
  }

  let statusFilterNotInString = '';
  if(statusFilterNotIn.length){
    const escapedFilters = statusFilterNotIn.map(s => sparqlEscapeUri(s)).join(', ');
    statusFilterNotInString = `FILTER(?status NOT IN (${escapedFilters}))`;
  }

  const queryIsActive = `
    ${PREFIXES}

    SELECT ?jobUri {
      GRAPH ?g {
        ?jobUri a ${sparqlEscapeUri(JOB_TYPE)}.
        ?jobUri task:operation ${sparqlEscapeUri(jobOperationUri)}.
        ?jobUri adms:status ?status.

        ${statusFilterInString}
        ${statusFilterNotInString}
      }
    }
  `;
  const result = await query(queryIsActive);
  return result.results.bindings.length ? result.results.bindings.map( r => { return { jobUri: r.jobUri.value }; }) : [];
}

export async function cleanupJobs(jobs){
  for(const job of jobs){
    const cleanupQuery = `
      ${PREFIXES}

      DELETE {
        GRAPH ?g {
          ?job ?jobP ?jobO.
          ?task ?taskP ?taskO.
        }
      }
      WHERE {
        BIND(${sparqlEscapeUri(job.jobUri)} as ?job)
        GRAPH ?g {
          ?job ?jobP ?jobO.
          OPTIONAL {
            ?task dct:isPartOf ?job.
            ?task ?taskP ?taskO.
          }
        }
      }
    `;
    await update(cleanupQuery);
  }
}


export async function createJob(jobOperationUri){
  const jobId = uuid();
  const jobUri = JOB_URI_PREFIX + `${jobId}`;
  const created = new Date();
  const createJobQuery = `
    ${PREFIXES}
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(JOBS_GRAPH)}{
        ${sparqlEscapeUri(jobUri)} a ${sparqlEscapeUri(JOB_TYPE)};
          mu:uuid ${sparqlEscapeString(jobId)};
          dct:creator ${sparqlEscapeUri(JOB_CREATOR_URI)};
          adms:status ${sparqlEscapeUri(STATUS_BUSY)};
          dct:created ${sparqlEscapeDateTime(created)};
          dct:modified ${sparqlEscapeDateTime(created)};
          task:operation ${sparqlEscapeUri(jobOperationUri)}.
      }
    }
  `;

  await update(createJobQuery);

  return jobUri;
}

export function isInverse(predicate) {
  return predicate && predicate.startsWith('^');
}

export function sparqlEscapePredicate(predicate) {
  return isInverse(predicate) ? `^<${predicate.slice(1)}>` : `<${predicate}>`;
}

export async function execDBOperationWithRetry(callback,
                                               attempt = 0,
                                               maxAttempts = MAX_DB_RETRY_ATTEMPTS,
                                               sleepTimeOnFail = SLEEP_TIME_AFTER_FAILED_DB_OPERATION) {
  try {
    return await callback();
  }
  catch(e){
    console.log(`Operation failed for ${callback.toString()}, attempt: ${attempt} of ${maxAttempts}`);
    console.log(`Error: ${e}`);
    console.log(`Sleeping ${sleepTimeOnFail} ms`);

    if(attempt >= maxAttempts){
      console.log(`Max attempts reached for ${callback.toString()}, giving up`);
      throw e;
    }

    await new Promise(r => setTimeout(r, sleepTimeOnFail));
    return execDBOperationWithRetry(callback, ++attempt, maxAttempts, sleepTimeOnFail);
  }
}
