import { getEdlConfig } from '@/shared/getConfig'

import { logger } from './logger'

/**
 * The EDL client token is used for retrieving/modifying user/groups in URS.
 * @returns the EDL client token
 */
const fetchEdlClientToken = async () => {
  logger.debug('Starting to fetch EDL client token')

  const { host, uid } = getEdlConfig()
  logger.debug('EDL host:', host)
  logger.debug('EDL UID:', uid)

  const { EDL_PASSWORD: password } = process.env
  logger.debug('EDL password:', password ? 'Present' : 'Not present')

  const url = `${host}/oauth/token`
  logger.debug('Token URL:', url)

  const authorizationHeader = `Basic ${Buffer.from(`${uid}:${password}`).toString('base64')}`

  try {
    logger.debug('Sending request to EDL')
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authorizationHeader,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: 'grant_type=client_credentials'
    })

    logger.debug('Response status:', response.status)

    if (!response.ok) {
      logger.error('Error response:', response)
      throw new Error(`EDL request failed with status ${response.status}`)
    }

    const json = await response.json()
    logger.debug('Response body:', JSON.stringify(json, null, 2))

    const accessToken = json.access_token
    logger.debug('Access token:', accessToken ? 'Present' : 'Not present')

    if (!accessToken) {
      logger.error('No access token received in response')
      throw new Error('No access token received from EDL')
    }

    logger.debug('Successfully fetched EDL client token')

    return accessToken
  } catch (error) {
    logger.error('Error fetching EDL client token:', error)
    throw error
  }
}

export default fetchEdlClientToken
