// NodeManager.js

const AWS = require('aws-sdk')

const ecs = new AWS.ECS()

const servicediscovery = new AWS.ServiceDiscovery()
const TTL = 60000 * 1 // 1 minute TTL

const {
  addVerifiedNode,
  clearVerifiedNodes,
  getNodesCache,
  getVerifiedNodes,
  invalidateNodeCache,
  removeVerifiedNode,
  setNodesCache
} = require('./cacheManager')

const {
  getLastUpdateTime,
  isSlaveConsistent,
  resetSlaveCheckTime
} = require('./sharedFunctions')

const discoverNodes = async () => {
  const namespaceName = process.env.SERVICE_DISCOVERY_NAMESPACE
  const masterServiceName = process.env.MASTER_SERVICE_NAME

  const namespaces = await servicediscovery.listNamespaces().promise()
  const namespace = namespaces.Namespaces.find((ns) => ns.Name === namespaceName)
  if (!namespace) throw new Error(`Namespace ${namespaceName} not found`)

  const services = await servicediscovery.listServices({
    Filters: [{
      Name: 'NAMESPACE_ID',
      Values: [namespace.Id],
      Condition: 'EQ'
    }]
  }).promise()

  const masterService = services.Services.find((s) => s.Name === masterServiceName)
  const slaveServices = services.Services.filter((s) => s.Name !== masterServiceName)

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

const restartNode = async (nodeUrl) => {
  const clusterName = process.env.ECS_CLUSTER_NAME

  console.log(`Attempting to restart node: ${nodeUrl}`)

  try {
    // List all services in the cluster
    const listServicesParams = { cluster: clusterName }
    const services = await ecs.listServices(listServicesParams).promise()

    // Find the correct service ARN
    const isMaster = nodeUrl.includes('master')
    const serviceKeyword = isMaster ? 'MasterService' : 'SlaveService'
    const serviceArn = services.serviceArns.find((arn) => arn.includes(serviceKeyword))

    if (!serviceArn) {
      throw new Error(`Could not find ${isMaster ? 'master' : 'slave'} service ARN`)
    }

    // Extract the service name from the ARN
    const serviceName = serviceArn.split('/').pop()

    console.log(`Attempting to restart service: ${serviceName} in cluster: ${clusterName}`)

    const updateParams = {
      cluster: clusterName,
      service: serviceName,
      forceNewDeployment: true
    }
    const result = await ecs.updateService(updateParams).promise()

    // Remove the restarted node from the verified list
    await removeVerifiedNode(nodeUrl)

    // Invalidate the node cache
    await invalidateNodeCache()
  } catch (error) {
    console.error(`Failed to restart node ${nodeUrl}:`, error)
    throw error
  }
}

const getNodes = async () => {
  const nodesCache = await getNodesCache()
  const now = Date.now()

  let cache = {}

  if (now - nodesCache.lastUpdated > TTL) {
    console.log('Cache expired, rediscovering nodes')
    const discoveredNodes = await discoverNodes()
    cache = {
      masterNode: discoveredNodes.masterNode,
      slaveNodes: discoveredNodes.slaveNodes,
      lastUpdated: now
    }

    console.log('Discovered ', cache)
    await setNodesCache(cache)

    const masterTime = await getLastUpdateTime(cache.masterNode)
    const { slaveNodes } = cache
    await clearVerifiedNodes()
    await Promise.all(slaveNodes.map(async (node) => {
      if (await isSlaveConsistent(node, masterTime)) {
        console.log(node, ' is verified')
        await addVerifiedNode(node)
      } else {
        console.log(node, 'is not verified')
        await removeVerifiedNode(node)
        await restartNode(node)
      }
    }))
  } else {
    console.log('Using cached nodes', nodesCache)
    cache = nodesCache
  }

  const verifiedNodes = await getVerifiedNodes()
  const { slaveNodes } = cache
  cache.slaveNodes = slaveNodes.filter((node) => verifiedNodes.includes(node))

  return cache
}

module.exports = {
  discoverNodes,
  getNodes,
  restartNode
}
