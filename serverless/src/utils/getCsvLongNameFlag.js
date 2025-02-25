const getCsvLongNameFlag = (scheme) => {
  if (['platforms', 'instruments', 'projects', 'providers', 'idnnode'].includes(scheme)) {
    return true
  }

  return false
}

export default getCsvLongNameFlag
