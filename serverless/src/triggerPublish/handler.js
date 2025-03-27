import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'

import publish from '@/publish/handler'
import { getApplicationConfig } from '@/shared/getConfig'

const region = process.env.AWS_REGION || 'us-east-1'

const triggerPublish = async (event, context) => {
  try {
    console.log('triggerPublish function started', {
      timestamp: new Date().toISOString(),
      region
    })

    const { defaultResponseHeaders } = getApplicationConfig()
    console.log('Application config loaded')

    const { body } = event
    console.log('Received event body:', body)

    const { name } = JSON.parse(body)
    console.log('Parsed name from body:', name)

    if (!name) {
      console.log('Name parameter is missing')

      return {
        statusCode: 400,
        headers: defaultResponseHeaders,
        body: JSON.stringify({ message: 'Error: "name" parameter is required in the request body' })
      }
    }

    const isOffline = process.env.IS_OFFLINE === 'true'
    console.log('Environment:', { isOffline })

    if (!isOffline) {
      const lambdaClient = new LambdaClient({
        region,
        maxAttempts: 3,
        httpOptions: { timeout: 300000 } // 5 minutes
      })

      const accountId = context.invokedFunctionArn.split(':')[4]
      const PUBLISH_HANDLER_NAME = 'kms-sit-publishHandler'
      const PUBLISH_HANDLER_ARN = `arn:aws:lambda:${region}:${accountId}:function:${PUBLISH_HANDLER_NAME}`

      console.log('Invoking function:', PUBLISH_HANDLER_ARN)

      const params = {
        FunctionName: PUBLISH_HANDLER_ARN,
        InvocationType: 'Event',
        Payload: JSON.stringify({ name })
      }

      const command = new InvokeCommand(params)
      console.log('Attempting to invoke publish Lambda function', { params })

      await lambdaClient.send(command)
      console.log('Publish Lambda function invoked successfully')
    } else {
      console.log('Executing in offline mode')
      console.log('Calling publish function directly in offline mode')
      publish({ name }).catch((error) => console.error('Async publish process error:', error))
      console.log('Publish function initiated in offline mode')
    }

    return {
      statusCode: 202,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: `Publish process initiated for version ${name}${isOffline ? ' in offline mode' : ''}`
      })
    }
  } catch (error) {
    console.error('Error in triggerPublish:', error)
    console.log('Error details:', {
      errorName: error.name,
      errorMessage: error.message,
      stackTrace: error.stack
    })

    // Log specific error types if needed
    if (error.name === 'ResourceNotFoundException') {
      console.error('The specified Lambda function does not exist')
    } else if (error.name === 'ServiceException') {
      console.error('AWS Lambda service error occurred')
    }

    const { defaultResponseHeaders } = getApplicationConfig()

    return {
      statusCode: 500,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: 'Error initiating publish process',
        errorDetails: {
          name: error.name,
          message: error.message
        }
      })
    }
  }
}

export default triggerPublish
