import fs from 'fs-extra';
import path from 'path';
import fetch from 'node-fetch';
import { sparqlEscapeString, sparqlEscapeUri } from 'mu';
import { updateSudo as update } from '@lblod/mu-auth-sudo';
import { sparqlEscapePredicate } from './utils';
import {
  DOWNLOAD_FILE_ENDPOINT,
  BATCH_SIZE,
  PUBLIC_GRAPH,
  TMP_INGEST_GRAPH,
  TYPES,
  KEEP_DELTA_FILES,
  DELTA_FILE_FOLDER
} from '../config';

fs.ensureDirSync(DELTA_FILE_FOLDER);

export default class DeltaFile {
  constructor(data) {
    /** Id of the delta file */
    this.id = data.id;
    /** Creation datetime of the delta file */
    this.created = data.attributes.created;
    /** Name of the delta file */
    this.name = data.attributes.name;
  }

  /**
   * Public endpoint to download the delta file from based on its id
   */
  get downloadUrl() {
    return DOWNLOAD_FILE_ENDPOINT.replace(':id', this.id);
  }

  /**
   * Location to store the delta file during processing
   */
  get deltaFilePath() {
    return path.join(DELTA_FILE_FOLDER,`${this.created}-${this.id}.json`);
  }

  /**
   * Trigger consumption of a delta file.
   * I.e. processing the insert/delete changesets and applying the changes
   * in the triple store taking into account the authorization rules.
   *
   * @param {function} onFinishCallback Callback executed when the processing of the delta file finished,
   *                         either successfully or unsuccessfully.
   *                         The callback function receives 2 arguments:
   *                         - the delta file object
   *                         - a boolean indicating success (true) or failure (false)
   * @method consume
   * @public
   */
  async consume(onFinishCallback) {
    const writeStream = fs.createWriteStream(this.deltaFilePath);
    writeStream.on('finish', () => this.ingest(onFinishCallback));

    try {
      const response = await fetch(this.downloadUrl);
      response.body.pipe(writeStream);
    } catch (e) {
      console.log(`Something went wrong while consuming the file ${this.id} from ${this.downloadUrl}`);
      console.log(e);
      await onFinishCallback(this, false);
    }

  }

  /**
   * Process the insert/delete changesets and apply the changes
   * in the triple store taking into account the authorization rules.
   *
   * @param {function} onFinishCallback Callback executed when the processing of the delta file finished,
   *                         either successfully or unsuccessfully.
   *                         The callback function receives 2 arguments:
   *                         - the delta file object
   *                         - a boolean indicating success (true) or failure (false)
   * @method ingest
   * @private
   */
  async ingest(onFinishCallback) {
    console.log(`Start ingesting file ${this.id} stored at ${this.deltaFilePath}`);
    try {
      const changeSets = await fs.readJson(this.deltaFilePath, {encoding: 'utf-8'});
      for (let {inserts, deletes} of changeSets) {
        console.log(`Deleting data in all graphs`);
        await deleteTriplesInAllGraphs(deletes);
        console.log(`Inserting data in temporary graph <${TMP_INGEST_GRAPH}>`);
        await insertTriplesInTmpGraph(inserts);
      }
      console.log(`Moving data from temporary graph <${TMP_INGEST_GRAPH}> to relevant application graphs.`);
      await moveTriplesFromTmpGraph();
      console.log(`Successfully finished ingesting file ${this.id} stored at ${this.deltaFilePath}`);
      await onFinishCallback(this, true);

      if(!KEEP_DELTA_FILES){
        await fs.unlink(this.deltaFilePath);
      }
    } catch (e) {
      console.log(`Something went wrong while ingesting file ${this.id} stored at ${this.deltaFilePath}`);
      console.log(e);
      await onFinishCallback(this, false);
    }
  }
}

/**
 * Insert the list of triples in a temporary graph in the store
 *
 * @param {Array} triples Array of triples from an insert changeset
 * @method insertTriplesInTmpGraph
 * @private
 */
async function insertTriplesInTmpGraph(triples) {
  for (let i = 0; i < triples.length; i += BATCH_SIZE) {
    console.log(
        `Inserting ${triples.length} triples in temporary graph in batches. Current batch: ${i}-${i + BATCH_SIZE}`);
    const batch = triples.slice(i, i + BATCH_SIZE);
    const statements = toStatements(batch);
    await update(`
      INSERT DATA {
          GRAPH <${TMP_INGEST_GRAPH}> {
              ${statements}
          }
      }
    `);
  }
}

/**
 * Delete the triples from the given list from all graphs in the store, including the temporary graph.
 * Note: Triples are deleted one by one to avoid the need to use OPTIONAL in the WHERE clause
 *
 * @param {Array} triples Array of triples from an insert changeset
 * @method insertTriplesInTmpGraph
 * @private
 */
async function deleteTriplesInAllGraphs(triples) {
  console.log(`Deleting ${triples.length} triples one by one in all graphs`);
  for (let i = 0; i < triples.length; i++) {
    const statements = toStatements([triples[i]]);
    await update(`
      DELETE WHERE {
          GRAPH ?g {
              ${statements}
          }
      }
    `);
  }
}

/**
 * Move triples from the temporary graph to the appropriate application graphs taking
 * the application's authorization rules into account.
 * Note: a change on the authorization rules of the application requires a revisit of this function
 *
 * @method moveTriplesFromTmpGraph
 * @private
 */
async function moveTriplesFromTmpGraph() {
  // Move public data to the public graph
  for (let config of TYPES.filter(config => !config.pathToOrg)) {
    await update(`
    DELETE {
        GRAPH <${TMP_INGEST_GRAPH}> {
            ?s ?p ?o .
        }
    }
    INSERT {
        GRAPH <${PUBLIC_GRAPH}> {
            ?s ?p ?o .
        }
    } WHERE {
        ?s a <${config.type}>.
        GRAPH <${TMP_INGEST_GRAPH}> {
            ?s ?p ?o .
        }
    }`);
  }

  // Move organisational data to the correct organisation graph
  for (let config of TYPES.filter(config => !!config.pathToOrg)) {
    const predicatePath = config.pathToOrg.map(p => sparqlEscapePredicate(p)).join('/');
    await update(`
    DELETE {
        GRAPH <${TMP_INGEST_GRAPH}> {
            ?s ?p ?o .
        }
    }
    INSERT {
        GRAPH ?organizationalGraph {
            ?s ?p ?o .
        }
    } WHERE {
        ?s a <${config.type}>.
        GRAPH <${TMP_INGEST_GRAPH}> {
              ?s ?p ?o .
        }
        ?s ${predicatePath} ?organization .
        GRAPH <${PUBLIC_GRAPH}> {
            ?organization <http://mu.semte.ch/vocabularies/core/uuid> ?organizationUuid .
        }
        BIND(IRI(CONCAT("http://mu.semte.ch/graphs/organizations/", ?organizationUuid)) as ?organizationalGraph)
    }`);
  }
}

/**
 * Transform an array of triples to a string of statements to use in a SPARQL query
 *
 * @param {Array} triples Array of triples to convert
 * @method toStatements
 * @private
 */
function toStatements(triples) {
  const escape = function(rdfTerm) {
    const {type, value, datatype, 'xml:lang': lang} = rdfTerm;
    if (type === 'uri') {
      return sparqlEscapeUri(value);
    } else if (type === 'literal' || type === 'typed-literal') {
      if (datatype)
        // value can also be a number, depending on the whims of virtuoso's json output,
        // the whims of the "mu" helper lib, or, I don't know, the weather.
        // note: this does not mean that all numbers come in as numbers of course, that would
        // be too easy.
        // Depending on whether the producing side used a SELECT or a CONSTRUCT query,
        // numbers can be represented either as strings or as json numerals
        // So we call `toString`, close our eyes, and go to our happy place.
        return `${sparqlEscapeString(value.toString())}^^${sparqlEscapeUri(datatype)}`;
      else if (lang)
        return `${sparqlEscapeString(value.toString())}@${lang}`;
      else
        return `${sparqlEscapeString(value.toString())}`;
    } else
      console.log(`Don't know how to escape type ${type}. Will escape as a string.`);
    return sparqlEscapeString(value.toString());
  };
  return triples.map(function(t) {
    const subject = escape(t.subject);
    const predicate = escape(t.predicate);
    const object = escape(t.object);
    return `${subject} ${predicate} ${object} . `;
  }).join('');
}
