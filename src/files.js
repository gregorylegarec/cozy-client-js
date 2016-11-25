/* global fetch Blob File */
import { getParentDomain } from './utils'

const contentTypeOctetStream = 'application/octet-stream'

// @data can be Blob | File | ArrayBuffer | ArrayBufferView | string
export async function upload (data, args) {
  let { name, folderId } = args || {}

  if (!data) {
    throw new Error('missing data argument')
  }

  if (!folderId) folderId = ''

  const headers = {}
  const options = { method: 'POST', headers }

  // transform any ArrayBufferView to ArrayBuffer
  if (data.buffer && data.buffer instanceof ArrayBuffer) {
    data = data.buffer
  }

  let contentType
  if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) {
    contentType = contentTypeOctetStream
  } else if (typeof File !== 'undefined' && data instanceof File) {
    contentType = data.type || contentTypeOctetStream
    if (!name) name = data.name
  } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
    contentType = contentTypeOctetStream
  } else if (typeof data === 'string') {
    contentType = 'text/plain'
  } else {
    throw new Error('invalid data type')
  }

  headers['content-type'] = contentType

  if (typeof name !== 'string' || name === '') {
    throw new Error('missing name argument')
  }

  const domain = getParentDomain()
  const query = `?Name=${encodeURIComponent(name)}&Type=io.cozy.files`
  const path = `/files/${encodeURIComponent(folderId)}`

  return fetch(`${domain}${path}${query}`, options)
    .then((res) => {
      const json = res.json()
      if (!res.ok) {
        return json.then(err => { throw err })
      } else {
        return json
      }
    })
}

export async function uploadFiles (files) {
  return Promise.all(Array.from(files).map(upload))
}
