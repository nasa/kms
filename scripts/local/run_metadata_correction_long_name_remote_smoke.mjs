#!/usr/bin/env node

/**
 * KMS-728 FULL REMOTE SMOKE: ingest -> keyword rename -> publish -> listener -> worker -> CMR.
 * Run from a VPN-connected machine with this repository's dependencies installed.
 *
 * Required environment:
 *   export CMR_ENV=sit                         # sit or uat ONLY; no production support.
 *   export CMR_AUTHORIZATION='Bearer <token>'   # CMR ingest/read token for CMR_ENV.
 *   export KMS_AUTH='<authorization header>'   # KMS edit/publish authorization for CMR_ENV.
 *
 * Defaults to ALTIUS (ed1b6648-3a24-46c6-997d-646b09979f7e), whose long name is
 * Atmospheric Limb Tracker for the Investigation of the Upcoming Stratosphere.
 * Before any writes, the selected Platform must be a published leaf with a unique short name,
 * a nonempty long name, and ZERO visible CMR collections in the target environment.
 * Draft must have the same short/long names. The smoke renames this keyword in the target only;
 * it does not change production. An earlier run's retained collections must be cleaned up first.
 *
 * Optional environment:
 *   export PLATFORM_UUID='<another-platform-uuid>'  # Override the ALTIUS default if necessary.
 *   export TARGET_PROVIDER=MMT_1
 *   export SOURCE_ENV=uat                      # sit or uat; read-only source.
 *   export SOURCE_COLLECTION_ID=C1240286110-SCIOPS
 *   export SOURCE_CMR_AUTHORIZATION='Bearer <source-token>'  # Only for restricted source records.
 *   export WAIT_TIMEOUT_MS=1800000             # Per polling phase (default 30 minutes).
 *   export POLL_INTERVAL_MS=15000
 *
 * Run:
 *   node scripts/local/run_metadata_correction_long_name_remote_smoke.mjs
 * Resume verification after a timeout WITHOUT ingesting, renaming, or publishing again:
 *   node scripts/local/run_metadata_correction_long_name_remote_smoke.mjs --verify <run-directory>
 *
 * Checklist (the same publish must pass BOTH collection scenarios):
 *   [ ] Ingest a clone with Platform Long_Name absent.
 *   [ ] Ingest a second clone with the current Long_Name before Instrument.
 *   [ ] Publish changed short AND long names once as KMS-728.
 *   [ ] Missing-name collection: applied audit, new Short_Name, Long_Name still absent.
 *   [ ] Existing-name collection: applied audit, both names updated in their original positions.
 *   [ ] Preserve non-keyword metadata in both; record environment and evidence in checklist.txt.
 *
 * WARNING: This creates TWO test collections, renames the specified keyword, and automatically
 * publishes ALL pending Draft edits as KMS-728, without confirmation. Coordinate with your team.
 * The target KMS deployment must contain KMS-728, allow the provider's writeback, and have working
 * caches, CMR UUID discovery, and enabled queue consumers. This script does not change those settings.
 * No automatic rollback, cleanup, second publish, or write retry. Evidence and original keyword
 * RDF are retained for inspection and deliberate cleanup; the source collection is never written.
 */

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { parse as parseCsv } from 'csv/sync'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const VERSION = 'KMS-728'
// ALTIUS had a populated long name and no publicly visible UAT collections on 2026-11-24.
// Never rely on that snapshot: preflight checks the selected environment on every fresh run.
const DEFAULT_PLATFORM_UUID = 'ed1b6648-3a24-46c6-997d-646b09979f7e'
const SKOS = 'http://www.w3.org/2004/02/skos/core#'
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const GCMD = 'https://gcmd.earthdata.nasa.gov/kms#'
const environmentUrl = (environment) => {
  assert.ok(['sit', 'uat'].includes(environment), 'CMR_ENV and SOURCE_ENV must be sit or uat; production is not supported')
  return `https://cmr.${environment}.earthdata.nasa.gov`
}
const xml = (value) => new DOMParser().parseFromString(value, 'application/xml')
const serialize = (value) => new XMLSerializer().serializeToString(value)
// Older xmldom collections are array-like but do not implement Symbol.iterator.
const children = (node, name) => Array.from(node.childNodes).filter((item) => item.nodeType === 1 && (!name || item.localName === name))
const child = (node, name) => children(node, name)[0]
const platforms = (doc) => children(doc.documentElement, 'Platform')
const setText = (parent, name, value) => {
  assert.ok(child(parent, name), `Source DIF10 is missing ${name}`)
  child(parent, name).textContent = value
}
// Compare XML content/element order without treating serializer indentation or prefixes as edits.
const tree = (node) => ({
  name: node.localName,
  attributes: Array.from(node.attributes).filter((attr) => !attr.name.startsWith('xmlns')).map((attr) => [attr.namespaceURI, attr.localName, attr.value]).sort(),
  children: Array.from(node.childNodes).flatMap((item) => {
    if (item.nodeType === 1) return [tree(item)]
    if ((item.nodeType === 3 || item.nodeType === 4) && item.data.trim()) return [item.data.trim()]
    return []
  })
})
const rows = (csv) => parseCsv(csv, { from_line: 2, columns: true, skip_empty_lines: true })
const positiveNumber = (value, fallback) => {
  const result = Number(value || fallback)
  assert.ok(Number.isSafeInteger(result) && result > 0, 'Polling durations must be positive integer milliseconds')
  return result
}

export async function runRemoteSmoke({ env = process.env, request = fetch, resumeDirectory, sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) }) } = {}) {
  const runId = `kms-728-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
  const output = resumeDirectory ? path.resolve(resumeDirectory) : path.join(root, 'tmp/kms-728-remote-smoke', runId)
  await fs.mkdir(output, { recursive: true })
  const save = (name, value) => fs.writeFile(path.join(output, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2))
  const verificationMode = request === fetch ? 'live' : 'local-harness'
  let state = { runId, startedAt: new Date().toISOString(), environment: env.CMR_ENV, versionName: VERSION, schemaVersion: 2 }
  const checks = []
  let error
  let sequence = 0
  let base
  let sourceBase
  const checkpoint = () => save('state.json', state)
  const check = async (name, callback) => {
    try {
      const result = await callback()
      checks.push({ name, passed: true })
      console.log(`✓ PASS [${state.environment?.toUpperCase()} / ${verificationMode}]: ${name}`)
      return result
    } catch (failure) {
      checks.push({ name, passed: false, error: failure.message })
      console.error(`✗ FAIL [${state.environment?.toUpperCase()} / ${verificationMode}]: ${name}\n  ${failure.message}`)
      throw failure
    }
  }
  const call = async (label, url, { method = 'GET', body, contentType, source = false } = {}) => {
    const address = new URL(url)
    assert.equal(address.origin, source ? sourceBase : base)
    if (source) assert.equal(method, 'GET', 'The source environment is read-only')
    if (method !== 'GET') {
      assert.ok(!resumeDirectory, 'Verification mode must never write')
      const permitted = state.collections?.some(({ nativeId }) => (
        (method === 'PUT' && address.pathname === `/ingest/providers/${encodeURIComponent(state.provider)}/collections/${encodeURIComponent(nativeId)}`)
        || (method === 'POST' && address.pathname === `/ingest/providers/${encodeURIComponent(state.provider)}/validate/collection/${encodeURIComponent(nativeId)}`)
      ))
        || (method === 'PUT' && address.pathname === '/kms/concept')
        || (method === 'POST' && address.pathname === '/kms/publish')
      assert.ok(permitted, `Refusing unexpected write endpoint: ${address.pathname}`)
    }
    const authorization = source ? env.SOURCE_CMR_AUTHORIZATION : address.pathname.startsWith('/kms/') ? env.KMS_AUTH : env.CMR_AUTHORIZATION
    const response = await request(url, {
      method, redirect: 'error', signal: AbortSignal.timeout(60_000),
      headers: {
        Accept: 'application/json', 'Client-Id': 'kms-728-remote-smoke',
        ...(authorization ? { Authorization: authorization } : {}),
        ...(contentType ? { 'Content-Type': contentType } : {}),
        ...(address.pathname.startsWith('/ingest/') ? {
          'Cmr-Validate-Keywords': 'false', 'Cmr-Validate-Umm-C': 'false',
          'Cmr-Send-Kms-Metadata-Fixer': 'false'
        } : {})
      },
      ...(body === undefined ? {} : { body })
    })
    const text = await response.text()
    await save(`${String(++sequence).padStart(3, '0')}-${label}.response.json`, { method, url, status: response.status, body: text })
    assert.ok(response.ok, `${label}: HTTP ${response.status}: ${text.slice(0, 1500)}. Writes are not retried.`)
    return { status: response.status, text }
  }
  const json = async (label, url, options) => JSON.parse((await call(label, url, options)).text)
  const poll = async (name, callback) => check(name, async () => {
    const deadline = Date.now() + positiveNumber(env.WAIT_TIMEOUT_MS, 1_800_000)
    while (Date.now() < deadline) {
      const result = await callback()
      if (result) return result
      console.log(`… WAIT: ${name}`)
      await sleep(positiveNumber(env.POLL_INTERVAL_MS, 15_000))
    }
    throw new Error(`Timed out: ${name}. Resume with --verify ${output}; do not repeat the publish.`)
  })
  const platformCsv = async () => rows((await call('published-platforms', `${base}/kms/concepts/concept_scheme/platforms?version=published&format=csv&bypassCache=true`)).text)
  const lookup = (uuid, conceptId) => `${base}/search/collections.umm_json?keyword=${encodeURIComponent(uuid)}${conceptId ? `&concept_id=${encodeURIComponent(conceptId)}` : ''}&page_size=1`

  try {
    await check('Environment and credentials configured', async () => {
      if (resumeDirectory) {
        state = JSON.parse(await fs.readFile(path.join(output, 'state.json'), 'utf8'))
        assert.ok(state.publishAttemptedAt && state.collections?.length === 2 && state.collections.every(({ collectionId }) => collectionId), 'Need a published two-collection smoke run; inspect saved state instead of republishing blindly')
        assert.equal(env.CMR_ENV, state.environment, 'CMR_ENV must match the saved run')
      }
      base = environmentUrl(env.CMR_ENV)
      sourceBase = environmentUrl(env.SOURCE_ENV || 'uat')
      assert.ok(env.CMR_AUTHORIZATION && env.KMS_AUTH, 'Set CMR_AUTHORIZATION and KMS_AUTH for the target environment')
      positiveNumber(env.WAIT_TIMEOUT_MS, 1_800_000)
      positiveNumber(env.POLL_INTERVAL_MS, 15_000)
    })
    console.log(`Target: ${base}; publish name: ${VERSION}; evidence: ${output}`)
    if (!resumeDirectory) {
      console.log('This run ingests TWO test collections, changes Platform short/long names, and publishes ALL pending Draft edits without confirmation.')
      state.provider = env.TARGET_PROVIDER || 'MMT_1'
      state.sourceEnvironment = env.SOURCE_ENV || 'uat'
      state.sourceCollectionId = env.SOURCE_COLLECTION_ID || 'C1240286110-SCIOPS'
      state.platformUuid = env.PLATFORM_UUID || DEFAULT_PLATFORM_UUID
      state.collections = ['missing', 'existing'].map((mode) => ({ mode, nativeId: `${runId}-${mode}`, verification: 'not-run' }))
      state.newShortName = `${runId}-RENAMED`
      await check('Dedicated test keyword and source IDs configured', async () => {
        assert.match(state.provider, /^[A-Za-z0-9_-]+$/)
        assert.match(state.platformUuid || '', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'PLATFORM_UUID must be a valid UUID when overriding the ALTIUS default')
        assert.match(state.sourceCollectionId, /^C\d+-[A-Za-z0-9_-]+$/)
      })
      await checkpoint()
      await check('Target provider is enabled for KMS writeback', async () => {
        const report = await json('enabled-providers', `${base}/kms/metadata_correction_audit?limit=1`)
        const enabled = report.enabledProviders || []
        assert.ok((enabled.length === 1 && enabled[0] === 'ALL') || enabled.includes(state.provider), `${state.provider} is not enabled for writeback`)
      })
      const published = await check('Published Platform is unique, has a long name, and has no target collections', async () => {
        const csv = await platformCsv()
        const matches = csv.filter((row) => row.UUID === state.platformUuid)
        assert.equal(matches.length, 1, 'Test Platform UUID must identify exactly one published CSV row')
        const [row] = matches
        assert.ok(row.Short_Name && row.Long_Name && row.Category, 'Test Platform needs Short_Name, Long_Name, and Category')
        assert.equal(csv.filter((other) => other.Short_Name?.toLowerCase() === row.Short_Name.toLowerCase()).length, 1, 'Test short name must not be duplicated')
        const linked = await json('initial-uuid-discovery', lookup(state.platformUuid))
        assert.equal(linked.hits, 0, 'Choose a dedicated unused Platform; do not rename a keyword used by existing target collections')
        return row
      })
      state.oldShortName = published.Short_Name
      state.oldLongName = published.Long_Name
      state.newLongName = `${published.Long_Name} KMS-728`
      state.platformCategory = published.Category
      const draft = await check('Draft Platform is an unchanged leaf with the expected published name', async () => {
        const response = await call('draft-concept', `${base}/kms/concept/${state.platformUuid}?version=draft&format=rdf&bypassCache=true`)
        const doc = xml(response.text)
        const concepts = Array.from(doc.getElementsByTagNameNS(SKOS, 'Concept'))
        assert.equal(concepts.length, 1)
        const [concept] = concepts
        assert.ok(concept.getAttributeNS(RDF, 'about').endsWith(state.platformUuid))
        assert.ok(concept.getElementsByTagNameNS(SKOS, 'inScheme')[0]?.getAttributeNS(RDF, 'resource').endsWith('/platforms'))
        assert.equal(concept.getElementsByTagNameNS(SKOS, 'narrower').length, 0, 'Use a leaf Platform, not a parent category')
        assert.equal(concept.getElementsByTagNameNS(SKOS, 'prefLabel').length, 1)
        assert.equal(concept.getElementsByTagNameNS(SKOS, 'prefLabel')[0].textContent, state.oldShortName)
        const longName = Array.from(concept.getElementsByTagNameNS(GCMD, 'altLabel')).find((node) => node.getAttributeNS(GCMD, 'category') === 'primary')
        assert.equal(longName?.getAttributeNS(GCMD, 'text'), state.oldLongName)
        // GET /concept includes version metadata alongside the Concept. Never PUT that metadata.
        for (const element of children(doc.documentElement)) if (element !== concept) doc.documentElement.removeChild(element)
        await save('draft.before.rdf', serialize(doc))
        return doc
      })
      const source = await check('Source native DIF10 downloaded read-only', async () => {
        const details = await json('source-details', `${sourceBase}/search/collections.umm_json?concept_id=${state.sourceCollectionId}&page_size=1`, { source: true })
        assert.equal(details.items?.length, 1)
        const { meta } = details.items[0]
        assert.match(meta.format, /dif10/i, 'Source must be native DIF10')
        const result = await call('source-native', `${sourceBase}/search/concepts/${state.sourceCollectionId}/${meta['revision-id']}.native`, { source: true })
        await save('source.native.xml', result.text)
        state.sourceRevisionId = meta['revision-id']
        return xml(result.text)
      })
      const ingestPath = `${base}/ingest/providers/${encodeURIComponent(state.provider)}`
      for (const record of state.collections) {
        const before = await check(`${record.mode}: clone has a unique identity and expected Long_Name presence`, async () => {
          const doc = xml(serialize(source))
          assert.equal(doc.documentElement.localName, 'DIF')
          assert.equal(platforms(doc).length, 1, 'Use a source with one Platform to keep this smoke focused')
          const platform = platforms(doc)[0]
          assert.ok(child(platform, 'Instrument'), 'Source needs nested Instrument for the ordering regression')
          setText(child(doc.documentElement, 'Entry_ID'), 'Short_Name', record.nativeId)
          setText(doc.documentElement, 'Entry_Title', `KMS-728 smoke ${record.nativeId}`)
          setText(platform, 'Type', state.platformCategory)
          setText(platform, 'Short_Name', state.oldShortName)
          for (const name of children(platform, 'Long_Name')) platform.removeChild(name)
          if (record.mode === 'existing') {
            const name = doc.createElementNS(platform.namespaceURI, platform.prefix ? `${platform.prefix}:Long_Name` : 'Long_Name')
            name.textContent = state.oldLongName
            platform.insertBefore(name, child(platform, 'Short_Name').nextSibling)
          }
          // Do not carry another concept's optional native UUID attribute into this test Platform.
          platform.removeAttribute('uuid')
          const value = serialize(doc)
          await save(`${record.mode}.collection.before.xml`, value)
          return value
        })
        await check(`${record.mode}: CMR validates the clone before ingest`, async () => {
          const response = await call(`${record.mode}-validate-clone`, `${ingestPath}/validate/collection/${encodeURIComponent(record.nativeId)}`, { method: 'POST', contentType: 'application/dif10+xml', body: before })
          assert.equal(response.status, 200)
        })
        await check(`${record.mode}: new test collection ingested once`, async () => {
          record.ingestAttemptedAt = new Date().toISOString()
          await checkpoint()
          const result = await json(`${record.mode}-ingest-clone`, `${ingestPath}/collections/${encodeURIComponent(record.nativeId)}`, { method: 'PUT', contentType: 'application/dif10+xml', body: before })
          assert.match(result['concept-id'] || '', new RegExp(`^C\\d+-${state.provider}$`))
          record.collectionId = result['concept-id']
          record.initialRevisionId = result['revision-id']
          assert.ok(Number.isInteger(record.initialRevisionId))
          assert.ok(!state.collections.some((other) => other !== record && other.collectionId === record.collectionId), 'The two scenarios must be separate collections')
          await checkpoint()
        })
        await poll(`${record.mode}: CMR UUID discovery finds the new test collection`, async () => {
          const linked = await json(`${record.mode}-uuid-discovery`, lookup(state.platformUuid, record.collectionId))
          return linked.items?.some(({ meta }) => meta['concept-id'] === record.collectionId)
        })
        await check(`${record.mode}: stored native record matches the starting fixture`, async () => {
          const result = await call(`${record.mode}-initial-native`, `${base}/search/concepts/${record.collectionId}/${record.initialRevisionId}.native`)
          assert.deepEqual(tree(xml(result.text).documentElement), tree(xml(before).documentElement), 'CMR changed the ingested fixture before the test publish')
          await save(`${record.mode}.collection.ingested.xml`, result.text)
        })
      }
      await check('Draft short and long names changed without changing the keyword UUID', async () => {
        // Re-read immediately before mutation to avoid overwriting intervening edits to this concept.
        const current = xml((await call('draft-recheck', `${base}/kms/concept/${state.platformUuid}?version=draft&format=rdf&bypassCache=true`)).text)
        assert.deepEqual(tree(current.getElementsByTagNameNS(SKOS, 'Concept')[0]), tree(draft.getElementsByTagNameNS(SKOS, 'Concept')[0]), 'Draft concept changed during setup; refusing to overwrite')
        draft.getElementsByTagNameNS(SKOS, 'prefLabel')[0].textContent = state.newShortName
        const longName = Array.from(draft.getElementsByTagNameNS(GCMD, 'altLabel')).find((node) => node.getAttributeNS(GCMD, 'category') === 'primary')
        longName.setAttributeNS(GCMD, 'gcmd:text', state.newLongName)
        const updated = serialize(draft)
        await save('draft.after.rdf', updated)
        state.keywordUpdateAttemptedAt = new Date().toISOString()
        await checkpoint()
        const response = await call('rename-keyword', `${base}/kms/concept?version=draft`, { method: 'PUT', body: updated, contentType: 'application/rdf+xml' })
        assert.equal(response.status, 200)
      })
      await check('Publish KMS-728 submitted exactly once', async () => {
        state.publishAttemptedAt = new Date().toISOString()
        await checkpoint()
        const response = await call('publish', `${base}/kms/publish?name=${VERSION}`, { method: 'POST' })
        assert.equal(response.status, 202, 'Publish must acknowledge asynchronous processing; HTTP 202 does not mean correction finished')
        state.publishAccepted = true
        await checkpoint()
      })
    }
    await poll('Published Platform CSV exposes the renamed keyword', async () => {
      const csv = await platformCsv()
      const row = csv.find((item) => item.UUID === state.platformUuid)
      return row?.Short_Name === state.newShortName && row?.Long_Name === state.newLongName
    })
    let collectionFailure
    for (const record of state.collections) {
      record.verification = 'not-run'
      delete record.verificationError
    }
    for (const record of state.collections) {
      try {
        const auditQuery = new URLSearchParams({
          collectionConceptId: record.collectionId, publishedVersionName: VERSION,
          keywordConceptUuid: state.platformUuid, source: 'cmrKeywordEventsListener',
          startDate: state.publishAttemptedAt, limit: '100'
        })
        const audit = await poll(`${record.mode}: publish-triggered worker audit reaches applied`, async () => {
          const report = await json(`${record.mode}-audit-list`, `${base}/kms/metadata_correction_audit?${auditQuery}`)
          const failed = report.items?.find(({ status }) => status === 'failed')
          if (failed) {
            const detail = await json(`${record.mode}-failed-audit`, `${base}/kms/metadata_correction_audit/${failed.runId}?includeDiff=true`)
            await save(`${record.mode}.audit.failed.json`, detail)
            throw new Error(`Correction failed: ${failed.errorMessage || failed.outcome}. Audit: ${base}/kms/metadata_correction_audit/${failed.runId}?format=html`)
          }
          const applied = report.items?.find(({ status, outcome }) => status === 'applied' && outcome === 'writeback-applied')
          if (!applied) return false
          return json(`${record.mode}-applied-audit`, `${base}/kms/metadata_correction_audit/${applied.runId}?includeDiff=true`)
        })
        await save(`${record.mode}.audit.applied.json`, audit)
        record.auditRunId = audit.runId
        await check(`${record.mode}: audit proves the publish resolved both new keyword names`, async () => {
          assert.equal(audit.collectionConceptId, record.collectionId)
          assert.equal(audit.status, 'applied')
          assert.equal(audit.outcome, 'writeback-applied')
          assert.equal(audit.source, 'cmrKeywordEventsListener')
          assert.equal(audit.publishedVersionName, VERSION)
          assert.equal(audit.trigger?.eventType, 'UPDATED')
          assert.equal(audit.trigger?.keywordConceptUuid, state.platformUuid)
          assert.ok(Number.isInteger(audit.resultingRevisionId) && audit.resultingRevisionId > record.initialRevisionId, 'Applied audit must identify the written CMR revision')
          const correction = audit.corrections?.find((item) => item.scheme?.toLowerCase() === 'platforms' && item.keywordConceptUuid === state.platformUuid)
          assert.ok(correction, 'Expected a generated Platform correction, not just an applied status')
          assert.equal(correction.oldKeywordObject.ShortName, state.oldShortName)
          assert.equal(correction.newKeywordObject.ShortName, state.newShortName)
          assert.equal(correction.newLongName, state.newLongName)
        })
        await poll(`${record.mode}: CMR indexes the corrected native revision`, async () => {
          const result = await json(`${record.mode}-final-collection`, `${base}/search/collections.umm_json?concept_id=${record.collectionId}&page_size=1`)
          const item = result.items?.[0]
          return item?.meta['revision-id'] >= audit.resultingRevisionId ? item : false
        })
        await check(`${record.mode}: Short_Name updates and Long_Name ${record.mode === 'missing' ? 'stays absent' : 'updates in place before Instrument'}`, async () => {
          const result = await call(`${record.mode}-final-native`, `${base}/search/concepts/${record.collectionId}/${audit.resultingRevisionId}.native`)
          await save(`${record.mode}.collection.after.xml`, result.text)
          const before = xml(await fs.readFile(path.join(output, `${record.mode}.collection.ingested.xml`), 'utf8'))
          const after = xml(result.text)
          assert.equal(platforms(after).length, 1)
          const platform = platforms(after)[0]
          assert.equal(child(platform, 'Short_Name')?.textContent, state.newShortName)
          assert.equal(child(platform, 'Type')?.textContent, state.platformCategory)
          if (record.mode === 'missing') {
            assert.equal(children(platform, 'Long_Name').length, 0, 'Regression: the editor added the optional Long_Name')
          } else {
            assert.equal(children(platform, 'Long_Name').length, 1)
            assert.equal(child(platform, 'Long_Name').textContent, state.newLongName, 'Existing Long_Name must actually change, not merely remain present')
            assert.notEqual(state.newLongName, child(platforms(before)[0], 'Long_Name').textContent)
            const order = children(platform).map(({ localName }) => localName)
            assert.ok(order.indexOf('Long_Name') < order.indexOf('Instrument'), 'Long_Name must precede Instrument')
          }
          assert.deepEqual(children(platform).map(({ localName }) => localName), children(platforms(before)[0]).map(({ localName }) => localName))
          // Older source records may legitimately receive other keyword corrections. Preserve
          // non-keyword sections and retain the full audit and XML for reviewing all changes.
          for (const name of ['Entry_ID', 'Entry_Title', 'Personnel', 'Summary', 'Spatial_Coverage', 'Metadata_Name', 'Metadata_Version', 'Metadata_Dates']) {
            assert.deepEqual(children(after.documentElement, name).map(tree), children(before.documentElement, name).map(tree), `Unrelated ${name} changed`)
          }
          record.finalRevisionId = audit.resultingRevisionId
          record.verification = 'passed'
          await checkpoint()
        })
        console.log(`${record.mode} audit: ${base}/kms/metadata_correction_audit/${record.auditRunId}?format=html`)
        console.log(`${record.mode} collection: ${base}/search/concepts/${record.collectionId}.native`)
      } catch (failure) {
        // Check the second collection even if the first fails; one success must not mask the other.
        record.verification = 'failed'
        record.verificationError = failure.message
        collectionFailure ||= failure
        await checkpoint()
      }
    }
    if (collectionFailure) throw collectionFailure
  } catch (failure) {
    error = failure
    if (!checks.some(({ passed }) => !passed)) {
      checks.push({ name: 'Smoke execution', passed: false, error: failure.message })
      console.error(`✗ FAIL: ${failure.message}`)
    }
  } finally {
    const allCollectionsPassed = state.collections?.length === 2 && state.collections.every(({ verification }) => verification === 'passed')
    const passed = !error && allCollectionsPassed
    const environment = state.environment?.toUpperCase() || '(not configured)'
    const verifiedEnvironment = passed && verificationMode === 'live' ? state.environment : null
    await checkpoint()
    await save('result.json', { ...state, passed, verificationMode, verifiedEnvironment, checks, ...(error ? { error: error.message } : {}) })
    const checklist = [
      `KMS-728 verification checklist - ${environment}`,
      `Target: ${base || '(not configured)'}`,
      `Verification mode: ${verificationMode}`,
      `Environment verified: ${verifiedEnvironment ? environment : 'NOT VERIFIED live'}`,
      `Publish: ${VERSION}`,
      ...checks.map(({ name, passed: ok }) => `${ok ? '[x] PASS' : '[!] FAIL'} ${name}`),
      '',
      ...(state.collections || []).map((record) => `${record.verification === 'passed' ? '[x] PASS' : record.verification === 'failed' ? '[!] FAIL' : '[ ] NOT RUN'} ${record.mode}: ${record.collectionId || '(not ingested)'}; audit=${record.auditRunId || '(none)'}; revision=${record.finalRevisionId || '(not verified)'}`),
      '',
      `${passed ? 'PASS' : 'FAIL'}: both scenarios must pass in ${environment}.`,
      ...(verificationMode === 'local-harness' ? ['Local harness results do not verify deployed SIT or UAT.'] : [])
    ].join('\n')
    await save('checklist.txt', checklist)
    console.log(`${passed ? '✓ PASS' : '✗ FAIL'} [${environment} / ${verificationMode}]: ${checks.filter(({ passed: ok }) => ok).length} passed; ${checks.filter(({ passed: ok }) => !ok).length} failed. Evidence: ${output}`)
    console.log(`Environment verified: ${verifiedEnvironment ? environment : 'NOT VERIFIED live'}. Checklist: ${path.join(output, 'checklist.txt')}`)
    if (state.collections?.some(({ ingestAttemptedAt }) => ingestAttemptedAt) || state.keywordUpdateAttemptedAt) console.log('Remote changes are retained. See state.json and draft.before.rdf before deliberate cleanup; no automatic rollback or extra publish was performed.')
  }
  if (error) throw error
  return { output, state, checks }
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help')) {
    console.log(`KMS-728 full remote smoke. Configure the environment variables documented at the TOP of this file.
Required: CMR_ENV=sit|uat, CMR_AUTHORIZATION, KMS_AUTH.
Default Platform: ALTIUS (${DEFAULT_PLATFORM_UUID}); rechecks its long name and absence of target collections before writes.
Optional: PLATFORM_UUID, TARGET_PROVIDER=MMT_1, SOURCE_ENV=uat, SOURCE_COLLECTION_ID=C1240286110-SCIOPS,
SOURCE_CMR_AUTHORIZATION, WAIT_TIMEOUT_MS=1800000, POLL_INTERVAL_MS=15000.
Run: node scripts/local/run_metadata_correction_long_name_remote_smoke.mjs
Resume reads only: node scripts/local/run_metadata_correction_long_name_remote_smoke.mjs --verify <run-directory>
Automatically ingests TWO collections (with/without Long_Name), changes Platform short/long names, and publishes ALL pending
Draft changes as KMS-728 without confirmation. Never targets production or writes to the source.
Verifies each collection independently; checklist.txt/result.json record target environment and both outcomes.
No automatic cleanup, rollback, or write retries. Requires deployed KMS-728 and enabled writeback.`)
  } else {
    const resume = process.argv[2] === '--verify'
    if ((process.argv.length > 2 && !resume) || (resume && !process.argv[3])) {
      console.error('✗ FAIL: Use --help, no arguments, or --verify <run-directory>')
      process.exitCode = 1
    } else runRemoteSmoke({ resumeDirectory: resume ? process.argv[3] : undefined }).catch((error) => {
      console.error(`✗ Smoke failed: ${error.message}`)
      process.exitCode = 1
    })
  }
}
