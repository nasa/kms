const fs = require('fs').promises

const baseUrl = 'http://localhost:8080/rdf4j-server'
const repoId = 'kms'
const rdf4jUrl = `${baseUrl}/repositories/${repoId}/statements`
const username = process.env.RDF4J_USER_NAME || 'rdf4j'
const password = process.env.RDF4J_PASSWORD || 'rdf4j'
const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64')

/**
 * Checks if the RDF4J server is running and accessible.
 *
 * @async
 * @returns {Promise<boolean>} True if the server is running, false otherwise.
 */
const checkRDF4JServer = async () => {
  try {
    const response = await fetch(`${baseUrl}/protocol`, {
      headers: {
        Authorization: `Basic ${base64Credentials}`
      }
    })
    if (response.ok) {
      console.log('RDF4J server is up and running')

      return true
    }
  } catch (error) {
    console.error('Error connecting to RDF4J server:', error)
  }

  return false
}

/**
 * Checks if the specified repository exists and retrieves its size.
 *
 * @async
 * @returns {Promise<boolean>} True if the repository exists, false otherwise.
 */
const checkRepository = async () => {
  try {
    const response = await fetch(`${baseUrl}/repositories/${repoId}/size`, {
      headers: {
        Authorization: `Basic ${base64Credentials}`,
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

/**
 * Waits for the repository to become available, checking at regular intervals.
 *
 * @async
 * @param {Object} options - The options for waiting.
 * @param {number} [options.maxAttempts=30] - Maximum number of attempts.
 * @param {number} [options.interval=5000] - Interval between attempts in milliseconds.
 * @param {number} [options.currentAttempt=1] - Current attempt number.
 * @returns {Promise<boolean>} True if the repository becomes available, false otherwise.
 */
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
    baseUrl,
    repoId,
    maxAttempts,
    interval,
    currentAttempt: currentAttempt + 1
  })
}

/**
 * Loads RDF/XML data from a file into the RDF4J repository.
 *
 * @async
 * @param {string} filePath - Path to the RDF/XML file.
 */
const loadRDFXMLToRDF4J = async (filePath) => {
  try {
    const xmlData = await fs.readFile(filePath, 'utf8')
    console.log(`Read ${xmlData.length} bytes from file`)

    const graphUri = 'https://gcmd.earthdata.nasa.gov/kms/version/draft'
    const url = new URL(rdf4jUrl)
    url.searchParams.append('context', `<${graphUri}>`)

    const response = await fetch(url, {
      method: 'POST',
      body: xmlData,
      headers: {
        'Content-Type': 'application/rdf+xml',
        Authorization: `Basic ${base64Credentials}`
      }
    })

    if (!response.ok) {
      const responseText = await response.text()
      console.log('Response text:', responseText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log(`Successfully loaded ${filePath} into RDF4J`)
  } catch (error) {
    console.error(`Error loading ${filePath} into RDF4J:`, error)
  }
}

/**
 * Main function to execute the setup process.
 *
 * This function performs the following steps:
 * 1. Checks if the RDF4J server is running.
 * 2. Waits for the specified repository to become available.
 * 3. Loads the RDF/XML data into the repository.
 *
 * @async
 */
const main = async () => {
  try {
    const serverRunning = await checkRDF4JServer(baseUrl)
    if (!serverRunning) {
      console.error(`RDF4J server is not running. Please start the server and try again.   
        If you just started it, give it a minute to fully start up, then try running setup again.`)

      return
    }

    console.log(`Waiting for repository '${repoId}' to be available...`)
    const repoExists = await waitForRepository({
      baseUrl,
      repoId
    })
    if (!repoExists) {
      console.error(`Repository '${repoId}' did not become available within the specified time. Please check the repository creation process.`)

      return
    }

    await loadRDFXMLToRDF4J('setup/data/convertedConcepts.rdf', rdf4jUrl)
    await loadRDFXMLToRDF4J('setup/data/schemes.rdf', rdf4jUrl)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

main()
