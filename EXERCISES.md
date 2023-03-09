# Exercises
Description of exercises for the _Translation Management Systems (TMS)_ sample application.

**Make sure to read and follow the instructions for each exercise carefully!**

## Aborting Deployment
If an error occurs while deploying code with the AWS Copilot CLI, **do not** Ctrl+C to abort the procedure!

E.g., an error might occur while starting up new instances, and Copilot will try up to ten times before aborting, but this takes a significant time.

You can change the state of deployment by setting the number of running instances to zero (and thereby trigger a safe abort) as follows:

*   In the AWS Console, go to **ECS**.

*   Navigate to **Clusters** and choose your cluster.

*   Scroll down to the section named **Services** and select the service that is failing to deploy.

*   On the service page, click on the button **Update service**.

*   In the field **Desired tasks**, specify _0_.

*   Scroll down and click the **Update** button.

After a while, your deployment in the terminal will abort successfully; fix the breaking code and deploy again.

## Exercise 1: TMS API 
In this exercise, an AWS Copilot [Load Balanced Web Service](https://aws.github.io/copilot-cli/docs/concepts/services/#load-balanced-web-service) for the _TMS API_ is created and deployed.

A basic API server exists in `modules/api` with the following endpoints defined in `modules/api/src/routes.js`:

    GET   /v1/status/:requestId
    GET   /v1/content/:requestId
    POST  /v1/content

> All routes just return a (dummy) response of 'OK' for now.

A Load Balanced Web Service must support _health checks_ and handle shutdowns gracefully:

*   Add a health check route for `GET /` that simply responds with 200 OK.

> Note: In `module/api/src/index.js`, add the health check route route _just after mounting the `/v1` routes_.

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

*   Verify that the API server works by sending a request to one of the endpoints.

*   Stop the container by running:

        docker stop <CONTAINER_ID>

    > Get the CONTAINER_ID via `docker ps`.

*   Check that the API server was shut down gracefully:

        docker logs <CONTAINER_ID>

*   Remove the container and image (locally):

        docker rm <CONTAINER_ID>
        docker rmi tms-api:v1

### Deployment
Create a Copilot application by running:

    copilot app init

in the **project root folder** and following the instructions.

> Note: The name of the _application_ should be `tms`.

Next, create and deploy a **test** environment for our application:

    copilot env init --name test

> Select your _default_ AWS profile when prompted.

    copilot env deploy --name test

Next, create the _TMS API_ service:

    copilot svc init --name api --svc-type "Load Balanced Web Service" --dockerfile modules/api/Dockerfile

Finally, run:

    copilot svc deploy --name api

Test the API running on AWS by invoking the Load Balanced Web Service URL (see the aforementioned API endpoints).

### Optional
Currently, the API is only supported by a single instance, and therefore incoming traffic is _not being load balanced_.

[Increase the number of instances](https://aws.github.io/copilot-cli/docs/manifest/lb-web-service/#count) to _two_ and (re)deploy.

Send a number of requests to (= "load test") the Load Balanced Web Service URL and then study the resulting metrics for in the AWS Console under **ECS** - is your traffic being load balanced across the two service instances?

> [Here](https://gist.github.com/Buthrakaur/376e0c05729ac6969e93) is a gist for a Powershell script you can adapt for sending repeated requests. 

## Exercise 2: Service-to-Service Communication
In this exercise, an AWS Copilot [Backend Service](https://aws.github.io/copilot-cli/docs/concepts/services/#backend-service) for the _TMS Validator_ service is created and deployed.

The _TMS Validator_ service will be invoked directly (synchronously) by the _TMS API_.

In the `modules/api` folder:

*   In the route for `POST /v1/content`, use the `superagent` library - don't forget to `require` (import) it - to make a POST call to the _TMS Validator_ service.

    > Note 1: The URL of the _TMS Validator_ service will be: `http://validator`.

    > Note 2: Use the [async/await](https://ladjs.github.io/superagent/#promise-and-generator-support) variant of calling `superagent`.

In `modules/validator/src/index.js`, add a health check and SIGTERM handling, just like you did for the _TMS API_ service in the previous exercise. 

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

        copilot svc init --name validator --svc-type "Backend Service" --dockerfile modules/validator/Dockerfile 

*   Deploy the _TMS Validator_ service:

        copilot svc deploy --name validator

*   Make the following changes to _TMS API_:

    *   The URL of the _TMS Validator_ service must now be `http://validator.${process.env.COPILOT_SERVICE_DISCOVERY_ENDPOINT}`

    *   Deploy the changes:

            copilot svc deploy --name api

*   Invoke your updated API server (replace `AWS_URL` with your Load Balanced Web Service URL):

        curl -X POST http://<AWS_URL>/v1/content

    > Tip: To get info about a service, run `copilot svc show`.

*   Check the logs of the _TMS Validator_ service to see that it's handled a request from _TMS API_:

        copilot svc logs --name validator

## Exercise 3: PubSub
In this exercise, a [Worker Service](https://aws.github.io/copilot-cli/docs/concepts/services/#worker-service) for processing content requests is created and deployed.

The _TMS API_ service will be modified to act as the _publisher_ of content requests.

### TMS Processor (Worker Service / subscriber)
The sample code in the [documentation](https://aws.github.io/copilot-cli/docs/developing/publish-subscribe/#javascript-example_1) illustrates how to implement a SQS subscriber.

> Make sure you change the region to match yours!

> Notice the `COPILOT_QUEUE_URI` environment variable - this is the address of the queue from which content requests are be consumed and processed (it's also available via `env.queueUrl` - see `modules/processor/src/env.js`).

The sample code in the documentation currently does not run repeatedly to consume requests from the queue (it does so only once). Implement continuous request processing in `modules/processor/src/index.js` as follows:

*   Use the following code as a starting point:

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

*   Create a new SQS queue using the AWS Console; copy the queue URI (referred to as `<MY_QUEUE_URI>` below).

*   Run the processor:

        COPILOT_QUEUE_URI=<MY_QUEUE_URI> node src/index.js

    > Windows Powershell: `$env:COPILOT_QUEUE_URI="<MY_QUEUE_URI>"`
        
*   In the AWS Console, send a message to the queue with the following body:

        {"Message":"1234"}

    The processor should log the received message.

### TMS API (publisher)
Modify `copilot/api/manifest.yml` to allow the _TMS API_ to publish requests to the queue (see more [here](https://aws.github.io/copilot-cli/docs/developing/publish-subscribe/#sending-messages-from-a-publisher)):

> Name your topic __requestsTopic__.

In `modules/api`:

*   Modify `modules/api/src/env.js` to parse and export the name of the topic (also an environment variable):

        const {
            requestsTopic
        } = JSON.parse(process.env.COPILOT_SNS_TOPIC_ARNS);

        // ...
        
        module.exports = {
            port,
            requestsTopic // <---
        };

*   In `modules/api/src/routes.js`, for the POST route, publish a request to the queue using the [documentation's sample code](https://aws.github.io/copilot-cli/docs/developing/publish-subscribe/#javascript-example) as a starting point.

    > Remember to change the SNS client to be your region!

    > Instead of the `Message` being `"hello"`, set it to a randomly generated request ID; use the built-in [crypto.randomUUID](https://nodejs.org/api/crypto.html#cryptorandomuuidoptions) method for this.

    > Note: The `JSON.parse(process.env.COPILOT_SNS_TOPIC_ARNS)` is already being done in `modules/api/src/env.js`; change the value of Message to publish from `'hello'` to the newly generated random request ID.

### Deployment
In the **project root** folder, deploy the changes to the _TMS API_ service:

    copilot svc deploy --name api

Add the new `processor` Worker Service:

    copilot svc init --name processor --svc-type "Worker Service" --dockerfile modules/processor/Dockerfile

> Make sure that the suggested `requestsTopic` is selected - marked as [x]!

    copilot svc deploy --name processor

After deployment, follow the logs of the `processor` Worker Service in realtime:

    copilot svc logs --name processor --follow

When POSTing a new content request, you should see the `processor` Worker Service logging the request ID after a little while.

## Exercise 4: Persistence, Jobs and Secrets
In this exercise, we'll add:

*   Persistence of content requests via MongoDB.

*   A [Scheduled Job](https://aws.github.io/copilot-cli/docs/concepts/jobs/) (or "job" for short) for updating content requests.

*   External configuration (via secrets).

> Ensure that a MongoDB database exists with a collection named `content_requests`, and that you've noted the database name and connection string.

### Create Job
A job is code that runs periodically; for the _TMS Poller_, it looks as follows:

```javascript
// modules/poller/src/index.js
const env = require('./env');
const dba = require('./db');

dba.init(env.dbUrl, env.dbName);

const job = async () => {
    const db = await dba.open();
    await dba.setStatusCompleted(db);
    await dba.close(); 
}

job();
```

In the **project root** folder, create a `Scheduled Job`:

    copilot job init --name poller --dockerfile modules/poller/Dockerfile

> Note: Just select a __Fixed Schedule__ of _Hourly_.

As you'll _manually_ run the job, open `copilot/poller/manifest.yml` and change the schedule to:

    on:
        schedule: "none"

### Environment Variables
Notice that a database name `env.dbName` and connection string `env.dbUrl` are used to open a connection to the database.

The values are passed to the job via environment variables; export these from `modules/poller/src/env.js`:

```javascript
const dbUrl 
    = env.get('DB_URL').required().asString();
        
const dbName 
    = env.get('DB_NAME').required().asString();

modules.exports = {
    dbName,
    dbUrl
};
```

### External Configuration
The database name and connecting string are values configured externally and set in the `copilot/poller/manifest.yml`:

`DB_NAME` is set directly as an environment variable in the manifest:

    variables:
        DB_NAME: <database name>

`DB_URL` is a secret stored in AWS SSM; create a new secret named `dbUrl` with the value set to the connection string:

    copilot secret init

Then add the following to the manifest:

    secrets:                      
        DB_URL: /copilot/${COPILOT_APPLICATION_NAME}/${COPILOT_ENVIRONMENT_NAME}/secrets/dbUrl
    
This becomes the correspondingly named environment variable used in the code.

### Deployment
Deploy the job:

    copilot job deploy --name poller

See the job's logs:

    copilot job logs --follow

To test the job, create a sample document for a content request in the MongoDB `content_requests` collection:

```javascript
{ 
    id: "ab86d1f414-9d4d-4bab-8ae3-be30959454b7",
    status: "pending" 
}
```

Run:

    copilot job run

You should see the status changed to `completed`.

### Update TMS Services (Optional)
The _TMS API_ and _TMS Processor_ services must be updated to also handle persistence of content requests.

For the _TMS API_:

*   Use the `newContentRequest` database method (see `modules/api/src/db/operations.js`) to create a new content request (before SNS publishing), with the content request ID already being generated.

*   Perform the steps in the section **Environment Variables** above (but in `modules/api/src/env.js`).

*   Update `copilot/api/manifest.yml`:

        variables:
            DB_NAME: <database name>    

        secrets:                      
            DB_URL: /copilot/${COPILOT_APPLICATION_NAME}/${COPILOT_ENVIRONMENT_NAME}/secrets/dbUrl

Deploy the updated _TMS API_:

    copilot svc deploy --name api

For the _TMS Processor_:

*   Use the `setStatusPending` database method (see `modules/processor/src/db/operations.js`) to update a content request, with the content request ID received via an SQS message.

*   Perform the steps in the section **Environment Variables** above (but in `modules/processor/src/env.js`).

*   Update `copilot/processor/manifest.yml`:

        variables:
            DB_NAME: <database name>    

        secrets:                      
            DB_URL: /copilot/${COPILOT_APPLICATION_NAME}/${COPILOT_ENVIRONMENT_NAME}/secrets/dbUrl

Deploy the updated _TMS Processor_:

    copilot svc deploy --name processor

## Exercise 6: Pipeline
In this exercise, you will create an automated [pipeline](https://aws.github.io/copilot-cli/docs/concepts/pipelines/) to build and deploy services to your _test_ environment.

In the **project root**, run:

    copilot pipeline init --name tms-pipeline

> Choose **Workloads** as the pipeline type, and **test** for your environment.

Commit and push the changes (a `copilot/pipelines` folder has been added) to the repo.

Run:

    copilot pipeline deploy

The connection between AWS and Github needs to be completed:

*   Navigate to https://console.aws.amazon.com/codesuite/settings/connections

*   Click "Update pending connection" and follow the steps.

To test the pipeline, make a change to a source file in any of the modules, then commit and push the change; to follow the pipeline status, run:

    copilot pipeline status

You can also follow the progress in the AWS Console, go to **CodePipeline**.

## Cleanup
When finished with the exercise, remove the application and all deployed resources by running the following in the **project root**:

    copilot app delete