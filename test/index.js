'use strict'

const Lab = require('lab')
const { describe, it } = exports.lab = Lab.script()
const { expect } = require('code')

const NoGres = require('..')

describe('client', async () => {
  describe('expect', () => {
    it('fails when supplied params are not an array', () => {
      const client = new NoGres.Client()
      expect(() => {
        client.expect('foo', 'bar')
      }).to.throw('Unexpected params: "bar".  Should be an array.')
    })

    it('returns the generated expectation', () => {
      const client = new NoGres.Client()
      const { sql, params, returns, throws } = client.expect('foo', ['bar'], [{ name: 'fooRow' }, { name: 'barRow' }])
      expect(sql).to.equal('foo')
      expect(params.length).to.equal(1)
      expect(params[0]).to.equal('bar')
      expect(returns.length).to.equal(2)
      expect(returns[0].name).to.equal('fooRow')
      expect(returns[1].name).to.equal('barRow')
      expect(throws).to.be.null()
    })

    it('throws the provided error', () => {
      const client = new NoGres.Client()
      const { sql, params, returns, throws } = client.expect('foo', ['bar'], new Error('some db error i cooked up'))
      expect(sql).to.equal('foo')
      expect(params.length).to.equal(1)
      expect(params[0]).to.equal('bar')
      expect(returns).to.be.undefined()
      expect(throws.message).to.equal('some db error i cooked up')
    })

    it('throws an error if not all expectations are met', { plan: 1 }, () => {
      const client = new NoGres.Client()
      client.expect('foo', ['bar'], [{ name: 'fooRow' }, { name: 'barRow' }])
      try {
        client.done()
      } catch (err) {
        expect(err).to.be.an.error(/Unresolved expectations/)
      }
    })
  })

  describe('reset', () => {
    it('removes all pending expectations', () => {
      const client = new NoGres.Client()
      client.expect('foo', ['bar'], [{ name: 'fooRow' }, { name: 'barRow' }])
      client.expect('foo', ['bar'], [{ name: 'fooRow' }, { name: 'barRow' }])
      client.reset()
      client.done()
    })
  })

  describe('connect', () => {
    it('throws configured error on connect: callback', { plan: 1 }, () => {
      const client = new NoGres.Client()
      client.errorOnConnect('foo')
      client.connect((err) => {
        expect(err).to.equal('foo')
      })
    })

    it('throws configured error on connect: promise', () => {
      const client = new NoGres.Client()
      client.errorOnConnect('foo')
      return client.connect()
        .catch((err) => {
          expect(err).to.equal('foo')
        })
    })

    it('throws configured error on connect: await', async () => {
      const client = new NoGres.Client()
      client.errorOnConnect('foo')
      try {
        await client.connect()
      } catch (err) {
        expect(err).to.equal('foo')
      }
    })

    it('works with a callback', { plan: 1 }, () => {
      const client = new NoGres.Client()
      client.connect((err) => {
        expect(err).to.be.undefined()
      })
    })

    it('works with promises', { plan: 1 }, () => {
      const client = new NoGres.Client()
      return client.connect()
        .then((err) => {
          expect(err).to.be.null()
        })
    })

    it('works with await', { plan: 1 }, async () => {
      const client = new NoGres.Client()
      const err = await client.connect()
      expect(err).to.be.null()
    })
  })

  describe('query', async () => {
    it('fails when not connected', { plan: 2 }, async () => {
      const client = new NoGres.Client()
      try {
        await client.query('select * from orders where id = $1', [1, 2, 3])
      } catch (err) {
        expect(err).to.be.an.error('Attempted to query when client not connected')
      }
      client.query('select * from orders where id = $1', [1, 2, 3], (err) => {
        expect(err).to.be.an.error('Attempted to query when client not connected')
      })
    })

    it('fails when no more expectations are defined', { plan: 2 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      const sql = 'select * from orders where id = $1'
      try {
        await client.query(sql, [1, 2, 3])
      } catch (err) {
        expect(err).to.be.an.error(`Unexpected query "${sql}".`)
      }
      client.query(sql, [1, 2, 3], (err) => {
        expect(err).to.be.an.error(`Unexpected query "${sql}".`)
      })
    })

    it('fails when an unexpected sql is supplied', { plan: 2 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      let { sql, params } = client.expect('select * from products where id = $1', [1, 2, 3])
      try {
        await client.query(`${sql} extra stuff`, params)
      } catch (err) {
        expect(err).to.be.an.error(`Unexpected query "${sql} extra stuff".\nExpected "${sql}"`)
      }
      client.expect(sql, params)
      client.query(`${sql} extra stuff`, params, (err) => {
        expect(err).to.be.an.error(`Unexpected query "${sql} extra stuff".\nExpected "${sql}"`)
      })
    })

    it('fails when an unexpected sql is supplied for regex expectation', { plan: 2 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      let { sql, params } = client.expect(/foo/, [1, 2, 3])
      try {
        await client.query('bar', [1, 2, 3])
      } catch (err) {
        expect(err).to.be.an.error(`Unexpected query "bar".\nExpected a regular expression matching ${sql}`)
      }
      client.expect(sql, params)
      client.query('bar', [1, 2, 3], (err) => {
        expect(err).to.be.an.error(`Unexpected query "bar".\nExpected a regular expression matching ${sql}`)
      })
    })

    it('fails when parameters do not match', { plan: 2 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      const { sql, params } = client.expect('select * from orders where id = $1', [2, 3, 4])
      client.expect(sql, params)
      client.expect(sql, params)
      try {
        await client.query(sql, [1, 2, 3])
      } catch (err) {
        expect(err).to.be.an.error(`Unexpected params for query "select * from orders where id = $1".\nExpected ${JSON.stringify(params)}, got [1,2,3].`)
      }
      client.query(sql, [1, 2, 3], (err) => {
        expect(err).to.be.an.error(`Unexpected params for query "select * from orders where id = $1".\nExpected ${JSON.stringify(params)}, got [1,2,3].`)
      })
    })

    it('fails when parameters have a different length', { plan: 2 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      const { sql, params } = client.expect('select * from orders where id = $1', [2, 3, 4])
      client.expect(sql, params)
      client.expect(sql, params)
      try {
        await client.query(sql, [1])
      } catch (err) {
        expect(err).to.be.an.error(`Unexpected params for query "select * from orders where id = $1".\nExpected ${JSON.stringify(params)}, got [1].`)
      }
      client.query(sql, [1], (err) => {
        expect(err).to.be.an.error(`Unexpected params for query "select * from orders where id = $1".\nExpected ${JSON.stringify(params)}, got [1].`)
      })
    })

    it('returns an empty rowset when no return value is supplied', { plan: 3 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      const { sql, params } = client.expect('select * from orders where id = $1', [1, 2, 3])
      const res = await client.query(sql, params)
      expect(res).to.equal({
        rows: [],
        rowCount: 0
      })

      client.expect(sql, params)
      client.query(sql, params, (err, cbRes) => {
        expect(err).to.be.null()
        expect(cbRes).to.equal({
          rows: [],
          rowCount: 0
        })
      })
      client.done()
    })

    it('returns the correct rowset when expected', { plan: 5 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      const { sql, params, returns } = client.expect('select * from orders where id = $1', [1, 2, 3], [{ name: 'foo' }, { name: 'bar' }])
      const res = await client.query(sql, params)
      expect(res.rows).to.equal(returns)
      expect(res.rowCount).to.equal(returns.length)

      client.expect(sql, params, returns)
      client.query(sql, params, (err, cbRes) => {
        expect(err).to.be.null()
        expect(cbRes.rowCount).to.equal(returns.length)
        expect(cbRes.rows).to.equal(returns)
      })
      client.done()
    })

    it('ignores the query parameters if the expectation params are null', { plan: 2 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      const { sql, returns } = client.expect('select * from orders where id = $1', null, [{ name: 'foo' }, { name: 'bar' }])
      const res = await client.query(sql, [1, 2, 3])
      expect(res.rows).to.equal(returns)
      expect(res.rowCount).to.equal(returns.length)
      client.done()
    })

    it('correctly matches an empty array of params', { plan: 2 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      const { sql, returns } = client.expect('select * from orders where id = $1', [], [{ name: 'foo' }, { name: 'bar' }])
      const res = await client.query(sql, [])
      expect(res.rows).to.equal(returns)
      expect(res.rowCount).to.equal(returns.length)
      client.done()
    })

    it('correctly matches a nested array of params', { plan: 2 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      const { sql, returns } = client.expect('select * from orders where id = $1', [[1, 2, 3], [4, 5, 6]], [{ name: 'foo' }, { name: 'bar' }])
      const res = await client.query(sql, [[1, 2, 3], [4, 5, 6]]) // Not using params in order to check value equality works
      expect(res.rows).to.equal(returns)
      expect(res.rowCount).to.equal(returns.length)
      client.done()
    })

    it('correctly fails to match a nested array of params', { plan: 1 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      const { sql } = client.expect('select * from orders where id = $1', [[1, 2, 5], [4, 5, 6]], [{ name: 'foo' }, { name: 'bar' }])
      try {
        await client.query(sql, [[1, 2, 3], [4, 5, 6]]) // Not using params in order to check value equality works
      } catch (err) {
        expect(err).to.be.an.error('Unexpected params for query "select * from orders where id = $1".\nExpected [[1,2,5],[4,5,6]], got [[1,2,3],[4,5,6]].')
      }
    })

    it('does not match an empty array of params to null', { plan: 1 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      const { sql } = client.expect('select * from orders where id = $1', [], [{ name: 'foo' }, { name: 'bar' }])
      try {
        await client.query(sql)
      } catch (err) {
        expect(err).to.be.an.error('Unexpected params for query "select * from orders where id = $1".\nExpected [], got undefined.')
      }
    })

    it('works with config parameter', { plan: 5 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      const { sql, params, returns } = client.expect('select * from orders where id = $1', [1, 2, 3], [{ name: 'foo' }, { name: 'bar' }])
      client.expect(sql, params, returns)

      const res = await client.query({text: sql, values: params})
      expect(res.rows).to.equal(returns)
      expect(res.rowCount).to.equal(returns.length)

      client.query({text: sql, values: params}, (err, cbRes) => {
        expect(err).to.be.null()
        expect(cbRes.rowCount).to.equal(returns.length)
        expect(cbRes.rows).to.equal(returns)
        client.done()
      })
    })

    it('handles multiple exptectations in the correct order', { plan: 4 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      const { sql: sql1, params: params1, returns: returns1 } = client.expect('select * from orders1 where id = $1', [1, 2, 3], [{ name: 'foo1' }, { name: 'bar1' }])
      const { sql: sql2, params: params2, returns: returns2 } = client.expect('select * from orders2 where id = $1', [4, 5, 6], [{ name: 'foo2' }, { name: 'bar2' }])

      const res1 = await client.query(sql1, params1)
      expect(res1.rows).to.equal(returns1)
      expect(res1.rowCount).to.equal(returns1.length)

      const res2 = await client.query(sql2, params2)
      expect(res2.rows).to.equal(returns2)
      expect(res2.rowCount).to.equal(returns2.length)

      client.done()
    })

    it('throws error when provided', { plan: 1 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      const { sql, params, returns, throws } = client.expect('select * from orders where id = $1', [1, 2, 3], new Error('example error'))
      await expect(client.query(sql, params)).to.reject(Error, 'example error')

      client.done()
    })
  })

  describe('events', () => {
    it('can be used to manually simulate events', { plan: 2 }, async () => {
      const client = new NoGres.Client()
      await client.connect()
      client.once('notification', ({ channel, payload }) => {
        expect(channel).to.equal('sample')
        expect(payload).to.equal('some string')
      })
      client.emit('notification', { channel: 'sample', payload: 'some string' })
    })
  })
})

describe('pool', async () => {
  describe('connect', () => {
    it('connects with the underlying client: callback', { plan: 3 }, () => {
      const pool = new NoGres.Pool()
      pool.connect((err, client) => {
        expect(err).to.be.null()
        expect(client).to.equal(pool.client)
        expect(pool.client.isConnected).to.be.true()
      })
    })

    it('connects with the underlying client', { plan: 2 }, async () => {
      const pool = new NoGres.Pool()
      const client = await pool.connect()
      expect(client).to.equal(pool.client)
      expect(pool.client.isConnected).to.be.true()
    })

    it('passes through underlying client error: callback', { plan: 3 }, () => {
      const pool = new NoGres.Pool()
      pool.client.errorOnConnect(new Error('bar'))
      pool.connect((err, client) => {
        expect(err).to.not.be.null()
        expect(client).to.be.undefined()
        expect(pool.client.isConnected).to.be.false()
      })
    })

    it('passes through underlying client error', { plan: 2 }, async () => {
      const pool = new NoGres.Pool()
      pool.client.errorOnConnect(new Error('bar'))
      await expect(pool.connect()).rejects(Error, 'bar')
      expect(pool.client.isConnected).to.be.false()
    })
  })
  describe('query', async () => {
    it('runs a query with the underlying client', async () => {
      const pool = new NoGres.Pool()
      const { sql, params, returns } = pool.expect('select * from orders where id = $1', [1, 2, 3], [{ name: 'foo' }, { name: 'bar' }])
      const res = await pool.query(sql, params)
      expect(res.rows).to.equal(returns)
      expect(res.rowCount).to.equal(returns.length)

      pool.expect(sql, params, returns)
      pool.query(sql, params, (err, cbRes) => {
        expect(err).to.be.null()
        expect(cbRes.rowCount).to.equal(returns.length)
        expect(cbRes.rows).to.equal(returns)
        pool.done()
      })
    })
  })

  describe('getExpectations', async () => {
    it('returns the expectations set', async () => {
      const pool = new NoGres.Pool()
      const { sql, params } = pool.expect('select * from orders where id = $1', [1, 2, 3], [{ name: 'foo' }, { name: 'bar' }])
      expect(pool.expectations.length).to.equal(1)
      await pool.query(sql, params)
      expect(pool.expectations.length).to.equal(0)
      pool.done()
    })
  })

  describe('reset', async () => {
    it('clears the expectations set', async () => {
      const pool = new NoGres.Pool()
      pool.expect('select * from orders where id = $1', [1, 2, 3], [{ name: 'foo' }, { name: 'bar' }])
      expect(pool.expectations.length).to.equal(1)
      await pool.reset()
      expect(pool.expectations.length).to.equal(0)
      pool.done()
    })
  })

  describe('end', async () => {
    it('invokes suppled callback', { plan: 1 }, async () => {
      const pool = new NoGres.Pool()
      pool.end(() => {
        expect(true).to.be.true()
      })
    })
  })
})
