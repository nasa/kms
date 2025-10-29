import { getEdlConfig } from '@/shared/getConfig'

/**
 * The EDL client token is used for retrieving/modifying user/groups in URS.
 * @returns the EDL client token
 */
const fetchEdlClientToken = async () => {
  console.log('#fetchEdlClientToken Starting to fetch EDL client token')

  const { host, uid } = getEdlConfig()
  console.log('#fetchEdlClientToken EDL host:', host)
  console.log('#fetchEdlClientToken EDL UID:', uid)

  const { EDL_PASSWORD: password } = process.env
  console.log('#fetchEdlClientToken EDL password:', password ? 'Present' : 'Not present')

  const url = `${host}/oauth/token`
  console.log('#fetchEdlClientToken Token URL:', url)

  const authorizationHeader = `Basic ${Buffer.from(`${uid}:${password}`).toString('base64')}`
  console.log('#fetchEdlClientToken Authorization header:', `${authorizationHeader.substring(0, 20)}...`)

  try {
    console.log('#fetchEdlClientToken Sending request to EDL')
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authorizationHeader,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: 'grant_type=client_credentials'
    })

    console.log('#fetchEdlClientToken Response status:', response.status)

    if (!response.ok) {
      console.error('#fetchEdlClientToken Error response:', response)
      throw new Error(`EDL request failed with status ${response.status}`)
    }

    const json = await response.json()
    console.log('#fetchEdlClientToken Response body:', JSON.stringify(json, null, 2))

    const accessToken = json.access_token
    console.log('#fetchEdlClientToken Access token:', accessToken ? 'Present' : 'Not present')

    if (!accessToken) {
      console.error('#fetchEdlClientToken No access token received in response')
      throw new Error('No access token received from EDL')
    }

    console.log('#fetchEdlClientToken Successfully fetched EDL client token')

    return accessToken
  } catch (error) {
    console.error('#fetchEdlClientToken Error fetching EDL client token:', error)
    throw error
  }
}

export default fetchEdlClientToken
