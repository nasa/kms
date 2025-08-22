// eslint-disable-next-line @typescript-eslint/no-require-imports
const { nodeExternalsPlugin } = require('esbuild-node-externals')

module.exports = {
  plugins: [nodeExternalsPlugin({
    allowList: ['@aws-sdk/client-s3']
  })]
}
