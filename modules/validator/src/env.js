const env = require('env-var');

// ...

const port = env.get('PORT').default('80').asPortNumber();
        
// ...

module.exports = {
    port
};