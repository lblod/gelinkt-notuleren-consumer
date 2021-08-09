import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { sparqlEscapeUri } from 'mu';
import {
  BATCH_SIZE_FOR_GRAPH_MOVE,
  INGEST_GRAPH,
  PUBLIC_GRAPH,
  TYPES,
  MU_SPARQL_ENDPOINT
} from '../config';
import {
  sparqlEscapePredicate,
  execDBOperationWithRetry
} from './utils';

/**
 * Move triples from the ingest graph to the appropriate org graphs taking
 * the application's authorization rules into account.
 * Note: a change on the authorization rules of the application requires a revisit of this function
 *
 * @arg extraHeaders: extra config which can be given down the mu-stack, e.g.
                       { 'mu-call-scope-id': ... }
 * @arg endpoint: string to database endpoint
 * @method moveTriplesFromIngestGraph
 * @public
 */
export async function moveTriplesFromIngestGraphToOrgGraph(extraHeaders = {}, endpoint = MU_SPARQL_ENDPOINT, batched = false, cleanUpIngestGraph = false) {
  for (let config of TYPES.filter(config => !config.pathToOrg)) {
    console.log('Moving triples public graph');
    if(batched) {
      await batchedMoveResourcesForTypeToPublicGraph(config.type, BATCH_SIZE_FOR_GRAPH_MOVE, extraHeaders, endpoint);
    }
    else {
      await moveResourcesForTypeToPublicGraph(config.type, extraHeaders, endpoint);
    }
  }

  for (let config of TYPES.filter(config => !!config.pathToOrg)) {
    console.log('Moving triples org graph');
    if(batched) {
      await batchedMoveResourcesForTypeToOrgGraph(config.type, config, BATCH_SIZE_FOR_GRAPH_MOVE, extraHeaders, endpoint);
    }
    else {
      await moveResourcesForTypeToOrgGraph(config.type, config, extraHeaders, endpoint);
    }
  }

  if(cleanUpIngestGraph){
    await cleanUp(INGEST_GRAPH, extraHeaders, endpoint);
  }
}

async function moveResourcesForTypeToPublicGraph(type,
                                                 extraHeaders,
                                                 endpoint,
                                                 sleep = 1000){
  const moveQuery = `
    DELETE {
      GRAPH <${INGEST_GRAPH}> {
        ?s ?p ?o .
      }
    }
    INSERT {
        GRAPH <${PUBLIC_GRAPH}> {
            ?s ?p ?o .
        }
    }
    WHERE {
      ?s a <${type}>.
      GRAPH <${INGEST_GRAPH}> {
        ?s ?p ?o .
      }
    }
  `;

  await execDBOperationWithRetry(async () => {
    return await update(moveQuery, extraHeaders, endpoint);
  });
  await new Promise(r => setTimeout(r, sleep));
}

async function batchedMoveResourcesForTypeToPublicGraph(type,
                                                        batchSize,
                                                        extraHeaders,
                                                        endpoint,
                                                        sleep = 1000){
  const total = await countSubjectsForType(type);
  for (let offset = 0; offset < total; offset += batchSize) {
    const batchedMoveQuery = `
      DELETE {
        GRAPH <${INGEST_GRAPH}> {
          ?s ?p ?o .
        }
      }
      INSERT {
          GRAPH <${PUBLIC_GRAPH}> {
              ?s ?p ?o .
          }
      }
      WHERE {

        {
          SELECT DISTINCT ?s WHERE {
             ?s a <${type}>.
          }
          ORDER BY ?s
          OFFSET ${offset}
          LIMIT ${batchSize}
        }

        GRAPH <${INGEST_GRAPH}> {
          ?s ?p ?o .
        }
      }
    `;

    await execDBOperationWithRetry(async () => {
      return await update(batchedMoveQuery, extraHeaders, endpoint);
    });
    await new Promise(r => setTimeout(r, sleep));
  }
}

async function moveResourcesForTypeToOrgGraph(type,
                                              typesConfig,
                                              extraHeaders,
                                              endpoint,
                                              sleep = 1000){

  const predicatePath = typesConfig.pathToOrg.map(p => sparqlEscapePredicate(p)).join('/');
  const moveQuery = `
      DELETE {
        GRAPH <${INGEST_GRAPH}> {
          ?s ?p ?o .
        }
      }
      INSERT {
        GRAPH ?organizationalGraph {
            ?s ?p ?o .
        }
      }
      WHERE {

        GRAPH <${INGEST_GRAPH}> {
          ?s ?p ?o .
        }

        ?s a <${type}>.
        ?s ${predicatePath} ?organization .

        GRAPH <${PUBLIC_GRAPH}> {
          ?organization <http://mu.semte.ch/vocabularies/core/uuid> ?organizationUuid .
        }
        BIND(IRI(CONCAT("http://mu.semte.ch/graphs/organizations/", ?organizationUuid)) as ?organizationalGraph)
      }`;

  await execDBOperationWithRetry(async () => {
    return await update(moveQuery, extraHeaders, endpoint);
  });
  await new Promise(r => setTimeout(r, sleep));
}

async function batchedMoveResourcesForTypeToOrgGraph(type,
                                                     typesConfig,
                                                     batchSize,
                                                     extraHeaders,
                                                     endpoint,
                                                     sleep = 1000){

  const predicatePath = typesConfig.pathToOrg.map(p => sparqlEscapePredicate(p)).join('/');
  const total = await countSubjectsForType(type);

  for (let offset = 0; offset < total; offset += batchSize) {
    const batchedMoveQuery = `
      DELETE {
        GRAPH <${INGEST_GRAPH}> {
          ?s ?p ?o .
        }
      }
      INSERT {
        GRAPH ?organizationalGraph {
            ?s ?p ?o .
        }
      }
      WHERE {
        {
          SELECT DISTINCT ?s WHERE {
            ?s a <${type}>.
          }
          ORDER BY ?s
          OFFSET ${offset}
          LIMIT ${batchSize}
        }

        GRAPH <${INGEST_GRAPH}> {
          ?s ?p ?o .
        }

        ?s ${predicatePath} ?organization .

        GRAPH <${PUBLIC_GRAPH}> {
          ?organization <http://mu.semte.ch/vocabularies/core/uuid> ?organizationUuid .
        }
        BIND(IRI(CONCAT("http://mu.semte.ch/graphs/organizations/", ?organizationUuid)) as ?organizationalGraph)
      }`;

    await execDBOperationWithRetry(async () => {
      return await update(batchedMoveQuery, extraHeaders, endpoint);
    });
    await new Promise(r => setTimeout(r, sleep));
  }
}

async function cleanUp(graph, extraHeaders, endpoint){
  const cleanupQuery = `
    DELETE {
      GRAPH <${graph}> {
       ?s ?p ?o.
      }
    }
    WHERE {
      GRAPH <${graph}> {
       ?s ?p ?o.
      }
    }
  `;
  return await execDBOperationWithRetry(async () => {
    return await update(cleanupQuery, extraHeaders, endpoint);
  });
}

async function countSubjectsForType(type){
  const countQuery = `
        SELECT( COUNT (  DISTINCT( ?s ) ) as ?count) WHERE {
          ?s a ${sparqlEscapeUri(type)}.
        }
      `;
  const result = await query(countQuery);

  let total = 0;
  if (result.results.bindings[0]) {
    total = parseInt(result.results.bindings[0].count.value);
  }
  return total;
}
