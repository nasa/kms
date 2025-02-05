/* eslint-disable no-return-assign */
const https = require('https')
const http = require('http')
const AWS = require('aws-sdk')

const servicediscovery = new AWS.ServiceDiscovery()

const ecs = new AWS.ECS()

// Cache object in the global scope
let nodesCache = {
  masterNode: null,
  slaveNodes: [],
  lastUpdated: 0
}

const CACHE_TTL = 1 * 60 * 1000 // 1 minutes in milliseconds

/**
 * The function provides a way to dynamically discover the network
 * locations of all RDF4J nodes (master and slaves) that are registered with
 * AWS Service Discovery. This is useful in a cloud environment where the
 * IP addresses of services may change dynamically, allowing the Lambda function
 * to always have up-to-date information on how to reach each node in the RDF4J
 * cluster.
 * */
const discoverNodes = async () => {
  const namespaceName = process.env.SERVICE_DISCOVERY_NAMESPACE
  const masterServiceName = process.env.MASTER_SERVICE_NAME

  // Discover the namespace ID
  const namespaces = await servicediscovery.listNamespaces().promise()
  const namespace = namespaces.Namespaces.find((ns) => ns.Name === namespaceName)
  if (!namespace) throw new Error(`Namespace ${namespaceName} not found`)

  // Discover all services in the namespace
  const services = await servicediscovery.listServices({
    Filters: [{
      Name: 'NAMESPACE_ID',
      Values: [namespace.Id],
      Condition: 'EQ'
    }]
  }).promise()

  // Separate master and slave services
  const masterService = services.Services.find((s) => s.Name === masterServiceName)
  const slaveServices = services.Services.filter((s) => s.Name !== masterServiceName)

  // Discover instances for each service
  const discoverInstances = async (service) => {
    const instances = await servicediscovery.discoverInstances({
      NamespaceName: namespaceName,
      ServiceName: service.Name
    }).promise()

    return instances.Instances.map((instance) => `http://${instance.Attributes.AWS_INSTANCE_IPV4}:8080`)
  }

  const masterNodes = await discoverInstances(masterService)
  const slaveNodes = await Promise.all(slaveServices.map(discoverInstances))

  return {
    masterNode: masterNodes[0],
    slaveNodes: slaveNodes.flat()
  }
}

/**
 *
 * This getNodes function implements a caching mechanism for the node discovery process.
 */
const getNodes = async () => {
  const now = Date.now()
  if (now - nodesCache.lastUpdated > CACHE_TTL) {
    console.log('Cache expired, rediscovering nodes')
    const discoveredNodes = await discoverNodes()
    nodesCache = {
      ...discoveredNodes,
      lastUpdated: now
    }
  } else {
    console.log('Using cached nodes')
  }

  return nodesCache
}

/**
 * This makeRequest function is a utility for making HTTP/HTTPS requests to the RDF4J nodes.
 */
const makeRequest = ({
  node,
  payload,
  method,
  headers,
  path = '',
  queryParams = {}
}) => new Promise((resolve, reject) => {
  const parsedUrl = new URL(node)
  const protocol = parsedUrl.protocol === 'https:' ? https : http

  // Combine the base path with the additional path
  const fullPath = `${parsedUrl.pathname}${path}`

  // Combine existing query parameters with new ones
  const searchParams = new URLSearchParams(parsedUrl.searchParams)
  Object.entries(queryParams).forEach(([key, value]) => {
    searchParams.append(key, value)
  })

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: `${fullPath}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
    method,
    headers
  }

  const req = protocol.request(options, (res) => {
    let data = ''
    res.on('data', (chunk) => data += chunk)
    res.on('end', () => resolve({
      statusCode: res.statusCode,
      body: data,
      headers: res.headers
    }))
  })

  req.on('error', (error) => reject(error))
  if (payload) req.write(payload)
  req.end()
})

/**
 * This function is used when a node is detected to be unhealthy or unresponsive. By
 * forcing a new deployment, it attempts to resolve issues by replacing the potentially
 * problematic task with a fresh one.
 */
const restartNode = async (nodeUrl) => {
  const clusterName = process.env.ECS_CLUSTER_NAME
  const serviceNamePrefix = process.env.ECS_SERVICE_NAME_PREFIX

  // Extract the node identifier from the URL
  const nodeIdentifier = nodeUrl.split('.')[0]

  // Construct the full service name
  const serviceName = nodeIdentifier === 'master'
    ? `${serviceNamePrefix}MasterService`
    : `${serviceNamePrefix}SlaveService`

  try {
    // Force a new deployment of the service
    await ecs.updateService({
      cluster: clusterName,
      service: serviceName,
      forceNewDeployment: true
    }).promise()

    console.log(`Triggered redeployment for node: ${nodeUrl}`)
  } catch (error) {
    console.error(`Failed to restart node ${nodeUrl}:`, error)
  }
}

/**
 * The restartAllNodes function is a simple utility that aims to restart all nodes in
 * the RDF4J cluster.
 */
const restartAllNodes = async (nodes) => {
  nodes.forEach(async (node) => {
    await restartNode(node)
  })
}

/**
 *
 * This operation ensures data consistency by writing to the master first and then
 * replicating to slaves. It also includes error handling and node restart mechanisms
 * to recover from failures. The function returns as soon as the master write is
 * complete, not waiting for slave replications to finish, which helps in maintaining
 * lower latency for write operations.} masterNode
 */

const handleWriteOperation = async ({
  masterNode, slaveNodes, event, path, queryParams
}) => {
  let response
  try {
    response = await makeRequest({
      node: masterNode,
      payload: event.body,
      method: event.httpMethod,
      headers: event.headers,
      path,
      queryParams
    })
  } catch (error) {
    console.error(`Error writing to master node ${masterNode}:`, error)
    await restartAllNodes([masterNode, ...slaveNodes])
    throw error
  }

  if (response.statusCode >= 200 && response.statusCode < 300) {
    // Use setImmediate to ensure this runs after the response is sent
    setImmediate(() => {
      Promise.all(slaveNodes.map(async (node) => {
        try {
          await makeRequest({
            node,
            payload: event.body,
            method: event.httpMethod,
            headers: event.headers,
            path,
            queryParams
          })
        } catch (error) {
          console.error(`Error replicating to slave node ${node}:`, error)
          await restartNode(node)
        }
      })).catch((error) => {
        console.error('Error during slave replication:', error)
      })
    })
  }

  return response
}

/** This operation aims to provide fast read responses by leveraging all available nodes,
 * while also implementing basic error recovery by restarting nodes that fail to respond.
 * */
const handleReadOperation = async ({
  nodes, event, path, queryParams
}) => {
  const readPromises = nodes.map((node) => makeRequest({
    node,
    payload: event.body,
    method: event.httpMethod,
    headers: event.headers,
    path,
    queryParams
  })
    .catch(async (error) => {
      console.error(`Error reading from node ${node}:`, error)
      if (node.includes('master')) {
        await restartAllNodes(nodes)
      } else {
        await restartNode(node)
      }

      return Promise.reject(error)
    }))

  try {
    return await Promise.any(readPromises)
  } catch (aggregateError) {
    console.error('All read attempts failed:', aggregateError.errors)
    throw new Error('All nodes failed to respond')
  }
}

/**
 * This Lambda function essentially acts as an intelligent router and load balancer
 * for the RDF4J cluster, handling node discovery, request distribution, write
 * replication, and basic error recovery. It aims to provide high availability
 * and consistency for the RDF4J service in a dynamic cloud environment.
 */
exports.handler = async (event) => {
  const { masterNode, slaveNodes } = await getNodes()
  const nodes = [masterNode, ...slaveNodes]

  const isWriteOperation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(event.httpMethod)

  const path = event.path || ''
  const queryParams = event.queryStringParameters || {}

  try {
    let response

    if (isWriteOperation) {
      response = await handleWriteOperation({
        masterNode,
        slaveNodes,
        event,
        path,
        queryParams
      })
    } else {
      response = await handleReadOperation({
        nodes,
        event,
        path,
        queryParams
      })
    }

    return {
      statusCode: response.statusCode,
      body: response.body,
      headers: response.headers
    }
  } catch (error) {
    console.error('Error:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' })
    }
  }
}
