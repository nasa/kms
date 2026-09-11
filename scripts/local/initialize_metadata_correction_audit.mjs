import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  initializeMetadataCorrectionAudit
} from '../../serverless/src/initializeMetadataCorrectionAudit/handler'
import { closeDocumentDbClient } from '../../serverless/src/shared/documentDbClient'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '../..')
const indexDefinitions = JSON.parse(fs.readFileSync(
  path.join(projectRoot, 'config/metadataCorrectionAuditIndexes.json'),
  'utf8'
))

try {
  const result = await initializeMetadataCorrectionAudit({
    RequestType: 'Create',
    ResourceProperties: { IndexDefinitions: indexDefinitions }
  })

  console.log(
    `[initialize-metadata-correction-audit] Verified ${result.Data.IndexCount} local audit indexes`
  )
} finally {
  await closeDocumentDbClient()
}
