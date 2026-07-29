#!/usr/bin/env node

import http from 'node:http'

const port = Number(process.env.PORT || '8787')
const host = process.env.HOST || '0.0.0.0'

http.createServer((request, response) => {
  console.log(`${new Date().toISOString()} ${request.method} ${request.url}`)
  response.end('ok')
}).listen(port, host, () => {
  console.log(`listening on http://host.docker.internal:${port}`)
})
