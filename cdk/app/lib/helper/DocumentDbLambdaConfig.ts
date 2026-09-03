import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'

const DOCUMENTDB_TLS_CA_FILE_NAME = 'us-east-1-bundle.pem'

/**
 * Bundles DocumentDB Lambda dependencies and copies the CA certificate when TLS is configured.
 *
 * @example
 * getDocumentDbCertificateBundling({
 *   DOCUMENTDB_DATABASE_NAME: 'kms',
 *   DOCUMENTDB_TLS_CA_FILE: '/var/task/us-east-1-bundle.pem'
 * })
 * // { bundling: { externalModules: [], commandHooks: { ...copy the CA... } } }
 *
 * @param environment Lambda environment containing the database name and optional TLS path.
 * @returns Bundling props for DocumentDB-enabled Lambdas, otherwise an empty object.
 */
export const getDocumentDbCertificateBundling = (
  environment: {
    DOCUMENTDB_DATABASE_NAME?: string
    DOCUMENTDB_TLS_CA_FILE?: string
  }
): Pick<NodejsFunctionProps, 'bundling'> => (
  environment.DOCUMENTDB_DATABASE_NAME
    ? {
      bundling: {
        // Node.js 24 SAM images do not supply AWS SDK packages to local Lambda containers.
        externalModules: [],
        ...(environment.DOCUMENTDB_TLS_CA_FILE
          ? {
            commandHooks: {
              beforeBundling: () => [],
              beforeInstall: () => [],
              afterBundling: (inputDir: string, outputDir: string) => [
                `cp "${inputDir}/serverless/certs/${DOCUMENTDB_TLS_CA_FILE_NAME}" "${outputDir}/${DOCUMENTDB_TLS_CA_FILE_NAME}"`
              ]
            }
          }
          : {})
      }
    }
    : {}
)

/**
 * Adds the DocumentDB client security group to a Lambda when the database is configured.
 *
 * @example
 * getDocumentDbLambdaSecurityGroups({
 *   securityGroup: baseGroup,
 *   clientSecurityGroup: documentDbGroup,
 *   environment: { DOCUMENTDB_DATABASE_NAME: 'kms' }
 * })
 * // [baseGroup, documentDbGroup]
 *
 * @param props Security groups and DocumentDB environment for the Lambda.
 * @returns The base Lambda group plus the DocumentDB client group when configured.
 */
export const getDocumentDbLambdaSecurityGroups = ({
  clientSecurityGroup,
  environment,
  securityGroup
}: {
  clientSecurityGroup?: ec2.ISecurityGroup
  environment: { DOCUMENTDB_DATABASE_NAME?: string }
  securityGroup: ec2.ISecurityGroup
}): ec2.ISecurityGroup[] => [
  securityGroup,
  ...(environment.DOCUMENTDB_DATABASE_NAME && clientSecurityGroup
    ? [clientSecurityGroup]
    : [])
]

export default getDocumentDbCertificateBundling
