'use strict'

const arraysAreEqual = (arr1, arr2) => {
  // Handles nested arrays, but not objects
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
    return false
  }
  if (arr1.length !== arr2.length) {
    return false
  }
  for (let x = 0; x < arr1.length; ++x) {
    if (Array.isArray(arr1[x])) {
      return arraysAreEqual(arr1[x], arr2[x])
    }
    if (arr1[x] !== arr2[x]) {
      return false
    }
  }
  return true
}

const copyArray = (arr) => {
  const copy = new Array(arr.length)
  for (let x = 0; x < arr.length; ++x) {
    copy[x] = Object.assign({}, arr[x])
  }
  return copy
}

const handleReturn = (err, value, cb) => {
  const retVal = value
    ? {
      rows: value,
      rowCount: value.length
    }
    : value
  if (typeof cb === 'function') {
    return Promise.resolve(cb(err, retVal))
  }
  return err ? Promise.reject(err) : Promise.resolve(retVal)
}

class Pool {
  constructor () {
    this._client = new Client()
  }

  get client () {
    return this._client
  }

  connect (cb) {
    return this._client.connect(cb)
  }

  query (sql, params, cb) {
    return this._client.connect()
      .then(() => {
        return this._client.query(sql, params, cb)
      })
  }

  expect (...params) {
    return this._client.expect(...params)
  }

  done () {
    return this._client.done()
  }

  end (cb) {
    return cb()
  }

  get expectations () {
    return this._client.expectations
  }

  reset () {
    this._client.reset()
  }
}

class Client {
  constructor () {
    this._expectations = []
  }

  get expectations () {
    return this._expectations
  }

  get isConnected () {
    return this._connected
  }

  // mocked pg node methods

  connect (cb) {
    this._connected = !this._errorOnConnect
    return handleReturn(this._errorOnConnect, null, cb)
  }

  query (sql, params, cb) {
    cb = typeof params === 'function' ? params : cb
    params = sql.values || params
    sql = sql.text || sql

    if (!this._connected) {
      return handleReturn(new Error('Attempted to query when client not connected'), null, cb)
    }

    const nextExpectation = this._expectations.shift()
    if (!nextExpectation) {
      return handleReturn(new Error(`Unexpected query "${sql}".`), null, cb)
    }

    if (typeof nextExpectation.sql === 'string' && sql !== nextExpectation.sql) {
      return handleReturn(new Error(`Unexpected query "${sql}".\nExpected "${nextExpectation.sql}"`), null, cb)
    }
    if (nextExpectation.sql instanceof RegExp && !nextExpectation.sql.test(sql)) {
      return handleReturn(new Error(`Unexpected query "${sql}".\nExpected a regular expression matching ${nextExpectation.sql}`), null, cb)
    }
    if (nextExpectation.params && !arraysAreEqual(params, nextExpectation.params)) {
      return handleReturn(new Error(`Unexpected params for query "${sql}".\nExpected ${JSON.stringify(nextExpectation.params)}, got ${JSON.stringify(params)}.`), null, cb)
    }
    return handleReturn(null, nextExpectation.returns, cb)
  }

  // mock configuration

  errorOnConnect (err) {
    this._errorOnConnect = (err)
  }

  expect (sql, params, returns = []) {
    if (params && !Array.isArray(params)) {
      throw new Error(`Unexpected params: ${JSON.stringify(params)}.  Should be an array.`)
    }
    this._expectations.push({ sql, params, returns: copyArray(returns) })
    return this.expectations[this.expectations.length - 1]
  }

  done () {
    if (this._expectations.length > 0) {
      throw new Error(`Unresolved expectations: ${JSON.stringify(this._expectations, null, 2)}`)
    }
  }

  reset () {
    this._expectations = []
  }
}

module.exports = {
  Client,
  Pool,
  native: {
    Client
  }
}
