import { getEdlConfig } from '@/shared/getConfig'

import fetchEdlClientToken from './fetchEdlClientToken'
import { logger } from './logger'

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

/**
 * Fetches the user profile using a Launchpad token via the Launchpad gateway
 * @param {string} host EDL host base URL
 * @param {string} launchpadToken Launchpad-provided token for the user
 * @returns {Promise<Object>} normalized profile enriched with assurance level 5
 */
const fetchProfileWithLaunchpadToken = async (host, launchpadToken) => {
  const clientToken = await fetchEdlClientToken()
  logger.debug('Fetched client token:', clientToken ? 'Present' : 'Not present')

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
    throw new Error(`EDL API request failed with status ${response.status}`)
  }

  const profile = await response.json()
  logger.debug('Received EDL profile:', JSON.stringify(profile, null, 2))

  const normalizedProfile = buildProfile(profile)

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
    throw new Error(`EDL oauth request failed with status ${response.status}`)
  }

  const profile = await response.json()
  logger.debug('Received EDL oauth profile:', JSON.stringify(profile, null, 2))

  return buildProfile(profile)
}

/**
 * Returns the user's EDL profile regardless of token type
 * @param {string} launchpadToken Authorization token (Launchpad or Bearer EDL)
 * @returns {Promise<Object>} normalized EDL profile
 */
const fetchEdlProfile = async (launchpadToken) => {
  logger.debug('Fetching EDL profile for token:', launchpadToken ? 'Present' : 'Not present')
  const {
    IS_OFFLINE
  } = process.env

  if (IS_OFFLINE && launchpadToken === 'ABC-1') {
    return {
      auid: 'admin',
      name: 'Admin User',
      uid: 'admin',
      assuranceLevel: 5
    }
  }

  const { host } = getEdlConfig()
  logger.debug('EDL host:', host)

  try {
    const normalizedToken = launchpadToken || ''
    const bearerMatch = normalizedToken.match(/^\s*bearer\s+(.*)$/i)

    if (bearerMatch) {
      const edlToken = bearerMatch[1].trim()

      if (!edlToken) {
        throw new Error('Invalid Bearer token provided')
      }

      logger.debug('Using EDL access token for profile lookup')

      return fetchProfileWithEdlAccessToken(host, edlToken)
    }

    const trimmedToken = normalizedToken.trim()
    logger.debug('Using Launchpad token for profile lookup')

    return fetchProfileWithLaunchpadToken(host, trimmedToken)
  } catch (error) {
    logger.error('#fetchEdlProfile fetchEdlProfile Error:', error)

    throw error
  }
}

export default fetchEdlProfile
