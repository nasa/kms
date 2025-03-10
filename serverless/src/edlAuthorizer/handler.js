import { downcaseKeys } from '@/shared/downcaseKeys'
import fetchEdlProfile from '@/shared/fetchEdlProfile'
import { generatePolicy } from '@/shared/generatePolicy'

/**
 * Custom authorizer for API Gateway authentication
 * @param {Object} event Details about the HTTP request that it received
 * @param {Object} context Methods and properties that provide information about the invocation, function, and execution environment
 */
const edlAuthorizer = async (event) => {
  const {
    headers = {},
    methodArn
  } = event

  const { authorization: launchpadToken = '' } = downcaseKeys(headers)

  const profile = await fetchEdlProfile(launchpadToken)
  const { uid } = profile

  if (uid) {
    return generatePolicy(uid, 'Allow', methodArn)
  }

  throw new Error('Unauthorized')
}

export default edlAuthorizer
