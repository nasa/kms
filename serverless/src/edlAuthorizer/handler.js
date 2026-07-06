import { downcaseKeys } from '@/shared/downcaseKeys'
import fetchEdlProfile from '@/shared/fetchEdlProfile'
import { generatePolicy } from '@/shared/generatePolicy'
import { logger } from '@/shared/logger'

const REQUIRED_ASSURANCE_LEVEL = 5

/**
 * Builds a request summary safe for authorization logs.
 *
 * @param {Object} event API Gateway authorizer event.
 * @returns {Object} Redacted request summary.
 */
const summarizeEventForLogs = (event = {}) => {
  const {
    headers = {},
    authorizationToken,
    methodArn
  } = event
  const normalizedHeaders = downcaseKeys(headers)
  const headerToken = normalizedHeaders.authorization || ''
  const eventToken = authorizationToken || ''

  return {
    methodArnPresent: Boolean(methodArn),
    headerAuthorizationPresent: Boolean(headerToken),
    headerAuthorizationLength: headerToken.length,
    eventAuthorizationTokenPresent: Boolean(eventToken),
    eventAuthorizationTokenLength: eventToken.length
  }
}

/**
 * Summarizes the selected request token without exposing its raw value.
 *
 * @param {string} token Request authorization token.
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
 * Summarizes the normalized EDL profile fields used by the authorizer.
 *
 * @param {Object} profile Normalized EDL profile.
 * @returns {Object} Redacted profile summary.
 */
const summarizeProfileForLogs = (profile = {}) => ({
  keys: Object.keys(profile).sort(),
  uid: profile.uid,
  auid: profile.auid,
  assuranceLevel: profile.assuranceLevel,
  namePresent: Boolean(profile.name)
})

export const edlAuthorizer = async (event) => {
  logger.info('[edl-authorizer] Authorization request received', summarizeEventForLogs(event))
  const {
    headers = {},
    methodArn,
    authorizationToken
  } = event

  // First, try to get the token from headers (case-insensitive)
  let token = downcaseKeys(headers).authorization

  // If not found in headers, check if it's directly in the event as authorizationToken
  if (!token && authorizationToken) {
    token = authorizationToken
  }

  // If still not found, default to an empty string
  token = token || ''
  logger.debug('Launchpad token:', token ? 'Present' : 'Not present')
  logger.info('[edl-authorizer] Resolved request token', summarizeTokenForLogs(token))

  try {
    const profile = await fetchEdlProfile(token)
    logger.debug('Fetched EDL profile:', JSON.stringify(profile, null, 2))
    logger.info('[edl-authorizer] Retrieved normalized EDL profile', summarizeProfileForLogs(profile))
    const {
      uid,
      assuranceLevel
    } = profile || {}

    if (!uid) {
      logger.error('Authorization failed: No uid found in profile', {
        ...summarizeTokenForLogs(token),
        profile: summarizeProfileForLogs(profile)
      })

      return generatePolicy('user', 'Deny', methodArn)
    }

    const parsedAssuranceLevel = Number(assuranceLevel)

    if (Number.isNaN(parsedAssuranceLevel)) {
      logger.error('Authorization failed: Assurance level missing from profile', {
        ...summarizeTokenForLogs(token),
        profile: summarizeProfileForLogs(profile),
        rawAssuranceLevel: assuranceLevel,
        rawAssuranceLevelType: typeof assuranceLevel
      })

      return generatePolicy('user', 'Deny', methodArn)
    }

    if (parsedAssuranceLevel < REQUIRED_ASSURANCE_LEVEL) {
      logger.error(`Authorization failed: Assurance level ${parsedAssuranceLevel} below required ${REQUIRED_ASSURANCE_LEVEL}`, {
        ...summarizeTokenForLogs(token),
        profile: summarizeProfileForLogs(profile),
        parsedAssuranceLevel,
        requiredAssuranceLevel: REQUIRED_ASSURANCE_LEVEL
      })

      return generatePolicy('user', 'Deny', methodArn)
    }

    logger.debug('Authorization successful for uid:', uid)
    logger.info('[edl-authorizer] Authorization successful', {
      uid,
      parsedAssuranceLevel,
      requiredAssuranceLevel: REQUIRED_ASSURANCE_LEVEL,
      tokenType: summarizeTokenForLogs(token).tokenType
    })

    const policy = generatePolicy(uid, 'Allow', methodArn)
    logger.debug('Returning policy:', JSON.stringify(policy, null, 2))

    return policy
  } catch (error) {
    logger.error('EDL Authorizer error:', error, {
      ...summarizeEventForLogs(event),
      ...summarizeTokenForLogs(token),
      errorMessage: error?.message,
      errorName: error?.name
    })

    // Return a "Deny" policy for any caught errors
    const denyPolicy = generatePolicy('user', 'Deny', methodArn)
    logger.debug('Returning deny policy:', JSON.stringify(denyPolicy, null, 2))

    return denyPolicy
  }
}

export default edlAuthorizer
