import * as lambda from 'aws-cdk-lib/aws-lambda'

/**
 * Shared runtime for all Node.js Lambda functions in the CDK app.
 *
 * Keeping this in one place makes Node runtime upgrades explicit and consistent
 * across stacks and helper constructs.
 */
export const NODE_LAMBDA_RUNTIME = lambda.Runtime.NODEJS_22_X
