/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */

import { promises as fs } from 'fs'
import path from 'path'
import url from 'url'
import { XMLBuilder, XMLParser } from 'fast-xml-parser'

const baseUrl = `${process.env.RDF4J_SERVICE_URL || 'http://127.0.0.1:8081'}/rdf4j-server`
const repoId = 'kms'
const rdf4jUrl = `${baseUrl}/repositories/${repoId}/statements`
const username = process.env.RDF4J_USER_NAME || 'rdf4j'
const password = process.env.RDF4J_PASSWORD || 'rdf4j'
const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64')
const pullOutDir = process.env.RDF4J_PULL_OUT_DIR || path.join('setup', 'data')
const postCreateDelayMs = Number(process.env.RDF4J_POST_READY_DELAY_MS || '5000')
const loadBatchSize = Number(process.env.RDF4J_LOAD_BATCH_SIZE || '1000')
const interBatchDelayMs = Number(process.env.RDF4J_INTER_BATCH_DELAY_MS || '0')
const shouldLoadSchemes = (process.env.RDF4J_LOAD_SCHEMES || 'true').toLowerCase() !== 'false'
const serverCheckAttempts = Number(process.env.RDF4J_SERVER_CHECK_ATTEMPTS || '60')
const serverCheckDelayMs = Number(process.env.RDF4J_SERVER_CHECK_DELAY_MS || '1000')

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  isArray: (name) => name === 'skos:Concept'
})

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  format: false
})

const asArray = (value) => {
  if (value === undefined || value === null) return []

  return Array.isArray(value) ? value : [value]
}

/* eslint-disable no-restricted-syntax */
const loadExport = async () => {
  const getAuthHeader = () => `Basic ${base64Credentials}`
  const baseHeaders = {
    Authorization: getAuthHeader(),
    Connection: 'close'
  }
  // eslint-disable-next-line no-promise-executor-return
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const waitForServer = async () => {
    for (let attempt = 1; attempt <= serverCheckAttempts; attempt += 1) {
      try {
        const response = await fetch(`${baseUrl}/protocol`, {
          headers: {
            ...baseHeaders
          }
        })
        if (response.ok) {
          return
        }
      } catch {
        // retry
      }
      await sleep(serverCheckDelayMs)
    }
    throw new Error(`RDF4J server not ready after ${serverCheckAttempts} attempts`)
  }

  const recreateDatabase = async () => {
    try {
      // Step 1: Delete existing repository
      const deleteResponse = await fetch(`${baseUrl}/repositories/${repoId}`, {
        method: 'DELETE',
        headers: baseHeaders
      })
      if (!deleteResponse.ok) {
        const responseText = await deleteResponse.text()
        const isMissingRepoDelete = (
          deleteResponse.status === 404
          || (
            deleteResponse.status === 400
            && responseText.includes('could not locate repository configuration')
          )
        )

        if (!isMissingRepoDelete) {
          throw new Error(`Failed to delete repository: ${deleteResponse.status} ${deleteResponse.statusText} ${responseText}`)
        }
      }

      console.log(`Deleted repository '${repoId}' (if it existed)`)

      // Step 2: Read config.ttl file
      const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
      const configPath = path.join(__dirname, '..', '..', 'cdk', 'rdfdb', 'docker', 'config', 'config.ttl')
      const createConfig = await fs.readFile(configPath, 'utf8')

      // Step 3: Create new repository
      const createResponse = await fetch(`${baseUrl}/repositories/${repoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/turtle',
          ...baseHeaders
        },
        body: createConfig
      })
      if (!createResponse.ok) {
        throw new Error(`Failed to create repository: ${createResponse.status} ${createResponse.statusText}`)
      }

      console.log(`Created new repository '${repoId}'`)
    } catch (error) {
      console.error('Error recreating database:', error)
      throw error
    }
  }

  const loadRDFXMLToRDF4J = async (filePath, graphId) => {
    const xmlData = await fs.readFile(filePath, 'utf8')
    console.log(`Read ${xmlData.length} bytes from file`)

    const parsed = parser.parse(xmlData)
    const rdf = parsed?.['rdf:RDF']
    if (!rdf) {
      throw new Error(`Invalid RDF payload in ${filePath}`)
    }

    const rootAttrs = Object.keys(rdf)
      .filter((key) => key.startsWith('@'))
      .reduce((acc, key) => ({
        ...acc,
        [key]: rdf[key]
      }), {})
    const metadata = rdf['gcmd:gcmd']
    const concepts = asArray(rdf['skos:Concept'])
    const totalBatches = Math.ceil(concepts.length / loadBatchSize)

    const graphUri = `https://gcmd.earthdata.nasa.gov/kms/version/${graphId}`
    const postUrl = new URL(rdf4jUrl)
    postUrl.searchParams.append('context', `<${graphUri}>`)

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
      const start = batchIndex * loadBatchSize
      const end = Math.min(start + loadBatchSize, concepts.length)
      const chunkConcepts = concepts.slice(start, end)

      const chunkDocument = {
        'rdf:RDF': {
          ...rootAttrs,
          ...(metadata ? { 'gcmd:gcmd': metadata } : {}),
          'skos:Concept': chunkConcepts
        }
      }

      const chunkXml = builder.build(chunkDocument)
      console.log(`Loading ${filePath} batch ${batchIndex + 1}/${totalBatches} concepts=${chunkConcepts.length}`)

      const response = await fetch(postUrl, {
        method: 'POST',
        body: chunkXml,
        headers: {
          'Content-Type': 'application/rdf+xml',
          ...baseHeaders
        }
      })

      if (!response.ok) {
        const responseText = await response.text()
        throw new Error(`Failed batch ${batchIndex + 1}/${totalBatches} for ${filePath}: ${response.status} ${response.statusText} ${responseText}`)
      }

      if (interBatchDelayMs > 0) {
        await sleep(interBatchDelayMs)
      }
    }

    console.log(`Successfully loaded ${filePath} into RDF4J in ${totalBatches} batches`)
  }

  const loadRawRDFXMLToRDF4J = async (filePath, graphId) => {
    const xmlData = await fs.readFile(filePath, 'utf8')
    console.log(`Read ${xmlData.length} bytes from file`)

    const graphUri = `https://gcmd.earthdata.nasa.gov/kms/version/${graphId}`
    const postUrl = new URL(rdf4jUrl)
    postUrl.searchParams.append('context', `<${graphUri}>`)

    const response = await fetch(postUrl, {
      method: 'POST',
      body: xmlData,
      headers: {
        'Content-Type': 'application/rdf+xml',
        ...baseHeaders
      }
    })
    if (!response.ok) {
      const responseText = await response.text()
      throw new Error(`Failed loading ${filePath}: ${response.status} ${response.statusText} ${responseText}`)
    }
  }

  try {
    process.env.RDF4J_SERVICE_URL = process.env.RDF4J_SERVICE_URL || 'http://127.0.0.1:8081'
    await waitForServer()

    await recreateDatabase()

    console.log(`Sleeping for ${postCreateDelayMs}ms before starting...`)
    await sleep(postCreateDelayMs)

    const versionTypes = ['published', 'draft']

    for (const versionType of versionTypes) {
      console.log(`\n*********** loading version ${versionType} ${versionType} ***********`)
      const rdfOutputPath = path.join(pullOutDir, `concepts_${versionType}.rdf`)
      const graphId = versionType

      await loadRDFXMLToRDF4J(rdfOutputPath, graphId)

      if (shouldLoadSchemes) {
        const schemesPath = path.join(pullOutDir, `schemes_${versionType}.rdf`)
        console.log(`\n*********** loading schemes ${versionType} ${versionType} ***********`)
        await loadRawRDFXMLToRDF4J(schemesPath, graphId)
      }
    }
  } catch (error) {
    console.error('Conversion failed:', error)
    process.exit(1)
  }
}

// Run the main function
loadExport()
