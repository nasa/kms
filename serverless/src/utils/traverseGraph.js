import { cloneDeep } from 'lodash'
import getNarrowers from './getNarrowers'
import formatCsvPath from './formatCsvPath'
import getCsvLongNameFlag from './getCsvLongNameFlag'
import getCsvProviderUrlFlag from './getCsvProviderUrlFlag'

const traverseGraph = async (csvHeadersCount, providerUrlsMap, longNamesMap, scheme, n, map, path = [], paths = []) => {
  const { narrowerPrefLabel, uri } = n

  const uuid = n.uri.split('/')[n.uri.split('/').length - 1]
  const longNameArray = longNamesMap[n.uri]
  const providerUrlsArray = providerUrlsMap[n.uri]

  path.push(narrowerPrefLabel)

  const narrowers = getNarrowers(uri, map)
  const isLeaf = narrowers.length === 0

  // eslint-disable-next-line no-restricted-syntax
  for (const obj of narrowers) {
    traverseGraph(csvHeadersCount, providerUrlsMap, longNamesMap, scheme, obj, map, cloneDeep(path), paths)
  }

  if (path.length > 1) {
    path.shift()

    formatCsvPath(scheme, csvHeadersCount, path, isLeaf)

    if (getCsvLongNameFlag(scheme)) {
      if (longNameArray) {
        path.push(longNameArray[0])
      } else {
        path.push(' ')
      }
    }

    if (getCsvProviderUrlFlag(scheme)) {
      if (providerUrlsArray) {
        path.push(providerUrlsArray[0])
      } else {
        path.push(' ')
      }
    }

    path.push(uuid)

    paths.push(path)
  }
}

export default traverseGraph
