const https = require('https')
const http = require('http')

// SPARQL query to get the last update time
const getLastUpdateTimeSparql = `
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX rdf4j: <http://rdf4j.cluster/ontology/>
SELECT ?time
WHERE {
  rdf4j:lastUpdateTime rdf4j:hasTime ?time .
}
`

// SPARQL update to set the last update time
const setLastUpdateTimeSparql = (time) => `
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX rdf4j: <http://rdf4j.cluster/ontology/>
DELETE {
  rdf4j:lastUpdateTime rdf4j:hasTime ?oldTime .
}
INSERT {
  rdf4j:lastUpdateTime rdf4j:hasTime "${time}"^^xsd:dateTime .
}
WHERE {
  OPTIONAL { rdf4j:lastUpdateTime rdf4j:hasTime ?oldTime . }
}
`

const processPayload = (payload, isBase64Encoded) => {
  if (!payload) return payload

  if (typeof payload === 'string') {
    if (isBase64Encoded) {
      try {
        const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8')
        console.log('Decoded Base64 payload')

        return decodedPayload
      } catch (error) {
        console.warn('Failed to decode payload as Base64, using raw payload')

        return payload
      }
    } else {
      return payload
    }
  } else if (Buffer.isBuffer(payload)) {
    return payload.toString('utf-8')
  } else {
    return JSON.stringify(payload)
  }
}

const makeRequest = ({
  node,
  payload,
  method,
  headers,
  path = '',
  queryParams = {},
  isBase64Encoded = false
}) => new Promise((resolve, reject) => {
  const parsedUrl = new URL(node)
  const protocol = parsedUrl.protocol === 'https:' ? https : http

  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  const fullPath = `${parsedUrl.pathname.replace(/\/$/, '')}/${cleanPath}`.replace(/\/+/g, '/')

  const searchParams = new URLSearchParams(parsedUrl.searchParams)
  Object.entries(queryParams).forEach(([key, value]) => {
    searchParams.append(key, value)
  })

  const auth = Buffer.from(`${process.env.RDF4J_USER_NAME}:${process.env.RDF4J_PASSWORD}`).toString('base64')

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: `${fullPath}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
    method,
    headers: {
      ...headers,
      Authorization: `Basic ${auth}`
    }
  }

  const processedPayload = processPayload(payload, isBase64Encoded)

  const req = protocol.request(options, (res) => {
    let data = ''
    res.on('data', (chunk) => {
      data += chunk
    })

    res.on('end', () => resolve({
      statusCode: res.statusCode,
      body: data,
      headers: res.headers
    }))
  })
  req.on('error', (error) => reject(error))
  if (processedPayload) req.write(processedPayload)
  req.end()
})

const getLastUpdateTime = async (node) => {
  try {
    const response = await makeRequest({
      node,
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        Accept: 'application/sparql-results+json'
      },
      path: `/rdf4j-server/repositories/${process.env.RDF4J_REPOSITORY_ID}`,
      payload: getLastUpdateTimeSparql
    })

    if (response.statusCode >= 200 && response.statusCode < 300) {
      try {
        const result = JSON.parse(response.body)

        return result.results.bindings[0]?.time?.value || null
      } catch (parseError) {
        console.error(`Error parsing JSON from ${node}:`, parseError)
        console.log('Response body:', response.body)

        return null
      }
    } else {
      console.error(`Unexpected status code from ${node}:`, response.statusCode)
      console.log('Response body:', response.body)

      return null
    }
  } catch (error) {
    console.error(`Error getting last update time for node ${node}:`, error)

    return null
  }
}

const setLastUpdateTime = async (node, time) => {
  try {
    await makeRequest({
      node,
      method: 'POST',
      headers: { 'Content-Type': 'application/sparql-update' },
      path: `/rdf4j-server/repositories/${process.env.RDF4J_REPOSITORY_ID}/statements`,
      payload: setLastUpdateTimeSparql(time)
    })

    console.log(`Updated node ${node}`)
  } catch (error) {
    console.error(`Error updating last update time for node ${node}:`, error)
    throw error
  }
}

let lastSlaveCheckTimes = {}

// Add this function to reset the last check time when nodes are invalidated
const resetSlaveCheckTimes = () => {
  lastSlaveCheckTimes = {}
}

const isSlaveConsistent = async (node, masterTime) => {
  const now = Date.now()

  // If less than a minute has passed since the last check for this specific node, return true
  if (lastSlaveCheckTimes[node] && now - lastSlaveCheckTimes[node] < 60000) {
    lastSlaveCheckTimes[node] = now

    return true
  }

  // Update the last check time for this node
  lastSlaveCheckTimes[node] = now
  const nodeTime = await getLastUpdateTime(node)

  if (masterTime === null) {
    console.warn(`Unable to get last update time for master node ${masterTime}`)

    return false
  }

  if (nodeTime === null) {
    console.warn(`Unable to get last update time for node ${node}`)

    return false
  }

  if (masterTime === nodeTime) {
    return true
  }

  return false
}

module.exports = {
  makeRequest,
  isSlaveConsistent,
  getLastUpdateTime,
  setLastUpdateTime,
  resetSlaveCheckTimes
}
