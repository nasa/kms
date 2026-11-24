#!/usr/bin/env node

/**
 * Prepare two DIF10 collections in SIT for manual KMS-728 testing.
 *
 * Required:
 *   export CMR_AUTHORIZATION='Bearer <SIT CMR ingest token>'
 * Optional:
 *   export TARGET_PROVIDER=MMT_1
 *   export PLATFORM_UUID=ed1b6648-3a24-46c6-997d-646b09979f7e
 *
 * Run from this repository with dependencies installed and SIT network access:
 *   node scripts/local/prepare_kms_728_sit_collections.mjs
 *
 * PUTs fixed native IDs kms-728-platform-without-long-name and
 * kms-728-platform-with-long-name. Rerunning resets those test records to the
 * prepared XML using the Platform's CURRENT published short/long names.
 * Only run when earlier testing/queued corrections for these records have finished.
 * No keyword edits, publishing, correction requests, or cleanup.
 *
 * The bundled source is the original UAT DIF10 regression record
 * C1240286110-SCIOPS, downloaded 2026-11-24. No runtime UAT requests are made.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { parse } from 'csv/sync'

const SIT = 'https://cmr.sit.earthdata.nasa.gov'
const directory = path.dirname(fileURLToPath(import.meta.url))
const children = (node, name) => Array.from(node.childNodes).filter((item) => item.nodeType === 1 && item.localName === name)
const child = (node, name) => {
  const matches = children(node, name)
  assert.equal(matches.length, 1, `Expected one ${name}`)
  return matches[0]
}

export async function prepareCollections({ env = process.env, request = fetch } = {}) {
  assert.ok(env.CMR_AUTHORIZATION, 'Set CMR_AUTHORIZATION to your SIT CMR ingest token')
  const provider = env.TARGET_PROVIDER || 'MMT_1'
  const uuid = env.PLATFORM_UUID || 'ed1b6648-3a24-46c6-997d-646b09979f7e'
  assert.match(provider, /^[A-Za-z0-9_-]+$/)
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  const output = path.resolve(directory, '../../tmp/kms-728-sit-prep', new Date().toISOString().replace(/[:.]/g, '-'))
  await fs.mkdir(output, { recursive: true })
  const records = []
  const save = () => fs.writeFile(path.join(output, 'collections.json'), JSON.stringify({ environment: 'sit', provider, platformUuid: uuid, records }, null, 2))
  const call = async (pathname, { method = 'GET', body } = {}) => {
    const response = await request(`${SIT}${pathname}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(60_000),
      headers: {
        Accept: 'application/json', 'Client-Id': 'kms-728-sit-prep',
        ...(method === 'GET' ? {} : {
          Authorization: env.CMR_AUTHORIZATION,
          'Content-Type': 'application/dif10+xml',
          'Cmr-Validate-Keywords': 'false', 'Cmr-Validate-Umm-C': 'false',
          // Preparation must not trigger correction before the tester publishes.
          'Cmr-Send-Kms-Metadata-Fixer': 'false'
        })
      }, ...(body === undefined ? {} : { body })
    })
    const text = await response.text()
    assert.ok(response.ok, `${method} ${pathname}: HTTP ${response.status}: ${text.slice(0, 1500)}`)
    return text
  }

  try {
    const csv = await call('/kms/concepts/concept_scheme/platforms?version=published&format=csv&bypassCache=true')
    const rows = parse(csv, { from_line: 2, columns: true, skip_empty_lines: true })
    const matches = rows.filter((row) => row.UUID === uuid)
    assert.equal(matches.length, 1, 'Platform UUID must identify one published CSV row')
    const platform = matches[0]
    assert.ok(platform.Short_Name && platform.Long_Name && platform.Category, 'Platform needs a short name, long name, and category')
    assert.equal(rows.filter((row) => row.Short_Name.toLowerCase() === platform.Short_Name.toLowerCase()).length, 1, 'Choose a Platform with an unambiguous short name')
    console.log(`✓ PASS [SIT]: Platform ${uuid}\nShort name: ${platform.Short_Name}\nLong name: ${platform.Long_Name}`)
    const source = await fs.readFile(path.join(directory, 'fixtures/kms-728-dif10-source.xml'), 'utf8')
    for (const withLongName of [false, true]) {
      const nativeId = `kms-728-platform-${withLongName ? 'with' : 'without'}-long-name`
      const doc = new DOMParser().parseFromString(source, 'application/xml')
      const root = doc.documentElement
      const nativePlatform = child(root, 'Platform')
      child(nativePlatform, 'Instrument')
      child(child(root, 'Entry_ID'), 'Short_Name').textContent = nativeId
      child(root, 'Entry_Title').textContent = `KMS-728 test: Platform ${withLongName ? 'with' : 'without'} Long_Name`
      child(nativePlatform, 'Type').textContent = platform.Category
      const shortName = child(nativePlatform, 'Short_Name')
      shortName.textContent = platform.Short_Name
      nativePlatform.removeAttribute('uuid')
      for (const name of children(nativePlatform, 'Long_Name')) nativePlatform.removeChild(name)
      if (withLongName) {
        const name = doc.createElementNS(nativePlatform.namespaceURI, 'Long_Name')
        name.textContent = platform.Long_Name
        nativePlatform.insertBefore(name, shortName.nextSibling)
      }
      const metadata = new XMLSerializer().serializeToString(doc)
      const record = { nativeId, withLongName, shortName: platform.Short_Name, longName: withLongName ? platform.Long_Name : null }
      records.push(record)
      await fs.writeFile(path.join(output, `${nativeId}.xml`), metadata)
      // Validate both fixtures before ingesting either; native XSD validation remains enabled.
      await call(`/ingest/providers/${provider}/validate/collection/${nativeId}`, { method: 'POST', body: metadata })
      console.log(`✓ PASS [SIT]: native schema validation for ${nativeId}`)
    }
    for (const record of records) {
      const metadata = await fs.readFile(path.join(output, `${record.nativeId}.xml`), 'utf8')
      record.ingestAttemptedAt = new Date().toISOString()
      await save()
      const result = JSON.parse(await call(`/ingest/providers/${provider}/collections/${record.nativeId}`, { method: 'PUT', body: metadata }))
      assert.match(result['concept-id'] || '', /^C\d+-[A-Za-z0-9_-]+$/)
      record.collectionId = result['concept-id']
      record.revisionId = result['revision-id']
      record.nativeUrl = `${SIT}/search/concepts/${record.collectionId}.native`
      record.auditUrl = `${SIT}/kms/metadata_correction_audit?collectionConceptId=${record.collectionId}&format=html`
      await save()
      console.log(`✓ PASS [SIT]: ${record.withLongName ? 'WITH' : 'WITHOUT'} Long_Name: ${record.collectionId} (revision ${record.revisionId})\nNative: ${record.nativeUrl}\nAudit: ${record.auditUrl}`)
    }
    console.log(`Prepared both test records. IDs and XML saved in ${output}\nNo keyword was edited or published. Rerun to reset the same native IDs after testing finishes.`)
    return { output, records }
  } finally {
    await save()
  }
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  prepareCollections().catch((error) => {
    console.error(`✗ FAIL [SIT]: ${error.message}`)
    process.exitCode = 1
  })
}
