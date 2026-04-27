import * as cdk from 'aws-cdk-lib'
import * as sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'

import { CmrKeywordEventsListenerSetup } from './helper/CmrKeywordEventsListenerSetup'
import { LogForwardingSetup } from './helper/LogForwardingSetup'
import { MetadataCorrectionSetup } from './helper/MetadataCorrectionSetup'

/**
 * Properties for the CMR event processing stack.
 */
export interface CmrEventProcessingStackProps extends cdk.StackProps {
  prefix: string
  stage: string
  topicArn: string
  logDestinationArn: string
}

/**
 * Stack responsible for consuming keyword events on the CMR side.
 *
 * It subscribes an SQS queue to the KMS keyword events topic and attaches the Lambda
 * that will process those events for downstream CMR business logic.
 */
export class CmrEventProcessingStack extends cdk.Stack {
  private readonly logForwardingSetup?: LogForwardingSetup

  /**
   * Creates the CMR listener resources and metadata correction messaging resources.
   *
   * @param {Construct} scope - Parent construct.
   * @param {string} id - Stack identifier.
   * @param {CmrEventProcessingStackProps} props - Stack configuration.
   */
  constructor(scope: Construct, id: string, props: CmrEventProcessingStackProps) {
    super(scope, id, props)

    const useLocalstack = this.node.tryGetContext('useLocalstack') === 'true'
    const topic = sns.Topic.fromTopicArn(this, 'KeywordEventsTopic', props.topicArn)

    const metadataCorrectionSetup = new MetadataCorrectionSetup(this, 'MetadataCorrection', {
      prefix: props.prefix,
      stage: props.stage
    })

    const listenerSetup = new CmrKeywordEventsListenerSetup(this, 'CmrKeywordEventsListener', {
      prefix: props.prefix,
      stage: props.stage,
      keywordEventsTopic: topic,
      metadataCorrectionRequestsTopic: metadataCorrectionSetup.metadataCorrectionRequestsTopic
    })

    // Set up CloudWatch Logs forwarding to Splunk via NGAP SecLog account
    // Skip log forwarding for localstack deployments
    if (!useLocalstack) {
      this.logForwardingSetup = new LogForwardingSetup(this, 'LogForwarding', {
        prefix: props.prefix,
        stage: props.stage,
        logDestinationArn: props.logDestinationArn,
        lambdas: {
          'cmrKeywordEventsListener/handler.js::cmr-keyword-events-processor': listenerSetup.listenerLambda,
          'metadataCorrectionService/handler.js::metadata-correction-service': metadataCorrectionSetup.metadataCorrectionServiceLambda
        }
      })
    }
  }
}
