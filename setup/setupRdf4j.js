/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs/promises')
const path = require('node:path')

const serviceUrl = process.env.RDF4J_SERVICE_URL || 'http://127.0.0.1:8081'
const baseUrl = `${serviceUrl}/rdf4j-server`
const repoId = process.env.RDF4J_REPOSITORY_ID || 'kms'
const rdf4jStatementsUrl = `${baseUrl}/repositories/${repoId}/statements`
const username = process.env.RDF4J_USER_NAME || 'rdf4j'
const password = process.env.RDF4J_PASSWORD || 'rdf4j'
const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64')
const shouldRecreateRepository = (process.env.RDF4J_RECREATE_REPOSITORY || 'true').toLowerCase() === 'true'
const shouldLoadSchemes = (process.env.RDF4J_LOAD_SCHEMES || 'true').toLowerCase() !== 'false'
const serverCheckAttempts = Number(process.env.RDF4J_SERVER_CHECK_ATTEMPTS || '60')
const serverCheckDelayMs = Number(process.env.RDF4J_SERVER_CHECK_DELAY_MS || '1000')
const postCreateDelayMs = Number(process.env.RDF4J_POST_READY_DELAY_MS || '5000')

const publishedFile = process.env.RDF4J_PUBLISHED_FILE || 'setup/data/concepts_published.rdf'
const draftFile = process.env.RDF4J_DRAFT_FILE || 'setup/data/concepts_draft.rdf'
const schemesPublishedFile = process.env.RDF4J_SCHEMES_PUBLISHED_FILE || 'setup/data/schemes_published.rdf'
const schemesDraftFile = process.env.RDF4J_SCHEMES_DRAFT_FILE || 'setup/data/schemes_draft.rdf'

const getAuthHeader = () => `Basic ${base64Credentials}`
const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

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

const recreateRepository = async () => {
  const configPath = path.join(process.cwd(), 'cdk', 'rdfdb', 'docker', 'config', 'config.ttl')
  const createConfig = await fs.readFile(configPath, 'utf8')

  const deleteResponse = await fetch(`${baseUrl}/repositories/${repoId}`, {
    method: 'DELETE',
    headers: { Authorization: getAuthHeader() }
  })
  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    const responseText = await deleteResponse.text()
    const isMissingRepoDelete = (
      deleteResponse.status === 400
      && responseText.includes('could not locate repository configuration')
    )
    if (!isMissingRepoDelete) {
      throw new Error(`Failed to delete repository: ${deleteResponse.status} ${deleteResponse.statusText} ${responseText}`)
    }
  }

  console.log(`Deleted repository '${repoId}' (if it existed)`)

  const createResponse = await fetch(`${baseUrl}/repositories/${repoId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/turtle',
      Authorization: getAuthHeader()
    },
    body: createConfig
  })
  if (!createResponse.ok) {
    const text = await createResponse.text()
    throw new Error(`Failed to create repository: ${createResponse.status} ${createResponse.statusText} ${text}`)
  }

  console.log(`Created repository '${repoId}'`)
}

const checkRepository = async () => {
  const response = await fetch(`${baseUrl}/repositories/${repoId}/size`, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: 'text/plain'
    }
  })
  if (!response.ok) return false

  const size = await response.text()
  console.log(`Repository '${repoId}' exists and contains ${size} statements`)

  return true
}

const clearContext = async (version) => {
  const graphUri = `https://gcmd.earthdata.nasa.gov/kms/version/${version}`
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
}

const loadRdfFile = async (filePath, version) => {
  const xmlData = await fs.readFile(filePath, 'utf8')
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

const main = async () => {
  try {
    await waitForServer()

    if (shouldRecreateRepository) {
      console.log(`Recreating repository '${repoId}'`)
      await recreateRepository()
      if (postCreateDelayMs > 0) {
        console.log(`Sleeping for ${postCreateDelayMs}ms before loading`)
        await sleep(postCreateDelayMs)
      }
    } else {
      console.log(`Skipping repository recreation for '${repoId}' (RDF4J_RECREATE_REPOSITORY=false)`)
      const exists = await checkRepository()
      if (!exists) {
        throw new Error(`Repository '${repoId}' does not exist. Run with RDF4J_RECREATE_REPOSITORY=true`)
      }
    }

    await clearContext('published')
    await loadRdfFile(publishedFile, 'published')
    if (shouldLoadSchemes) {
      await loadRdfFile(schemesPublishedFile, 'published')
    }

    await clearContext('draft')
    await loadRdfFile(draftFile, 'draft')
    if (shouldLoadSchemes) {
      await loadRdfFile(schemesDraftFile, 'draft')
    }
  } catch (error) {
    console.error('RDF4J setup failed:', error)
    process.exit(1)
  }
}

main()
