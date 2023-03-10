const setStatusCompleted = db => {
  return db.collection('content_requests').updateMany(
    {
      status: 'pending'
    },
    {
      $set: {
        status: 'completed'
      }
    }
  );
};

module.exports = {
  setStatusCompleted
};