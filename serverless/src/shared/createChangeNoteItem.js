// Serverless/src/shared/createChangeNoteItem.js

import { camelCase } from 'lodash'

export const createChangeNoteItem = (rawText) => {
  const fields = ['Date', 'User Id', 'Entity', 'Operation', 'System Note', 'Field', 'User Note', 'Old Value', 'New Value']
  const result = {}

  let currentField = null
  let currentValue = ''

  const lines = rawText.split('\n')

  lines.forEach((line) => {
    let remainingLine = line
    let fieldFound = false

    fields.forEach((field) => {
      const fieldIndex = remainingLine.indexOf(`${field}:`)
      if (fieldIndex !== -1) {
        if (currentField && currentField !== field) {
          result[camelCase(currentField)] = currentValue.trim()
          currentValue = ''
        }

        currentField = field
        const valueStart = fieldIndex + field.length + 1
        const nextFieldIndex = fields.findIndex((nextField, index) => index > fields.indexOf(field) && remainingLine.includes(`${nextField}:`))

        if (nextFieldIndex !== -1) {
          const nextField = fields[nextFieldIndex]
          const nextFieldStart = remainingLine.indexOf(`${nextField}:`)
          currentValue += `${remainingLine.substring(valueStart, nextFieldStart).trim()}\n`
          remainingLine = remainingLine.substring(nextFieldStart)
        } else {
          currentValue += `${remainingLine.substring(valueStart).trim()}\n`
          remainingLine = ''
        }

        fieldFound = true
      }
    })

    if (!fieldFound && currentField) {
      currentValue += `${remainingLine.trim()}\n`
    }
  })

  if (currentField) {
    result[camelCase(currentField)] = currentValue.trim()
  } else {
    result.other = rawText
  }

  return result
}

export default createChangeNoteItem
