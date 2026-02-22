#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs')
const http = require('node:http')
const https = require('node:https')
const path = require('node:path')

const dataDir = path.resolve(__dirname, '../../locust/data')

const readLines = (fileName) => {
  const filePath = path.join(dataDir, fileName)
  if (!fs.existsSync(filePath)) return []

  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const encodePattern = (value) => encodeURIComponent(value).replaceAll('%2F', '%252F')

const normalizeBasePath = (value) => {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  if (trimmed === '/') return ''
  const withPrefix = trimmed.startsWith('/') ? trimmed : `/${trimmed}`

  return withPrefix.endsWith('/') ? withPrefix.slice(0, -1) : withPrefix
}

const parseArgs = () => {
  const defaults = {
    baseUrl: 'http://localhost:3013',
    basePath: '/kms',
    durationSeconds: 0,
    maxRequests: 0,
    timeoutSeconds: 30,
    sleepMs: 0,
    seed: 42,
    statusEvery: 200,
    stopOnException: false,
    insecure: false
  }

  const args = { ...defaults }
  const raw = process.argv.slice(2)
  for (let i = 0; i < raw.length; i += 1) {
    const token = raw[i]
    const next = raw[i + 1]
    if (token === '--base-url' && next) {
      args.baseUrl = next
      i += 1
    } else if (token === '--base-path' && next) {
      args.basePath = next
      i += 1
    } else if (token === '--duration-seconds' && next) {
      args.durationSeconds = Number(next)
      i += 1
    } else if (token === '--max-requests' && next) {
      args.maxRequests = Number(next)
      i += 1
    } else if (token === '--timeout-seconds' && next) {
      args.timeoutSeconds = Number(next)
      i += 1
    } else if (token === '--sleep-ms' && next) {
      args.sleepMs = Number(next)
      i += 1
    } else if (token === '--seed' && next) {
      args.seed = Number(next)
      i += 1
    } else if (token === '--status-every' && next) {
      args.statusEvery = Number(next)
      i += 1
    } else if (token === '--stop-on-exception') {
      args.stopOnException = true
    } else if (token === '--insecure') {
      args.insecure = true
    }
  }

  return args
}

const createPrng = (seed) => {
  let state = Number(seed)
  if (!Number.isFinite(state)) state = 1
  state = Math.floor(state) % 2147483647
  if (state <= 0) state += 2147483646

  return () => {
    state = (state * 16807) % 2147483647

    return (state - 1) / 2147483646
  }
}

const pick = (items, rnd) => items[Math.floor(rnd() * items.length)]

const createEndpoints = ({
  uuids, prefLabels, schemes, rnd
}) => {
  const endpoints = []

  if (uuids.length > 0) {
    endpoints.push({
      name: '/concept/{conceptId}',
      buildPath: () => `/concept/${pick(uuids, rnd)}`
    })

    endpoints.push({
      name: '/concept_fullpaths/concept_uuid/{conceptId}',
      buildPath: () => `/concept_fullpaths/concept_uuid/${pick(uuids, rnd)}`
    })
  }

  endpoints.push({
    name: '/concepts',
    buildPath: () => '/concepts'
  })

  if (prefLabels.length > 0) {
    endpoints.push({
      name: '/concepts/pattern/{pattern}',
      buildPath: () => `/concepts/pattern/${encodePattern(pick(prefLabels, rnd))}`
    })
  }

  if (schemes.length > 0) {
    endpoints.push({
      name: '/concepts/concept_scheme/{conceptScheme}',
      buildPath: () => `/concepts/concept_scheme/${encodeURIComponent(pick(schemes, rnd))}`
    })

    endpoints.push({
      name: '/concepts/concept_scheme/{conceptScheme}?format=csv',
      buildPath: () => `/concepts/concept_scheme/${encodeURIComponent(pick(schemes, rnd))}?format=csv`
    })
  }

  endpoints.push({
    name: '/tree/concept_scheme/all',
    buildPath: () => '/tree/concept_scheme/all'
  })

  return endpoints
}

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

const sendRequest = async ({
  protocol,
  hostname,
  port,
  pathSuffix,
  timeoutMs,
  insecure
}) => {
  const client = protocol === 'https:' ? https : http
  const options = {
    protocol,
    hostname,
    port,
    method: 'GET',
    path: pathSuffix,
    timeout: timeoutMs
  }
  if (protocol === 'https:' && insecure) {
    options.rejectUnauthorized = false
  }

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let bytes = 0
      res.on('data', (chunk) => {
        bytes += chunk.length
      })

      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          bytes
        })
      })
    })
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'))
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.end()
  })
}

const main = async () => {
  const args = parseArgs()
  const parsed = new URL(args.baseUrl)
  const rnd = createPrng(args.seed)

  const uuids = readLines('uuids.txt')
  const prefLabels = readLines('prefLabels.txt')
  const schemes = readLines('schemes.txt')

  const endpoints = createEndpoints({
    uuids,
    prefLabels,
    schemes,
    rnd
  })

  if (endpoints.length === 0) {
    console.error('No endpoints to run. Check locust/data files.')
    process.exit(1)
  }

  const basePath = normalizeBasePath(args.basePath)
  const timeoutMs = Math.max(1, Math.floor(args.timeoutSeconds * 1000))

  const perEndpointCounts = Object.fromEntries(endpoints.map((endpoint) => [endpoint.name, 0]))
  const errorStatusCounts = {}
  let totalRequests = 0
  let totalBytes = 0
  let exceptionCount = 0
  const start = Date.now()

  console.log('Starting sequential endpoint hammer')
  console.log(`baseUrl=${args.baseUrl} basePath=${basePath || '/'} timeoutSeconds=${args.timeoutSeconds}`)
  console.log(`durationSeconds=${args.durationSeconds} maxRequests=${args.maxRequests}`)
  console.log(`endpoints=${endpoints.length}`)

  const shouldContinue = () => {
    const elapsedMs = Date.now() - start

    if (args.durationSeconds > 0 && elapsedMs >= (args.durationSeconds * 1000)) return false
    if (args.maxRequests > 0 && totalRequests >= args.maxRequests) return false

    return true
  }

  while (shouldContinue()) {
    const endpoint = pick(endpoints, rnd)
    const requestPath = `${basePath}${endpoint.buildPath()}`

    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await sendRequest({
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        pathSuffix: requestPath,
        timeoutMs,
        insecure: args.insecure
      })
      totalRequests += 1
      totalBytes += result.bytes
      perEndpointCounts[endpoint.name] += 1
      if (result.status >= 400) {
        errorStatusCounts[result.status] = (errorStatusCounts[result.status] || 0) + 1
      }
    } catch (error) {
      exceptionCount += 1
      if (args.stopOnException) {
        console.error(`Request exception on ${requestPath}: ${error.message || error}`)
        break
      }
    }

    if (args.statusEvery > 0 && totalRequests > 0 && totalRequests % args.statusEvery === 0) {
      const elapsedSeconds = Math.max((Date.now() - start) / 1000, 0.001)
      const rps = totalRequests / elapsedSeconds
      const statusSummary = Object.keys(errorStatusCounts).length
        ? Object.entries(errorStatusCounts).map(([code, count]) => `${code}:${count}`).join(', ')
        : 'none'
      console.log(`progress requests=${totalRequests} rps=${rps.toFixed(2)} exceptions=${exceptionCount} httpErrors=${statusSummary}`)
    }

    if (args.sleepMs > 0) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(args.sleepMs)
    }
  }

  const elapsedSeconds = Math.max((Date.now() - start) / 1000, 0.001)
  const rps = totalRequests / elapsedSeconds
  console.log('\nDone')
  console.log(`requests=${totalRequests} elapsedSeconds=${elapsedSeconds.toFixed(2)} rps=${rps.toFixed(2)} bytes=${totalBytes} exceptions=${exceptionCount}`)
  if (Object.keys(errorStatusCounts).length > 0) {
    console.log('httpErrorCounts:')
    Object.entries(errorStatusCounts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([code, count]) => {
        console.log(`  ${code}: ${count}`)
      })
  }

  console.log('endpointCounts:')
  Object.entries(perEndpointCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name, count]) => {
      console.log(`  ${name}: ${count}`)
    })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
