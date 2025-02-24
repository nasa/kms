const fs = require('fs').promises
const path = require('path')

// eslint-disable-next-line import/no-extraneous-dependencies
const xml2js = require('xml2js')

const rootDir = path.join(__dirname, '..')
const conceptsPath = path.join(rootDir, 'data/raw_concepts_data.rdf')

/**
 * Iterates through raw_concepts_data.rdf and pulls out UUIDs
 * @returns extractedUUIDs.js in setup/data
 */
const extractUUIDs = async () => {
  try {
    // Read the concepts.rdf file
    const data = await fs.readFile(conceptsPath, 'utf8')

    // Parse the XML
    const parser = new xml2js.Parser()
    const result = await parser.parseStringPromise(data)

    // Extract UUIDs from rdf:about attributes
    const rdfUUIDs = result['rdf:RDF']['skos:Concept'].map((concept) => concept.$['rdf:about'])

    return rdfUUIDs
  } catch (error) {
    console.error('Error processing concepts.rdf:', error)
    throw error
  }
}

// Usage
extractUUIDs()
  .then((uuids) => {
    // Create a JSON object with the extracted UUIDs
    const jsonContent = JSON.stringify({ extractedUUIDs: uuids }, null, 2)

    // Write the JSON to a file
    const outputPath = path.join(__dirname, '..', 'data', 'extractedUUIDs.json')

    return fs.writeFile(outputPath, jsonContent)
  })
  .then(() => {
    console.log('extractedUUIDs.json has been created with the extracted UUIDs')
  })
  .catch((error) => {
    console.error('Failed to extract UUIDs or write to file:', error)
  })
