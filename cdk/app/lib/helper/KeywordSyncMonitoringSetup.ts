import * as cdk from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import { Construct } from 'constructs'

const KEYWORD_SYNC_METRIC_NAMESPACE = 'KMS/KeywordSync'
const KEYWORD_EVENT_PUBLISH_FAILURES_METRIC = 'KeywordEventPublishFailures'
const PUBLISH_FAILURE_ALARM_PERIOD = cdk.Duration.days(1)

export interface KeywordSyncMonitoringSetupProps {
  prefix: string
  stage: string
  notificationEmails?: string[]
}

/**
 * Sets up CloudWatch monitoring resources for keyword sync publishing.
 */
export class KeywordSyncMonitoringSetup {
  public readonly publishFailuresAlarm: cloudwatch.Alarm

  /**
   * Creates the keyword sync monitoring resources.
   *
   * @param {Construct} scope - Construct scope for the monitoring resources.
   * @param {KeywordSyncMonitoringSetupProps} props - Monitoring configuration.
   */
  constructor(scope: Construct, props: KeywordSyncMonitoringSetupProps) {
    const { notificationEmails = [], prefix, stage } = props

    const keywordEventPublishFailuresMetric = new cloudwatch.Metric({
      namespace: KEYWORD_SYNC_METRIC_NAMESPACE,
      metricName: KEYWORD_EVENT_PUBLISH_FAILURES_METRIC,
      statistic: 'Sum',
      period: PUBLISH_FAILURE_ALARM_PERIOD
    })

    this.publishFailuresAlarm = new cloudwatch.Alarm(scope, 'KeywordSyncPublishFailuresAlarm', {
      alarmName: `${prefix}-${stage}-keyword-event-publish-failures`,
      alarmDescription: 'Alerts when publisher keyword event publishes fail after retries.',
      metric: keywordEventPublishFailuresMetric,
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    })

    if (notificationEmails.length === 0) {
      return
    }

    const alarmTopic = new sns.Topic(scope, 'KeywordSyncAlarmTopic', {
      topicName: `${prefix}-${stage}-keyword-sync-alerts`
    })

    notificationEmails.forEach((email) => {
      alarmTopic.addSubscription(new subscriptions.EmailSubscription(email))
    })

    this.publishFailuresAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic))
  }
}
