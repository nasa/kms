import { downcaseKeys } from '@/shared/downcaseKeys'
import fetchEdlProfile from '@/shared/fetchEdlProfile'
import { generatePolicy } from '@/shared/generatePolicy'

/**
 * Custom authorizer for API Gateway authentication
 * @param {Object} event Details about the HTTP request that it received
 * @param {Object} context Methods and properties that provide information about the invocation, function, and execution environment
 */
export const edlAuthorizer = async (event) => {
  try {
    console.log('in edl authorizer')
    const {
      headers = {},
      methodArn,
      authorizationToken
    } = event

    // First, try to get the token from headers (case-insensitive)
    let launchpadToken = downcaseKeys(headers).authorization
    console.log('dbg1 token is ', launchpadToken)

    // If not found in headers, check if it's directly in the event as authorizationToken
    if (!launchpadToken && authorizationToken) {
      launchpadToken = authorizationToken
    }

    console.log('dbg2 token is ', launchpadToken)

    // If still not found, default to an empty string
    launchpadToken = launchpadToken || ''
    const profile = await fetchEdlProfile(launchpadToken)
    console.log('profile is', profile)

    const { uid } = profile

    if (uid) {
      console.log('got uid ', uid)

      return generatePolicy(uid, 'Allow', methodArn)
    }

    throw new Error('Unauthorized')
  } catch (error) {
    console.error('Error in EDL authorizer', error)
    throw new Error('Unauthorized2')
  }
}

export default edlAuthorizer
