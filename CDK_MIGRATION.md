# CDK Migration Guide for KMS (Keyword Management System)

This guide outlines the steps to migrate the KMS (Keyword Management System) from Serverless Framework to AWS CDK (Cloud Development Kit).

## Prerequisites
- AWS CLI configured with appropriate permissions
- Node.js and npm installed
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- Serverless Framework CLI installed (for removal of old stack)

## Migration Steps

### 1. Deploy KMS to AWS to retain ApiGatewayRestApi
Before removing the old Serverless stack, we need to ensure that the API Gateway is retained. This step involves deploying a minimal CDK stack that imports the existing API Gateway.

```bash
cdk deploy KmsRetentionStack
```

### 2. Remove the old Serverless stack
Use the Serverless Framework CLI to remove the existing stack. Replace `sit` with your appropriate stage name if different.

```bash
npx sls remove --stage sit
```

This step removes all resources managed by the Serverless Framework except for the API Gateway, which we retained in step 1.

### 3. Set environment variables for API Gateway
We need to set environment variables for the existing API Gateway ID and its root resource ID. These will be used in our CDK stack.

First, set the `API_ID`:
```bash
export API_ID=<your-api-id>
```

Then, retrieve and set the `ROOT_RESOURCE_ID`:
```bash
export ROOT_RESOURCE_ID=$(aws apigateway get-rest-api --rest-api-id $API_ID --query 'rootResourceId' --output text)
```

Verify that both environment variables are set correctly:
```bash
echo $API_ID
echo $ROOT_RESOURCE_ID
```

### 4. Deploy the new CDK stack
With the environment variables set, we can now deploy our full CDK stack:

```bash
cdk deploy KmsStack
```

This command deploys the new KMS infrastructure using CDK, integrating with the existing API Gateway.

## Post-Migration Steps
- Verify that all resources are correctly deployed and functioning as expected.
- Update any CI/CD pipelines to use CDK commands instead of Serverless Framework commands.
- Remove any Serverless Framework specific files and configurations that are no longer needed.

## Troubleshooting
- If you encounter permission issues, ensure that your AWS CLI is configured with the correct credentials and has the necessary permissions.
- If the API Gateway integration fails, double-check that the `API_ID` and `ROOT_RESOURCE_ID` environment variables are set correctly.
- For any CDK specific issues, refer to the AWS CDK documentation or run `cdk doctor` to diagnose common problems.

## Rollback
In case of any issues during migration:
1. You can redeploy the Serverless Framework stack.
2. Remove the CDK stack using:
   ```bash
   cdk destroy KmsStack
   ```
3. Ensure that the API Gateway and any critical resources are not accidentally deleted.

## Notes
- This migration process is designed to minimize downtime by retaining the existing API Gateway.
- Always perform this migration in a non-production environment first to identify and resolve any potential issues.
- Keep backups of your Serverless Framework configurations and any custom resources for reference.
