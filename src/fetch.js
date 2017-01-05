/* global fetch */
import {refreshToken} from './auth_v3'
import {retry} from './utils'
import jsonapi from './jsonapi'

export function cozyFetch (cozy, path, options = {}) {
  return cozy.fullpath(path).then((fullpath) => {
    let resp
    if (options.disableAuth) {
      resp = fetch(fullpath, options)
    } else if (options.manualAuthCredentials) {
      resp = cozyFetchWithAuth(cozy, fullpath, options, options.manualAuthCredentials)
    } else {
      resp = cozy.authorize().then((credentials) =>
        cozyFetchWithAuth(cozy, fullpath, options, credentials))
    }
    return resp.then(handleResponse)
  })
}

function cozyFetchWithAuth (cozy, fullpath, options, credentials) {
  if (credentials) {
    options.headers = options.headers || {}
    options.headers['Authorization'] = credentials.token.toAuthHeader()
  }
  return Promise.all([
    cozy.isV2(),
    fetch(fullpath, options)
  ]).then(([isV2, res]) => {
    if (res.status !== 401 || isV2 || !credentials) {
      return res
    }
    const { client, token } = credentials
    return retry(() => refreshToken(cozy, client, token), 3)()
      .then((newToken) => cozy.saveCredentials(client, newToken))
      .then((credentials) => cozyFetchWithAuth(cozy, fullpath, options, credentials))
  })
}

export function cozyFetchJSON (cozy, method, path, body, options = {}) {
  options.method = method

  const headers = options.headers = options.headers || {}

  headers['Accept'] = 'application/json'

  if (body !== undefined) {
    if (headers['Content-Type']) {
      options.body = body
    } else {
      headers['Content-Type'] = 'application/json'
      options.body = JSON.stringify(body)
    }
  }

  return cozyFetch(cozy, path, options)
    .then(handleJSONResponse)
}

function handleResponse (res) {
  if (res.ok) {
    return res
  }
  let data
  const contentType = res.headers.get('content-type')
  if (contentType && contentType.indexOf('json') >= 0) {
    data = res.json()
  } else {
    data = res.text()
  }
  return data.then(err => {
    throw new FetchError(res, err)
  })
}

function handleJSONResponse (res) {
  const contentType = res.headers.get('content-type')
  if (!contentType || contentType.indexOf('json') < 0) {
    return res.text((data) => {
      throw new FetchError(res, new Error('Response is not JSON: ' + data))
    })
  }

  const json = res.json()
  if (contentType.indexOf('application/vnd.api+json') === 0) {
    return json.then(jsonapi)
  } else {
    return json
  }
}

export class FetchError {
  constructor (res, reason) {
    this.response = res
    this.url = res.url
    this.status = res.status
    this.reason = reason
  }

  isUnauthorised () {
    return this.status === 401
  }
}
