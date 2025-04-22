/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { existsSync, promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import fetch from 'node-fetch'

import { buildJsonMap } from '../../serverless/src/shared/buildJsonMap'
import { toRDF } from '../../serverless/src/shared/toRDF'

import { fetchVersions } from './lib/fetchVersions'

const LEGACY_SERVER = process.env.LEGACY_SERVER || 'http://localhost:9700'

/**
 * Creates RDF files for concept schemes and concepts based on legacy JSON data.
 *
 * This function performs the following operations:
 * 1. Fetches versions for both 'published' and 'draft' concepts.
 * 2. For each version:
 *    a. Creates an RDF file for concept schemes.
 *    b. Creates an RDF file for concepts.
 *
 * The function uses the LEGACY_SERVER environment variable to determine the source of data.
 * It processes both 'published' and 'draft' version types.
 *
 * The function creates the following files:
 * - schemes_v{version}.rdf or schemes_{draft|published}.rdf: Contains RDF data for concept schemes.
 * - concepts_{version}.rdf or concepts_{draft|published}.rdf: Contains RDF data for concepts.
 *
 * @async
 * @function createRdfFiles
 * @throws {Error} If there's an issue reading input files or writing output files.
 *
 * @example
 * createRdfFiles();
 */
const createRdfFiles = async () => {
  const getCreationDateMap = async () => {
    const versionsUrl = `${LEGACY_SERVER}/kms/concept_versions/all`
    const versionsResponse = await fetch(versionsUrl)
    const versionsXml = await versionsResponse.text()
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: 'value',
      parseAttributeValue: false,
      parseTagValue: false,
      tagValueProcessor: (tagName, tagValue) => tagValue?.toString() || '',
      attributeValueProcessor: (attrName, attrValue) => attrValue?.toString() || ''
    })
    const versionsJson = parser.parse(versionsXml)
    const versionsArray = versionsJson.versions.version
    const map = {}
    versionsArray.forEach((versionInfo) => {
      map[versionInfo.value] = versionInfo['@_creation_date']
    })

    return map
  }

  // Creates an RDF file by converting legacy JSON to RDF skos:Concept for all concepts of a specific version.
  const createRdfFile = async (version, versionType, jsonContent) => {
    try {
      console.log('creating rdf file for ', version, versionType)
      const jsonMap = await buildJsonMap(jsonContent)

      // Fetch UUIDs dynamically
      const extractedUUIDs = Object.keys(jsonMap)
      console.log('creating rdf file for ', version, versionType, extractedUUIDs)
      // Create output file handle
      let outputPath
      if (versionType === 'past_published') {
        outputPath = path.join(__dirname, '..', 'data', 'export', 'rdf', `concepts_${version}.rdf`)
      } else {
        outputPath = path.join(__dirname, '..', 'data', 'export', 'rdf', `concepts_${versionType}.rdf`)
      }

      // Ensure the directory exists
      const dir = path.dirname(outputPath)
      await fs.mkdir(dir, { recursive: true })

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
          'gcmd:keywordVersion': version,
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
          if (json) {
            const conceptXml = toRDF(json)
            // eslint-disable-next-line no-await-in-loop
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

  const addVersionParameter = (version, versionType) => {
    if (versionType === 'past_published') {
      return `?version=${version}`
    }

    if (versionType === 'draft') {
      return `?version=${versionType}`
    }

    return ''
  }

  // Fetches XML schemes for a given version from the GCMD API.
  const getXmlSchemes = async (version, versionType) => {
    let schemesUrl = `${LEGACY_SERVER}/kms/concept_schemes`
    schemesUrl += addVersionParameter(version, versionType)

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

  // Creates an RDF file for the concept schemes of a specific version.
  const createSchemes = async (version, versionType, xmlInput, creationDateMap) => {
    console.log('creating schemes for ', version, versionType)
    // Parse the input XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    })
    const parsedXml = parser.parse(xmlInput)

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
          'gcmd:versionType': versionType
        },
        'skos:ConceptScheme': []
      }
    }
    rdfObject['rdf:RDF']['gcmd:Version']['dcterms:created'] = creationDateMap[version]

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
    let outputPath
    if (versionType === 'past_published') {
      outputPath = path.join(__dirname, '..', 'data', 'export', 'rdf', `schemes_v${version}.rdf`)
    } else {
      outputPath = path.join(__dirname, '..', 'data', 'export', 'rdf', `schemes_${versionType}.rdf`)
    }

    // Ensure the directory exists
    const dir = path.dirname(outputPath)
    await fs.mkdir(dir, { recursive: true })

    const fileHandle = await fs.open(outputPath, 'w')
    await fileHandle.writeFile(rdf)
    await fileHandle.close()
  }

  try {
    const creationDateMap = await getCreationDateMap()

    const versionTypes = ['published', 'draft', 'past_published']

    for (const versionType of versionTypes) {
      console.log('version type', versionType)
      const versions = await fetchVersions(LEGACY_SERVER, versionType)

      for (const version of versions) {
        console.log(`*********** fetching ${version} ${versionType} ***********`)

        await createSchemes(version, versionType, await getXmlSchemes(version, versionType), creationDateMap)

        // eslint-disable-next-line no-underscore-dangle
        const __dirname = fileURLToPath(new URL('.', import.meta.url))
        let jsonInputPath
        if (versionType === 'past_published') {
          jsonInputPath = path.join(__dirname, '..', 'data', 'export', 'json', `json_v${version}.json`)
        } else {
          jsonInputPath = path.join(__dirname, '..', 'data', 'export', 'json', `json_${versionType}.json`)
        }

        // Check if both files exist
        if (!existsSync(jsonInputPath)) {
          throw new Error(`JSON file not found: ${jsonInputPath}`)
        }

        const jsonContent = await fs.readFile(jsonInputPath, 'utf8')

        await createRdfFile(version, versionType, jsonContent)
      }
    }
  } catch (error) {
    console.error('Conversion failed:', error)
    process.exit(1)
  }
}

createRdfFiles()
