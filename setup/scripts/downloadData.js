import fs from 'fs'
import https from 'https'
import path from 'path'
import url from 'url'

import fetch from 'node-fetch'

import { fetchVersions } from './lib/fetchVersions'

/* eslint-disable no-await-in-loop */
const LEGACY_SERVER = process.env.LEGACY_SERVER || 'https://gcmd.sit.earthdata.nasa.gov'

/**
 * Downloads and saves concept data from the GCMD API for different versions and types.
 *
 * This function performs the following operations:
 * 1. Fetches versions for 'published' and 'draft' concepts, and optionally 'past_published' if specified.
 * 2. For each version and type, downloads the concept data in JSON format from the GCMD API.
 * 3. Saves the downloaded data to JSON files in the '../data' directory.
 *
 * @async
 * @function downloadData
 * @param {boolean} downloadAll - If true, includes 'past_published' versions in addition to 'published' and 'draft'.
 *
 * @throws {Error} If there's an issue fetching data from the API or writing to files.
 *
 * File naming convention:
 * - For 'published' and 'draft': json_{published|draft}.json
 * - For 'past_published': json_v{version}.json
 *
 * The function uses the LEGACY_SERVER environment variable (default: 'https://gcmd.sit.earthdata.nasa.gov')
 * to determine the source of data.
 *
 * @example
 * // Download only 'published' and 'draft' versions
 * downloadData(false);
 *
 * @example
 * // Download all versions including 'past_published'
 * downloadData(true);
 */
const downloadData = async (downloadAll) => {
  let jsonStream

  const addVersionParameter = (version, versionType) => {
    if (versionType === 'past_published') {
      return `&version=${version}`
    }

    if (versionType === 'draft') {
      return `&version=${versionType}`
    }

    return ''
  }

  const fetchLegacyData = async (apiEndpoint, format, version, versionType) => {
    let fetchUrl = `${apiEndpoint}/kms/concepts_to_rdf_repo?format=${format}`
    fetchUrl += addVersionParameter(version, versionType)

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    })
    const response = await fetch(fetchUrl, { agent: httpsAgent })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.text()
  }

  /**
   * Creates JSON file for all concepts in a specified version by downloading concept data from the GCMD API.
   * This function orchestrates the download of raw JSON content used for building concept data.
   */
  const createFiles = async (version, versionType) => {
    try {
      // eslint-disable-next-line no-underscore-dangle
      const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
      // Create JSON output stream
      let jsonOutputPath
      if (versionType === 'past_published') {
        jsonOutputPath = path.join(__dirname, '..', 'data', `json_v${version}.json`)
      } else {
        jsonOutputPath = path.join(__dirname, '..', 'data', `json_${versionType}.json`)
      }

      const content = await fetchLegacyData(LEGACY_SERVER, 'json', version, versionType)
      jsonStream = fs.createWriteStream(jsonOutputPath)
      jsonStream.write(content)
      await jsonStream.close()
    } catch (error) {
      console.error('Error in convertFiles:', error)
      throw error
    }
  }

  try {
    const versionTypes = ['published', 'draft']
    if (downloadAll) {
      versionTypes.push('past_published')
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const versionType of versionTypes) {
      const versions = await fetchVersions(LEGACY_SERVER, versionType)

      // eslint-disable-next-line no-restricted-syntax
      for (const version of versions) {
        console.log(`*********** fetching version ${version} ${versionType} ***********`)
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
downloadData(downloadAll)
