// Config.js
module.exports = () => {
  const isOffline = process.env.IS_OFFLINE === 'true'

  return {
    publishStateMachineArn:
      isOffline
        ? 'defaultArnForLocalDev'
        // eslint-disable-next-line no-template-curly-in-string
        : (process.env.PUBLISH_STATE_MACHINE_ARN || '${cf:${self:service}-${self:provider.stage}.PublishProcessStepFunctionArn}')
  }
}
