// RequestManager.js

const {
  invalidateNodeCache
} = require('./cacheManager')
const {
  makeRequest,
  setLastUpdateTime,
  isSlaveConsistent,
  getLastUpdateTime
} = require('./sharedFunctions')
const { restartNode } = require('./nodeManager')

// Separate function to handle slave replication
const replicateToSlaves = async ({
  slaveNodes,
  event,
  path,
  queryParams,
  masterTime,
  currentTime
}) => {
  console.log('Starting replication to slaves:', slaveNodes)

  const results = await Promise.all(slaveNodes.map(async (node) => {
    try {
      if (!await isSlaveConsistent(node, masterTime)) {
        await restartNode(node)
        console.log(`Restarted inconsistent slave node ${node}`)

        return {
          success: false,
          restarted: true
        }
      }

      const slaveResponse = await makeRequest({
        node,
        payload: event.body,
        method: event.httpMethod,
        headers: event.headers,
        path,
        queryParams,
        isBase64Encoded: event.isBase64Encoded
      })

      if (slaveResponse.statusCode >= 200 && slaveResponse.statusCode < 300) {
        await setLastUpdateTime(node, currentTime)
        console.log(`Successful replication to slave node: ${node}`)

        return {
          success: true,
          restarted: false
        }
      }

      console.log(`Failed replication to slave node: ${node}, status code: ${slaveResponse.statusCode}`)

      return {
        success: false,
        restarted: false
      }
    } catch (error) {
      console.error(`Error replicating to slave node ${node}:`, error)
      try {
        await restartNode(node)
        console.log(`Restarted slave node ${node} after replication failure`)

        return {
          success: false,
          restarted: true
        }
      } catch (restartError) {
        console.error(`Failed to restart slave node ${node}:`, restartError)

        return {
          success: false,
          restarted: false
        }
      }
    }
  }))

  const successCount = results.filter((r) => r.success).length
  const restartCount = results.filter((r) => r.restarted).length
  const failCount = results.length - successCount

  if (failCount > 0 || restartCount > 0) {
    console.log('Invalidating node cache due to failures or restarts')
    await invalidateNodeCache()
  }

  console.log(`Replication complete. Successful: ${successCount}, Failed: ${failCount}, Restarted: ${restartCount}`)

  return {
    successCount,
    failCount,
    restartCount
  }
}

const handleWriteOperation = async ({
  masterNode, slaveNodes, event, path, queryParams
}) => {
  try {
    const masterTime = await getLastUpdateTime(masterNode)
    const masterResponse = await makeRequest({
      node: masterNode,
      payload: event.body,
      method: event.httpMethod,
      headers: event.headers,
      path,
      queryParams,
      isBase64Encoded: event.isBase64Encoded
    })

    if (masterResponse.statusCode < 200 || masterResponse.statusCode >= 300) {
      throw new Error(`Master write failed with status code ${masterResponse.statusCode}`)
    }

    console.log(`Successful replication to master node: ${masterNode}`)

    const currentTime = new Date().toISOString()
    await setLastUpdateTime(masterNode, currentTime)

    // Await slave replication
    // Call replicateToSlaves with a dictionary
    const replicationResult = await replicateToSlaves({
      slaveNodes,
      event,
      path,
      queryParams,
      masterTime,
      currentTime
    }).catch(async (error) => {
      console.error('Error in slave replication:', error)

      return {
        successCount: 0,
        failCount: slaveNodes.length,
        restartCount: 0
      }
    })
    // Determine replication status
    let replicationStatus
    if (replicationResult.successCount === slaveNodes.length) {
      replicationStatus = 'complete'
    } else if (replicationResult.successCount > 0) {
      replicationStatus = 'partial'
    } else {
      replicationStatus = 'failed'
    }

    // Add replication information to response headers
    const updatedHeaders = {
      ...masterResponse.headers,
      'X-Replication-Status': replicationStatus,
      'X-Replication-Success-Count': replicationResult.successCount.toString(),
      'X-Replication-Fail-Count': replicationResult.failCount.toString(),
      'X-Replication-Restart-Count': replicationResult.restartCount.toString()
    }

    // Return master response with updated headers
    return {
      ...masterResponse,
      headers: updatedHeaders
    }
  } catch (error) {
    console.error('Error in write operation:', error)
    await invalidateNodeCache()
    throw error
  }
}

const handleReadOperation = async ({
  nodes, event, path, queryParams
}) => {
  const masterNode = nodes[0]
  const shuffledNodes = [masterNode, ...nodes.slice(1)].sort(() => Math.random() - 0.5)

  return shuffledNodes.reduce(async (previousPromise, node) => {
    try {
      // Wait for the previous promise to resolve
      const prevResult = await previousPromise

      // If we've already got a successful response, just return it
      if (prevResult) return prevResult

      const response = await makeRequest({
        node,
        payload: event.body,
        method: event.httpMethod,
        headers: event.headers,
        path,
        queryParams,
        isBase64Encoded: event.isBase64Encoded
      })

      console.log('Read request successful, using ', node)

      // Return the successful response
      return response
    } catch (error) {
      console.error(`Error reading from node ${node}:`, error)

      if (node !== masterNode) {
        try {
          await restartNode(node)
          console.log(`Restarted slave node ${node} after read failure`)
        } catch (restartError) {
          console.error(`Failed to restart slave node ${node}:`, restartError)
        }
      }

      await invalidateNodeCache()

      return null // Continue to the next node
    }
  }, Promise.resolve(null))
    .then((result) => {
      if (result) return result
      throw new Error('All nodes failed to respond to read request')
    })
}

const checkMasterHealth = async (masterNode) => {
  try {
    const response = await makeRequest({
      node: masterNode,
      method: 'GET',
      headers: {},
      path: '/rdf4j-server/protocol'
    })

    return response.statusCode >= 200 && response.statusCode < 300
  } catch (error) {
    console.error('Health check failed:', error)

    return false
  }
}

module.exports = {
  makeRequest,
  handleWriteOperation,
  handleReadOperation,
  checkMasterHealth
}
