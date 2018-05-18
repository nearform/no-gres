### EXAMPLE
This example code demonstrates running the same code against PG and no-gres.

### Requirements
It assumes that a postgresql database is running and that the following environment variables are configured:
```
PGHOST
PGUSER
PGPASSWORD
PGDATABASE
```

### Running
```
npm run pg-test
```

### Overview

`fetchCustomer.fetchCustomerById` is an example function to be tested.  It accepts `db` and `customerId` parameters, runs a query and performs some post-processing on the results.

Running the example will invoke `fetchCustomer.fetchCustomerById`, twice - passing a real PG client and a no-gres instance in turn, and validate the results of both.

As part of this process, a `customer` table is created and dropped in the configured Postgres instance.