/* eslint-disable import/no-extraneous-dependencies */
const path = require('path')

const axios = require('axios')
const fs = require('fs-extra')
const xml2js = require('xml2js')

/**
 * Grabs concepts from all https://gcmd.earthdata.nasa.gov/kms/concepts pages and converts them to one rdf
 * @returns raw_concepts_data.rdf in setup/data
 */
async function createRawConceptsRDF() {
  const baseUrl = 'https://gcmd.earthdata.nasa.gov/kms/concepts'
  const pageSize = 2000
  const totalPages = 8
  let allConcepts = []

  // Iterate through all current pages of https://gcmd.earthdata.nasa.gov/kms/concepts
  for (let page = 1; page <= totalPages; page += 1) {
    const url = `${baseUrl}?page_size=${pageSize}&page_num=${page}&format=rdf`
    console.log(`Fetching page ${page}...`)

    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await axios.get(url)
      // eslint-disable-next-line no-await-in-loop
      const result = await xml2js.parseStringPromise(response.data)

      if (result['rdf:RDF'] && result['rdf:RDF']['skos:Concept']) {
        allConcepts = allConcepts.concat(result['rdf:RDF']['skos:Concept'])
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error.message)
    }
  }

  console.log(`Total concepts fetched: ${allConcepts.length}`)

  // Create a new RDF structure with all concepts
  const combinedRDF = {
    'rdf:RDF': {
      $: {
        'xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        'xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
        'xmlns:rdfs': 'http://www.w3.org/2000/01/rdf-schema#'
      },
      'skos:Concept': allConcepts
    }
  }

  // Convert back to XML
  const builder = new xml2js.Builder()
  const xml = builder.buildObject(combinedRDF)

  // Write to file
  const outputPath = path.join(__dirname, '..', 'data', 'raw_concepts_data.rdf')

  await fs.writeFile(outputPath, xml)
  console.log('Combined RDF file created: raw_concepts_data.rdf')
}

// Run the function
createRawConceptsRDF().catch(console.error)
