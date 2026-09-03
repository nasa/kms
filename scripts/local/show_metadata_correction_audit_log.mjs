#!/usr/bin/env node

import { MongoClient } from 'mongodb'

/**
 * Prints the local DocumentDB-compatible audit documents for one collection.
 *
 * Input comes from `COLLECTION_CONCEPT_ID` and the `DOCUMENTDB_*` environment variables; output is
 * a console table with one row per matching audit run.
 *
 * @returns {Promise<void>} Resolves after the query results have been printed and the client closes.
 */
const main = async () => {
  const collectionConceptId = process.env.COLLECTION_CONCEPT_ID || 'C1234567890-LOCAL'
  const uri = process.env.DOCUMENTDB_URI
    || `mongodb://localhost:${process.env.DOCUMENTDB_HOST_PORT || 27018}`
  const databaseName = process.env.DOCUMENTDB_DATABASE_NAME || 'kms'
  const collectionName = process.env.DOCUMENTDB_AUDIT_COLLECTION_NAME
    || 'metadataCorrectionAudits'
  const client = new MongoClient(uri)

  try {
    await client.connect()
    const documents = await client.db(databaseName)
      .collection(collectionName)
      .find({ collectionConceptId })
      .sort({ createdAt: -1, _id: -1 })
      .toArray()

    console.log(`Metadata correction audit runs for ${collectionConceptId}: ${documents.length}`)
    console.table(documents.map((document) => ({
      runId: document.runId,
      collectionUri: document.collectionUri,
      createdAt: document.createdAt,
      version: document.publishedVersionName,
      status: document.status,
      nativeFormat: document.nativeFormat,
      corrections: document.corrections?.length || 0,
      priorRevisionId: document.priorRevisionId,
      resultingRevisionId: document.resultingRevisionId,
      error: document.error?.message
    })))
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error('[show-metadata-correction-audit-log] Failed to query audit log', error)
  process.exitCode = 1
})
