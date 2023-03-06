# Exercises
Description of exercises for the _Translation Management Systems (TMS)_ sample application.

## Exercise 1: TMS API 
In this exercise, an AWS Copilot [Load Balanced Web Service](https://aws.github.io/copilot-cli/docs/concepts/services/#load-balanced-web-service) for the _TMS API_ is created and deployed.

A basic API server exists in `modules/api` with the following endpoints:

    GET   /v1/status/:requestId
    GET   /v1/content/:requestId
    POST  /v1/content

> All routes just return a (dummy) response of 'OK' for now.

A Load Balanced Web Service must support _health checks_ and handle shutdowns gracefully:

*   Add a health check route for `GET /` that responds with 200 OK.

> Note: In `src/index.js`, add this route just after the `/v1` routes.

*   Handle the SIGTERM signal for graceful shutdown:

    ```
    const server = app.listen(...)

    process.on('SIGTERM', () => {
      server.close(() => {
        // TBD: Cleanup, e.g. closing the server and various connections.
        console.log('API server closed');

        process.exit(0);
      });
    })
    ```

Test the containerized API server by:

*   Building its Docker image:

        docker build -t tms-api:v1 . 

*   Run a container:

        docker run -d -p 80:80 tms-api:v1

*   Verify that the API server works by sending a 
    request to one of the endpoints.

*   Stop the container by running:

        docker stop <CONTAINER_ID>

    > Get the CONTAINER_ID via `docker ps`.

*   Check that the API server was shut down 
    gracefully:

        docker logs <CONTAINER_ID>

*   Remove the container and image (locally):

        docker rm <CONTAINER_ID>
        docker rmi tms-api:v1

Create and deploy a Copilot application named `tms` and add a Load Balanced Web Service (as a first service in the application) by running:

    copilot init

in the **project root folder** and following the instructions.

> Note 1: The name of the _application_ should be `tms`.

> Note 2: The name of the _service_ should be `api`.

> Deployment will take a while!

Once deployment has finished, test the API running on AWS by invoking the Load Balancer URL.

## Exercise 2: Service-to-Service Communication
In this exercise, an AWS Copilot [Backend Service](https://aws.github.io/copilot-cli/docs/concepts/services/#backend-service) for the _TMS Validator_ service is created and deployed.

The _TMS Validator_ service will be invoked directly (synchronously) by the _TMS API_.

In the `modules/api` folder:

*   Install the [superagent](https://ladjs.github.io/superagent/) HTTP client library:

        npm install superagent

*   In the route for `POST /v1/content`, use the `superagent` library to make a POST call to the _TMS Validator_ service.

    > Note 1: The URL of the _TMS Validator_ service will be: `http://validator`.

    > Note 2: Use the [async/await](https://ladjs.github.io/superagent/#promise-and-generator-support) variant of calling `superagent`.

In the `modules/validator` folder, add a health check and SIGTERM handling, just like you did for the _TMS API_ service in the previous exercise. 

You can use [Docker Compose](https://docs.docker.com/compose/) to locally test the interaction between the two services:

*   Create a folder named `etc` in the `modules` folder and in it, add a file named `docker-compose-ex2.yaml` with the following:

    ```
    services:
        api:
            build: ../api/
            ports:
                - "80:80"
        validator:
            build: ../validator
    ```

    This sets up two services named `api` and `validator`.

    > Why aren't `ports` defined for the `validator` service?

*   Launch the two services (from the `etc` folder):

        docker compose -f docker-compose-ex2.yaml up --build

*   In a second terminal window, invoke the API server:

        curl -X POST http://localhost/v1/content

    In the first terminal windows (where Docker Compose is running), you should see a log statement from the `validator` service, indicating that service-to-service communication was successful.

*   Ctrl+C to shut down Docker Compose.

To create and deploy the _TMS Validator_ service, in the **project root** folder:

*   Create the _TMS Validator_ service:

        copilot svc init --name validator --svc-type "Backend Service" --dockerfile ./modules/validator/Dockerfile 

*   Deploy the _TMS Validator_ service:

        copilot svc deploy -n validator

*   Make the following changes to _TMS API_:

    *   The URL of the _TMS Validator_ service must now be `http://validator.${process.env.COPILOT_SERVICE_DISCOVERY_ENDPOINT}`

    *   Deploy the changes:

            copilot svc deploy -n api

*   Invoke your updated API server (replace `AWS_URL` with your Load Balanced Web Service URL):

        curl -X POST http://<AWS_URL>/v1/content

    > Tip: To get info about a service, run `copilot svc show`.

*   Check the logs of the _TMS Validator_ service to see that it's handled a request from _TMS API_:

        copilot svc logs -n validator

## Exercise 3: PubSub
In this exercise, a [Worker Service](https://aws.github.io/copilot-cli/docs/concepts/services/#worker-service) for processing content requests is created and deployed.

The _TMS API_ service will be modified to act as the _publisher_ of content requests.

### Worker Service (subscriber)
In `modules/processor`, use the sample code in the [documentation](https://aws.github.io/copilot-cli/docs/developing/publish-subscribe/#javascript-example_1) as a starting point in (copy and paste it into `src/index.js`).

> Remember to change to your region!

> Notice the `COPILOT_QUEUE_URI` environment variable - this is the address of the queue from which content requests are be consumed and processed (it's also available via `env.queueUrl` - see `src/env.js`).

The subscriber sample code currently does not run repeatedly to consume requests from the queue (it does so only once). 

Implement continuous request processing in `src/index.js`:

*   After creating the SQS `client` object, refactor the sample code by creating the following function called `processor`:

    ```
    const client = new SQSClient({ region: "eu-north-1" });

    // ...

    const running = true;
    const stopRunning = () => {
        console.log('Exiting polling loop');
        running = false;
    }

    process.on('SIGINT', stopRunning);
    process.on('SIGTERM', stopRunning);

    const processor = async () => {
        while (running) {
            // TODO 1. Send ReceiveMessageCommand.

            if (out.Messages === undefined || out.Messages.length === 0) {
                // note: continue instead of return! 
                continue;
            }
            
            for (const message of out.Messages) {
                const {
                    Body,
                    ReceiptHandle
                } = message;

                const body      = JSON.parse(Body);
                const requestId = body.Message;

                // ...
                // Process message.
                console.log('Processing request with ID: ' + requestId);

                // TODO 2. Send DeleteMessageCommand to instruct the queue the this message has been handled and can be removed.
            } 
        }
    }

    processor();
    ```

*   Implement the TODOs in the `processor` function.

To test the processor locally:

*   Create a new SQS queue using the AWS Console.

*   Copy the queue URI; in `src/env.js`, add the following:

        ```
        module.exports = {
            queueUrl: process.env.QUEUE_URI ?? queueUrl
        };
        ```

*   Install dependencies and then run the processor:

        npm install @aws-sdk/client-sqs

        QUEUE_URI=<queue URI> node src/index.js
        
*   In the AWS Console, send a message to the queue with the following body:

        {"Message":"1234"}

    The processor should log the received message.

### TMS API (publisher)
Add the following to `copilot/api/manifest.yml` to allow the _TMS API_ to publish requests to the queue (see more [here](https://aws.github.io/copilot-cli/docs/developing/publish-subscribe/#sending-messages-from-a-publisher)):

    publish:
        topics:
            - name: requestsTopic

In `modules/api`:

*   Install AWS SNS dependency:

        npm install @aws-sdk/client-sns

*   Modify `src/env.js` to parse and export the name of the topic (also an environment variable):

        const {
            requestsTopic
        } = JSON.parse(process.env.COPILOT_SNS_TOPIC_ARNS);

        // ...
        
        module.exports = {
            port,
            requestsTopic // <---
        };

*   In `src/routes.js`, for the POST route, publish a request to the queue using the [documentation's sample code](https://aws.github.io/copilot-cli/docs/developing/publish-subscribe/#javascript-example) as a starting point.

    > Remember to change the SNS client to be your region!

    > Instead of the `Message` being `"hello"`, set it to a randomly generated request ID:

        const crypto = require('crypto');
        
        // ...
        
        // before publishing a request message, generate a random request ID.
        const requestId = crypto.randomUUID();
        

    > Hint: The `JSON.parse(process.env.COPILOT_SNS_TOPIC_ARNS)` is already being done in `src/env.js`; change the value of Message to publish from `'hello'` to the newly generated random request ID.

### Deployment
In the **project root** folder, deploy the changes to the _TMS API_ service:

    copilot svc deploy --name api

Add the new `processor` Worker Service:

    copilot svc init --name processor --svc-type "Worker Service" --dockerfile ./modules/processor/Dockerfile

> Make sure that the suggested `requestsTopic` is selected!

    copilot svc deploy --name processor

After deployment, follow the logs of the `processor` Worker Service in realtime:

    copilot svc logs -n processor --follow

When POSTing a new content request, you should see the `processor` Worker Service logging the request ID after a little while.

## Exercise 4: Jobs
In this exercise, a [Scheduled Job](https://aws.github.io/copilot-cli/docs/concepts/jobs/) (or "job" for short) that acts as a content request _poller_ is created and deployed.

A job is code that runs periodically:

```javascript
const job = () => {
    console.log('Running job @ ' + new Date());
}

job();
```

In the **project root** folder, create a `Schedule Job`:

    copilot job init --name poller --dockerfile ./modules/poller/Dockerfile

The job should run using a __rate__ of __every three (3) minutes__.

Deploy the job:

    copilot job deploy --name poller

Follow the job's logs to see its "runs":

    copilot job logs --follow

### Retries (Optional)
A job can fail, e.g. by an uncaught error, but be retried a specified number of times.

Add code to the empty `job` function in `src/index.js` to fail ~ half the times the job is run.

Add `3` [retries](https://aws.github.io/copilot-cli/docs/manifest/scheduled-job/) to the `poller` manifest.

Redeploy the job.

In the AWS Console, navigate to __Step Functions__ and inspect the state machine for the poller; More details about a job's executions (and whether it has failed and retried) can be found under __Logging__.
