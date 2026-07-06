import { getEdlConfig } from '@/shared/getConfig'
import { logger } from '@/shared/logger'

import fetchEdlClientToken from './fetchEdlClientToken'

/**
 * Builds a token summary safe for logs without exposing the raw token value.
 *
 * @param {string} token Authorization token value from the request.
 * @returns {{tokenPresent: boolean, tokenType: string, tokenLength: number}}
 * Redacted token summary.
 */
const summarizeTokenForLogs = (token) => {
  const normalizedToken = token || ''
  const bearerMatch = normalizedToken.match(/^\s*bearer\s+(.*)$/i)
  const tokenValue = bearerMatch ? bearerMatch[1].trim() : normalizedToken.trim()
  let tokenType = 'missing'

  if (bearerMatch) {
    tokenType = 'bearer'
  } else if (tokenValue) {
    tokenType = 'launchpad'
  }

  return {
    tokenPresent: tokenValue.length > 0,
    tokenType,
    tokenLength: tokenValue.length
  }
}

/**
 * Extracts only the raw profile fields useful for authorization debugging.
 *
 * @param {Object} profile Raw profile payload from EDL.
 * @returns {Object} Redacted profile summary for logs.
 */
const summarizeRawProfileForLogs = (profile = {}) => ({
  keys: Object.keys(profile).sort(),
  uid: profile.uid,
  auid: profile.nams_auid,
  assuranceLevel: profile.assurance_level ?? profile.assuranceLevel,
  firstNamePresent: Boolean(profile.first_name),
  lastNamePresent: Boolean(profile.last_name)
})

/**
 * Extracts normalized profile fields relevant to authorizer decisions.
 *
 * @param {Object} profile Normalized profile payload.
 * @returns {Object} Redacted normalized profile summary for logs.
 */
const summarizeNormalizedProfileForLogs = (profile = {}) => ({
  keys: Object.keys(profile).sort(),
  uid: profile.uid,
  auid: profile.auid,
  assuranceLevel: profile.assuranceLevel,
  namePresent: Boolean(profile.name)
})

/**
 * Builds an EDL profile into the format expected by consumers
 * @param {Object} profile Raw EDL profile response
 * @returns {Object} Normalized profile containing auid, name, uid, assuranceLevel
 */
const buildProfile = (profile) => {
  const {
    first_name: firstName,
    last_name: lastName,
    nams_auid: auid,
    uid,
    assurance_level: assuranceLevel
  } = profile

  let name = [firstName, lastName].filter(Boolean).join(' ')

  if (name.trim().length === 0) {
    name = uid
  }

  return {
    auid,
    name,
    uid,
    assuranceLevel
  }
}

const buildEdlError = (response, source) => {
  const {
    status
  } = response

  if (status === 400 || status === 401) {
    return new Error('Unauthorized')
  }

  return new Error(`${source} failed with status ${status}`)
}

/**
 * Fetches the user profile using a Launchpad token via the Launchpad gateway
 * @param {string} host EDL host base URL
 * @param {string} launchpadToken Launchpad-provided token for the user
 * @returns {Promise<Object>} normalized profile enriched with assurance level 5
 */
const fetchProfileWithLaunchpadToken = async (host, launchpadToken) => {
  const clientToken = await fetchEdlClientToken()
  logger.debug('Fetched client token:', clientToken ? 'Present' : 'Not present')
  logger.info('[edl-profile] Fetching Launchpad profile via EDL gateway', {
    host,
    ...summarizeTokenForLogs(launchpadToken)
  })

  const response = await fetch(`${host}/api/nams/edl_user`, {
    body: `token=${launchpadToken}`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clientToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    }
  })

  logger.debug('EDL API response status:', response.status)

  if (!response.ok) {
    logger.error('Error response:', response)
    throw buildEdlError(response, 'EDL API request')
  }

  const profile = await response.json()
  logger.debug('Received EDL profile:', JSON.stringify(profile, null, 2))
  logger.info('[edl-profile] Received raw Launchpad profile summary', summarizeRawProfileForLogs(profile))

  const normalizedProfile = buildProfile(profile)
  logger.info('[edl-profile] Normalized Launchpad profile summary', summarizeNormalizedProfileForLogs(normalizedProfile))

  return {
    ...normalizedProfile,
    assuranceLevel: 5
  }
}

/**
 * Fetches the user profile directly from EDL using an access token
 * @param {string} host EDL host base URL
 * @param {string} edlToken Direct EDL access token (Bearer token)
 * @returns {Promise<Object>} normalized profile from the oauth endpoint
 */
const fetchProfileWithEdlAccessToken = async (host, edlToken) => {
  logger.info('[edl-profile] Fetching direct EDL bearer profile', {
    host,
    ...summarizeTokenForLogs(`Bearer ${edlToken}`)
  })

  const response = await fetch(`${host}/oauth/userInfo`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${edlToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    }
  })

  logger.debug('EDL oauth response status:', response.status)

  if (!response.ok) {
    logger.error('EDL oauth error response:', response)
    throw buildEdlError(response, 'EDL oauth request')
  }

  const profile = await response.json()
  logger.debug('Received EDL oauth profile:', JSON.stringify(profile, null, 2))
  logger.info('[edl-profile] Received raw bearer profile summary', summarizeRawProfileForLogs(profile))

  const normalizedProfile = buildProfile(profile)
  logger.info('[edl-profile] Normalized bearer profile summary', summarizeNormalizedProfileForLogs(normalizedProfile))

  return normalizedProfile
}

/**
 * Returns the user's EDL profile regardless of token type
 * @param {string} token Authorization token (Launchpad or Bearer EDL)
 * @returns {Promise<Object>} normalized EDL profile
 */
const fetchEdlProfile = async (token) => {
  logger.debug('Fetching EDL profile for token:', token ? 'Present' : 'Not present')
  const {
    IS_OFFLINE
  } = process.env

  if (IS_OFFLINE && token === 'ABC-1') {
    return {
      auid: 'admin',
      name: 'Admin User',
      uid: 'admin',
      assuranceLevel: 5
    }
  }

  const { host } = getEdlConfig()
  logger.debug('EDL host:', host)
  logger.info('[edl-profile] Starting profile lookup', {
    host,
    isOffline: Boolean(IS_OFFLINE),
    ...summarizeTokenForLogs(token)
  })

  try {
    const normalizedToken = token || ''
    const bearerMatch = normalizedToken.match(/^\s*bearer\s+(.*)$/i)

    if (bearerMatch) {
      const edlToken = bearerMatch[1].trim()

      if (!edlToken) {
        throw new Error('Invalid Bearer token provided')
      }

      logger.debug('Using EDL access token for profile lookup')
      logger.info('[edl-profile] Resolved token path', {
        tokenType: 'bearer'
      })

      return fetchProfileWithEdlAccessToken(host, edlToken)
    }

    const trimmedToken = normalizedToken.trim()
    logger.debug('Using Launchpad token for profile lookup')
    logger.info('[edl-profile] Resolved token path', {
      tokenType: 'launchpad'
    })

    return fetchProfileWithLaunchpadToken(host, trimmedToken)
  } catch (error) {
    logger.error('#fetchEdlProfile fetchEdlProfile Error:', error)

    throw error
  }
}

export default fetchEdlProfile
