const {
  MongoClient,
  ServerApiVersion
} = require('mongodb');

const operations = require('./operations');

// ...

let client;

const open = async (dbUrl, dbName) => {
  if (!client) {
    client = await new MongoClient(
      dbUrl, 
      { 
          useNewUrlParser: true, 
          useUnifiedTopology: true, 
          serverApi: ServerApiVersion.v1 
      }
    ).connect();
  }
      
  return client.db(dbName);
} 

const close = () => {
  return client.close();
}

// ...

module.exports = {
  open,
  close,

  ...operations
}