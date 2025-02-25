const getCsvProviderUrlFlag = (scheme) => {
  if (['providers'].includes(scheme)) {
    return true
  }

  return false
}

export default getCsvProviderUrlFlag
