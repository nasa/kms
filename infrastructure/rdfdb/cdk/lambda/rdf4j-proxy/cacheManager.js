// CacheManager.js

const AWS = require('aws-sdk')
const { resetSlaveCheckTime } = require('./sharedFunctions')

const dynamodb = new AWS.DynamoDB.DocumentClient()
const { NODES_CACHE_TABLE } = process.env
const { VERIFIED_NODES_TABLE } = process.env

let localNodesCache = null
let localVerifiedNodesCache = null

const getNodesCache = async () => {
  if (localNodesCache !== null) {
    return localNodesCache
  }

  const params = {
    TableName: NODES_CACHE_TABLE,
    Key: { id: 'nodesCache' }
  }

  try {
    const result = await dynamodb.get(params).promise()
    localNodesCache = result.Item || {
      masterNode: null,
      slaveNodes: [],
      lastUpdated: 0
    }

    return localNodesCache
  } catch (error) {
    console.error('Error fetching nodes cache from DynamoDB:', error)

    return {
      masterNode: null,
      slaveNodes: [],
      lastUpdated: 0
    }
  }
}

const setNodesCache = async (nodesCache) => {
  const params = {
    TableName: NODES_CACHE_TABLE,
    Item: {
      id: 'nodesCache',
      ...nodesCache,
      lastUpdated: Date.now()
    }
  }

  try {
    localNodesCache = nodesCache // Update local cache
    await dynamodb.put(params).promise()
  } catch (error) {
    console.error('Error setting nodes cache in DynamoDB:', error)
  }
}

const getVerifiedNodes = async () => {
  if (localVerifiedNodesCache !== null) {
    return localVerifiedNodesCache
  }

  const params = {
    TableName: VERIFIED_NODES_TABLE,
    Key: { id: 'verifiedNodes' }
  }

  try {
    const result = await dynamodb.get(params).promise()
    localVerifiedNodesCache = result.Item?.nodes || []

    return localVerifiedNodesCache
  } catch (error) {
    console.error('Error fetching verified nodes from DynamoDB:', error)

    return []
  }
}

const addVerifiedNode = async (node) => {
  const currentNodes = await getVerifiedNodes()
  if (!currentNodes.includes(node)) {
    const updatedNodes = [...currentNodes, node]
    const params = {
      TableName: VERIFIED_NODES_TABLE,
      Item: {
        id: 'verifiedNodes',
        nodes: updatedNodes
      }
    }

    try {
      localVerifiedNodesCache = updatedNodes // Update local cache
      await dynamodb.put(params).promise()
    } catch (error) {
      console.error('Error adding verified node to DynamoDB:', error)
    }
  }
}

const removeVerifiedNode = async (node) => {
  console.log('Removing node ', node)
  const currentNodes = await getVerifiedNodes()
  const updatedNodes = currentNodes.filter((n) => n !== node)

  const params = {
    TableName: VERIFIED_NODES_TABLE,
    Item: {
      id: 'verifiedNodes',
      nodes: updatedNodes
    }
  }

  try {
    localVerifiedNodesCache = updatedNodes // Update local cache
    await dynamodb.put(params).promise()
  } catch (error) {
    console.error('Error removing verified node from DynamoDB:', error)
  }
}

const clearVerifiedNodes = async () => {
  const params = {
    TableName: VERIFIED_NODES_TABLE,
    Item: {
      id: 'verifiedNodes',
      nodes: []
    }
  }

  try {
    localVerifiedNodesCache = [] // Update local cache
    await dynamodb.put(params).promise()
  } catch (error) {
    console.error('Error clearing verified nodes from DynamoDB:', error)
  }
}

const invalidateNodeCache = async () => {
  await clearVerifiedNodes()

  // Get the current cache
  const currentCache = await getNodesCache()

  // Update the cache, keeping the master node but clearing slave nodes
  await setNodesCache({
    masterNode: currentCache.masterNode,
    slaveNodes: [],
    lastUpdated: currentCache.lastUpdated // Update the lastUpdated timestamp
  })

  // Update local cache
  if (localNodesCache) {
    localNodesCache.slaveNodes = []
    localNodesCache.lastUpdated = Date.now()
  }

  // Reset the slave check time
  resetSlaveCheckTime()
}

module.exports = {
  getNodesCache,
  setNodesCache,
  getVerifiedNodes,
  addVerifiedNode,
  removeVerifiedNode,
  clearVerifiedNodes,
  invalidateNodeCache
}
