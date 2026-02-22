#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs')
const http = require('node:http')
const https = require('node:https')
const path = require('node:path')

const dataDir = path.resolve(__dirname, '../../loadtest/locust/data')

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
    baseUrl: process.env.BASE_URL || 'http://localhost:3013',
    basePath: '/kms',
    durationSeconds: 0,
    maxRequests: 500,
    concurrentRequests: 100,
    timeoutSeconds: 30,
    sleepMs: 0,
    statusEvery: 200,
    stopOnException: false,
    insecure: false,
    printUrls: true
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
    } else if (token === '--concurrent-requests' && next) {
      args.concurrentRequests = Number(next)
      i += 1
    } else if (token === '--timeout-seconds' && next) {
      args.timeoutSeconds = Number(next)
      i += 1
    } else if (token === '--sleep-ms' && next) {
      args.sleepMs = Number(next)
      i += 1
    } else if (token === '--status-every' && next) {
      args.statusEvery = Number(next)
      i += 1
    } else if (token === '--stop-on-exception') {
      args.stopOnException = true
    } else if (token === '--insecure') {
      args.insecure = true
    } else if (token === '--print-urls') {
      args.printUrls = true
    }
  }

  return args
}

const createUniqueRequestPaths = ({ prefLabels, schemes }) => {
  const paths = new Set()
  paths.add('/concepts?format=json')

  prefLabels.forEach((pattern) => {
    paths.add(`/concepts/pattern/${encodePattern(pattern)}?format=json`)
  })

  schemes.forEach((scheme) => {
    const encodedScheme = encodeURIComponent(scheme)
    paths.add(`/concepts/concept_scheme/${encodedScheme}?format=json`)
  })

  return Array.from(paths).sort((a, b) => a.localeCompare(b))
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

  const prefLabels = readLines('prefLabels.txt')
  const schemes = readLines('schemes.txt')

  const requestPaths = createUniqueRequestPaths({
    prefLabels,
    schemes
  })

  if (requestPaths.length === 0) {
    console.error('No endpoints to run. Check loadtest/locust/data files.')
    process.exit(1)
  }

  const basePath = normalizeBasePath(args.basePath)
  const timeoutMs = Math.max(1, Math.floor(args.timeoutSeconds * 1000))

  const perUrlCounts = Object.fromEntries(requestPaths.map((requestPath) => [requestPath, 0]))
  const errorStatusCounts = {}
  let totalRequests = 0
  let totalBytes = 0
  let exceptionCount = 0
  const start = Date.now()
  let nextPathIndex = 0
  const workerCount = Math.max(1, Math.floor(args.concurrentRequests) || 1)

  console.log('Starting concurrent endpoint hammer')
  console.log(`baseUrl=${args.baseUrl} basePath=${basePath || '/'} timeoutSeconds=${args.timeoutSeconds}`)
  console.log(`durationSeconds=${args.durationSeconds} maxRequests=${args.maxRequests} concurrentRequests=${workerCount}`)
  console.log(`uniqueUrls=${requestPaths.length}`)

  if (args.printUrls) {
    console.log('Unique URL set:')
    requestPaths.forEach((requestPath) => {
      console.log(`  ${new URL(`${basePath}${requestPath}`, args.baseUrl).toString()}`)
    })
  }

  const shouldContinue = () => {
    const elapsedMs = Date.now() - start

    if (args.durationSeconds > 0 && elapsedMs >= (args.durationSeconds * 1000)) return false
    if (args.maxRequests > 0 && totalRequests >= args.maxRequests) return false

    return true
  }

  const getNextRequestPath = () => {
    if (!shouldContinue()) return null

    const requestPath = requestPaths[nextPathIndex]
    nextPathIndex = (nextPathIndex + 1) % requestPaths.length

    return requestPath
  }

  const callUntilSuccess = async (requestPath) => {
    const fullPath = `${basePath}${requestPath}`
    const fullUrl = new URL(fullPath, args.baseUrl).toString()
    try {
      const result = await sendRequest({
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        pathSuffix: fullPath,
        timeoutMs,
        insecure: args.insecure
      })

      totalRequests += 1
      totalBytes += result.bytes
      perUrlCounts[requestPath] += 1
      const isSuccessful = result.status < 400
      if (isSuccessful) {
        if (args.printUrls) {
          console.log(`Calling: ${fullUrl} - Result: Success (Status: ${result.status})`)
        }

        return
      }

      errorStatusCounts[result.status] = (errorStatusCounts[result.status] || 0) + 1
      if (result.status === 404) {
        if (args.printUrls) {
          console.log(`Calling: ${fullUrl} - Result: Skip (Status: 404)`)
        }

        return
      }

      if (args.printUrls) {
        console.log(`Calling: ${fullUrl} - Result: Failure (Status: ${result.status}) - Retrying immediately`)
      }

      await callUntilSuccess(requestPath)
    } catch (error) {
      exceptionCount += 1
      if (args.printUrls) {
        console.log(`Calling: ${fullUrl} - Result: Failure (Exception: ${error.message || error}) - Retrying immediately`)
      }

      if (args.stopOnException) {
        throw error
      }

      await callUntilSuccess(requestPath)
    }
  }

  const runWorker = async () => {
    const requestPath = getNextRequestPath()
    if (!requestPath) {
      return
    }

    await callUntilSuccess(requestPath)
    if (args.statusEvery > 0 && totalRequests > 0 && totalRequests % args.statusEvery === 0) {
      const elapsedSeconds = Math.max((Date.now() - start) / 1000, 0.001)
      const rps = totalRequests / elapsedSeconds
      const statusSummary = Object.keys(errorStatusCounts).length
        ? Object.entries(errorStatusCounts).map(([code, count]) => `${code}:${count}`).join(', ')
        : 'none'
      console.log(`progress requests=${totalRequests} rps=${rps.toFixed(2)} exceptions=${exceptionCount} httpErrors=${statusSummary}`)
    }

    if (args.sleepMs > 0) {
      await sleep(args.sleepMs)
    }

    await runWorker()
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))

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

  console.log('urlCounts:')
  Object.entries(perUrlCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([requestPath, count]) => {
      console.log(`  ${requestPath}: ${count}`)
    })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
