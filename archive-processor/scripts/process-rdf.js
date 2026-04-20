/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Combines the RDF upload and CSV download processes for all RDF files in the data directory.
 *
 * For each RDF file found in `../data`:
 * 1. It uploads the RDF file along with `schemes_published.rdf` to an RDF4J repository,
 *    after clearing the specified context and the Redis cache.
 * 2. It then triggers a download process for the same version, parsing the RDF file
 *    to find concept schemes and downloading each as a CSV.
 *
 * This script is controlled by environment variables for services like RDF4J and Redis.
 *
 * Usage:
 * node scripts/process_rdf.js
 */
import { execSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'url'

import { createClient } from 'redis'

const scriptPath = fileURLToPath(import.meta.url)
const scriptDir = dirname(scriptPath)

// --- Configuration ---

// RDF4J and Redis configuration from environment variables
const serviceUrl = process.env.RDF4J_SERVICE_URL || 'http://127.0.0.1:8081'
const baseUrl = `${serviceUrl}/rdf4j-server`
const repoId = process.env.RDF4J_REPOSITORY_ID || 'kms'
const rdf4jStatementsUrl = `${baseUrl}/repositories/${repoId}/statements`
const username = process.env.RDF4J_USER_NAME || 'rdf4j'
const password = process.env.RDF4J_PASSWORD || 'rdf4j'
const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64')
const serverCheckAttempts = Number(process.env.RDF4J_SERVER_CHECK_ATTEMPTS || '60')
const serverCheckDelayMs = Number(process.env.RDF4J_SERVER_CHECK_DELAY_MS || '1000')
const uploadContext = process.env.RDF4J_UPLOAD_CONTEXT || 'published'
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380'

// Download configuration
const KMS_APP_BASE_URL = 'http://localhost:3013'
const CONCEPTS_BASE_URL = `${KMS_APP_BASE_URL}/concepts/concept_scheme`
const OUTPUT_BASE_DIR = join(scriptDir, '..', 'local-kms-csv')

// Delays
const csvDownloadDelayMs = Number(process.env.PROCESS_CSV_DOWNLOAD_DELAY_MS || '1000')
const versionProcessingDelayMs = Number(process.env.PROCESS_VERSION_DELAY_MS || '5000')

// --- RDF4J Upload Functions ---

/**
 * Builds the HTTP Basic auth header for RDF4J admin/repository calls.
 * @returns {string} Basic auth header value.
 */
const getAuthHeader = () => `Basic ${base64Credentials}`

/**
 * Sleeps for the provided delay.
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

/**
 * Polls RDF4J protocol endpoint until the server is ready or attempts are exhausted.
 * @returns {Promise<void>}
 * @throws {Error} If server is not reachable within configured attempts.
 */
const waitForServer = async () => {
  const checkAttempt = async (attempt) => {
    if (attempt > serverCheckAttempts) {
      throw new Error(`RDF4J server not ready after ${serverCheckAttempts} attempts`)
    }

    try {
      console.log(`Checking RDF4J server (${attempt}/${serverCheckAttempts}) at ${baseUrl}`)
      const response = await fetch(`${baseUrl}/protocol`, {
        headers: { Authorization: getAuthHeader() }
      })
      if (response.ok) {
        console.log('RDF4J server is up and running')

        return
      }
    } catch (error) {
      const code = error?.cause?.code || error?.code || error?.message || 'unknown'
      console.log(`RDF4J server check failed (${attempt}/${serverCheckAttempts}): ${code}`)
    }

    await sleep(serverCheckDelayMs)
    await checkAttempt(attempt + 1)
  }

  await checkAttempt(1)
}

/**
 * Executes a SPARQL query to count statements in a specific graph.
 * @param {string} graphUri - The URI of the graph to query.
 * @returns {Promise<number>} The number of statements in the graph.
 */
const getGraphStatementCount = async (graphUri) => {
  const sparqlQuery = `SELECT (COUNT(*) AS ?count) WHERE { GRAPH <${graphUri}> { ?s ?p ?o } }`
  const url = new URL(`${baseUrl}/repositories/${repoId}`)
  url.searchParams.append('query', sparqlQuery)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/sparql-results+json',
        Authorization: getAuthHeader()
      }
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`SPARQL count query failed: ${response.status} ${response.statusText} ${text}`)
    }

    const result = await response.json()
    const count = parseInt(result.results.bindings[0]?.count?.value || '0', 10)

    return count
  } catch (error) {
    // If the query fails (e.g., repo not ready), assume count is 0 but log it.
    console.warn(`Warning: Could not retrieve statement count for ${graphUri}. Returning 0. Error: ${error.message}`)

    return 0
  }
}

/**
 * Clears a graph context in the repository for a given version.
 * @param {string} version - Graph version (for example `published` or `draft`).
 * @returns {Promise<void>}
 * @throws {Error} If context delete fails.
 */
const clearContext = async (version) => {
  console.log(`Clearing context: ${version}`)
  const graphUri = `https://gcmd.earthdata.nasa.gov/kms/version/${version}`

  // 1. Get a statement count before clearing.
  const preClearCount = await getGraphStatementCount(graphUri)
  console.log(`Found ${preClearCount} statements in context <${graphUri}> before clearing.`)

  if (preClearCount === 0) {
    console.log('Context is already empty. No deletion needed.')

    return // No need to delete if it's already empty.
  }

  // 2. Perform the deletion.
  const url = new URL(rdf4jStatementsUrl)
  url.searchParams.append('context', `<${graphUri}>`)

  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: getAuthHeader() }
  })

  if (!response.ok && response.status !== 404) {
    const text = await response.text()
    throw new Error(`Failed to clear context ${version}: ${response.status} ${response.statusText} ${text}`)
  }

  // 3. Verify that the context is now empty.
  const postClearCount = await getGraphStatementCount(graphUri)
  if (postClearCount > 0) {
    throw new Error(`Context clearing verification failed. Found ${postClearCount} statements in <${graphUri}> after deletion.`)
  }

  console.log(`Context '${version}' cleared and verified successfully (statement count is 0).`)
}

/**
 * Clears the Redis cache.
 * @returns {Promise<void>}
 * @throws {Error} If Redis connection or flush fails.
 */
const clearRedisCache = async () => {
  if (!redisUrl) {
    console.log('REDIS_URL not set, skipping cache clearing.')

    return
  }

  console.log(`Connecting to Redis at ${redisUrl}`)
  const client = createClient({ url: redisUrl })

  try {
    await client.connect()

    // Set a dummy key to verify the flush operation
    const dummyKey = `cache-flush-test-${Date.now()}`
    await client.set(dummyKey, '1')

    console.log('Flushing Redis cache...')
    await client.flushDb()

    // Verify the flush
    const keyExists = await client.exists(dummyKey)
    if (keyExists) {
      throw new Error('Redis cache flush verification failed. Dummy key still exists.')
    }

    console.log('Redis cache cleared and verified successfully.')
  } catch (error) {
    throw new Error(`Failed to clear Redis cache: ${error.message}`)
  } finally {
    if (client.isOpen) {
      await client.disconnect()
    }
  }
}

/**
 * Loads a local RDF/XML file into the RDF4J statements endpoint for the target context.
 * @param {string} filePath - Local path to RDF/XML file.
 * @param {string} version - Context version (for example `published` or `draft`).
 * @returns {Promise<void>}
 * @throws {Error} If file read or POST load fails.
 */
const loadRdfFile = async (filePath, version) => {
  const xmlData = await readFile(filePath, 'utf8')
  console.log(`Read ${xmlData.length} bytes from file: ${filePath}`)

  const graphUri = `https://gcmd.earthdata.nasa.gov/kms/version/${version}`
  const postUrl = new URL(rdf4jStatementsUrl)
  postUrl.searchParams.append('context', `<${graphUri}>`)

  const response = await fetch(postUrl, {
    method: 'POST',
    body: xmlData,
    headers: {
      'Content-Type': 'application/rdf+xml',
      Authorization: getAuthHeader()
    }
  })
  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(`Failed loading ${filePath}: ${response.status} ${response.statusText} ${responseText}`)
  }

  console.log(`Successfully loaded ${filePath} into context '${version}'`)
}

/**
 * Reads the schemes RDF file, replaces the version name with the provided version,
 * and then uploads it to the RDF4J statements endpoint.
 * @param {string} filePath - Local path to the schemes RDF/XML file.
 * @param {string} targetContext - Context version for the upload (e.g., `published`).
 * @param {string} fileContentVersion - The version string to inject into the file's content.
 * @returns {Promise<void>}
 * @throws {Error} If file read, modification, or POST load fails.
 */
const loadModifiedSchemesFile = async (filePath, targetContext, fileContentVersion) => {
  let xmlData = await readFile(filePath, 'utf8')
  console.log(`Read and modifying schemes file: ${filePath} for version ${fileContentVersion}`)

  // Replace the version name in the file content.
  const versionTagRegex = /<gcmd:versionName>.*<\/gcmd:versionName>/
  const newVersionTag = `<gcmd:versionName>${fileContentVersion}</gcmd:versionName>`

  if (versionTagRegex.test(xmlData)) {
    xmlData = xmlData.replace(versionTagRegex, newVersionTag)
    console.log(`Replaced version tag. New tag: ${newVersionTag}`)
  } else {
    // This is not a fatal error, as some schemes files may not have this tag.
    console.warn(`Warning: Could not find <gcmd:versionName> tag in ${filePath}. Uploading file as-is.`)
  }

  const graphUri = `https://gcmd.earthdata.nasa.gov/kms/version/${targetContext}`
  const postUrl = new URL(rdf4jStatementsUrl)
  postUrl.searchParams.append('context', `<${graphUri}>`)

  const response = await fetch(postUrl, {
    method: 'POST',
    body: xmlData,
    headers: {
      'Content-Type': 'application/rdf+xml',
      Authorization: getAuthHeader()
    }
  })

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(`Failed loading modified schemes file ${filePath}: ${response.status} ${response.statusText} ${responseText}`)
  }

  console.log(`Successfully loaded modified ${filePath} into context '${targetContext}'`)
}

// --- CSV Download Function ---

/**
 * Downloads all concept scheme CSV files for a given version.
 * @param {string} version - The version identifier, derived from the filename.
 * @param {string} rdfFilePath - The full path to the RDF file to parse for schemes.
 */
const downloadCsvForVersion = async (version, rdfFilePath) => {
  // 1. Create the output directory and define log path
  // Note: Assumes this script is run from the `archive-processor` directory.
  const outputDir = join(OUTPUT_BASE_DIR, version)
  const logFilePath = join(outputDir, 'log.txt')
  console.log(`Creating output directory: ${outputDir}`)
  mkdirSync(outputDir, { recursive: true })

  // 2. Create a logging function to write errors to log.txt
  const logError = (message, errorDetails) => {
    const timestamp = new Date().toISOString()
    let details = 'No additional error information available.'
    if (typeof errorDetails === 'string') {
      details = errorDetails
    } else if (errorDetails) {
      details = errorDetails.stderr?.toString()
        || errorDetails.message
        || JSON.stringify(errorDetails)
    }

    const logEntry = `${timestamp} - ${message}\nDetails: ${details}\n\n`

    try {
      appendFileSync(logFilePath, logEntry)
      console.error(`Error: ${message} Check ${logFilePath} for details.`)
    } catch (logWriteError) {
      console.error('--- CRITICAL: FAILED TO WRITE TO LOG FILE ---')
      console.error('Original Error:', logEntry)
      console.error('Log Write Error:', logWriteError.message)
    }
  }

  try {
    // 3. Read the RDF file to find the list of schemes
    console.log(`Reading schemes from ${rdfFilePath}...`)

    if (!existsSync(rdfFilePath)) {
      logError(`RDF file not found at ${rdfFilePath}`, 'File does not exist.')

      return // Stop processing for this version
    }

    const rdfXml = readFileSync(rdfFilePath, 'utf-8')

    // 4. Parse scheme names from the RDF/XML
    const resourceUrlRegex = /<skos:inScheme rdf:resource="[^"]+"\/>/g
    const urlMatches = rdfXml.match(resourceUrlRegex) || []
    const schemeUrls = urlMatches.map((tag) => tag.slice(34, -3))

    let schemeNames = [
      ...new Set(schemeUrls.map((url) => url.substring(url.lastIndexOf('/') + 1)))
    ].filter((name) => name !== 'Trash')

    // Handle mapping 'GranuleDataFormat' to 'DataFormat'
    if (schemeNames.includes('GranuleDataFormat')) {
      console.log("Mapping scheme 'GranuleDataFormat' to 'DataFormat' for download.")
      schemeNames = schemeNames.map((name) => (name === 'GranuleDataFormat' ? 'DataFormat' : name))
      // Re-apply Set to handle cases where 'DataFormat' already existed, ensuring no duplicates.
      schemeNames = [...new Set(schemeNames)]
    }

    if (schemeNames.length === 0) {
      console.warn(`No schemes found in ${rdfFilePath}. Exiting download step.`)

      return
    }

    console.log(`Found schemes: ${schemeNames.join(', ')}`)

    // 5. Download each scheme's CSV file
    await schemeNames.reduce(async (previousPromise, schemeName) => {
      await previousPromise

      const csvUrl = `${CONCEPTS_BASE_URL}/${schemeName}?format=csv`
      const outputPath = join(outputDir, `${schemeName}.csv`)
      console.log(`Downloading ${schemeName}.csv from ${csvUrl}...`)

      try {
        const curlCommand = `curl -s -f -H "Cache-Control: no-cache" -H "Pragma: no-cache" "${csvUrl}"`
        const responseBody = execSync(curlCommand).toString()

        if (responseBody.trim().startsWith('{"error"')) {
          logError(`Server returned an error for ${schemeName}.csv`, responseBody.trim())
        } else {
          writeFileSync(outputPath, responseBody)
          console.log(` -> Successfully saved to ${outputPath}`)
        }
      } catch (e) {
        logError(`Failed to download ${schemeName}.csv`, e)
      }

      console.log(`Pausing for ${csvDownloadDelayMs / 1000} seconds after download...`)
      await sleep(csvDownloadDelayMs)
    }, Promise.resolve())

    console.log(`\nDownload process for version ${version} completed.`)
  } catch (error) {
    logError(`An unexpected error occurred during the download for version ${version}`, error)
  }
}

// --- Main Execution ---

/**
 * Executes the combined upload and download process.
 */
const main = async () => {
  try {
    // Note: Assumes being run from `archive-processor`, so paths are relative from there.
    const dataDir = join(scriptDir, '..', 'downloaded-rdf')
    const schemesFile = join(scriptDir, '..', 'schemes-rdf', 'schemes_published.rdf')

    if (!existsSync(schemesFile)) {
      console.error(`Fatal: Schemes file not found at ${schemesFile}`)
      process.exit(1)
    }

    // Read the list of versions to process from the environment variable
    const versionsToProcess = (process.env.TO_BE_PROCESSED_VERSIONS || ''
    ).split(',').map((v) => v.trim()).filter(Boolean)

    const allFiles = await readdir(dataDir)
    let rdfFiles = allFiles.filter((f) => f.endsWith('.rdf') || f.endsWith('.rdf.xml'))

    // If a specific list of versions is provided, filter the files
    if (versionsToProcess.length > 0) {
      console.log(`Processing only specified versions: ${versionsToProcess.join(', ')}`)
      rdfFiles = rdfFiles.filter((filename) => {
        const version = filename.replace('.rdf.xml', '').replace('.rdf', '')

        return versionsToProcess.includes(version)
      })
    } else {
      console.log('Processing all available versions.')
    }

    if (rdfFiles.length === 0) {
      console.log('No RDF files found to process for the specified versions.')

      return
    }

    console.log(`Found ${rdfFiles.length} RDF files to process.`)

    // Wait for RDF4J server to be ready before starting the loop
    await waitForServer()

    await rdfFiles.reduce(async (previousPromise, rdfFilename, index) => {
      await previousPromise

      // Pause before processing the next file, but not before the first one.
      if (index > 0) {
        console.log(`\nPausing for ${versionProcessingDelayMs / 1000} seconds before the next version...`)
        await sleep(versionProcessingDelayMs)
      }

      const version = rdfFilename.replace('.rdf.xml', '').replace('.rdf', '')
      const conceptsFile = join(dataDir, rdfFilename)

      console.log(`\n--- Processing version: ${version} (File ${index + 1}/${rdfFiles.length}) ---\n`)

      try {
        // --- UPLOAD ---
        console.log(`Starting RDF upload for ${rdfFilename}`)
        await clearRedisCache()
        await clearContext(uploadContext)
        await loadRdfFile(conceptsFile, uploadContext)

        // The schemes file is uploaded with every concept, unless it's the concept itself
        if (conceptsFile !== schemesFile) {
          // When uploading the schemes file, modify its content to include the current version.
          await loadModifiedSchemesFile(schemesFile, uploadContext, version)
        }

        console.log(`Upload for ${version} completed successfully.`)

        // --- DOWNLOAD ---
        console.log(`\nStarting CSV download for ${version}`)
        await downloadCsvForVersion(version, conceptsFile)

        console.log(`\n--- Finished processing version: ${version} ---`)
      } catch (error) {
        console.error(`Failed to process version ${version}:`, error)
        // Continue to the next file
      }
    }, Promise.resolve())

    console.log('\nAll versions processed successfully.')
  } catch (error) {
    console.error('A fatal error occurred in the main process:', error)
    process.exit(1)
  }
}

main()
