/* eslint-disable no-underscore-dangle */
/* eslint-disable import/extensions */
/* eslint-disable no-restricted-syntax */
import fs from 'fs'
import path from 'path'
import url from 'url'

import { delay } from '../../serverless/src/shared/delay'

import { fetchConceptIds } from './fetchConceptIds.js'
import { fetchVersions } from './fetchVersions.js'

/* eslint-disable no-await-in-loop */
const MAX_RETRIES = 10
const RETRY_DELAY = 2000 // 2 seconds

let jsonStream
let xmlStream

/**
 * Processes a single concept, fetching its JSON and XML representations from the GCMD API.
 * This function downloads the raw data used for building concept data.
 *
 * @param {string} uuid - The UUID of the concept to process.
 * @param {string|null} version - The version of the concept to fetch, or null for the latest version.
 * @param {number} retryCount - The number of times this function has been retried.
 * @returns {Promise<Object>} A promise that resolves to an object indicating success and the processed UUID.
 * @throws {Error} If processing fails after maximum retries.
 */
const processConcept = async (uuid, version, retryCount = 0) => {
  let jsonFileURL = `https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}?format=json`
  let xmlFileURL = `https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}?format=xml`

  if (version) {
    jsonFileURL += `&version=${version}`
    xmlFileURL += `&version=${version}`
  }

  try {
    const writeToStream = (stream, data) => new Promise((resolve) => {
      if (!stream.write(data)) {
        stream.once('drain', resolve)
      } else {
        process.nextTick(resolve)
      }
    })

    const jsonResponse = await fetch(jsonFileURL)
    const json = await jsonResponse.json()
    await writeToStream(jsonStream, `${JSON.stringify(json, null, 2)}\n`)

    const xmlResponse = await fetch(xmlFileURL)
    let xmlText = await xmlResponse.text()
    xmlText = xmlText.replace('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', '')
    await writeToStream(xmlStream, `${xmlText}\n`)

    return {
      success: true,
      uuid
    }
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
 * Creates JSON and XML files for all concepts in a specified version by downloading concept data from the GCMD API.
 * This function orchestrates the download of raw JSON and XML content used for building concept data.
 *
 * @param {string} version - The version to process.
 * @param {string} versionType - The type of version (e.g., 'published', 'draft').
 * @throws {Error} If there's an error during file creation or concept data download.
 */
const createFiles = async (version, versionType) => {
  try {
    let versionName = version
    if (versionType === 'published') {
      // eslint-disable-next-line no-param-reassign
      version = null
      versionName = 'published'
    }

    // Fetch UUIDs dynamically
    const extractedUUIDs = await fetchConceptIds(version)
    const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
    // Create JSON and XML output streams
    const jsonOutputPath = path.join(__dirname, '..', 'data', `json_results_${versionName}.json`)
    const xmlOutputPath = path.join(__dirname, '..', 'data', `xml_results_${versionName}.xml`)
    jsonStream = fs.createWriteStream(jsonOutputPath)

    jsonStream.write('[')
    xmlStream = fs.createWriteStream(xmlOutputPath)
    xmlStream.write('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n')
    xmlStream.write('<concepts>')

    // Process concepts and write to file
    const total = extractedUUIDs.length
    for (let i = 0; i < extractedUUIDs.length; i += 1) {
      const uuid = extractedUUIDs[i]
      try {
        console.log(`   processing ${i + 1}/${total} - ${uuid}`)
        await processConcept(uuid, version)
        if (i !== extractedUUIDs.length - 1) {
          jsonStream.write(',')
        }

        await delay(25)
      } catch (error) {
        console.log('Error processing concept ', uuid)
      }
    }

    jsonStream.write(']')
    await jsonStream.close()
    xmlStream.write('</concepts>')
    await xmlStream.close()
  } catch (error) {
    console.error('Error in convertFiles:', error)
    throw error
  }
}

/**
 * Main function to orchestrate the download of concept data for various GCMD keyword versions.
 * This function initiates the process of downloading JSON and XML content for all concepts across different versions.
 *
 * @param {boolean} downloadAll - Whether to download all versions including past published versions.
 */
const main = async (downloadAll) => {
  try {
    const versionTypes = ['published', 'draft']
    if (downloadAll) {
      versionTypes.push('past_published')
    }

    for (const versionType of versionTypes) {
      const versions = await fetchVersions(versionType)

      // eslint-disable-next-line no-restricted-syntax
      for (const version of versions) {
        console.log(`*********** fetching ${version} ***********`)
        await createFiles(version, versionType)
      }
    }
  } catch (error) {
    console.error('Conversion failed:', error)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const downloadAll = args.includes('-all')

// Run the main function
main(downloadAll)
