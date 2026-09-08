import {
  describe,
  expect,
  test
} from 'vitest'

import { renderMetadataCorrectionAuditHtml } from '../renderMetadataCorrectionAuditHtml'

const PATCH = `===================================================================
--- cmr-revision-3
+++ corrected-metadata
@@ -1,1 +1,1 @@
-<ShortName>GOSAT</ShortName>
+<ShortName>GOSAT - Test1</ShortName>
`

describe('renderMetadataCorrectionAuditHtml', () => {
  test('renders a safe change table and colored side-by-side native metadata diff', () => {
    const view = renderMetadataCorrectionAuditHtml({
      items: [{
        runId: 'run-1',
        collectionConceptId: 'C123-PROV',
        collectionUri: 'https://cmr.example.com/search/concepts/C123-PROV',
        status: 'applied',
        updatedAt: new Date('2026-09-07T12:00:00.000Z'),
        changes: [{
          scheme: 'platforms',
          action: 'UPDATED',
          oldKeywordPath: 'Platforms > GOSAT',
          newKeywordPath: 'Platforms > GOSAT - Test1'
        }],
        metadataDiff: {
          changed: true,
          format: 'unified',
          patch: PATCH,
          truncated: false
        }
      }],
      nextPageHref: '?format=html&amp;paginationToken=next'
    })

    expect(view).toContain('<!doctype html>')
    expect(view).toContain('<table class="changes-table">')
    expect(view).toContain('Platforms &gt; GOSAT - Test1')
    expect(view).toContain('class="d2h-del d2h-change"')
    expect(view).toContain('class="d2h-ins d2h-change"')
    expect(view).toContain('<ins> - Test1</ins>')
    expect(view).toContain('white-space: pre;')
    expect(view).toContain('overflow-x: auto;')
    expect(view).toContain('Next page')
    expect(view).toContain('<a href="metadata_correction_audit/run-1?format=html">run-1</a>')
  })

  test('keeps summaries compact when a native metadata diff was not requested', () => {
    const view = renderMetadataCorrectionAuditHtml({
      items: [{
        runId: 'run/summary',
        collectionConceptId: 'C123-PROV',
        status: 'applied',
        changes: [{
          scheme: 'platforms',
          action: 'UPDATED',
          oldKeywordPath: 'Platforms > GOSAT',
          newKeywordPath: 'Platforms > GOSAT - Test1'
        }]
      }]
    })

    expect(view).toContain('Keyword changes')
    expect(view).toContain('<a href="metadata_correction_audit/run%2Fsummary?format=html">run/summary</a>')
    expect(view).not.toContain('Native metadata diff')
    expect(view).not.toContain('Run details')
  })

  test('renders complete run context and lifecycle history in detail mode', () => {
    const view = renderMetadataCorrectionAuditHtml({
      detail: true,
      items: [{
        runId: 'run-detail',
        collectionConceptId: 'C123-PROV',
        providerId: 'PROV',
        publishedVersionName: 'version-1',
        nativeFormat: 'UMM-C',
        delegateName: 'umm',
        source: 'cmrKeywordEventsListener',
        outcome: 'writeback-applied',
        priorRevisionId: 4,
        resultingRevisionId: 5,
        messageId: 'message-1',
        createdAt: new Date('2026-09-07T11:59:00.000Z'),
        updatedAt: new Date('2026-09-07T12:00:00.000Z'),
        status: 'applied',
        trigger: {
          eventType: 'UPDATED',
          scheme: 'platforms',
          keywordConceptUuid: 'platform-uuid',
          timestamp: '2026-09-07T11:58:00.000Z'
        },
        corrections: [],
        keywordValidationFailures: [{ path: 'Platforms > Missing' }],
        statusHistory: [{
          status: 'checked',
          timestamp: new Date('2026-09-07T11:59:00.000Z'),
          outcome: 'corrections-resolved'
        }, {
          status: 'failed',
          timestamp: '2026-09-07T12:00:00.000Z',
          error: 'CMR failed'
        }]
      }]
    })

    expect(view).toContain('Run details')
    expect(view).toContain('Published KMS version')
    expect(view).toContain('version-1')
    expect(view).toContain('Prior CMR revision')
    expect(view).toContain('Trigger')
    expect(view).toContain('platform-uuid')
    expect(view).toContain('Keyword validation failures')
    expect(view).toContain('&quot;path&quot;: &quot;Platforms &gt; Missing&quot;')
    expect(view).toContain('Lifecycle history')
    expect(view).toContain('corrections-resolved')
    expect(view).toContain('CMR failed')
    expect(view).toContain('No native metadata diff was recorded for this run.')
    expect(view).toContain('<p class="audit-meta">Run run-detail')
    expect(view).not.toContain('metadata_correction_audit/run-detail?format=html')
  })

  test('escapes audit content and reports absent and truncated diffs', () => {
    const view = renderMetadataCorrectionAuditHtml({
      detail: true,
      items: [
        {
          runId: '<script>alert("run")</script>',
          collectionConceptId: '<script>alert("collection")</script>',
          collectionUri: 'mailto:not-a-web-link@example.com',
          status: 'failed',
          error: { message: '<script>alert("error")</script>' }
        },
        {
          runId: 'run-2',
          collectionConceptId: 'C456-PROV',
          status: 'pending',
          corrections: [],
          metadataDiff: {
            patch: PATCH,
            truncated: true
          }
        },
        {
          runId: 'run-3',
          collectionConceptId: 'C789-PROV',
          status: 'checked',
          metadataDiff: {
            patch: { invalid: true }
          }
        },
        {
          runId: 'run-4',
          collectionConceptId: 'C999-PROV',
          status: 'applied',
          metadataDiff: {
            patch: PATCH.replace('GOSAT - Test1', '<img src=x onerror=alert("patch")>')
          }
        }
      ]
    })

    expect(view).not.toContain('<script>alert')
    expect(view).not.toContain('href="mailto:')
    expect(view).toContain('&lt;script&gt;alert(&quot;collection&quot;)&lt;/script&gt;')
    expect(view).toContain('No keyword path changes were recorded for this run.')
    expect(view).toContain('No native metadata diff was recorded for this run.')
    expect(view).toContain('This diff was truncated')
    expect(view).toContain('status status-failed')
    expect(view).toContain('<pre>[object Object]</pre>')
    expect(view).not.toContain('<img src=x')
    expect(view).not.toContain('onerror=alert("patch")')
    expect(view).toContain('onerror=alert(&quot;patch&quot;)')
  })

  test('renders an empty state', () => {
    const view = renderMetadataCorrectionAuditHtml({
      message: 'No matching records'
    })

    expect(view).toContain('No matching records')
    expect(view).toContain('0 audit records')
  })
})
