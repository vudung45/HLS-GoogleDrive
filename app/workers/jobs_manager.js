import Redis from "ioredis";
import Queue from 'bull';
import {ConvertHLSJob} from "./job";
import MongoDBModels from "../database/models.js"


// var client = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
// var subscriber = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

// var opts = {
//   createClient: function (type) {
//     switch (type) {
//       case 'client':
//         return client;
//       case 'subscriber':
//         return subscriber;
//       default:
//         return new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
//     }
//   }
// }

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const QUEUES_SETTINGS = {
    "hls_converter": {
        jobConstructor: ConvertHLSJob,
        dbModel: "conversionsCollection" // this._models["conversionCollection"]
    }
}

const SINGLETON = {

}

export const JobStatus = {
    ACTIVE: "active",
    COMPLETED: "completed",
    FAILED_RETRYING: "failed-retrying",
    FAILED_COMPLETELY: "failed-completely",
    UNKNOWN: "unknown",
}

export  class JobManager {
    constructor(mongoURI, db="hls") {
        if(SINGLETON[mongoURI+"_"+db])
            return SINGLETON[mongoURI+"_"+db];

        this._mongoURI = mongoURI;
        this._db = db;
        this._models = new MongoDBModels(mongoURI, db);
        this.queues = {}
        Object.keys(QUEUES_SETTINGS).forEach(k => this.queues[k] = new Queue(k, REDIS_URL));
        SINGLETON[mongoURI+"_"+db] = this;
        return this;
    }

    async addJob(queueName, options) {
        if(!(queueName in this.queues))
            throw queueName+" is not in supported job types";

        let queue = this.queues[queueName];
        let jobConstructor = QUEUES_SETTINGS[queueName].jobConstructor;
        let job = new jobConstructor(options);
        if(!(await job.verifyInputs({models: this._models}))) {
            throw "Failed to verify options"
        }
        let jobDoc = null;
        if(!job.isUnique())
            jobDoc = await this._models[QUEUES_SETTINGS[queueName].dbModel].add(job.payload()).catch(e => console.error(e));
        //if an identifier is defined, this means that this job has an unique identifier
        else {
            jobDoc = await this._models[QUEUES_SETTINGS[queueName].dbModel].findOneAndUpdate(
                job.genSearchParamaters(), {
                    "$setOnInsert": job.payload()
                }, {new: true, upsert: true}).catch(e => console.error(e));
        }
        
        await queue.add({jobId: jobDoc._id}, {attempts:1, timeout: 60000*10, jobId: jobDoc._id.toString()});
        
        return jobDoc;
    }


    async startJob(queueName, jobId) {
        if(!(queueName in this.queues))
            throw queueName+" is not in supported job types";

        let queue = this.queues[queueName];
        let jobDoc = await this._models[QUEUES_SETTINGS[queueName].dbModel].get(jobId).catch(e => console.error(e));
        if(!jobDoc)
            throw "Failed to get metadata for jobId "+ jobId;

        // if the queueJob was not created then we create and start it
        let queueJob = null;
        if(!(queueJob = await queue.getJob(jobId))) {
            await this.addJob(queueName, {...JSON.parse(JSON.stringify(jobDoc)), _id:null});
            return jobDoc;
        }

        // retry
        if(await queueJob.getState() === "completed")  {
            await queueJob.remove();
            await queue.add({jobId: jobDoc._id}, {attempts:1, timeout: 60000*10, jobId: jobDoc._id.toString()});
            return jobDoc;
        }
        
        await queueJob.retry().catch(e => console.log(e));

        return jobDoc;
    }

    async emptyQueues() {
        for(const key of Object.keys(this.queues)) {
            console.log(await this.queues[key].empty());
        }
    }


    async getJob(queueName, jobId) {
        if(!(queueName in this.queues))
            throw queueName+" is not in supported job types";

        let queue = this.queues[queueName];
        let jobDoc = await this._models[QUEUES_SETTINGS[queueName].dbModel].get(jobId).catch(e => console.log(e));
        if(!jobDoc)
            throw "Failed to retrieve jobDoc";

        let queueStatus = null;
        let job = await queue.getJob(jobId);
        if(job) {
            let state = await job.getState().catch(e => { console.log(e); return JobStatus.UNKNOWN; });
            state = state == "failed" ? (job.attemptsMade >= job.opts.attempts ? JobStatus.FAILED_COMPLETELY : JobStatus.FAILED_RETRYING) : state;
            queueStatus = {
                state: state,
                progress: job._progress,
                logs: await queue.getJobLogs(jobId).catch(e => console.log(e))
            }
        }

        return {...JSON.parse(JSON.stringify(jobDoc)), queueStatus: queueStatus};
    }

    async close() {
        let routines = [];
        for(const key of Object.keys(this.queues)) {
            console.log("Closing queue: "+key);
            routines.push(this.queues[key].close());
        }
        await Promise.all(routines);
        delete SINGLETON[this._mongoURI+"_"+this._db];
        await this._models.close();
    }



}
