import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'

import { CmrKeywordEventsListenerSetup } from './helper/CmrKeywordEventsListenerSetup'
import { LogForwardingSetup } from './helper/LogForwardingSetup'
import { MetadataCorrectionSetup } from './helper/MetadataCorrectionSetup'
import { VpcSetup } from './helper/VpcSetup'

/**
 * Properties for the CMR event processing stack.
 */
export interface CmrEventProcessingStackProps extends cdk.StackProps {
  cmrBaseUrl: string
  cmrLbUrl?: string
  redisEnabled?: string
  redisHost?: string
  redisPort?: string
  prefix: string
  stage: string
  topicArn: string
  logDestinationArn: string
  vpcId: string
}

/**
 * Stack responsible for consuming keyword events on the CMR side.
 *
 * It subscribes an SQS queue to the KMS keyword events topic and attaches the Lambda
 * that will process those events for downstream CMR business logic.
 */
export class CmrEventProcessingStack extends cdk.Stack {
  private readonly logForwardingSetup?: LogForwardingSetup

  private readonly vpc: ec2.IVpc

  private readonly securityGroup: ec2.SecurityGroup

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
    const vpcSetup = new VpcSetup(this, props.prefix, props.vpcId, useLocalstack)

    this.vpc = vpcSetup.vpc
    this.securityGroup = vpcSetup.securityGroup

    const metadataCorrectionSetup = new MetadataCorrectionSetup(this, 'MetadataCorrection', {
      cmrBaseUrl: props.cmrBaseUrl,
      cmrLbUrl: props.cmrLbUrl,
      prefix: props.prefix,
      redisEnabled: props.redisEnabled,
      redisHost: props.redisHost,
      redisPort: props.redisPort,
      stage: props.stage,
      securityGroup: this.securityGroup,
      useLocalstack,
      vpc: this.vpc
    })

    const listenerSetup = new CmrKeywordEventsListenerSetup(this, 'CmrKeywordEventsListener', {
      cmrBaseUrl: props.cmrBaseUrl,
      cmrLbUrl: props.cmrLbUrl,
      prefix: props.prefix,
      stage: props.stage,
      keywordEventsTopic: topic,
      metadataCorrectionRequestsTopic: metadataCorrectionSetup.metadataCorrectionRequestsTopic,
      securityGroup: this.securityGroup,
      useLocalstack,
      vpc: this.vpc
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
