# No-Gres

[![Greenkeeper badge](https://badges.greenkeeper.io/nearform/no-gres.svg)](https://greenkeeper.io/)

A small module to mock [pg](https://www.npmjs.com/package/pg) for testing purposes.

[![js-standard-style][1]][2]

* Includes support for async/await, promise and callback styles.
* Verifies that all expected sql statements are called, and with matching parameters
* Verifies sql statements are called in the correct sequence
* Can strict match sql string equality or use regular expressions
* Allows return values for each statement to be defined

1. [Install](#install)
2. [Usage](#usage)
3. [API](#API)
4. [Example Code](#Example-Code)


## Install

```sh
npm install --save-dev @nearform/no-gres
```
## Usage
```js
const assert = require('assert')
const Client = require('@nearform/no-gres').Client
const fetchCustomer = require('./fetchCustomer')

const doTest = async () => {
  const dbClient = new Client()

  // Set expectations and result
  dbClient.expect(
    /SELECT firstname, lastname FROM customer WHERE id = \$1/i,
    [2],
    [
      { firstname: 'Jayne', lastname: 'Cobb' }
    ])
  // Returns the parameters passed so that they can be used for assertions or more expecations

  await dbClient.connect() // Queries will error if this is not called first
  const result = await fetchCustomer.fetchCustomerById(dbClient, 2)

  dbClient.done() // Check all expectations are met - will error if not

  // Assert results
  assert.deepStrictEqual(result, ['Jayne Cobb'])
}

module.exports = doTest
```

## API
### constructor
```js
const Client = new noGres.Client()
```

### throwOnConnect(err)
```js
Client.errorOnConnect(new Error('Unknown  Host'))
```
Used to simulate an error during connection.  The error supplied will be either throw or used in promise rejection, depending on how `connect` is called.

### connect([callback])
This must be called before any queries happen, which follows the behaviour of the real [pg](https://www.npmjs.com/package/pg) api.  You can make this simulate an error (e.g. to test error handling) by use of the [throwOnConnect](#throwOnConnect(err)) method.
```js
// callback
Client.connect((err) => {
    console.error(err)
    // ...do stuff
})

// promise
Client.connect()
.catch((err) => {
    console.error(err)
})
.then(() => {
    // ...do stuff
}

// async
try {
    await Client.connect()
} catch(err) {
    console.error(err)
}
// ...do stuff

```

### expect(sql, [params], [returns])
This sets an expectation that a call will be made to the `query` function of the client.  It can be called multiple times to set a sequence of expectations.  Any unmatched call or a call out of sequence will cause the `query` call to generate an error.

`sql` - A string or regular expression which will be compared to the string passed to the `query` function

`params` - An optional array of parameters which will be matched against those passed to the
`query` function

`returns` - An optional array or an Error instance. If an array, it will represent the "rows" to be returned by the `query` call. If an Error, the associated query will fail with this error. By default, an empty rowset is returned.

Returns the parameters used on the call as an objects.  Handy for re-using the values later in the test:
```js
const { sql, params, returns } = client.expect('select * from orders where id = $1', [123], [])
client.expect(sql, [456], [{id: 456}])
client.expect(sql, params, returns)

let res
res = await orders.fetchById(client, 123)
assert.deepStrictEqual(res, [])
res = orders.fetchById(client, 456)
assert.deepStrictEqual(res, [456])
res = await orders.fetchById(client, 123)
assert.deepStrictEqual(res, [])

```

### query (sql, params, [callback])
### query (config, [callback])
Mock of the [pg](https://www.npmjs.com/package/pg) query function.
`sql` - sql statement to run
`params` - parameter array for the sql
`callback` - optional (err, data) callback.  If not supplied, a promise will be returned.
`config` - object containing `text` and `values` for the sql and parameters, respectively.  Used for compatibility with the real api.
```js
const order = await client.query('select * from orders where id = $1, [123])

const product = client.query({
    text: 'select * from products where category = $1',
    values: ['games']
    }, (err, data) => {
        if (err) {
            return console.error(err)
        }
        return data
    })
```

### done()
Verifies that all expectations have been met.  Will throw an error if they have not.
```js
await client.expect(/select/, [])
client.done()

//Error: Unresolved expectations: [
//  {
//    "sql": {},
//    "params": [],
//    "returns": []
//  }
//]

```

### reset()
Removes all pending expectations and allows the client to be re-used
```js
client.expect(/select/, [])
client.reset()
client.done()
```

## Example Code
See the `example` directory of this project for sample code testing a module against both no-gres and a real PG client instance.

## License

Copyright nearForm Ltd 2018. Licensed under [Apache 2.0][license].

[1]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[2]: https://github.com/feross/standard
[license]: ./LICENSE
