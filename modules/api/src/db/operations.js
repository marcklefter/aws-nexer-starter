const newContentRequest = (db, requestId) => {
  return db.collection('content_requests').insertOne({
    requestId,
    status: 'created'
  });
};

const getContentRequest = (db, requestId) => {
  return db.collection('content_requests').findOne(
    {
        requestId
    }, 
    {
        projection: {
            _id: 0
        }
    }
  );
};

module.exports = {
  newContentRequest,
  getContentRequest
};