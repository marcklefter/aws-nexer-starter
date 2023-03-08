const {
  MongoClient,
  ServerApiVersion
} = require('mongodb');

const operations = require('./operations');

// ...

let dbClient;

let dbName;
let dbConnected;

const init = (dbUrl, _dbName) => {
  dbClient = new MongoClient(
    dbUrl, 
    { 
        useNewUrlParser: true, 
        useUnifiedTopology: true, 
        serverApi: ServerApiVersion.v1 
    }
  );

  dbName = _dbName;
}

const open = async () => {
  if (!dbConnected) {
    await dbClient.connect();

    dbConnected = true;
  }
      
  return dbClient.db(dbName);
} 

const close = () => {
  return dbClient.close();
}

// ...

module.exports = {
  init,
  open,
  close,

  ...operations
}