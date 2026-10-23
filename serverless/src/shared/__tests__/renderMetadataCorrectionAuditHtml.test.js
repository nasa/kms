import {
  afterEach,
  describe,
  expect,
  test,
  vi
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
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows whole-version activity timestamps with relative ages at page load', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-23T17:00:00.000Z').getTime())

    const view = renderMetadataCorrectionAuditHtml({
      groupByPublishedVersion: true,
      items: [{
        publishedVersionName: '25.0',
        updatedAt: '2026-10-23T16:55:00.000Z'
      }],
      publishedVersionActivity: [{
        publishedVersionName: '25.0',
        firstActivityAt: new Date('2026-10-21T09:00:00.000Z'),
        latestActivityAt: '2026-10-23T12:00:00.000Z'
      }]
    })

    expect(view).toContain('<strong>First activity:</strong> <time datetime="2026-10-21T09:00:00.000Z">2026-10-21T09:00:00.000Z</time> (2 days ago)')
    expect(view).toContain('<strong>Latest activity:</strong> <time datetime="2026-10-23T12:00:00.000Z">2026-10-23T12:00:00.000Z</time> (5 hours ago)')
    expect(view).toContain('<strong>Activity duration:</strong> 2d 3h')
    expect(view).toContain('Duration is from first to latest recorded activity.')
    expect(view).toContain('Ages are as of page load; refresh to update.')
    expect(view).toContain('Latest activity does not confirm all queued work is complete.')
  })

  test('formats activity duration for short, zero, missing, invalid, and reversed intervals', () => {
    const firstActivityAt = '2026-10-23T12:00:00.000Z'
    const scenarios = [
      {
        latestActivityAt: '2026-10-23T13:02:03.000Z',
        expected: '1h 2m 3s'
      },
      {
        latestActivityAt: '2026-10-23T12:00:45.000Z',
        expected: '45s'
      },
      {
        latestActivityAt: firstActivityAt,
        expected: '0s'
      },
      {
        latestActivityAt: undefined,
        expected: 'Not available'
      },
      {
        latestActivityAt: 'invalid',
        expected: 'Not available'
      },
      {
        latestActivityAt: '2026-10-23T11:59:59.000Z',
        expected: 'Not available'
      }
    ]

    scenarios.forEach(({ latestActivityAt, expected }) => {
      const view = renderMetadataCorrectionAuditHtml({
        groupByPublishedVersion: true,
        items: [{ publishedVersionName: '25.0' }],
        publishedVersionActivity: [{
          publishedVersionName: '25.0',
          firstActivityAt,
          latestActivityAt
        }]
      })

      expect(view).toContain(`<strong>Activity duration:</strong> ${expected}</span>`)
    })
  })

  test('keeps version activity separate and handles singular, recent, future, and absent dates', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-23T17:00:00.000Z').getTime())

    const view = renderMetadataCorrectionAuditHtml({
      groupByPublishedVersion: true,
      items: [
        { publishedVersionName: 'hour' },
        { publishedVersionName: 'minute' },
        { publishedVersionName: 'missing' },
        { publishedVersionName: 'invalid' }
      ],
      publishedVersionActivity: [{
        publishedVersionName: 'hour',
        firstActivityAt: '2026-10-22T17:00:00.000Z',
        latestActivityAt: '2026-10-23T16:00:00.000Z'
      }, {
        publishedVersionName: 'minute',
        firstActivityAt: '2026-10-23T16:59:00.000Z',
        latestActivityAt: '2026-10-23T16:59:45.000Z'
      }, {
        publishedVersionName: 'invalid',
        firstActivityAt: '<script>invalid</script>',
        latestActivityAt: '2026-10-23T18:00:00.000Z'
      }, {
        publishedVersionName: 'missing',
        firstActivityAt: null
      }]
    })

    expect(view).toContain('(1 day ago)')
    expect(view).toContain('(1 hour ago)')
    expect(view).toContain('(1 minute ago)')
    expect(view).toContain('(just now)')
    expect(view).toContain('(in 1 hour)')
    expect(view).toContain('<strong>First activity:</strong> Not available')
    expect(view).toContain('<strong>Latest activity:</strong> Not available')
    expect(view).not.toContain('<script>invalid</script>')
    expect(view.indexOf('(1 hour ago)')).toBeLessThan(view.indexOf('Published Version: minute'))
    expect(view.indexOf('(1 minute ago)')).toBeGreaterThan(view.indexOf('Published Version: minute'))
  })

  test('renders a safe change table and colored side-by-side native metadata diff', () => {
    const view = renderMetadataCorrectionAuditHtml({
      collectionConceptId: 'C123-PROV',
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
    expect(view).toContain('<form class="audit-filter" method="get">')
    expect(view).toContain('name="format" value="html"')
    expect(view).toContain('name="collectionConceptId" value="C123-PROV"')
    expect(view).toContain('<a href="?format=html">Clear</a>')
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
        publishedVersionName: 'published-42',
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
    expect(view).toContain('Published Version published-42')
    expect(view).toContain('<a href="metadata_correction_audit/run%2Fsummary?format=html">run/summary</a>')
    expect(view).not.toContain('Native metadata diff')
    expect(view).not.toContain('Run details')
  })

  test('renders a published version report as a collection change table', () => {
    const view = renderMetadataCorrectionAuditHtml({
      groupByPublishedVersion: true,
      items: [{
        runId: 'run-v42-a',
        collectionConceptId: 'C42-A',
        collectionUri: 'https://cmr.example.com/search/concepts/C42-A',
        publishedVersionName: 'published-42',
        status: 'applied',
        changes: [{
          scheme: 'platforms',
          action: 'replace',
          oldKeywordPath: 'Platforms > Old',
          newKeywordPath: 'Platforms > New'
        }]
      }, {
        runId: 'run-v42-b',
        recordType: 'publisherEventNoOp',
        collectionCount: 0,
        outcome: 'no-collections-found',
        publishedVersionName: 'published-42',
        status: 'checked'
      }, {
        runId: 'run-v41',
        publishedVersionName: 'published-41',
        status: 'applied'
      }]
    })

    expect(view).toContain('Published Version: published-42')
    expect(view).not.toContain('<strong>First activity:</strong>')
    expect(view).not.toContain('<strong>Latest activity:</strong>')
    expect(view).toContain('2 audit records')
    expect(view).toContain('Published Version: published-41')
    expect(view).toContain('1 audit record')
    expect(view).toContain('<table class="published-table">')
    expect(view).toContain('<th scope="col">Collection ID</th>')
    expect(view).toContain('<th scope="col">Outcome</th>')
    expect(view).toContain('C42-A')
    expect(view).toContain('Platforms &gt; Old')
    expect(view).toContain('Platforms &gt; New')
    expect(view).toContain('No collections found')
    expect(view).toContain('no-collections-found')
    expect(view).toContain('<td><a href="run-v42-a?format=html">C42-A</a></td>')
    expect(view).toContain('<a href="run-v42-b?format=html">No collections found</a>')
    expect(view).not.toContain('https://cmr.example.com/search/concepts/C42-A')
    expect(view).not.toContain('<p class="audit-meta">Run ')
    expect(view.indexOf('Published Version: published-42'))
      .toBeLessThan(view.indexOf('Published Version: published-41'))
  })

  test('renders failed and unknown published audit values', () => {
    const view = renderMetadataCorrectionAuditHtml({
      groupByPublishedVersion: true,
      items: [{
        runId: 'run-failed',
        collectionConceptId: 'C-FAILED',
        publishedVersionName: 'published-failed',
        status: 'failed'
      }, {
        runId: 'run-unknown',
        collectionConceptId: 'C-UNKNOWN'
      }]
    })

    expect(view).toContain('Published Version: published-failed')
    expect(view).toContain('Published Version: Unknown published version')
    expect(view).toContain('<span class="status status-failed">failed</span>')
    expect(view).toContain('<span class="status">unknown</span>')
    expect(view).toContain('<a href="run-failed?format=html">C-FAILED</a>')
  })

  test('links every changed keyword row to its failed run, including workflow failures', () => {
    const view = renderMetadataCorrectionAuditHtml({
      groupByPublishedVersion: true,
      runDetailHrefPrefix: '../',
      items: [{
        runId: 'failed/run',
        recordType: 'metadataCorrectionWorkflowFailure',
        status: 'failed',
        changes: [{ scheme: 'platforms' }, { scheme: 'productlevelid' }]
      }, {
        collectionConceptId: 'C-MISSING-RUN',
        status: 'failed'
      }]
    })

    expect(view).toContain('Metadata correction workflow failure')
    expect(view.match(/<a href="\.\.\/failed%2Frun\?format=html">Metadata correction workflow failure<\/a>/g))
      .toHaveLength(2)

    expect(view).not.toContain('href="../undefined')
    expect(view).toContain('<td>C-MISSING-RUN</td>')
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

  test('explains a completed native no-op in audit cards and published reports', () => {
    const audit = {
      runId: 'native-no-op',
      collectionConceptId: 'C123-PROV',
      status: 'checked',
      outcome: 'no-native-corrections-applied',
      resolvedCorrectionCount: 3,
      correctionsAppliedCount: 0
    }
    let view = renderMetadataCorrectionAuditHtml({
      detail: true,
      items: [audit]
    })

    expect(view).toContain('no-native-corrections-applied')
    expect(view).toContain('3 corrections resolved; 0 applied to native metadata.')
    expect(view).toContain('No native metadata diff was recorded for this run.')
    view = renderMetadataCorrectionAuditHtml({
      groupByPublishedVersion: true,
      items: [audit]
    })

    expect(view).toContain('no-native-corrections-applied')
    expect(view).toContain('3 corrections resolved; 0 applied to native metadata.')

    view = renderMetadataCorrectionAuditHtml({
      items: [{
        ...audit,
        resolvedCorrectionCount: 1
      }]
    })

    expect(view).toContain('1 correction resolved; 0 applied to native metadata.')
  })

  test('identifies a workflow failure that occurred before a collection was known', () => {
    const view = renderMetadataCorrectionAuditHtml({
      detail: true,
      items: [{
        runId: 'workflow-failure',
        recordType: 'metadataCorrectionWorkflowFailure',
        status: 'failed',
        outcome: 'keyword-event-processing-failed',
        error: { message: 'CMR lookup unavailable' }
      }]
    })

    expect(view).toContain('Metadata correction workflow failure')
    expect(view).toContain('CMR lookup unavailable')
    expect(view).not.toContain('Unknown collection')
  })

  test('renders a no-collections-found publisher event clearly', () => {
    const view = renderMetadataCorrectionAuditHtml({
      detail: true,
      items: [{
        runId: 'f3351653-dfc3-47d8-9176-294ea90bc118',
        recordType: 'publisherEventNoOp',
        publishedVersionName: '20.1',
        collectionCount: 0,
        outcome: 'no-collections-found',
        status: 'checked',
        corrections: [{
          scheme: 'platforms',
          action: 'UPDATED',
          oldKeywordPath: 'Platforms > GOSAT',
          newKeywordPath: 'Platforms > GOSAT - Test1'
        }]
      }]
    })

    expect(view).toContain('Publisher event: no collections found')
    expect(view).toContain('Published KMS version')
    expect(view).toContain('20.1')
    expect(view).toContain('Collections found')
    expect(view).toContain('no-collections-found')
    expect(view).toContain('Platforms &gt; GOSAT - Test1')
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

  test('renders the bare string None instead of the disclaimer when the list is not provided', () => {
    const view = renderMetadataCorrectionAuditHtml({})

    expect(view).not.toContain('enabled-providers-notice')
    expect(view).toContain('None')
  })

  test('renders a disclaimer naming the enabled providers', () => {
    const view = renderMetadataCorrectionAuditHtml({
      enabledProviders: ['ARCTEST', 'KMS']
    })

    expect(view).toContain(
      'KMS fixer service enabled only for the following providers: ARCTEST, KMS'
    )
  })

  test('renders a disclaimer describing an unrestricted rollout', () => {
    const view = renderMetadataCorrectionAuditHtml({
      enabledProviders: ['ALL']
    })

    expect(view).toContain(
      'KMS fixer service enabled only for the following providers: all providers'
    )
  })

  test('does not treat ALL as a wildcard when listed alongside specific providers', () => {
    const view = renderMetadataCorrectionAuditHtml({
      enabledProviders: ['ARCTEST', 'ALL']
    })

    expect(view).toContain(
      'KMS fixer service enabled only for the following providers: ARCTEST, ALL'
    )

    expect(view).not.toContain('all providers')
  })

  test('renders a disclaimer describing a fully disabled rollout', () => {
    const view = renderMetadataCorrectionAuditHtml({
      enabledProviders: []
    })

    expect(view).toContain(
      'KMS fixer service enabled only for the following providers: none'
    )
  })
})
