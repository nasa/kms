import { downcaseKeys } from '@/shared/downcaseKeys'
import fetchEdlProfile from '@/shared/fetchEdlProfile'
import { generatePolicy } from '@/shared/generatePolicy'
import { logger } from '@/shared/logger'

const REQUIRED_ASSURANCE_LEVEL = 5

export const edlAuthorizer = async (event) => {
  logger.debug('EDL Authorizer called with event:', JSON.stringify(event, null, 2))
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

  try {
    const profile = await fetchEdlProfile(token)
    logger.debug('Fetched EDL profile:', JSON.stringify(profile, null, 2))
    const {
      uid,
      assuranceLevel
    } = profile || {}

    if (!uid) {
      logger.error('Authorization failed: No uid found in profile')

      return generatePolicy('user', 'Deny', methodArn)
    }

    const parsedAssuranceLevel = Number(assuranceLevel)

    if (Number.isNaN(parsedAssuranceLevel)) {
      logger.error('Authorization failed: Assurance level missing from profile')

      return generatePolicy('user', 'Deny', methodArn)
    }

    if (parsedAssuranceLevel < REQUIRED_ASSURANCE_LEVEL) {
      logger.error(`Authorization failed: Assurance level ${parsedAssuranceLevel} below required ${REQUIRED_ASSURANCE_LEVEL}`)

      return generatePolicy('user', 'Deny', methodArn)
    }

    logger.debug('Authorization successful for uid:', uid)

    const policy = generatePolicy(uid, 'Allow', methodArn)
    logger.debug('Returning policy:', JSON.stringify(policy, null, 2))

    return policy
  } catch (error) {
    logger.error('EDL Authorizer error:', error)

    // Return a "Deny" policy for any caught errors
    const denyPolicy = generatePolicy('user', 'Deny', methodArn)
    logger.debug('Returning deny policy:', JSON.stringify(denyPolicy, null, 2))

    return denyPolicy
  }
}

export default edlAuthorizer
