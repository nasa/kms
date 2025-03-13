/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
const fs = require('fs').promises
const path = require('path')

const { XMLParser, XMLBuilder } = require('fast-xml-parser')

const { fetchVersions } = require('./fetchVersions')
const { toRDF } = require('./toRDF')

const getXmlSchemes = async (version) => {
  let url = 'https://gcmd.earthdata.nasa.gov/kms/concept_schemes'
  if (version !== 'published') {
    url += `?version=${version}`
  }

  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const xmlContent = await response.text()

    return xmlContent
  } catch (error) {
    console.error('Error fetching schemes:', error)
    throw error
  }
}

const createSchemes = async (version, versionType, xmlInput) => {
  // Parse the input XML
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  })
  const parsedXml = parser.parse(xmlInput)

  // Find the most recent update date
  const mostRecentDate = parsedXml.schemes.scheme.reduce((maxDate, scheme) => {
    const schemeDate = new Date(scheme['@_updateDate'])

    return schemeDate > maxDate ? schemeDate : maxDate
  }, new Date(0))

  // Prepare the RDF structure
  const rdfObject = {
    'rdf:RDF': {
      '@_xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      '@_xmlns:rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      '@_xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
      '@_xmlns:dcterms': 'http://purl.org/dc/terms/',
      '@_xmlns:gcmd': 'https://gcmd.earthdata.nasa.gov/kms#',
      'gcmd:Version': {
        '@_rdf:about': 'https://gcmd.earthdata.nasa.gov/kms/version_metadata',
        'gcmd:versionName': version,
        'gcmd:versionType': versionType,
        'dcterms:modified': mostRecentDate.toISOString().split('T')[0], // Use the most recent date
        'dcterms:created': mostRecentDate.toISOString().split('T')[0] // Also update the created date
      },
      'skos:ConceptScheme': []
    }
  }

  // Process each scheme
  parsedXml.schemes.scheme.forEach((scheme) => {
    const conceptScheme = {
      '@_rdf:about': `https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme['@_name']}`,
      'skos:prefLabel': {
        '@_xml:lang': 'en',
        '#text': scheme['@_longName']
      },
      'skos:notation': scheme['@_name'],
      'dcterms:modified': {
        '@_rdf:datatype': 'http://www.w3.org/2001/XMLSchema#date',
        '#text': scheme['@_updateDate']
      }
    }

    if (scheme['@_csvHeaders']) {
      conceptScheme['gcmd:csvHeaders'] = scheme['@_csvHeaders']
    }

    rdfObject['rdf:RDF']['skos:ConceptScheme'].push(conceptScheme)
  })

  // Create the XML builder
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
    attributeNamePrefix: '@_'
  })

  // Build the final XML
  let versionName = version
  if (versionType === 'published') {
    versionName = 'published'
  }

  const rdf = builder.build(rdfObject)
  const outputPath = path.join(__dirname, '..', 'data', `schemes_${versionName}.rdf`)
  const fileHandle = await fs.open(outputPath, 'w')
  await fileHandle.writeFile(rdf)
  await fileHandle.close()
}

const fetchUUIDs = async (version) => {
  let baseUrl = 'https://gcmd.earthdata.nasa.gov/kms/concepts?format=json'
  if (version) {
    baseUrl += `&version=${version}`
  }

  const pageSize = 2000
  let allUUIDs = []
  let currentPage = 1
  let totalPages = 1

  try {
    while (currentPage <= totalPages) {
      const url = `${baseUrl}&page_num=${currentPage}&page_size=${pageSize}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      if (!data.concepts || !Array.isArray(data.concepts)) {
        throw new Error('Unexpected data structure: concepts array not found')
      }

      allUUIDs = allUUIDs.concat(data.concepts.map((concept) => concept.uuid))

      if (currentPage === 1) {
        totalPages = Math.ceil(data.hits / pageSize)
      }

      currentPage += 1

      if (currentPage <= totalPages) {
        // eslint-disable-next-line no-promise-executor-return
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }

    return allUUIDs
  } catch (error) {
    console.error('Error fetching UUIDs:', error)
    throw error
  }
}

const MAX_RETRIES = 10
const RETRY_DELAY = 2000 // 2 seconds

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

const processConcept = async (uuid, version, retryCount = 0) => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text'
  })

  let jsonFileURL = `https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}?format=json`
  let xmlFileURL = `https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}?format=xml`

  if (version) {
    jsonFileURL += `&version=${version}`
    xmlFileURL += `&version=${version}`
  }

  try {
    const processedData = await toRDF(jsonFileURL, xmlFileURL)
    const parsedData = parser.parse(processedData)

    if (!parsedData['rdf:RDF'] || !parsedData['rdf:RDF']['skos:Concept']) {
      throw new Error(`Unexpected data structure for UUID ${uuid}`)
    }

    return parsedData['rdf:RDF']['skos:Concept']
  } catch (error) {
    console.log(error)
    if (retryCount < MAX_RETRIES && (error.name === 'FetchError' || error.message.includes('HTTP error'))) {
      console.warn(`Network error for UUID ${uuid}. Retrying in ${RETRY_DELAY / 1000} seconds...`)
      await delay(RETRY_DELAY)

      return processConcept(uuid, version, retryCount + 1)
    }

    console.error(`Error processing UUID ${uuid}:`, error)
    throw new Error(`Failed to process concept ${uuid}: ${error.message}`)
  }
}

/**
 * Creates an rdf doc of all concepts by iterating through UUIDs, fetching their data in different formats, and synthesizing them into one .rdf
 */
const createRdfFile = async (version, versionType) => {
  try {
    let versionName = version
    if (versionType === 'published') {
      // eslint-disable-next-line no-param-reassign
      version = null
      versionName = 'published'
    }

    // Fetch UUIDs dynamically
    const extractedUUIDs = await fetchUUIDs(version)
    // Create output file handle
    const outputPath = path.join(__dirname, '..', 'data', `concepts_${versionName}.rdf`)

    const fileHandle = await fs.open(outputPath, 'w')

    // Create XML builder
    const builder = new XMLBuilder({
      format: true,
      indentBy: '  ',
      ignoreAttributes: false
    })

    // Write XML declaration and root element start
    await fileHandle.writeFile('<?xml version="1.0" encoding="UTF-8"?>\n')
    await fileHandle.writeFile('<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#" xmlns:gcmd="https://gcmd.earthdata.nasa.gov/kms#">\n')

    // Write gcmd:gcmd element
    const gcmdElement = {
      'gcmd:gcmd': {
        'gcmd:hits': extractedUUIDs.length.toString(),
        'gcmd:page_num': '1',
        'gcmd:page_size': extractedUUIDs.length.toString(),
        'gcmd:termsOfUse': 'https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf',
        'gcmd:keywordVersion': versionName,
        'gcmd:viewer': 'https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/all'
      }
    }
    await fileHandle.writeFile(builder.build(gcmdElement))

    // Process concepts and write to file
    const total = extractedUUIDs.length
    for (let i = 0; i < extractedUUIDs.length; i += 1) {
      const uuid = extractedUUIDs[i]
      try {
        console.log(`   processing ${i + 1}/${total} - ${uuid}`)
        const concept = await processConcept(uuid, version)
        const conceptXml = builder.build({ 'skos:Concept': concept })
        await fileHandle.writeFile(conceptXml)
        await delay(25)
      } catch (error) {
        console.log('Error processing concept ', uuid)
      }
    }

    // Write closing root element
    await fileHandle.writeFile('</rdf:RDF>\n')

    // Close the file handle
    await fileHandle.close()
  } catch (error) {
    console.error('Error in convertFiles:', error)
    throw error
  }
}

const main = async () => {
  try {
    const versionTypes = ['published', 'draft', 'past_published']
    for (const versionType of versionTypes) {
      if (versionType === 'draft') {
        // eslint-disable-next-line no-continue
        continue
      }

      let versions = await fetchVersions(versionType)
      if (versionType === 'past_published') {
        versions = versions.slice(0, 0)
      }

      // eslint-disable-next-line no-restricted-syntax
      for (const version of versions) {
        console.log(`*********** fetching ${version} ***********`)
        await createSchemes(version, versionType, await getXmlSchemes(version))
        await createRdfFile(version, versionType)
      }
    }
  } catch (error) {
    console.error('Conversion failed:', error)
    process.exit(1)
  }
}

main()
