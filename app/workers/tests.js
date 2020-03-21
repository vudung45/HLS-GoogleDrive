import Queue from 'bull';

import {ConvertHLSJob} from "./job.js";
import MongoDBModels from "../database/models.js";
import MONGODB_CREDENTIALS from "../credentials/mongodb.js";
import { JobManager } from "./jobs_manager.js";

// Connect to a local redis intance locally, and the Heroku-provided URL in production

(async function() {
    // Create / Connect to a named work queue
    const jobManager = new JobManager(MONGODB_CREDENTIALS.loginURI, MONGODB_CREDENTIALS.dbName);
    await jobManager.addJob("hls_converter", {originalFile: "5e674d69918eb86db5c44a4b",  aux: {inputOptions: {}, outputOptions: {}}}).catch(e => console.log(e));
    await jobManager.close();
    return;
})();