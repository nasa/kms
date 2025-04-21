/* eslint-disable no-promise-executor-return */
/* eslint-disable no-restricted-syntax */
import fs from 'fs'
import path from 'path'
import url from 'url'

import fetch from 'node-fetch'

import { fetchVersions } from './lib/fetchVersions'

/* eslint-disable no-await-in-loop */
const LEGACY_SERVER = process.env.LEGACY_SERVER || 'http://localhost:9700'

/**
 * Exports and saves concept data from the GCMD API for different versions and types.
 * This works off a local mysql database.
 *
 * This function performs the following operations:
 * 1. Fetches versions for 'published' and 'draft' concepts, and optionally 'past_published' if specified.
 * 2. For each version and type, exports the concept data in JSON format from the GCMD API.
 * 3. Saves the exported data to JSON files in the '../data/export/json' directory.
 *
 * @async
 * @function exportData
 * @param {boolean} exportAll - If true, includes 'past_published' versions in addition to 'published' and 'draft'.
 *
 * @throws {Error} If there's an issue fetching data from the API or writing to files.
 *
 * File naming convention:
 * - For 'published' and 'draft': json_{published|draft}.json
 * - For 'past_published': json_v{version}.json
 * @example
 * // Exports only 'published' and 'draft' versions
 * exportData(false);
 *
 * @example
 * // Exports all versions including 'past_published'
 * exportData(true);
 */
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
  let fetchUrl = `${apiEndpoint}/kms/concepts_to_rdf_repo?format=${format}&fetch=1`
  fetchUrl += addVersionParameter(version, versionType)
  console.log('calling ', fetchUrl)

  const response = await fetch(fetchUrl)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.text()
}

/**
   * Creates JSON file for all concepts in a specified version by exporting concept data from the GCMD API.
   * This function orchestrates the export of raw JSON content used for building concept data.
   */
const createFiles = async (version, versionType) => {
  // eslint-disable-next-line no-underscore-dangle
  const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
  let jsonOutputPath
  if (versionType === 'past_published') {
    jsonOutputPath = path.join(__dirname, '..', 'data', 'export', 'json', `json_v${version}.json`)
  } else {
    jsonOutputPath = path.join(__dirname, '..', 'data', 'export', 'json', `json_${versionType}.json`)
  }

  // Ensure the directory exists
  const dir = path.dirname(jsonOutputPath)
  await fs.mkdir(dir, { recursive: true })

  // Check if file already exists
  if (fs.existsSync(jsonOutputPath)) {
    console.log(`RDF File already exists for ${versionType} ${version}. Skipping...`)

    return true // File exists, no export needed
  }

  const content = await fetchLegacyData(LEGACY_SERVER, 'json', version, versionType)
  const jsonStream = fs.createWriteStream(jsonOutputPath)
  jsonStream.write(content)
  await jsonStream.close()
  console.log(`Successfully created file for ${versionType} ${version}`)

  return false // File didn't exist, export was needed
}

const exportData = async (exportAll) => {
  const startTime = Date.now()

  try {
    const versionTypes = ['published', 'draft']
    if (exportAll) {
      versionTypes.push('past_published')
    }

    for (const versionType of versionTypes) {
      const versions = await fetchVersions(LEGACY_SERVER, versionType)

      for (const version of versions) {
        console.log(`\n*********** fetching version ${version} ${versionType} ***********`)
        const versionStartTime = Date.now()
        const fileExists = await createFiles(version, versionType)
        const versionEndTime = Date.now()
        const versionDuration = (versionEndTime - versionStartTime) / 1000 // Convert to seconds
        if (!fileExists) console.log(`Export for version ${version} ${versionType} took ${versionDuration.toFixed(2)} seconds.`)
      }
    }
  } catch (error) {
    console.error('Conversion failed:', error)
    process.exit(1)
  } finally {
    const endTime = Date.now()
    const totalDuration = (endTime - startTime) / 1000 // Convert to seconds
    console.log(`Total execution time: ${totalDuration.toFixed(2)} seconds`)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const exportAll = args.includes('-all')

// Run the main function
exportData(exportAll)
