import { cloneDeep } from 'lodash'
import fetchNarrowers from './fetchNarrowers'

const longNameFlag = (scheme) => {
  if (['platforms', 'instruments', 'projects', 'providers', 'idnnode'].includes(scheme)) {
    return true
  }

  return false
}

const providerUrlFlag = (scheme) => {
  if (['providers'].includes(scheme)) {
    return true
  }

  return false
}

const formatPath = (scheme, maxLevel, path, isLeaf) => {
  if (['platforms', 'instruments', 'projects'].includes(scheme)) {
    if (maxLevel + 1 === path.length) {
      return path
    }

    if ((maxLevel + 1 > path.length) && !isLeaf) {
      while (maxLevel + 1 > path.length) {
        path.push(' ')
      }

      return path
    }

    if ((maxLevel + 1 > path.length) && isLeaf) {
      path.splice(maxLevel - 1, 0, ' ')

      return path
    }
  }

  if (['sciencekeywords', 'chronounits', 'locations', 'discipline', 'rucontenttype', 'measurementname'].includes(scheme)) {
    if (maxLevel + 1 === path.length) {
      return path
    }

    if (maxLevel + 1 > path.length) {
      while (maxLevel + 1 > path.length) {
        path.push(' ')
      }

      return path
    }
  }

  if (['providers'].includes(scheme)) {
    if (maxLevel === path.length) {
      return path
    }

    if ((maxLevel > path.length) && !isLeaf) {
      while (maxLevel > path.length) {
        path.push(' ')
      }

      return path
    }

    if ((maxLevel > path.length) && isLeaf) {
      while (maxLevel > path.length) {
        path.splice(path.length - 1, 0, ' ')
      }

      return path
    }
  }

  return path
}

const traverseGraph = async (maxLevel, providerUrlsMap, longNamesMap, scheme, n, map, path = [], paths = []) => {
  const { narrowerPrefLabel, uri } = n

  const uuid = n.uri.split('/')[n.uri.split('/').length - 1]
  const longNameArray = longNamesMap[n.uri]
  const providerUrlsArray = providerUrlsMap[n.uri]

  path.push(narrowerPrefLabel)

  const narrowers = fetchNarrowers(uri, map)
  const isLeaf = narrowers.length === 0

  // eslint-disable-next-line no-restricted-syntax
  for (const obj of narrowers) {
    traverseGraph(maxLevel, providerUrlsMap, longNamesMap, scheme, obj, map, cloneDeep(path), paths)
  }

  if (path.length > 1) {
    path.shift()

    formatPath(scheme, maxLevel, path, isLeaf)

    if (longNameFlag(scheme)) {
      if (longNameArray) {
        path.push(longNameArray[0])
      } else {
        path.push(' ')
      }
    }

    if (providerUrlFlag(scheme)) {
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
