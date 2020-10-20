# gelinkt-notuleren-consumer

Configurable consumer to sync data from external sources based on diff files generated by a producer. An example
producer can be found [here](http://github.com/lblod/mandatendatabank-mandatarissen-producer).

At regular intervals the consumer checks for new diff files and ingests the data found within. The data is ingested
in the appropriate graphs according to the authorization rules.

## Tutorials

### Add the service to a stack

1) Add the service to your `docker-compose.yml`:

    ```yaml
    consumer:
      image: lblod/gelinkt-notuleren-consumer
      environment:
        SERVICE_NAME: 'your-custom-consumer-identifier' # replace with the desired consumer identifier
        SYNC_BASE_URL: 'http://base-sync-url # replace with link the application hosting the producer server
      volumes:
        - ./config/consumer/:/config/ # replace with path to types configuration
    ```

2) Change the `SERVICE_NAME` to the desired consumer identifier.
    - Is important as it is used to ensure persistence.

3) Change the `SYNC_BASE_URL` to the application hosting the producer server.

4) Create a `config/consumer/types.js` configuration file. It will define an array off desired types to be ingested by
   the consumer:

    ```json
    [
      {
        "type": "http://www.w3.org/ns/person#Person"
      },
      {
        "type": "http://www.w3.org/ns/person#Person",
        "pathToOrg": [
           "http://www.w3.org/ns/org#holds",
           "^http://www.w3.org/ns/org#hasPost"
        ]
      }
   ]
   ```
   each type is represented by a simple object definition:

    - `"type"` : the full URI of a type we would like to ingest
    - `"pathToOrg"` : **OPTIONAL** array of URI's that construct a path to a linked organization. Used to constuct the
      organization graph to insert the triples in.

### Automate the scheduling of sync-tasks

to achieve this we can simple add a `INGEST_INTERVAL` env. variable

```yaml
 consumer:
   image: lblod/gelinkt-notuleren-consumer
   environment:
     INGEST_INTERVAL: 60000 # each minute
```

### API

> **GET** `/`
>
> simple "hello-world" endpoint, returns the current running version for the true geeks

> **POST** `/schedule-ingestion`
>
> Schedule and execute a sync task.

## Configuration

The following environment variables are required:

- `SERVICE_NAME`: consumer identifier. important as it is used to ensure persistence.
- `SYNC_BASE_URL`: base URL of the stack hosting the producer API (e.g. http://mandaten.lblod.info/)

The following environment variables are optional:

- `SYNC_FILES_PATH (default: /sync/files)`: relative path to the endpoint to retrieve names of the diff files from
- `DOWNLOAD_FILES_PATH (default: /files/:id/download)`: relative path to the endpoint to download a diff file
  from. `:id` will be replaced with the uuid of the file.
- `INGEST_INTERVAL (in ms, default: -1)`: interval at which the consumer needs to sync data automatically. If negative,
  sync can only be triggered manually via the API endpoint.
- `START_FROM_DELTA_TIMESTAMP (ISO datetime, default: now)`: timestamp to start sync data from (e.g. "2020-07-05T13:57:
  36.344Z")
- `PUBLIC_GRAPH (default: http://mu.semte.ch/graphs/public)`: public graph in which all public data and sync tasks will
  be ingested
- `TMP_INGEST_GRAPH (default: http://mu.semte.ch/graphs/tmp-ingest-gelinkt-notuleren-mandatarissen-consumer)`: temporary
  graph in which all insert changesets are ingested before they're moved to the appropriate graphs according to the
  authorization rules.

### Model

#### Used prefixes

| Prefix | URI                                                       |
|--------|-----------------------------------------------------------|
| dct    | http://purl.org/dc/terms/                                 |
| adms   | http://www.w3.org/ns/adms#                                |
| ext    | http://mu.semte.ch/vocabularies/ext                       |

#### Sync task

##### Class

`ext:SyncTask`

##### Properties

| Name       | Predicate        | Range           | Definition                                                                                                                                   |
|------------|------------------|-----------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| status     | `adms:status`    | `adms:Status`   | Status of the sync task, initially set to `<http://lblod.data.gift/gelinkt-notuleren-mandatarissen-consumer-sync-task-statuses/not-started>` |
| created    | `dct:created`    | `xsd:dateTime`  | Datetime of creation of the task                                                                                                             |
| creator    | `dct:creator`    | `rdfs:Resource` | Creator of the task, in this case the mandatendatabank-consumer `<http://lblod.data.gift/services/gelinkt-notuleren-mandatarissen-consumer>` |
| deltaUntil | `ext:deltaUntil` | `xsd:dateTime`  | Datetime of the latest successfully ingested sync file as part of the task execution                                                         |

#### Sync task statuses

The status of the sync task will be updated to reflect the progress of the task. The following statuses are known:

* http://lblod.data.gift/gelinkt-notuleren-mandatarissen-consumer-sync-task-statuses/not-started
* http://lblod.data.gift/gelinkt-notuleren-mandatarissen-consumer-sync-task-statuses/ongoing
* http://lblod.data.gift/gelinkt-notuleren-mandatarissen-consumer-sync-task-statuses/success
* http://lblod.data.gift/gelinkt-notuleren-mandatarissen-consumer-sync-task-statuses/failure

### Data flow

At regular intervals, the service will schedule a sync task. Execution of a task consists of the following steps:

1. Retrieve the timestamp to start the sync from
2. Query the producer service for all diff files since that specific timestamp
3. Download the content of each diff file
4. Process each diff file in order

During the processing of a diff file, the insert and delete changesets are processed in a different way

**Insert changeset**
Ingest the changeset in a temporary graph `TMP_INGEST_GRAPH`. Data cannot be ingested directly in the appropriate graph(
s) since info to determine the correct graphs (e.g. the `rdf:type`) may still be missing.

**Delete changeset**
Apply a delete query triple per triple across all graphs (including the temporary graph)

At the end of each diff file processing, queries are executed to move data from the temporary graph to the appropriate
graphs based on the `rdf:type` and authorization rules. This movement
operation (`./lib/delta-file/moveTriplesFromTmpGraph()`) contains the most important part of the consumer service. If
the application's authorization rules change, this function needs to be revisited.

If one file fails to be ingested, the remaining files in the queue are blocked since the files must always be handled in
order.

The service makes 2 core assumptions that must be respected at all times:

1. At any moment we know that the latest `ext:deltaUntil` timestamp on a task, either in failed/ongoing/success state,
   reflects the timestamp of the latest delta file that has been completly and successfully consumed
2. Maximum 1 sync task is running at any moment in time

#### This implementation is a configurable fork of [gelinkt-notuleren-mandatarissen-consumer](https://github.com/lblod/gelinkt-notuleren-mandatarissen-consumer)
