import fs from 'fs-extra';
import path from 'path';
import fetch from 'node-fetch';

import {
  SYNC_BASE_URL,
  SYNC_DATASET_ENDPOINT,
  DOWNLOAD_FILE_ENDPOINT,
  DUMPFILE_FOLDER,
  SYNC_FILES_PATH,
  SYNC_DATASET_SUBJECT
} from '../../config';

const BASEPATH = path.join(SYNC_FILES_PATH, DUMPFILE_FOLDER);
fs.ensureDirSync(BASEPATH);

class DumpFile {
  constructor(distributionData, data) {
    this.id = data.id;
    this.issued = distributionData["release-date"];
  }

  get downloadUrl() {
    return DOWNLOAD_FILE_ENDPOINT.replace(':id', this.id);
  }

  get filePath() {
    return path.join(BASEPATH,`${this.id}.ttl`);
  }

  async download() {
    try {
      await fetch(this.downloadUrl)
        .then(res => new Promise((resolve, reject) => {
          const writeStream = fs.createWriteStream(this.filePath);
          res.body.pipe(writeStream);
          writeStream.on('close', () => resolve());
          writeStream.on('error', reject);
      }));
    } catch(e) {
      console.log(`Something went wrong while downloading file from ${this.downloadUrl}`);
      console.log(e);
      throw e;
    }
  }

  async load() {
    try {
      await this.download();
      const triples = fs.readFileSync(this.filePath, 'utf8').split('\n');
      console.log(`Successfully loaded file ${this.id} stored at ${this.filePath}`);
      return triples;
    }
    catch(error){
      console.log(`Something went wrong while ingesting file ${this.id} stored at ${this.filePath}`);
      console.log(error);
      throw error;
    }
  }
}

async function getLatestDumpFile() {
  try {
    console.log(`Retrieving latest dataset from ${SYNC_DATASET_ENDPOINT}`);
    const responseDataset = await fetch(
      `${SYNC_DATASET_ENDPOINT}?filter[subject]=${SYNC_DATASET_SUBJECT}&filter[:has-no:next-version]=yes`,
      {
        headers: {
          'Accept': 'application/vnd.api+json'
        }
      }
    );
    const dataset = await responseDataset.json();

    if (dataset.data.length) {
      const distributionMetaData = dataset.data[0].attributes;
      const distributionRelatedLink = dataset.data[0].relationships.distributions.links.related;
      const distributionUri = `${SYNC_BASE_URL}/${distributionRelatedLink}`;

      console.log(`Retrieving distribution from ${distributionUri}`);
      const resultDistribution = await fetch(`${distributionUri}?include=subject`, {
        headers: {
          'Accept': 'application/vnd.api+json'
        }
      });
      const distribution = await resultDistribution.json();
      return new DumpFile(distributionMetaData, distribution.data[0].relationships.subject.data);
    } else {
      throw 'No dataset was found at the producing endpoint.';
    }
  } catch (e) {
    console.log(`Unable to retrieve dataset from ${SYNC_DATASET_ENDPOINT}`);
    throw e;
  }
}

export {
  getLatestDumpFile
};
