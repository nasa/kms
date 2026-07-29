#!/usr/bin/env node

const requestUrl = process.env.KMS_REQUEST_URL 
const response = await fetch(requestUrl, {
  headers: {
    Accept: 'application/json'
  }
})

console.log(JSON.stringify({
  url: requestUrl,
  status: response.status,
  body: await response.text()
}, null, 2))
