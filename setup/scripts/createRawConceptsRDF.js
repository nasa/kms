/* eslint-disable no-await-in-loop */
const path = require('path')
// eslint-disable-next-line import/no-extraneous-dependencies
const fs = require('fs-extra')
const { XMLParser, XMLBuilder } = require('fast-xml-parser')

// eslint-disable-next-line no-promise-executor-return
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchWithRetry(url, retries = 3, delayMs = 1000) {
  for (let i = 0; i < retries; i += 1) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.text()
    } catch (error) {
      console.error(`Attempt ${i + 1} failed: ${error.message}`)
      if (i < retries - 1) {
        console.log(`Retrying in ${delayMs / 1000} seconds...`)
        await delay(delayMs)
      }
    }
  }

  throw new Error(`Failed to fetch after ${retries} attempts`)
}

// Creates raw_concept_data.rdf file under setup/data to be used for extracting uuids
async function createRawConceptsRDF() {
  const baseUrl = 'https://gcmd.earthdata.nasa.gov/kms/concepts'
  const pageSize = 2000
  const totalPages = 8
  let allConcepts = []

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text'
  })

  // Iterate through all pages of rdf concepts and extract data
  for (let page = 1; page <= totalPages; page += 1) {
    const url = `${baseUrl}?page_size=${pageSize}&page_num=${page}&format=rdf`
    console.log(`Fetching page ${page}...`)

    try {
      const xmlData = await fetchWithRetry(url)
      const result = parser.parse(xmlData)

      if (result['rdf:RDF'] && result['rdf:RDF']['skos:Concept']) {
        const concepts = Array.isArray(result['rdf:RDF']['skos:Concept'])
          ? result['rdf:RDF']['skos:Concept']
          : [result['rdf:RDF']['skos:Concept']]
        allConcepts = allConcepts.concat(concepts)
        console.log(`Page ${page}: Added ${concepts.length} concepts`)
      } else {
        console.warn(`Page ${page}: No concepts found in the response`)
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error.message)
    }

    // Add a delay between requests to avoid rate limiting
    await delay(1000)
  }

  console.log(`Total concepts fetched: ${allConcepts.length}`)

  // Combine all information together
  const combinedRDF = {
    'rdf:RDF': {
      '@_xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      '@_xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
      '@_xmlns:rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      'skos:Concept': allConcepts
    }
  }

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true
  })
  const xml = builder.build(combinedRDF)

  const outputPath = path.join(__dirname, '..', 'data', 'raw_concepts_data.rdf')

  await fs.writeFile(outputPath, xml)
  console.log('Combined RDF file created: raw_concepts_data.rdf')
}

createRawConceptsRDF().catch(console.error)
