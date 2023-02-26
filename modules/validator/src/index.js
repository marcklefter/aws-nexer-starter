const express   = require('express');
const env       = require('./env');

// ...

const app = express();
app.use(express.json());

// ...

app.post('/', (_, res) => {
    console.log('tms-validator: Validating TMS request');
    res.send('TMS request is valid');
});

// ...

const srvd = app.listen(env.port, () => {
    console.log(`Listening on port ${env.port}`)
});