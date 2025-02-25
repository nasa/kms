const formatCsvPath = (scheme, csvHeadersCount, path, isLeaf) => {
  if (['platforms', 'instruments', 'projects'].includes(scheme)) {
    const maxLevel = csvHeadersCount - 2
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
      path.splice(maxLevel - 2, 0, ' ')

      return path
    }
  }

  if (['sciencekeywords', 'chronounits', 'locations', 'discipline', 'rucontenttype', 'measurementname'].includes(scheme)) {
    const maxLevel = csvHeadersCount - 1
    if (maxLevel === path.length) {
      return path
    }

    if (maxLevel > path.length) {
      while (maxLevel > path.length) {
        path.push(' ')
      }

      return path
    }
  }

  if (['providers'].includes(scheme)) {
    const maxLevel = csvHeadersCount - 3
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

export default formatCsvPath
