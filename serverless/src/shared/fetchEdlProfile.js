import { getEdlConfig } from '@/shared/getConfig'

import fetchEdlClientToken from './fetchEdlClientToken'

/**
 * Returns the user's EDL profile based on the launchpad token provided
 * @param {Object} headers Lambda event headers
 */
const fetchEdlProfile = async (launchpadToken) => {
  console.log('#fetchEdlProfile Fetching EDL profile for token:', launchpadToken ? 'Present' : 'Not present')
  const {
    IS_OFFLINE
  } = process.env

  if (IS_OFFLINE && launchpadToken === 'ABC-1') {
    return {
      auid: 'admin',
      name: 'Admin User',
      uid: 'admin'
    }
  }

  const { host } = getEdlConfig()
  console.log('#fetchEdlProfile EDL host:', host)

  try {
    const clientToken = await fetchEdlClientToken()
    console.log('#fetchEdlProfile Fetched client token:', clientToken ? 'Present' : 'Not present')

    const response = await fetch(`${host}/api/nams/edl_user`, {
      body: `token=${launchpadToken}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clientToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      }
    })

    console.log('#fetchEdlProfile EDL API response status:', response.status)

    const profile = await response.json()
    console.log('#fetchEdlProfile Received EDL profile:', JSON.stringify(profile, null, 2))

    const {
      first_name: firstName,
      last_name: lastName
    } = profile

    let name = [firstName, lastName].filter(Boolean).join(' ')

    if (name.trim().length === 0) {
      name = profile.uid
    }

    return {
      auid: profile.nams_auid,
      name,
      uid: profile.uid
    }
  } catch (error) {
    console.error('#fetchEdlProfile fetchEdlProfile Error:', error)

    return undefined
  }
}

export default fetchEdlProfile
