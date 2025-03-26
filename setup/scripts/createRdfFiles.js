/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import { existsSync, promises as fs } from 'fs'
import path from 'path'
import url from 'url'

import { XMLBuilder, XMLParser } from 'fast-xml-parser'

import { buildJsonMap } from '../../serverless/src/shared/buildJsonMap'
import { buildXmlMap } from '../../serverless/src/shared/buildXmlMap'
import { toRDF } from '../../serverless/src/shared/toRDF'

import { fetchVersions } from './fetchVersions'

/**
 * Fetches XML schemes for a given version from the GCMD API.
 *
 * @async
 * @function getXmlSchemes
 * @param {string} version - The version of the schemes to fetch. Use 'published' for the latest published version.
 * @returns {Promise<string>} The XML content of the schemes.
 * @throws {Error} If there's an HTTP error or any other issue fetching the schemes.
 */
const getXmlSchemes = async (version) => {
  let schemesUrl = 'https://gcmd.earthdata.nasa.gov/kms/concept_schemes'
  if (version !== 'published') {
    schemesUrl += `?version=${version}`
  }

  try {
    const response = await fetch(schemesUrl)

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

/**
 * Creates an RDF file for the concept schemes of a specific version.
 *
 * @async
 * @function createSchemes
 * @param {string} version - The version of the schemes.
 * @param {string} versionType - The type of the version (e.g., 'published', 'draft').
 * @param {string} versionName - The name to use for the version in file naming.
 * @param {string} xmlInput - The XML content of the schemes.
 * @throws {Error} If there's an issue parsing the XML or writing the RDF file.
 */
const createSchemes = async (version, versionType, versionName, xmlInput) => {
  console.log('creating schemes for ', version, versionType)
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

  const rdf = builder.build(rdfObject)
  const outputPath = path.join(__dirname, '..', 'data', `schemes_${versionName}.rdf`)
  const fileHandle = await fs.open(outputPath, 'w')
  await fileHandle.writeFile(rdf)
  await fileHandle.close()
}

/**
 * Creates an RDF file by synthesizing JSON and XML data for all concepts of a specific version.
 *
 * This function performs the following steps:
 * 1. Builds JSON and XML maps from the input content.
 * 2. Extracts UUIDs from the JSON map.
 * 3. Creates an RDF file and writes the XML declaration and root element.
 * 4. Adds metadata about the version and concept count.
 * 5. Iterates through each concept, synthesizing its JSON and XML data into RDF format.
 * 6. Writes each concept's RDF representation to the file.
 *
 * @async
 * @function createRdfFile
 * @param {string} versionName - The name of the version to use in file naming.
 * @param {string} jsonContent - The JSON content containing concept data for all concepts.
 * @param {string} xmlContent - The XML content containing concept data for all concepts.
 * @throws {Error} If there's an issue processing the concepts or writing the RDF file.
 */
const createRdfFile = async (versionName, jsonContent, xmlContent) => {
  try {
    console.log('creating rdf file for ', versionName)
    const jsonMap = await buildJsonMap(jsonContent)
    const xmlMap = await buildXmlMap(xmlContent)

    // Fetch UUIDs dynamically
    const extractedUUIDs = Object.keys(jsonMap)
    console.log('creating rdf file for ', versionName, extractedUUIDs)
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
        const json = jsonMap[uuid]
        const xml = xmlMap[uuid]
        if (json && xml) {
          const conceptXml = toRDF(json, xml)
          await fileHandle.writeFile(conceptXml)
        }
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

/**
 * Main function to orchestrate the creation of RDF files for GCMD keyword versions.
 *
 * This function performs the following steps for each version:
 * 1. Fetches and processes concept schemes, creating an RDF file for the schemes.
 * 2. Checks for the existence of previously generated JSON and XML files for the concepts.
 * 3. If the files exist, reads them and calls createRdfFile to synthesize the JSON and XML data into a single RDF file for all concepts.
 * 4. If either file doesn't exist, throws an error.
 *
 * @async
 * @function main
 * @param {boolean} downloadAll - If true, includes past published versions in addition to current published and draft versions.
 * @throws {Error} If there's an issue fetching versions, processing schemes, or if JSON/XML files are missing.
 */
const main = async (downloadAll) => {
  try {
    const versionTypes = ['published', 'draft']
    if (downloadAll) {
      versionTypes.push('past_published')
    }

    for (const versionType of versionTypes) {
      const versions = await fetchVersions(versionType)

      for (const version of versions) {
        console.log(`*********** fetching ${version} ***********`)
        let versionName = version
        if (versionType === 'published') {
          versionName = 'published'
        }

        await createSchemes(version, versionType, versionName, await getXmlSchemes(version))

        // eslint-disable-next-line no-underscore-dangle
        const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
        const jsonOutputPath = path.join(__dirname, '..', 'data', `json_results_${versionName}.json`)
        const xmlOutputPath = path.join(__dirname, '..', 'data', `xml_results_${versionName}.xml`)

        // Check if both files exist
        if (!existsSync(jsonOutputPath)) {
          throw new Error(`JSON file not found: ${jsonOutputPath}`)
        }

        if (!existsSync(xmlOutputPath)) {
          throw new Error(`XML file not found: ${xmlOutputPath}`)
        }

        const jsonContent = await fs.readFile(jsonOutputPath, 'utf8')
        const xmlContent = await fs.readFile(xmlOutputPath, 'utf8')

        await createRdfFile(versionName, jsonContent, xmlContent)
      }
    }
  } catch (error) {
    console.error('Conversion failed:', error)
    process.exit(1)
  }
}

const args = process.argv.slice(2)
const downloadAll = args.includes('-all')

main(downloadAll)
