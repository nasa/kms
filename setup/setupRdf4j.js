const fs = require('fs').promises
const path = require('path')

const serviceUrl = process.env.RDF4J_SERVICE_URL || 'http://127.0.0.1:8081'
const baseUrl = `${serviceUrl}/rdf4j-server`
const repoId = process.env.RDF4J_REPOSITORY_ID || 'kms'
const rdf4jStatementsUrl = `${baseUrl}/repositories/${repoId}/statements`

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null && value !== '')

const username = firstDefined(
  process.env.RDF4J_USER_NAME,
  process.env.RDF4J_USERNAME,
  process.env.RDF4J_USER,
  process.env.bamboo_RDF4J_USER_NAME,
  'rdf4j'
)
const password = firstDefined(
  process.env.RDF4J_PASSWORD,
  process.env.RDF4J_PASS,
  process.env.bamboo_RDF4J_PASSWORD,
  'rdf4j'
)
const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64')
const shouldRecreateRepository = (process.env.RDF4J_RECREATE_REPOSITORY || 'false').toLowerCase() === 'true'
const publishedFile = process.env.RDF4J_PUBLISHED_FILE || 'setup/data/concepts_published.rdf'
const draftFile = process.env.RDF4J_DRAFT_FILE || 'setup/data/concepts_draft.rdf'
const schemesPublishedFile = process.env.RDF4J_SCHEMES_PUBLISHED_FILE || 'setup/data/schemes_published.rdf'
const schemesDraftFile = process.env.RDF4J_SCHEMES_DRAFT_FILE || 'setup/data/schemes_draft.rdf'
const shouldLoadSchemes = (process.env.RDF4J_LOAD_SCHEMES || 'true').toLowerCase() !== 'false'
const maxLoadRetries = Number(process.env.RDF4J_LOAD_RETRIES || '3')
const retryDelayMs = Number(process.env.RDF4J_LOAD_RETRY_DELAY_MS || '1500')
const serverCheckAttempts = Number(process.env.RDF4J_SERVER_CHECK_ATTEMPTS || '15')
const serverCheckDelayMs = Number(process.env.RDF4J_SERVER_CHECK_DELAY_MS || '2000')
const postRepoReadyDelayMs = Number(process.env.RDF4J_POST_READY_DELAY_MS || '60000')

const getAuthHeader = () => `Basic ${base64Credentials}`
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const isRetryableStatus = (statusCode) => [408, 429, 500, 502, 503, 504].includes(statusCode)
const isRetryableError = (error) => {
  const code = error?.cause?.code || error?.code || ''

  return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'UND_ERR_SOCKET'].includes(code)
}

const checkRDF4JServer = async () => {
  for (let attempt = 1; attempt <= serverCheckAttempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/protocol`, {
        headers: {
          Authorization: getAuthHeader()
        }
      })
      if (response.ok) {
        console.log('RDF4J server is up and running')

        return true
      }
      console.warn(`RDF4J server check returned ${response.status} (attempt ${attempt}/${serverCheckAttempts})`)
    } catch (error) {
      console.warn(`RDF4J server check failed (attempt ${attempt}/${serverCheckAttempts}): ${error?.cause?.code || error}`)
    }

    await sleep(serverCheckDelayMs)
  }

  return false
}

const checkRepository = async () => {
  try {
    const response = await fetch(`${baseUrl}/repositories/${repoId}/size`, {
      headers: {
        Authorization: getAuthHeader(),
        Accept: 'text/plain'
      }
    })
    if (response.ok) {
      const size = await response.text()
      console.log(`Repository '${repoId}' exists and contains ${size} statements`)

      return true
    }
  } catch (error) {
    console.error(`Error checking repository '${repoId}':`, error)
  }

  return false
}

const waitForRepository = async ({
  maxAttempts = 30, interval = 5000, currentAttempt = 1
}) => {
  console.log(`Checking for repository '${repoId}' (attempt ${currentAttempt}/${maxAttempts})`)

  if (await checkRepository()) {
    return true
  }

  if (currentAttempt >= maxAttempts) {
    console.log(`Repository '${repoId}' not found after ${maxAttempts} attempts`)

    return false
  }

  await new Promise((resolve) => {
    setTimeout(resolve, interval)
  })

  return waitForRepository({
    maxAttempts,
    interval,
    currentAttempt: currentAttempt + 1
  })
}

const recreateRepository = async () => {
  const configPath = path.join(process.cwd(), 'cdk', 'rdfdb', 'docker', 'config', 'config.ttl')
  const createConfig = await fs.readFile(configPath, 'utf8')

  const deleteResponse = await fetch(`${baseUrl}/repositories/${repoId}`, {
    method: 'DELETE',
    headers: {
      Authorization: getAuthHeader()
    }
  })
  if (deleteResponse.status === 401) {
    throw new Error(`Failed to delete repository: 401 Unauthorized. If your user is not admin, rerun with RDF4J_RECREATE_REPOSITORY=false.`)
  }
  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    throw new Error(`Failed to delete repository: ${deleteResponse.status} ${deleteResponse.statusText}`)
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

const clearContext = async (version) => {
  const graphUri = `https://gcmd.earthdata.nasa.gov/kms/version/${version}`
  const url = new URL(rdf4jStatementsUrl)
  url.searchParams.append('context', `<${graphUri}>`)

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: getAuthHeader()
    }
  })
  if (!response.ok && response.status !== 404) {
    const text = await response.text()
    throw new Error(`Failed to clear context ${version}: ${response.status} ${response.statusText} ${text}`)
  }
}

const loadRDFXMLToRDF4J = async (filePath, version) => {
  const xmlData = await fs.readFile(filePath, 'utf8')
  console.log(`Read ${xmlData.length} bytes from file: ${filePath}`)

  await clearContext(version)

  const graphUri = `https://gcmd.earthdata.nasa.gov/kms/version/${version}`
  const url = new URL(rdf4jStatementsUrl)
  url.searchParams.append('context', `<${graphUri}>`)

  let lastError = null
  for (let attempt = 1; attempt <= maxLoadRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: xmlData,
        headers: {
          'Content-Type': 'application/rdf+xml',
          Authorization: getAuthHeader()
        }
      })
      if (!response.ok) {
        const responseText = await response.text()
        const error = new Error(`Error loading ${filePath}: ${response.status} ${response.statusText} ${responseText}`)
        if (!isRetryableStatus(response.status) || attempt === maxLoadRetries) {
          throw error
        }
        lastError = error
        console.warn(`Retrying load (${attempt}/${maxLoadRetries}) for ${filePath} due to status ${response.status}`)
        await sleep(retryDelayMs * attempt)
        continue
      }

      lastError = null
      break
    } catch (error) {
      if (!isRetryableError(error) || attempt === maxLoadRetries) {
        throw error
      }
      lastError = error
      console.warn(`Retrying load (${attempt}/${maxLoadRetries}) for ${filePath} after error: ${error?.cause?.code || error}`)
      await sleep(retryDelayMs * attempt)
    }
  }

  if (lastError) {
    throw lastError
  }

  console.log(`Successfully loaded ${filePath} into context '${version}'`)
}

const main = async () => {
  try {
    const serverRunning = await checkRDF4JServer()
    if (!serverRunning) {
      console.error(`RDF4J server is not running. Start it first and retry.
If you just started it, wait for startup and rerun this command.`)
      process.exitCode = 1

      return
    }

    if (shouldRecreateRepository) {
      console.log(`Recreating repository '${repoId}'`)
      await recreateRepository()
    } else {
      console.log(`Skipping repository recreation for '${repoId}' (RDF4J_RECREATE_REPOSITORY=false)`)
    }

    console.log(`Waiting for repository '${repoId}' to be available...`)
    const repoExists = await waitForRepository({})
    if (!repoExists) {
      console.error(`Repository '${repoId}' did not become available in time.`)
      process.exitCode = 1

      return
    }

    if (postRepoReadyDelayMs > 0) {
      console.log(`Repository is up. Waiting ${postRepoReadyDelayMs}ms before loading RDF...`)
      await sleep(postRepoReadyDelayMs)
    }

    await loadRDFXMLToRDF4J(publishedFile, 'published')
    await loadRDFXMLToRDF4J(draftFile, 'draft')
    if (shouldLoadSchemes) {
      await loadRDFXMLToRDF4J(schemesPublishedFile, 'published')
      await loadRDFXMLToRDF4J(schemesDraftFile, 'draft')
    }
  } catch (error) {
    console.error('RDF4J setup failed:', error)
    process.exit(1)
  }
}

main()
