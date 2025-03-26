import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'

import { getApplicationConfig } from '@/shared/getConfig'

import { publish } from '../publish/handler'

// Import the publish function
const region = process.env.AWS_REGION || 'us-east-1'

const sfnClient = new SFNClient({
  region,
  maxAttempts: 3,
  retryMode: 'standard'
})
const triggerPublish = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body } = event
  const { name } = JSON.parse(body)

  if (!name) {
    return {
      statusCode: 400,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ message: 'Error: "name" parameter is required in the request body' })
    }
  }

  const isOffline = process.env.IS_OFFLINE === 'true'
  console.log('is offline', isOffline)
  if (isOffline) {
    // If running offline, execute the publish function directly
    try {
      console.log('calling publish')
      const result = await publish({ name })
      console.log('done calling publish')

      return {
        statusCode: 200,
        headers: defaultResponseHeaders,
        body: JSON.stringify({
          message: `Publish process completed for version ${name}`,
          result
        })
      }
    } catch (error) {
      console.error('Error in offline publish process:', error)

      return {
        statusCode: 500,
        headers: defaultResponseHeaders,
        body: JSON.stringify({
          message: 'Error in publish process',
          error: error.message
        })
      }
    }
  } else {
    // If not offline, trigger the Step Function
    const params = {
      stateMachineArn: process.env.PUBLISH_STATE_MACHINE_ARN,
      input: JSON.stringify({ name })
    }

    try {
      const command = new StartExecutionCommand(params)
      const result = await sfnClient.send(command)

      return {
        statusCode: 202,
        headers: defaultResponseHeaders,
        body: JSON.stringify({
          message: `Publish process initiated for version ${name}`,
          executionArn: result.executionArn
        })
      }
    } catch (error) {
      console.error('Error starting Step Function execution:', error)

      return {
        statusCode: 500,
        headers: defaultResponseHeaders,
        body: JSON.stringify({ message: 'Error initiating publish process' })
      }
    }
  }
}

export default triggerPublish
