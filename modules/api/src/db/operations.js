export const newContentRequest = (db, requestId) => {
  return db.collection('content_requests').insertOne({
    requestId,
    status: 'created'
  });
}

export const getContentRequest = (db, requestId) => {
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
}