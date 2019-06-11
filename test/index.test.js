'use strict'

const test = require('tap').test
const NoGres = require('../index')

test('client', t => {
  t.test('expect', t => {
    t.test('fails when supplied params are not an array', t => {
      const client = new NoGres.Client()
      t.throws(() => { client.expect('foo', 'bar') }, Error('Unexpected params: "bar".  Should be an array.'))
      t.end()
    })

    t.test('returns the generated expectation', t => {
      const client = new NoGres.Client()
      const { sql, params, returns, throws } = client.expect('foo', ['bar'], [{ name: 'fooRow' }, { name: 'barRow' }])
      t.equal(sql, 'foo')
      t.equal(params.length, 1)
      t.equal(params[0], 'bar')
      t.equal(returns.length, 2)
      t.equal(returns[0].name, 'fooRow')
      t.equal(returns[1].name, 'barRow')
      t.equal(throws, null)
      t.end()
    })

    t.test('throws the provided error', t => {
      const client = new NoGres.Client()
      const { sql, params, returns, throws } = client.expect('foo', ['bar'], new Error('some db error i cooked up'))
      t.equal(sql, 'foo')
      t.equal(params.length, 1)
      t.equal(params[0], 'bar')
      t.equal(returns, undefined)
      t.equal(throws.message, 'some db error i cooked up')
      t.end()
    })

    t.test('throws an error if not all expectations are met', t => {
      const client = new NoGres.Client()
      client.expect('foo', ['bar'], [{ name: 'fooRow' }, { name: 'barRow' }])
      t.throws(() => { client.done() })
      t.end()
    })

    t.end()
  })

  t.test('release', t => {
    t.test('noop since no-gres has a single client per pool', t => {
      const client = new NoGres.Client()
      client.release()
      t.ok(true)
      t.end()
    })

    t.end()
  })

  t.test('reset', t => {
    t.test('removes all pending expectations', t => {
      const client = new NoGres.Client()
      client.expect('foo', ['bar'], [{ name: 'fooRow' }, { name: 'barRow' }])
      client.expect('foo', ['bar'], [{ name: 'fooRow' }, { name: 'barRow' }])
      client.reset()
      t.doesNotThrow(() => { client.done() })
      t.end()
    })

    t.end()
  })

  t.test('connect', t => {
    t.test('throws configured error on connect: callback', t => {
      const client = new NoGres.Client()
      client.errorOnConnect('foo')
      client.connect(err => {
        t.equal(err, 'foo')
        t.end()
      })
    })

    t.test('throws configured error on connect: promise', t => {
      const client = new NoGres.Client()
      client.errorOnConnect('foo')
      t.rejects(client.connect(), 'foo')
      t.end()
    })

    t.test('throws configured error on connect: await', async t => {
      const client = new NoGres.Client()
      client.errorOnConnect('foo')
      try {
        await client.connect()
      } catch (err) {
        t.equal(err, 'foo')
      } finally {
        t.end()
      }
    })

    t.test('works with a callback', t => {
      const client = new NoGres.Client()
      client.connect(err => {
        t.equal(err, undefined)
        t.end()
      })
    })

    t.test('works with promises', t => {
      const client = new NoGres.Client()
      t.resolves(client.connect())
      t.end()
    })

    t.test('works with await', { plan: 1 }, async t => {
      const client = new NoGres.Client()
      try {
        await client.connect()
      } catch (err) {
        t.error(err)
      } finally {
        t.end()
      }
    })

    t.end()
  })

  t.test('query', t => {
    t.test('fails when not connected', t => {
      t.plan(2)
      const client = new NoGres.Client()
      const sql = 'select * from orders where id = $1'
      const result = client.query(sql, [1, 2, 3])
      t.rejects(result)
      client.query(sql, [1, 2, 3], err => {
        t.equals(err.message, 'Attempted to query when client not connected')
      })
    })

    t.test('fails when no more expectations are defined', async t => {
      t.plan(2)
      const client = new NoGres.Client()
      await client.connect()
      const sql = 'select * from orders where id = $1'
      const result = client.query(sql, [1, 2, 3])
      t.rejects(result, Error(`Unexpected query "${sql}".`))
      client.query(sql, [1, 2, 3], err => {
        t.equals(err.message, `Unexpected query "${sql}".`)
      })
    })

    t.test('fails when an unexpected sql is supplied', async t => {
      t.plan(2)
      const client = new NoGres.Client()
      await client.connect()
      let { sql, params } = client.expect('select * from products where id = $1', [1, 2, 3])
      t.rejects(client.query(`${sql} extra stuff`, params), `Unexpected query "${sql} extra stuff".\nExpected "${sql}"`)
      client.expect(sql, params)
      client.query(`${sql} extra stuff`, params, err => {
        t.equals(err.message, `Unexpected query "${sql} extra stuff".\nExpected "${sql}"`)
      })
    })

    t.test('fails when an unexpected sql is supplied for regex expectation', async t => {
      t.plan(2)
      const client = new NoGres.Client()
      await client.connect()
      let { sql, params } = client.expect(/foo/, [1, 2, 3])
      t.rejects(client.query('bar', [1, 2, 3]), `Unexpected query "bar".\nExpected a regular expression matching ${sql}`)
      client.expect(sql, params)
      client.query('bar', [1, 2, 3], err => {
        t.equals(err.message, `Unexpected query "bar".\nExpected a regular expression matching ${sql}`)
      })
    })

    t.test('fails when parameters do not match', async t => {
      t.plan(2)
      const client = new NoGres.Client()
      await client.connect()
      const { sql, params } = client.expect('select * from orders where id = $1', [2, 3, 4])
      client.expect(sql, params)
      t.rejects(client.query(sql, [1, 2, 3]), `Unexpected params for query "select * from orders where id = $1".\nExpected ${JSON.stringify(params)}, got [1,2,3].`)
      client.expect(sql, params)
      client.query(sql, [1, 2, 3], err => {
        t.equals(err.message, `Unexpected params for query "select * from orders where id = $1".\nExpected ${JSON.stringify(params)}, got [1,2,3].`)
      })
    })

    t.test('fails when parameters have a different length', async t => {
      t.plan(2)
      const client = new NoGres.Client()
      await client.connect()
      const { sql, params } = client.expect('select * from orders where id = $1', [2, 3, 4])
      client.expect(sql, params)
      t.rejects(client.query(sql, [1]), `Unexpected params for query "select * from orders where id = $1".\nExpected ${JSON.stringify(params)}, got [1].`)
      client.expect(sql, params)
      client.query(sql, [1], err => {
        t.equals(err.message, `Unexpected params for query "select * from orders where id = $1".\nExpected ${JSON.stringify(params)}, got [1].`)
      })
    })

    t.test('returns an empty rowset when no return value is supplied', async t => {
      t.plan(3)
      const client = new NoGres.Client()
      await client.connect()
      const { sql, params } = client.expect('select * from orders where id = $1', [1, 2, 3])
      t.resolveMatch(client.query(sql, params), { rows: [], rowCount: 0 })
      client.expect(sql, params)
      client.query(sql, params, (err, cbRes) => {
        t.equals(err, null)
        t.deepEqual(cbRes, { rows: [], rowCount: 0 })
      })
      client.done()
    })

    t.test('returns the correct rowset when expected', async t => {
      t.plan(5)
      const client = new NoGres.Client()
      await client.connect()
      const { sql, params, returns } = client.expect('select * from orders where id = $1', [1, 2, 3], [{ name: 'foo' }, { name: 'bar' }])
      const res = await client.query(sql, params)
      t.equals(res.rows, returns)
      t.equals(res.rowCount, returns.length)
      client.expect(sql, params, returns)
      client.query(sql, params, (err, cbRes) => {
        t.equals(err, null)
        t.equals(cbRes.rowCount, returns.length)
        t.deepEqual(cbRes.rows, returns)
      })
      client.done()
    })

    t.test('ignores the query parameters if the expectation params are null', async t => {
      t.plan(2)
      const client = new NoGres.Client()
      await client.connect()
      const { sql, returns } = client.expect('select * from orders where id = $1', null, [{ name: 'foo' }, { name: 'bar' }])
      const res = await client.query(sql, [1, 2, 3])
      t.equals(res.rowCount, returns.length)
      t.deepEqual(res.rows, returns)
      client.done()
    })

    t.test('correctly matches an empty array of params', async t => {
      t.plan(2)
      const client = new NoGres.Client()
      await client.connect()
      const { sql, returns } = client.expect('select * from orders where id = $1', [], [{ name: 'foo' }, { name: 'bar' }])
      const res = await client.query(sql, [])
      t.deepEqual(res.rows, returns)
      t.equals(res.rowCount, returns.length)
      client.done()
    })

    t.test('correctly matches a nested array of params', async t => {
      t.plan(2)
      const client = new NoGres.Client()
      await client.connect()
      const { sql, returns } = client.expect('select * from orders where id = $1', [[1, 2, 3], [4, 5, 6]], [{ name: 'foo' }, { name: 'bar' }])
      const res = await client.query(sql, [[1, 2, 3], [4, 5, 6]]) // Not using params in order to check value equality works
      t.deepEqual(res.rows, returns)
      t.equals(res.rowCount, returns.length)
      client.done()
    })

    t.test('correctly fails to match a nested array of params', async t => {
      const client = new NoGres.Client()
      await client.connect()
      const { sql } = client.expect('select * from orders where id = $1', [[1, 2, 5], [4, 5, 6]], [{ name: 'foo' }, { name: 'bar' }])
      t.rejects(client.query(sql, [[1, 2, 3], [4, 5, 6]]), 'Unexpected params for query "select * from orders where id = $1".\nExpected [[1,2,5],[4,5,6]], got [[1,2,3],[4,5,6]].')
      t.end()
    })

    t.test('does not match an empty array of params to null', async t => {
      const client = new NoGres.Client()
      await client.connect()
      const { sql } = client.expect('select * from orders where id = $1', [], [{ name: 'foo' }, { name: 'bar' }])
      t.rejects(client.query(sql), 'Unexpected params for query "select * from orders where id = $1".\nExpected [], got undefined.')
    })

    t.test('works with config parameter', async t => {
      t.plan(5)
      const client = new NoGres.Client()
      await client.connect()
      const { sql, params, returns } = client.expect('select * from orders where id = $1', [1, 2, 3], [{ name: 'foo' }, { name: 'bar' }])
      client.expect(sql, params, returns)
      const res = await client.query({ text: sql, values: params })
      t.deepEqual(res.rows, returns)
      t.equals(res.rowCount, returns.length)
      client.query({ text: sql, values: params }, (err, cbRes) => {
        t.equals(err, null)
        t.equals(cbRes.rowCount, returns.length)
        t.deepEqual(cbRes.rows, returns)
        client.done()
      })
    })

    t.test('handles multiple exptectations in the correct order', async t => {
      t.plan(4)
      const client = new NoGres.Client()
      await client.connect()
      const { sql: sql1, params: params1, returns: returns1 } = client.expect('select * from orders1 where id = $1', [1, 2, 3], [{ name: 'foo1' }, { name: 'bar1' }])
      const { sql: sql2, params: params2, returns: returns2 } = client.expect('select * from orders2 where id = $1', [4, 5, 6], [{ name: 'foo2' }, { name: 'bar2' }])
      const res1 = await client.query(sql1, params1)
      t.deepEqual(res1.rows, returns1)
      t.equals(res1.rowCount, returns1.length)
      const res2 = await client.query(sql2, params2)
      t.deepEqual(res2.rows, returns2)
      t.equals(res2.rowCount, returns2.length)
      client.done()
    })

    t.test('throws error when provided', async t => {
      const client = new NoGres.Client()
      await client.connect()
      const { sql, params } = client.expect('select * from orders where id = $1', [1, 2, 3], new Error('example error'))
      t.rejects(client.query(sql, params), 'example error')
      client.done()
      t.end()
    })

    t.end()
  })

  t.test('events', t => {
    t.test('can be used to manually simulate events', async t => {
      t.plan(2)
      const client = new NoGres.Client()
      await client.connect()
      client.once('notification', ({ channel, payload }) => {
        t.equals(channel, 'sample')
        t.equals(payload, 'some string')
      })
      client.emit('notification', { channel: 'sample', payload: 'some string' })
    })

    t.end()
  })

  t.end()
})

test('pool', t => {
  t.test('connect', t => {
    t.test('connects with the underlying client: callback', t => {
      t.plan(3)
      const pool = new NoGres.Pool()
      pool.connect((err, client) => {
        t.equals(err, null)
        t.deepEqual(client, pool.client)
        t.ok(pool.client.isConnected)
      })
    })

    t.test('connects with the underlying client', async t => {
      t.plan(2)
      const pool = new NoGres.Pool()
      const client = await pool.connect()
      t.deepEqual(client, pool.client)
      t.ok(pool.client.isConnected)
    })

    t.test('passes through underlying client error: callback', t => {
      t.plan(3)
      const pool = new NoGres.Pool()
      pool.client.errorOnConnect(new Error('bar'))
      pool.connect((err, client) => {
        t.notEqual(err, null)
        t.equals(client, undefined)
        t.notOk(pool.client.isConnected)
      })
    })

    t.test('passes through underlying client error', async t => {
      t.plan(2)
      const pool = new NoGres.Pool()
      pool.client.errorOnConnect(new Error('bar'))
      t.rejects(pool.connect(), 'bar')
      t.notOk(pool.client.isConnected)
    })

    t.end()
  })

  t.test('query', t => {
    t.test('runs a query with the underlying client', async t => {
      t.plan(5)
      const pool = new NoGres.Pool()
      const { sql, params, returns } = pool.expect('select * from orders where id = $1', [1, 2, 3], [{ name: 'foo' }, { name: 'bar' }])
      const res = await pool.query(sql, params)
      t.deepEqual(res.rows, returns)
      t.equals(res.rowCount, returns.length)
      pool.expect(sql, params, returns)
      pool.query(sql, params, (err, cbRes) => {
        t.equals(err, null)
        t.equals(cbRes.rowCount, returns.length)
        t.deepEqual(cbRes.rows, returns)
        pool.done()
      })
    })

    t.end()
  })

  t.test('expectations', async t => {
    t.test('returns the expectations set', async t => {
      t.plan(2)
      const pool = new NoGres.Pool()
      const { sql, params } = pool.expect('select * from orders where id = $1', [1, 2, 3], [{ name: 'foo' }, { name: 'bar' }])
      t.equals(pool.expectations.length, 1)
      await pool.query(sql, params)
      t.equals(pool.expectations.length, 0)
      pool.done()
    })

    t.end()
  })

  t.test('reset', async t => {
    t.test('clears the expectations set', async t => {
      t.plan(2)
      const pool = new NoGres.Pool()
      pool.expect('select * from orders where id = $1', [1, 2, 3], [{ name: 'foo' }, { name: 'bar' }])
      t.equals(pool.expectations.length, 1)
      await pool.reset()
      t.equals(pool.expectations.length, 0)
      pool.done()
    })

    t.end()
  })

  t.test('end', async t => {
    t.test('invokes suppled callback', async t => {
      const pool = new NoGres.Pool()
      pool.end(() => { t.ok(true) })
      t.end()
    })
  })

  t.end()
})
