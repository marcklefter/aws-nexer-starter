export const setStatusPending = (db, requestId) => {
  return db.collection('content_requests').updateOne(
    {
      requestId
    },
    {
      $set: {
        status: 'pending'
      }
    }
  );
}