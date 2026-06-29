#!/usr/bin/env node

import { spawn } from 'node:child_process'

const ENVIRONMENT_BASE_URLS = {
  sit: 'https://cmr.sit.earthdata.nasa.gov/kms',
  uat: 'https://cmr.uat.earthdata.nasa.gov/kms',
  prod: 'https://cmr.earthdata.nasa.gov/kms'
}

/**
 * Prints usage guidance and exits.
 *
 * This helper calls the real synchronous metadata-correction endpoint, so it can
 * mutate CMR metadata when writer-token rollout is enabled in the deployed env.
 *
 * @param {number} exitCode Process exit code.
 * @returns {never} Always exits the process.
 */
const showUsageAndExit = (exitCode) => {
  const message = [
    'Usage:',
    '  KMS_AUTHORIZATION=\'Bearer <token>\' \\',
    '  ALLOW_MUTATING_CORRECTION_ENDPOINT=true \\',
    '  node scripts/local/find_collection_with_positive_manual_sync_result.mjs <sit|uat|prod> [format] [providerId]',
    '',
    'Examples:',
    '  KMS_AUTHORIZATION=\'Bearer eyJ...\' ALLOW_MUTATING_CORRECTION_ENDPOINT=true \\',
    '    node scripts/local/find_collection_with_positive_manual_sync_result.mjs sit dif10 AMD_KOPRI',
    '',
    '  KMS_AUTHORIZATION=\'Bearer eyJ...\' ALLOW_MUTATING_CORRECTION_ENDPOINT=true \\',
    '    RESULT_FIELD=keywordValidationFailureCount node scripts/local/find_collection_with_positive_manual_sync_result.mjs uat echo10',
    '',
    'Optional environment variables:',
    '  RESULT_FIELD         JSON field to test. Defaults to resolvedCorrectionCount.',
    '                       Dot paths are supported, e.g. correctionResult.correctionsAppliedCount',
    '  MIN_VALUE            Minimum numeric value to count as a match. Defaults to 1.',
    '  MAX_CONCEPTS         Optional cap on how many concept ids to try.',
    '  REQUEST_DELAY_MS     Optional delay between endpoint calls. Defaults to 0.',
    '  STOP_ON_ERROR        When true, throw on the first non-2xx response instead of skipping it.',
    '  KMS_BASE_URL         Optional KMS base URL override.',
    '',
    'Safety:',
    '  This script calls PUT /metadata_correction/{collectionConceptId}.',
    '  Set ALLOW_MUTATING_CORRECTION_ENDPOINT=true to acknowledge that it may',
    '  write corrected metadata back to CMR when writeback is enabled.'
  ].join('\n')

  const output = exitCode === 0 ? process.stdout : process.stderr
  output.write(`${message}\n`)
  process.exit(exitCode)
}

/**
 * Resolves the requested environment into a KMS base URL.
 *
 * @param {string|undefined} environmentArg CLI environment argument.
 * @returns {{environment: string, baseUrl: string}} Normalized environment and base URL.
 */
const resolveEnvironment = (environmentArg) => {
  const environment = String(environmentArg || '').trim().toLowerCase()
  const baseUrl = process.env.KMS_BASE_URL || ENVIRONMENT_BASE_URLS[environment]

  if (!baseUrl) {
    throw new Error(`Unsupported environment "${environmentArg}". Expected one of: sit, uat, prod`)
  }

  return {
    environment,
    baseUrl
  }
}

/**
 * Parses a positive integer from an environment variable, with a fallback.
 *
 * @param {string|undefined} rawValue Raw environment variable value.
 * @param {number} defaultValue Value to use when the env var is absent.
 * @param {string} variableName Variable name for error messages.
 * @returns {number} Parsed positive integer.
 */
const parsePositiveInteger = (rawValue, defaultValue, variableName) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue
  }

  const parsed = Number(rawValue)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${variableName} must be a positive integer, received "${rawValue}"`)
  }

  return parsed
}

/**
 * Parses a non-negative integer from an environment variable, with a fallback.
 *
 * @param {string|undefined} rawValue Raw environment variable value.
 * @param {number} defaultValue Value to use when the env var is absent.
 * @param {string} variableName Variable name for error messages.
 * @returns {number} Parsed non-negative integer.
 */
const parseNonNegativeInteger = (rawValue, defaultValue, variableName) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue
  }

  const parsed = Number(rawValue)

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${variableName} must be a non-negative integer, received "${rawValue}"`)
  }

  return parsed
}

/**
 * Sleeps for a short delay between endpoint calls when throttling is desired.
 *
 * @param {number} ms Milliseconds to pause.
 * @returns {Promise<void>} Resolves after the delay.
 */
const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

/**
 * Runs the existing concept-listing helper and parses its JSON stdout.
 *
 * @param {object} params Script inputs.
 * @param {string} params.environment Target CMR/KMS environment.
 * @param {string} params.format Native format alias or MIME type.
 * @returns {Promise<string[]>} Concept ids returned by the listing script.
 */
const listCollectionConceptIds = async ({
  environment,
  format
}) => new Promise((resolve, reject) => {
  const child = spawn(
    'node',
    [
      'scripts/local/list_collection_concept_ids_by_native_format.mjs',
      environment,
      format
    ],
    {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )

  let stdout = ''
  let stderr = ''

  child.stdout.on('data', (chunk) => {
    stdout += String(chunk)
  })

  child.stderr.on('data', (chunk) => {
    stderr += String(chunk)
    process.stderr.write(String(chunk))
  })

  child.on('error', reject)

  child.on('close', (code) => {
    if (code !== 0) {
      reject(new Error(
        'Failed to list collection concept ids. '
        + `Exit code: ${code}. ${stderr.trim()}`
      ))

      return
    }

    try {
      const conceptIds = JSON.parse(stdout)

      if (!Array.isArray(conceptIds)) {
        throw new Error('Expected a JSON array of concept ids.')
      }

      resolve(conceptIds)
    } catch (error) {
      reject(new Error(
        'Failed to parse concept id list output. '
        + `Error: ${error.message}`
      ))
    }
  })
})

/**
 * Reads a nested value from an object using dot-path syntax.
 *
 * @param {object} responseBody Parsed JSON response body.
 * @param {string} fieldPath Dot-path to read.
 * @returns {unknown} Nested value or `undefined`.
 */
const getFieldValue = (responseBody, fieldPath) => fieldPath
  .split('.')
  .reduce((value, segment) => (
    value && typeof value === 'object'
      ? value[segment]
      : undefined
  ), responseBody)

/**
 * Compacts an error response body into a one-line snippet for stderr logging.
 *
 * @param {string} bodyText Raw HTTP response body.
 * @returns {string} Trimmed one-line body preview.
 */
const formatErrorBodySnippet = (bodyText) => String(bodyText || '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 500)

/**
 * Calls the synchronous metadata-correction endpoint for one concept id.
 *
 * @param {object} params Request inputs.
 * @param {string} params.baseUrl Target KMS base URL.
 * @param {string} params.authorizationValue Authorization header value.
 * @param {string} params.collectionConceptId Collection concept id to test.
 * @returns {Promise<{ok: boolean, status: number, bodyText: string, responseBody?: object}>}
 * Raw response details plus parsed JSON when available.
 */
const callManualSyncEndpoint = async ({
  baseUrl,
  authorizationValue,
  collectionConceptId
}) => {
  const requestUrl = `${baseUrl}/metadata_correction/${encodeURIComponent(collectionConceptId)}`
  const response = await fetch(requestUrl, {
    method: 'PUT',
    headers: {
      Authorization: authorizationValue,
      Accept: 'application/json'
    }
  })

  const bodyText = await response.text()
  let responseBody

  try {
    responseBody = JSON.parse(bodyText)
  } catch {
    // Keep the raw body for debug output when the response is not JSON.
  }

  return {
    ok: response.ok,
    status: response.status,
    bodyText,
    responseBody
  }
}

/**
 * Filters concept ids down to one provider when requested.
 *
 * @param {string[]} conceptIds Candidate concept ids.
 * @param {string|undefined} providerId Optional provider id suffix filter.
 * @returns {string[]} Filtered concept ids.
 */
const filterConceptIdsByProvider = (conceptIds, providerId) => {
  const normalizedProviderId = String(providerId || '').trim()

  if (!normalizedProviderId) {
    return conceptIds
  }

  const suffix = `-${normalizedProviderId}`

  return conceptIds.filter((conceptId) => String(conceptId).endsWith(suffix))
}

/**
 * Formats the result summary returned to stdout when a match is found.
 *
 * @param {object} params Summary inputs.
 * @param {string} params.collectionConceptId Matching concept id.
 * @param {number} params.inspectedCount Number of collections tried.
 * @param {string} params.resultField JSON field that matched.
 * @param {number} params.resultValue Numeric field value that matched.
 * @param {object} params.responseBody Full endpoint response body.
 * @returns {object} Serializable match summary.
 */
const buildMatchSummary = ({
  collectionConceptId,
  inspectedCount,
  resultField,
  resultValue,
  responseBody
}) => ({
  collectionConceptId,
  inspectedCount,
  matchedField: resultField,
  matchedValue: resultValue,
  response: responseBody
})

/**
 * Walks collection ids one at a time until the requested response field exceeds the threshold.
 *
 * This is intentionally sequential so we do not blast the live sync endpoint with parallel
 * mutation requests while searching for a useful test collection.
 *
 * @param {object} params Search inputs.
 * @param {string[]} params.candidateConceptIds Remaining concept ids to inspect.
 * @param {string} params.baseUrl Target KMS base URL.
 * @param {string} params.authorizationValue Authorization header value.
 * @param {string} params.resultField Dot-path field to inspect on the JSON response.
 * @param {number} params.minValue Minimum numeric value that counts as a match.
 * @param {number} params.requestDelayMs Delay between requests.
 * @param {boolean} params.stopOnError When true, throw on the first non-2xx response.
 * @param {number} [params.inspectedCount=0] Number of requests already attempted.
 * @returns {Promise<object>} Match summary or a no-match summary when exhausted.
 */
const findFirstMatchingCollection = async ({
  candidateConceptIds,
  baseUrl,
  authorizationValue,
  resultField,
  minValue,
  requestDelayMs,
  stopOnError,
  inspectedCount = 0
}) => {
  if (candidateConceptIds.length === 0) {
    return {
      collectionConceptId: null,
      inspectedCount,
      matchedField: resultField,
      matchedValue: 0,
      response: null
    }
  }

  const [collectionConceptId, ...remainingConceptIds] = candidateConceptIds
  const nextInspectedCount = inspectedCount + 1

  process.stderr.write(
    `[find-positive-manual-sync-result] (${nextInspectedCount}/${nextInspectedCount + remainingConceptIds.length}) `
    + `PUT ${collectionConceptId}\n`
  )

  const result = await callManualSyncEndpoint({
    baseUrl,
    authorizationValue,
    collectionConceptId
  })

  if (!result.ok) {
    const errorBodySnippet = formatErrorBodySnippet(result.bodyText)

    process.stderr.write(
      `[find-positive-manual-sync-result] Skipping ${collectionConceptId}; `
      + `endpoint returned ${result.status}${errorBodySnippet ? ` body=${errorBodySnippet}` : ''}\n`
    )

    if (stopOnError) {
      throw new Error(
        `Manual sync endpoint failed for ${collectionConceptId} `
        + `with status ${result.status}. ${errorBodySnippet || 'No response body returned.'}`
      )
    }

    if (requestDelayMs > 0) {
      await sleep(requestDelayMs)
    }

    return findFirstMatchingCollection({
      candidateConceptIds: remainingConceptIds,
      baseUrl,
      authorizationValue,
      resultField,
      minValue,
      requestDelayMs,
      stopOnError,
      inspectedCount: nextInspectedCount
    })
  }

  const resultValue = Number(getFieldValue(result.responseBody, resultField) || 0)

  process.stderr.write(
    `[find-positive-manual-sync-result] ${collectionConceptId} -> ${resultField}=${resultValue}\n`
  )

  if (resultValue >= minValue) {
    return buildMatchSummary({
      collectionConceptId,
      inspectedCount: nextInspectedCount,
      resultField,
      resultValue,
      responseBody: result.responseBody
    })
  }

  if (requestDelayMs > 0) {
    await sleep(requestDelayMs)
  }

  return findFirstMatchingCollection({
    candidateConceptIds: remainingConceptIds,
    baseUrl,
    authorizationValue,
    resultField,
    minValue,
    requestDelayMs,
    stopOnError,
    inspectedCount: nextInspectedCount
  })
}

const main = async () => {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsageAndExit(0)
  }

  if (String(process.env.ALLOW_MUTATING_CORRECTION_ENDPOINT || '').toLowerCase() !== 'true') {
    throw new Error(
      'Refusing to call the mutating metadata correction endpoint. '
      + 'Set ALLOW_MUTATING_CORRECTION_ENDPOINT=true to continue.'
    )
  }

  const environmentArg = process.argv[2]
  const format = String(process.argv[3] || 'dif10').trim()
  const providerId = process.argv[4]
  const authorizationValue = String(process.env.KMS_AUTHORIZATION || '').trim()

  if (!environmentArg) {
    showUsageAndExit(1)
  }

  if (!authorizationValue) {
    throw new Error('Missing KMS_AUTHORIZATION environment variable.')
  }

  const { environment, baseUrl } = resolveEnvironment(environmentArg)
  const resultField = String(process.env.RESULT_FIELD || 'resolvedCorrectionCount').trim()
  const minValue = parsePositiveInteger(process.env.MIN_VALUE, 1, 'MIN_VALUE')
  const requestDelayMs = parseNonNegativeInteger(process.env.REQUEST_DELAY_MS, 0, 'REQUEST_DELAY_MS')
  const stopOnError = String(process.env.STOP_ON_ERROR || '').toLowerCase() === 'true'
  const maxConcepts = process.env.MAX_CONCEPTS
    ? parsePositiveInteger(process.env.MAX_CONCEPTS, 1, 'MAX_CONCEPTS')
    : undefined

  process.stderr.write(
    `[find-positive-manual-sync-result] Listing ${format} collections in ${environment}\n`
  )

  const conceptIds = filterConceptIdsByProvider(
    await listCollectionConceptIds({
      environment,
      format
    }),
    providerId
  )

  if (conceptIds.length === 0) {
    throw new Error('No candidate collection concept ids were found for the requested filter.')
  }

  const candidateConceptIds = maxConcepts
    ? conceptIds.slice(0, maxConcepts)
    : conceptIds

  process.stderr.write(
    `[find-positive-manual-sync-result] Trying ${candidateConceptIds.length} collection concept ids `
    + `against ${baseUrl}/metadata_correction/{collectionConceptId}\n`
  )

  const summary = await findFirstMatchingCollection({
    candidateConceptIds,
    baseUrl,
    authorizationValue,
    resultField,
    minValue,
    requestDelayMs,
    stopOnError
  })

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

await main()
