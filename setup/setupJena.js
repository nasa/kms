const fs = require('fs').promises

const baseUrl = 'http://localhost:3030'
const datasetName = 'kms'
const fusekiUrl = `${baseUrl}/${datasetName}`
const username = process.env.RDFDB_USER_NAME || 'admin'
const password = process.env.RDFDB_PASSWORD || 'jena'
const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64')

/**
 * Checks if the Fuseki server is running and accessible.
 *
 * @async
 * @returns {Promise<boolean>} True if the server is running, false otherwise.
 */
const checkFusekiServer = async () => {
  try {
    const response = await fetch(`${baseUrl}/$/ping`, {
      headers: {
        Authorization: `Basic ${base64Credentials}`
      }
    })
    if (response.ok) {
      console.log('Fuseki server is up and running')

      return true
    }
  } catch (error) {
    console.error('Error connecting to Fuseki server:', error)
  }

  return false
}

/**
 * Loads RDF/XML data from a file into the Fuseki dataset.
 *
 * @async
 * @param {string} filePath - Path to the RDF/XML file.
 */
const loadRDFXMLToFuseki = async (filePath) => {
  try {
    const rdfXml = await fs.readFile(filePath, 'utf8')
    console.log(`Read ${rdfXml.length} bytes from file ${filePath}`)

    const response = await fetch(`${fusekiUrl}/data?default`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/rdf+xml',
        Authorization: `Basic ${base64Credentials}`
      },
      body: rdfXml
    })

    if (!response.ok) {
      const responseText = await response.text()
      console.log('Response text:', responseText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log(`Successfully loaded ${filePath} into Fuseki`)
  } catch (error) {
    console.error(`Error loading ${filePath} into Fuseki:`, error)
  }
}

/**
 * Main function to execute the setup process.
 *
 * This function performs the following steps:
 * 1. Checks if the Fuseki server is running.
 * 2. Waits for the specified dataset to become available.
 * 3. Loads the RDF/XML data into the dataset.
 *
 * @async
 */
const main = async () => {
  try {
    const serverRunning = await checkFusekiServer()
    if (!serverRunning) {
      console.error(`Fuseki server is not running. Please start the server and try again.   
        If you just started it, give it a minute to fully start up, then try running setup again.`)

      return
    }

    await loadRDFXMLToFuseki('setup/data/convertedConcepts.rdf')
    await loadRDFXMLToFuseki('setup/data/schemes.rdf')
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

main()
