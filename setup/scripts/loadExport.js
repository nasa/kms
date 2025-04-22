/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */

import { promises as fs } from 'fs'
import path from 'path'
import url from 'url'

import { recreateDatabase } from '../../serverless/src/recreateDatabase/handler'

import { fetchVersions } from './lib/fetchVersions'

const LEGACY_SERVER = process.env.LEGACY_SERVER || 'http://localhost:9700'

const baseUrl = 'http://localhost:8080/rdf4j-server'
const repoId = 'kms'
const rdf4jUrl = `${baseUrl}/repositories/${repoId}/statements`
const username = process.env.RDF4J_USER_NAME || 'rdf4j'
const password = process.env.RDF4J_PASSWORD || 'rdf4j'
const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64')

/* eslint-disable no-restricted-syntax */
const loadExport = async (downloadAll) => {
  const loadRDFXMLToRDF4J = async (filePath, graphId) => {
    try {
      const xmlData = await fs.readFile(filePath, 'utf8')
      console.log(`Read ${xmlData.length} bytes from file`)

      const graphUri = `https://gcmd.earthdata.nasa.gov/kms/version/${graphId}`
      const postUrl = new URL(rdf4jUrl)
      postUrl.searchParams.append('context', `<${graphUri}>`)

      const response = await fetch(postUrl, {
        method: 'POST',
        body: xmlData,
        headers: {
          'Content-Type': 'application/rdf+xml',
          Authorization: `Basic ${base64Credentials}`
        }
      })

      if (!response.ok) {
        const responseText = await response.text()
        console.log('Response text:', responseText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      console.log(`Successfully loaded ${filePath} into RDF4J`)
    } catch (error) {
      console.error(`Error loading ${filePath} into RDF4J:`, error)
    }
  }

  // eslint-disable-next-line no-promise-executor-return
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  try {
    process.env.RDF4J_SERVICE_URL = 'http://localhost:8080'

    await recreateDatabase()

    console.log('Sleeping for 1 minute before starting...')
    await sleep(60000)

    const versionTypes = ['published', 'draft']
    if (downloadAll) {
      versionTypes.push('past_published')
    }

    for (const versionType of versionTypes) {
      const versions = await fetchVersions(LEGACY_SERVER, versionType)

      for (const version of versions) {
        console.log(`\n*********** loading version ${version} ${versionType} ***********`)
        const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
        let rdfOutputPath
        let schemePath
        let graphId
        if (versionType === 'past_published') {
          rdfOutputPath = path.join(__dirname, '..', 'data', 'export', 'rdf', `concepts_${version}.rdf`)
          schemePath = path.join(__dirname, '..', 'data', 'export', 'rdf', `schemes_v${version}.rdf`)
          graphId = version
        } else {
          rdfOutputPath = path.join(__dirname, '..', 'data', 'export', 'rdf', `concepts_${versionType}.rdf`)
          schemePath = path.join(__dirname, '..', 'data', 'export', 'rdf', `schemes_${versionType}.rdf`)
          graphId = versionType
        }

        await loadRDFXMLToRDF4J(rdfOutputPath, graphId)
        await loadRDFXMLToRDF4J(schemePath, graphId)
      }
    }
  } catch (error) {
    console.error('Conversion failed:', error)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const loadAll = args.includes('-all')

// Run the main function
loadExport(loadAll)
