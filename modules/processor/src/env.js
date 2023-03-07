const env = require('env-var');

// ...

const queueUrl = env.get('COPILOT_QUEUE_URI').required().asString();
        
// ...

module.exports = {
    queueUrl
};