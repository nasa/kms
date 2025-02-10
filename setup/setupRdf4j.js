const fs = require('fs').promises

const baseUrl = 'http://localhost:8080/rdf4j-server'
const repoId = 'kms'
const rdf4jUrl = `${baseUrl}/repositories/${repoId}/statements`
const username = process.env.RDF4J_USER_NAME || 'rdf4j'
const password = process.env.RDF4J_PASSWORD || 'rdf4j'
const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64')

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

const loadRDFXMLToRDF4J = async (filePath) => {
  try {
    const xmlData = await fs.readFile(filePath, 'utf8')
    console.log(`Read ${xmlData.length} bytes from file`)

    const response = await fetch(rdf4jUrl, {
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

    console.log('Successfully loaded RDF XML into RDF4J')
  } catch (error) {
    console.error('Error loading RDF XML into RDF4J:', error)
  }
}

const main = async () => {
  const inputFile = 'setup/data/concepts.rdf'

  try {
    const serverRunning = await checkRDF4JServer(baseUrl)
    if (!serverRunning) {
      console.error('RDF4J server is not running. Please start the server and try again.')

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

    await loadRDFXMLToRDF4J(inputFile, rdf4jUrl)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

main()
