const assert = require('assert')
const Client = require('../').Client
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
  console.log('no-gres test ok')
}

module.exports = doTest
