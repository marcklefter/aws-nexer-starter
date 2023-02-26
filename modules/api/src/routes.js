const express = require('express');

// ...

const routes = express.Router();

// ...
// TMS API.
routes.get('/status/:requestId', (req, res) => {
    res.send('OK: ' + req.params.requestId);
});

routes.get('/content/:requestId', (req, res) => {
    res.send('OK: ' + req.params.requestId);
});

routes.post('/content', (req, res) => {
    res.send('OK');
});

// ...

module.exports = routes;