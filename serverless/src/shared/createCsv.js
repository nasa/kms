import { stringify } from 'csv'
/**
 * Create CSV output from the 2 dimnesion array
 * @param {[[String]]} value
 * @returns
 */
const createCsv = async (csvMetadata, csvHeaders, values) => new Promise((resolve, reject) => {
  values.splice(0, 0, csvMetadata)
  values.splice(1, 0, csvHeaders)
  stringify(values, { quoted: true }, (err, output) => {
    if (err) {
      reject(err)
    } else {
      resolve(output)
    }
  })
})

export default createCsv
