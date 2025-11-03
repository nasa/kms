import { downcaseKeys } from '@/shared/downcaseKeys'
import fetchEdlProfile from '@/shared/fetchEdlProfile'
import { generatePolicy } from '@/shared/generatePolicy'
import { logger } from '@/shared/logger'

/**
 * Custom authorizer for API Gateway authentication
 * @param {Object} event Details about the HTTP request that it received
 * @param {Object} context Methods and properties that provide information about the invocation, function, and execution environment
 */
export const edlAuthorizer = async (event) => {
  logger.debug('EDL Authorizer called with event:', JSON.stringify(event, null, 2))
  const {
    headers = {},
    methodArn,
    authorizationToken
  } = event

  // First, try to get the token from headers (case-insensitive)
  let launchpadToken = downcaseKeys(headers).authorization

  // If not found in headers, check if it's directly in the event as authorizationToken
  if (!launchpadToken && authorizationToken) {
    launchpadToken = authorizationToken
  }

  // If still not found, default to an empty string
  launchpadToken = launchpadToken || ''
  logger.debug('Launchpad token:', launchpadToken ? 'Present' : 'Not present')

  try {
    const profile = await fetchEdlProfile(launchpadToken)
    logger.debug('Fetched EDL profile:', JSON.stringify(profile, null, 2))
    const { uid } = profile

    if (uid) {
      logger.debug('Authorization successful for uid:', uid)

      return generatePolicy(uid, 'Allow', methodArn)
    }

    logger.error('Authorization failed: No uid found in profile')
    throw new Error('Unauthorized')
  } catch (error) {
    logger.error('EDL Authorizer error:', error)
    throw error
  }
}

export default edlAuthorizer
