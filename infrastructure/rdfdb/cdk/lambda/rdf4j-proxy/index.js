const { getNodes } = require('./nodeManager')
const { handleWriteOperation, handleReadOperation, checkMasterHealth } = require('./requestManager')

/**
 * RDF4J Cluster Proxy
 *
 * This Lambda function serves as an intelligent proxy for an RDF4J cluster, implementing
 * a master-slave architecture with the following key features:
 *
 * Architecture Overview:
 * - One writer node (master) and multiple reader nodes (slaves).
 * - The master node has an EFS (Elastic File System) volume for persistent storage.
 * - The slave nodes initially mirror the master's data using the mdp_copy tool during startup.
 *
 * Write Operations:
 * - All write operations are directed to the master node first.
 * - After a successful write to the master, the changes are distributed to all slave nodes.
 *
 * Read Operations:
 * - Read requests are distributed across all nodes (master and slaves) for load balancing.
 *
 * Consistency Management:
 * - A list of verified nodes is maintained to ensure data consistency.
 * - Newly discovered slave nodes are verified for consistency with the master when discovered.
 * - If a slave node is found to be inconsistent, it is restarted and synced with the master.
 *
 * Self-Healing Mechanism:
 * - If any slave node fails during read or write operations, the proxy initiates a restart.
 * - The restart process includes syncing the slave's data with the master using mdp_copy.
 * - mdp_copy allows safe copying of data even when the server is running.
 * - The mdp_copy is done in during container startup.
 *
 * Node Verification Process:
 * 1. When a slave node is discovered, its data consistency is verified against the master.
 * 2. If inconsistent, the node is restarted and its data is synced with the master.
 * 3. Once verified, the node is added to the verifiedNodes list.
 *
 * Fault Tolerance:
 * - The system can continue operating even if some slave nodes fail.
 * - Failed nodes are automatically restarted and re-synced to maintain cluster integrity.
 *
 * Performance Optimization:
 * - Verified nodes are prioritized for read operations to ensure data consistency.
 * - Load balancing across nodes improves read performance and scalability.
 *
 * This proxy ensures data consistency across the cluster while optimizing read performance
 * through load balancing. It also implements robust self-healing mechanisms to maintain
 * cluster health and availability.
 */

exports.handler = async (event) => {
  if (event.path === '/health') {
    const { masterNode } = await getNodes()
    const isHealthy = await checkMasterHealth(masterNode)

    return {
      statusCode: isHealthy ? 200 : 500,
      body: JSON.stringify({ status: isHealthy ? 'healthy' : 'unhealthy' }),
      headers: { 'Content-Type': 'application/json' }
    }
  }

  const { masterNode, slaveNodes } = await getNodes()
  const nodes = [masterNode, ...slaveNodes]

  let isWriteOperation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(event.httpMethod)

  const path = event.path || ''
  const queryParams = event.queryStringParameters || {}
  const contentType = event.headers['Content-Type'] || event.headers['content-type']
  if (contentType?.toLowerCase() === 'application/sparql-query') {
    isWriteOperation = false
  }

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
      body: JSON.stringify({ error: 'Internal Server Error' }),
      headers: { 'Content-Type': 'application/json' }
    }
  }
}
