import { promisify } from 'util'
import zlib from 'zlib'

import { getCmrSystemToken } from '@/shared/getCmrWriterToken'
import { getApplicationConfig } from '@/shared/getConfig'
import { logger } from '@/shared/logger'

const RDF_VERSIONS = ['published', 'draft']
const SOURCE_BASE_URLS = {
  sit: 'https://cmr.sit.earthdata.nasa.gov/kms',
  uat: 'https://cmr.uat.earthdata.nasa.gov/kms',
  prod: 'https://cmr.earthdata.nasa.gov/kms'
}
const gunzip = promisify(zlib.gunzip)

/**
 * Reads the Authorization header from an API Gateway event without modifying its value.
 *
 * @param {object} event API Gateway invocation event.
 * @returns {string|undefined} Incoming authorization value.
 */
const getRequestAuthorization = (event) => Object.entries(event.headers || {})
  .find(([headerName]) => headerName.toLowerCase() === 'authorization')?.[1]

/**
 * Resolves the configured source environment to its KMS API base URL.
 *
 * @returns {{sourceEnvironment: string, sourceBaseUrl: string}|undefined} Source configuration.
 * @throws {Error} When the configured environment is unsupported.
 */
const getSourceConfiguration = () => {
  const sourceEnvironment = String(process.env.RDF_MIRROR_SOURCE_ENV || '')
    .trim()
    .toLowerCase()

  if (!sourceEnvironment) return undefined

  const sourceBaseUrl = SOURCE_BASE_URLS[sourceEnvironment]

  if (!sourceBaseUrl) {
    throw new Error('RDF_MIRROR_SOURCE_ENV must be sit, uat, or prod')
  }

  return {
    sourceEnvironment,
    sourceBaseUrl
  }
}

/**
 * Requests and downloads one gzip-compressed RDF graph from the source KMS environment.
 *
 * @param {object} params Download parameters.
 * @param {string} params.authorization Authorization value forwarded to the source KMS API.
 * @param {string} params.sourceBaseUrl Source KMS API base URL.
 * @param {'published'|'draft'} params.version RDF graph version.
 * @returns {Promise<string>} Uncompressed RDF/XML content.
 */
const downloadRdf = async ({
  authorization,
  sourceBaseUrl,
  version
}) => {
  const headers = {
    Accept: 'application/json',
    Authorization: authorization
  }
  const exportResponse = await fetch(`${sourceBaseUrl}/rdf/export?version=${version}`, {
    method: 'POST',
    headers
  })

  if (!exportResponse.ok) {
    const responseText = await exportResponse.text()
    throw new Error(`Source ${version} export failed: ${exportResponse.status} ${responseText}`)
  }

  const { downloadUrl } = await exportResponse.json()

  if (!downloadUrl) {
    throw new Error(`Source ${version} export did not return a download URL`)
  }

  const downloadResponse = await fetch(downloadUrl)

  if (!downloadResponse.ok) {
    throw new Error(`Source ${version} download failed: ${downloadResponse.status}`)
  }

  let rdfXml
  try {
    const compressedRdf = Buffer.from(await downloadResponse.arrayBuffer())
    rdfXml = (await gunzip(compressedRdf)).toString('utf8')
  } catch (error) {
    throw new Error(`Source ${version} download is not valid gzip: ${error.message}`)
  }

  if (!rdfXml.includes('<rdf:RDF')) {
    throw new Error(`Source ${version} download does not contain RDF/XML`)
  }

  return rdfXml
}

/**
 * Replaces one version graph in the destination RDF4J repository.
 *
 * @param {object} params Import parameters.
 * @param {string} params.rdfXml RDF/XML to import.
 * @param {'published'|'draft'} params.version Destination graph version.
 * @returns {Promise<void>}
 */
const replaceDestinationGraph = async ({ rdfXml, version }) => {
  const serviceUrl = String(process.env.RDF4J_SERVICE_URL || 'http://localhost:8081')
    .replace(/\/$/, '')
  const repositoryId = process.env.RDF4J_REPOSITORY_ID || 'kms'
  const statementsUrl = new URL(`${serviceUrl}/rdf4j-server/repositories/${repositoryId}/statements`)
  const graphUri = `https://gcmd.earthdata.nasa.gov/kms/version/${version}`
  const credentials = Buffer.from(
    `${process.env.RDF4J_USER_NAME || 'rdf4j'}:${process.env.RDF4J_PASSWORD || 'rdf4j'}`
  ).toString('base64')
  const authorization = `Basic ${credentials}`

  statementsUrl.searchParams.set('context', `<${graphUri}>`)

  const clearResponse = await fetch(statementsUrl, {
    method: 'DELETE',
    headers: { Authorization: authorization }
  })

  if (!clearResponse.ok && clearResponse.status !== 404) {
    const responseText = await clearResponse.text()
    throw new Error(`Failed to clear destination ${version} graph: ${clearResponse.status} ${responseText}`)
  }

  const importResponse = await fetch(statementsUrl, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/rdf+xml'
    },
    body: rdfXml
  })

  if (!importResponse.ok) {
    const responseText = await importResponse.text()
    throw new Error(`Failed to import destination ${version} graph: ${importResponse.status} ${responseText}`)
  }
}

/**
 * Downloads published and draft RDF from the configured source environment and mirrors
 * both graphs into the local RDF4J repository.
 *
 * @param {object} event API Gateway or EventBridge invocation event.
 * @returns {Promise<object>} API Gateway-compatible result.
 */
export const mirrorRdf = async (event = {}) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const isApiRequest = Boolean(event.requestContext)

  try {
    const sourceConfiguration = getSourceConfiguration()

    if (!sourceConfiguration) {
      return {
        statusCode: 200,
        headers: defaultResponseHeaders,
        body: JSON.stringify({
          status: 'skipped',
          reason: 'RDF_MIRROR_SOURCE_ENV is not configured'
        })
      }
    }

    const authorization = isApiRequest
      ? getRequestAuthorization(event)
      : await getCmrSystemToken()

    if (!authorization) {
      throw new Error(isApiRequest
        ? 'Authorization header is unavailable'
        : 'CMR system token is unavailable')
    }

    // Complete every source download before modifying either destination graph.
    const rdfByVersion = await RDF_VERSIONS.reduce(
      (previousDownloads, version) => previousDownloads.then(async (downloads) => ({
        ...downloads,
        [version]: await downloadRdf({
          authorization,
          sourceBaseUrl: sourceConfiguration.sourceBaseUrl,
          version
        })
      })),
      Promise.resolve({})
    )

    await RDF_VERSIONS.reduce(
      (previousImport, version) => previousImport.then(() => replaceDestinationGraph({
        rdfXml: rdfByVersion[version],
        version
      })),
      Promise.resolve()
    )

    logger.info('[rdf-mirror] Mirrored RDF graphs', {
      sourceEnvironment: sourceConfiguration.sourceEnvironment,
      versions: RDF_VERSIONS
    })

    return {
      statusCode: 200,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        status: 'mirrored',
        sourceEnvironment: sourceConfiguration.sourceEnvironment,
        versions: RDF_VERSIONS
      })
    }
  } catch (error) {
    logger.error(`[rdf-mirror] Failed to mirror RDF graphs, error=${error.toString()}`)

    if (!isApiRequest) throw error

    return {
      statusCode: 500,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        error: 'Unable to mirror RDF graphs'
      })
    }
  }
}

export default mirrorRdf
