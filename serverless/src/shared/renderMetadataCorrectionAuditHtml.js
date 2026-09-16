import { html as renderDiffHtml } from 'diff2html'
// Vite and the Lambda esbuild configuration inline this package stylesheet as text.
// eslint-disable-next-line import/no-unresolved
import diff2HtmlStyles from 'diff2html/bundles/css/diff2html.min.css?inline'
import { escape } from 'html-escaper'

const PAGE_STYLES = `
  :root {
    color-scheme: light;
    --ink: #142f3c;
    --muted: #5f7480;
    --line: #cbd8dd;
    --paper: #fffdf8;
    --canvas: #eef4f3;
    --accent: #007f77;
    --accent-soft: #d8efeb;
    --danger: #a43b35;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background:
      radial-gradient(circle at 8% 0%, rgba(0, 127, 119, 0.14), transparent 28rem),
      linear-gradient(180deg, #f7faf8 0, var(--canvas) 22rem);
    color: var(--ink);
    font-family: "Avenir Next", Avenir, "Trebuchet MS", sans-serif;
  }

  main {
    width: min(96vw, 1600px);
    margin: 0 auto;
    padding: 2.5rem 0 4rem;
  }

  h1, h2, h3, p { margin-top: 0; }

  h1 {
    margin-bottom: 0.4rem;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(2rem, 4vw, 3.6rem);
    font-weight: 600;
    letter-spacing: -0.035em;
  }

  .lede {
    margin-bottom: 2rem;
    color: var(--muted);
    font-size: 1.05rem;
  }

  .audit-card {
    margin-bottom: 1.5rem;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 0.75rem;
    background: var(--paper);
    box-shadow: 0 0.7rem 2rem rgba(20, 47, 60, 0.08);
  }

  .audit-filter {
    display: flex;
    align-items: end;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    padding: 1rem;
    border: 1px solid var(--line);
    border-radius: 0.75rem;
    background: var(--paper);
    box-shadow: 0 0.7rem 2rem rgba(20, 47, 60, 0.06);
  }

  .audit-filter label {
    display: grid;
    flex: 1;
    gap: 0.35rem;
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .audit-filter input {
    width: 100%;
    padding: 0.7rem 0.8rem;
    border: 1px solid #9db6b6;
    border-radius: 0.4rem;
    background: #ffffff;
    color: var(--ink);
    font: 0.9rem ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .audit-filter button,
  .audit-filter a {
    padding: 0.7rem 1rem;
    border: 1px solid var(--accent);
    border-radius: 0.4rem;
    font: inherit;
    font-weight: 700;
    text-decoration: none;
  }

  .audit-filter button {
    background: var(--accent);
    color: #ffffff;
    cursor: pointer;
  }

  .audit-filter a {
    background: transparent;
    color: var(--accent);
  }

  .audit-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.4rem;
    border-bottom: 1px solid var(--line);
  }

  .audit-header h2 {
    margin-bottom: 0.25rem;
    font-size: 1.25rem;
  }

  .audit-header a { color: var(--accent); }

  .audit-meta {
    margin: 0;
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.78rem;
    overflow-wrap: anywhere;
  }

  .audit-meta a {
    color: var(--accent);
    font-weight: 700;
  }

  .status {
    flex: none;
    padding: 0.35rem 0.65rem;
    border: 1px solid #9db6b6;
    border-radius: 999px;
    background: var(--accent-soft);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .status-failed {
    border-color: #e4aaa5;
    background: #fce6e4;
    color: var(--danger);
  }

  .section {
    padding: 1.25rem 1.4rem;
    border-bottom: 1px solid var(--line);
  }

  .section:last-child { border-bottom: 0; }

  .section h3 {
    margin-bottom: 0.8rem;
    font-size: 0.82rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 1rem;
    margin: 0;
  }

  .detail-grid div {
    min-width: 0;
    padding: 0.7rem 0.8rem;
    border-left: 0.2rem solid var(--accent);
    background: #f1f6f4;
  }

  .detail-grid dt {
    margin-bottom: 0.25rem;
    color: var(--muted);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .detail-grid dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .changes-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 0.88rem;
  }

  .changes-table th,
  .changes-table td {
    padding: 0.65rem 0.7rem;
    border: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
    overflow-wrap: anywhere;
  }

  .changes-table th {
    background: #e7efed;
    color: #36515d;
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .changes-table th:nth-child(1) { width: 14%; }
  .changes-table th:nth-child(2) { width: 11%; }

  .history-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.86rem;
  }

  .history-table th,
  .history-table td {
    padding: 0.6rem 0.7rem;
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
  }

  .history-table th {
    color: var(--muted);
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .previous-path { background: #fff4f3; }
  .updated-path { background: #edf9f3; }

  .diff-scroll {
    max-width: 100%;
    overflow-x: auto;
    border: 1px solid var(--line);
    border-radius: 0.4rem;
    background: #ffffff;
  }

  .diff-scroll .d2h-wrapper { min-width: 72rem; }
  .diff-scroll .d2h-file-header { display: none; }
  .diff-scroll .d2h-file-wrapper { margin: 0; border: 0; }
  .diff-scroll .d2h-files-diff { display: flex; }
  .diff-scroll .d2h-file-side-diff { width: 50%; }
  .diff-scroll .d2h-code-wrapper { overflow: visible; }
  .diff-scroll .d2h-diff-table { font-size: 0.75rem; }
  .diff-scroll .d2h-code-side-line { white-space: pre; }
  .diff-scroll .d2h-code-line-ctn { white-space: pre; }

  .notice,
  .error {
    margin: 0 0 0.8rem;
    padding: 0.75rem 0.9rem;
    border-radius: 0.35rem;
    background: #fff4cf;
    color: #684f00;
  }

  .error {
    background: #fce6e4;
    color: var(--danger);
  }

  .empty {
    padding: 3rem;
    border: 1px dashed #91aaa9;
    border-radius: 0.75rem;
    background: rgba(255, 253, 248, 0.75);
    color: var(--muted);
    text-align: center;
  }

  .next-page {
    display: inline-block;
    padding: 0.75rem 1rem;
    border-radius: 0.4rem;
    background: var(--accent);
    color: #ffffff;
    font-weight: 700;
    text-decoration: none;
  }

  .diagnostic {
    max-width: 100%;
    margin: 0;
    overflow-x: auto;
    white-space: pre;
    font: 0.78rem/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  @media (max-width: 700px) {
    main { width: min(94vw, 1600px); padding-top: 1.5rem; }
    .audit-filter { align-items: stretch; flex-direction: column; }
    .audit-header { display: block; }
    .status { display: inline-block; margin-top: 0.8rem; }
    .changes-table th:nth-child(1),
    .changes-table th:nth-child(2) { width: auto; }
  }
`

/**
 * Escapes an audit value before placing it in the HTML document.
 *
 * @param {unknown} value Audit value to display.
 * @param {string} fallback Text used when the value is absent.
 * @returns {string} HTML-safe display value.
 */
const displayValue = (value, fallback = 'Not available') => escape(
  String(value ?? fallback)
)

/**
 * Formats a stored date consistently for detail fields and lifecycle history.
 *
 * @param {unknown} value Stored date value.
 * @returns {string} HTML-safe ISO date or fallback text.
 */
const displayDate = (value) => displayValue(value instanceof Date ? value.toISOString() : value)

/**
 * Renders an HTML-only collection concept ID filter for the audit summary.
 *
 * @param {unknown} collectionConceptId Current exact-match filter value.
 * @returns {string} GET form that retains the HTML response format.
 */
const renderCollectionFilter = (collectionConceptId) => {
  const clearLink = collectionConceptId
    ? '<a href="?format=html">Clear</a>'
    : ''

  return `
    <form class="audit-filter" method="get">
      <input type="hidden" name="format" value="html">
      <label for="collectionConceptId">
        Collection ID
        <input id="collectionConceptId" name="collectionConceptId" value="${displayValue(collectionConceptId, '')}" placeholder="C1234567890-PROVIDER">
      </label>
      <button type="submit">Filter</button>
      ${clearLink}
    </form>
  `
}

/**
 * Renders labeled audit values in a responsive detail grid.
 *
 * @param {Array<[string, unknown]>} entries Label/value pairs, including optional values.
 * @returns {string} Detail grid containing only available values.
 */
const renderDetailGrid = (entries) => {
  const availableEntries = entries.filter(([, value]) => value !== undefined && value !== null && value !== '')

  if (availableEntries.length === 0) return ''

  return `<dl class="detail-grid">${availableEntries.map(([label, value]) => `
    <div>
      <dt>${displayValue(label)}</dt>
      <dd>${displayValue(value)}</dd>
    </div>
  `).join('')}</dl>`
}

/**
 * Returns either a safe CMR collection link or a plain collection identifier.
 *
 * @param {Object} audit Audit summary or detail document.
 * @returns {string} HTML collection heading.
 */
const renderCollectionHeading = (audit) => {
  const conceptId = displayValue(audit.collectionConceptId, 'Unknown collection')
  const collectionUri = String(audit.collectionUri || '')

  if (!/^https:\/\//i.test(collectionUri)) return conceptId

  return `<a href="${displayValue(collectionUri)}" rel="noopener noreferrer">${conceptId}</a>`
}

/**
 * Renders the CSV-derived corrections as a compact old-to-new path table.
 *
 * @param {Object} audit Audit summary or detail document.
 * @returns {string} HTML changes table.
 */
const renderChangesTable = (audit) => {
  let changes = []
  if (Array.isArray(audit.changes)) changes = audit.changes
  else if (Array.isArray(audit.corrections)) changes = audit.corrections

  if (changes.length === 0) {
    return '<p class="notice">No keyword path changes were recorded for this run.</p>'
  }

  const rows = changes.map((change) => `
    <tr>
      <td>${displayValue(change.scheme)}</td>
      <td>${displayValue(change.action)}</td>
      <td class="previous-path">${displayValue(change.oldKeywordPath)}</td>
      <td class="updated-path">${displayValue(change.newKeywordPath)}</td>
    </tr>
  `).join('')

  return `
    <table class="changes-table">
      <thead>
        <tr>
          <th scope="col">Scheme</th>
          <th scope="col">Action</th>
          <th scope="col">Previous keyword path</th>
          <th scope="col">Updated keyword path</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

/**
 * Converts a stored unified patch into a colored, side-by-side metadata table.
 *
 * @param {Object} audit Audit summary or detail document.
 * @returns {string} HTML diff or an explanatory message when no patch exists.
 */
const renderNativeMetadataDiff = (audit) => {
  const { metadataDiff } = audit

  if (!metadataDiff?.patch) {
    return '<p class="notice">No native metadata diff was recorded for this run.</p>'
  }

  let diffHtml
  try {
    diffHtml = renderDiffHtml(metadataDiff.patch, {
      diffMaxChanges: 5_000,
      diffMaxLineLength: 50_000,
      diffStyle: 'word',
      drawFileList: false,
      matching: 'lines',
      outputFormat: 'side-by-side'
    })
  } catch {
    diffHtml = `<pre>${displayValue(metadataDiff.patch)}</pre>`
  }

  const truncatedNotice = metadataDiff.truncated
    ? '<p class="notice">This diff was truncated when the audit record was created.</p>'
    : ''

  return `
    ${truncatedNotice}
    <div class="diff-scroll">${diffHtml}</div>
  `
}

/**
 * Renders the fields available only on a complete audit document.
 *
 * @param {Object} audit Detailed audit document.
 * @returns {string} Run overview and optional trigger detail sections.
 */
const renderRunDetails = (audit) => {
  const overview = renderDetailGrid([
    ['Provider', audit.providerId],
    ['Published KMS version', audit.publishedVersionName],
    ['Native format', audit.nativeFormat],
    ['Delegate', audit.delegateName],
    ['Source', audit.source],
    ['Outcome', audit.outcome],
    ['Prior CMR revision', audit.priorRevisionId],
    ['Resulting CMR revision', audit.resultingRevisionId],
    ['Message ID', audit.messageId],
    ['Created', audit.createdAt instanceof Date ? audit.createdAt.toISOString() : audit.createdAt],
    ['Updated', audit.updatedAt instanceof Date ? audit.updatedAt.toISOString() : audit.updatedAt]
  ])
  const trigger = audit.trigger && typeof audit.trigger === 'object'
    ? renderDetailGrid([
      ['Event type', audit.trigger.eventType],
      ['Scheme', audit.trigger.scheme],
      ['Keyword UUID', audit.trigger.keywordConceptUuid],
      ['Event timestamp', audit.trigger.timestamp]
    ])
    : ''

  return `
    ${overview ? `<section class="section"><h3>Run details</h3>${overview}</section>` : ''}
    ${trigger ? `<section class="section"><h3>Trigger</h3>${trigger}</section>` : ''}
  `
}

/**
 * Renders the status transitions recorded throughout one correction run.
 *
 * @param {Object} audit Detailed audit document.
 * @returns {string} Lifecycle history section or an empty string.
 */
const renderStatusHistory = (audit) => {
  if (!Array.isArray(audit.statusHistory) || audit.statusHistory.length === 0) return ''

  const rows = audit.statusHistory.map((entry) => `
    <tr>
      <td>${displayValue(entry.status)}</td>
      <td>${displayDate(entry.timestamp)}</td>
      <td>${displayValue(entry.outcome, '')}</td>
      <td>${displayValue(entry.error, '')}</td>
    </tr>
  `).join('')

  return `
    <section class="section">
      <h3>Lifecycle history</h3>
      <table class="history-table">
        <thead><tr><th>Status</th><th>Timestamp</th><th>Outcome</th><th>Error</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `
}

/**
 * Renders validation diagnostics retained on a detailed audit document.
 *
 * @param {Object} audit Detailed audit document.
 * @returns {string} Escaped validation diagnostics or an empty string.
 */
const renderValidationFailures = (audit) => {
  if (!Array.isArray(audit.keywordValidationFailures)
    || audit.keywordValidationFailures.length === 0) return ''

  return `
    <section class="section">
      <h3>Keyword validation failures</h3>
      <pre class="diagnostic">${displayValue(JSON.stringify(audit.keywordValidationFailures, null, 2))}</pre>
    </section>
  `
}

/**
 * Renders a run id as a detail link in summary mode and plain text in detail mode.
 *
 * @param {Object} audit Audit summary document.
 * @param {boolean} detail Whether this is already the complete run view.
 * @returns {string} Linked or plain-text run id.
 */
const renderRunId = (audit, detail) => {
  const displayRunId = displayValue(audit.runId)

  if (detail || !audit.runId) return displayRunId

  const runId = encodeURIComponent(String(audit.runId))

  return `<a href="metadata_correction_audit/${runId}?format=html">${displayRunId}</a>`
}

/**
 * Renders one audit run with its status, path changes, and native metadata diff.
 *
 * @param {Object} audit Audit summary or detail document.
 * @param {Object} options Rendering options.
 * @param {boolean} options.detail Whether this is the complete run view.
 * @returns {string} HTML audit card.
 */
const renderAuditCard = (audit, { detail }) => {
  const status = String(audit.status || 'unknown').toLowerCase()
  const statusClass = status === 'failed' ? ' status-failed' : ''
  const updatedAt = audit.updatedAt || audit.createdAt
  const updatedText = updatedAt
    ? ` &middot; Updated ${displayValue(updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt)}`
    : ''
  const errorMessage = audit.errorMessage || audit.error?.message
  const errorSection = errorMessage
    ? `<div class="section"><p class="error">${displayValue(errorMessage)}</p></div>`
    : ''

  return `
    <article class="audit-card">
      <header class="audit-header">
        <div>
          <h2>${renderCollectionHeading(audit)}</h2>
          <p class="audit-meta">Run ${renderRunId(audit, detail)}${updatedText}</p>
        </div>
        <span class="status${statusClass}">${displayValue(status)}</span>
      </header>
      ${detail ? renderRunDetails(audit) : ''}
      ${errorSection}
      <section class="section">
        <h3>Keyword changes</h3>
        ${renderChangesTable(audit)}
      </section>
      ${detail ? renderValidationFailures(audit) : ''}
      ${detail ? renderStatusHistory(audit) : ''}
      ${detail || audit.metadataDiff ? `<section class="section">
        <h3>Native metadata diff</h3>
        ${renderNativeMetadataDiff(audit)}
      </section>` : ''}
    </article>
  `
}

/**
 * Builds a self-contained browser view of metadata-correction audit records.
 *
 * This HTML view is a temporary stopgap until MMT provides an audit interface backed by the JSON
 * API and its filters. Once that MMT interface is available, this renderer can likely be removed.
 *
 * @example
 * renderMetadataCorrectionAuditHtml({
 *   items: [{ runId: 'run-1', collectionConceptId: 'C123-PROV', status: 'applied' }]
 * })
 * // '<!doctype html>...'
 *
 * @param {Object} params Page data.
 * @param {string} [params.collectionConceptId] Current collection ID filter.
 * @param {boolean} [params.detail=false] Whether to render complete run information.
 * @param {Array<Object>} [params.items=[]] Audit records to render.
 * @param {string} [params.message] Optional empty-state or error message.
 * @param {string} [params.nextPageHref] Link to the next result page.
 * @param {string} [params.title='Metadata correction audit'] Browser page title.
 * @returns {string} Complete HTML document.
 */
export const renderMetadataCorrectionAuditHtml = ({
  collectionConceptId,
  detail = false,
  items = [],
  message,
  nextPageHref,
  title = 'Metadata correction audit'
} = {}) => {
  const cards = items.length > 0
    ? items.map((audit) => renderAuditCard(audit, { detail })).join('')
    : `<p class="empty">${displayValue(message, 'No matching audit records were found.')}</p>`
  const nextPageLink = nextPageHref
    ? `<a class="next-page" href="${displayValue(nextPageHref)}">Next page</a>`
    : ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'">
    <title>${displayValue(title)}</title>
    <style>${diff2HtmlStyles}\n${PAGE_STYLES}</style>
  </head>
  <body>
    <main>
      <h1>${displayValue(title)}</h1>
      <p class="lede">${items.length} audit ${items.length === 1 ? 'record' : 'records'} on this page</p>
      ${detail ? '' : renderCollectionFilter(collectionConceptId)}
      ${cards}
      ${nextPageLink}
    </main>
  </body>
</html>`
}

export default renderMetadataCorrectionAuditHtml
