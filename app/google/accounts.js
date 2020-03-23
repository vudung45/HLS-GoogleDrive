import {google}  from 'googleapis';
import rp from "request-promise"
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import retry from 'async-retry';
import  {EventEmitter} from  'events';

import Media from "../utils/media.js"
import { retryableAsync } from "../utils/helper.js";


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryApi(apiCoroutine) {
    return await retry(async bail => {
        let error = null;
        const res = await apiCoroutine.catch(e => {
            error = e;
        });
        if(error) {
            // if(error.code !== 403  || error.code !== 500) {
            //     bail(error);
            //     return;
            // }
            throw error;
        }
        return res;
    }, {retries: 5, minTimeout: 2000, maxTimeout: 10000});
}

const DELAY_TIME = 100; // 100ms

export class Account {
    constructor(identifier, authClient) {
        this.identifier = identifier;
        this.authClient = authClient;
        this.drive_v3 = google.drive({version: 'v3', auth: this.authClient});
        this.needUpdate = true;
        this.metadata = {
            "limit": 0,
            "usage": 0,
            "usageInDrive": 0,
            "usageInDriveTrash": 0
        }
        this.lastApiCall = Date.now();
    }


    async genAPIHeaders() {
        const token = await this.authClient.authorize();
        return {
            "Accept": "application/json",
            "Authorization": "Bearer "+token.access_token
        }
    }


    async uploadFile(media) {
        while(Date.now() - this.lastApiCall < DELAY_TIME) {
            await sleep(Math.max(0, DELAY_TIME - Date.now() + this.lastApiCall));
        }

        this.lastApiCall = Date.now();
        let uploadResp = await retryApi(this.drive_v3.files.create({
            resource: {
                "name": media.name
            },
            media: media.payload(),
            fields: "id"
        })).catch(e => console.error(e));
        
        this.needUpdate = true;

        if(!uploadResp || !uploadResp.data || !("data" in uploadResp) || !("id" in uploadResp.data)) {
            throw "Failed to upload file";
            return null;
        }

        return uploadResp.data.id;
    }

    async getFile(fileId) {
        let getResp = await retryApi(this.drive_v3.files.get({
            fileId: fileId
        })).catch(e => console.error(e));

        if(!getResp)
            throw "Failed to get fileId "+fileId

        return getResp;
    }

    async copyFile(fileId) {
        
    }


    async updateFilePermission(fileId, permission = {"role": "reader","type": "anyone"}) {
        while(Date.now() - this.lastApiCall < DELAY_TIME) {
            await sleep(Math.max(0, DELAY_TIME - Date.now() + this.lastApiCall));
        }

        this.lastApiCall = Date.now();

        return await retryApi(this.drive_v3.permissions.create({
                requestBody: permission,
                fileId: fileId
        })).catch(e => console.error(e));
    }

    async updateMetadata() {
        if(!this.needUpdate)
            return;

        while(Date.now() - this.lastApiCall < DELAY_TIME) {
            await sleep(Math.max(0, DELAY_TIME - Date.now() + this.lastApiCall));
        }

        this.lastApiCall = Date.now();

        // for some reason, has to invoke this everytime
        let apiResp = await retryApi(this.drive_v3.about.get({
                          fields: "storageQuota"
                      })).catch(e=> console.error(e));


        if(!apiResp || !apiResp.data || !apiResp.data.storageQuota) {
            console.log(apiResp);
            return;
        }

        this.needUpdate = false;
        this.metadata = apiResp.data.storageQuota;
    }

    valueOf() {
        return this.metadata.limit - this.metadata.usage;
    }

    hashCode() {
        return this.identifier.hashCode();
    }

    toString() {
        return this.identifier;
    }
    
}

class QueueJob {
    constructor(jobName, aux, jobId, sessionId = null) {
        this.jobName = jobName;
        this.aux = aux;
        this.jobId = jobId;
        this.sessionId = sessionId;
    }
}

class JobResponse {
    constructor(response, error) {
        this.response = response;
        this.error = error;
    }
}

const BATCH_SIZE = 10; // process 10 jobs at a time
const BATCH_DELAY = 5000; // delay 1 seconds in between batches

/* Managing multiple service accounts */
export class AccountManager {
    constructor(accounts=[]) {
        this.accounts = {}
        accounts.forEach((acc) => {
            accounts[acc.identifier] = acc;
        });
        this._jobQueue = []; // to avoid google drive rate limit
        this._eventEmitter = new EventEmitter();
        this.jobResponse = {}
        this._last_updates = {}
        this.stopRoutine = false;
        this._processJobsRoutine();
    }

    async _processJobsRoutine(){
        while(!this.stopRoutine) {
            let jobsToExecute = this._jobQueue.splice(0, BATCH_SIZE);
            try {
                let routines = jobsToExecute.map(job => {
                        return this["_"+job.jobName](job.aux)
                                    .then(r => {
                                        this.jobResponse[job.jobId] = new JobResponse(r, null); 
                                        this._eventEmitter.emit("jobFinish");
                                    })
                                    .catch(e => {
                                        this.jobResponse[job.jobId] = new JobResponse(null, e); 
                                        this._eventEmitter.emit("jobFinish");
                                    });
                        });
                await Promise.all(routines).catch(e => console.error(e)); // this shouldn't throw any error thou
            } catch (e) {
                console.error(e);
            }
            await sleep(Math.max(100, BATCH_DELAY * jobsToExecute.length / BATCH_SIZE));
        }
    }

    removeQueueJobs(sessionId) {
        if(!sessionId)
            throw "Please provide sessionid";

        let cancelJobs = [];
        this._jobQueue = this._jobQueue.filter(job => { 
            if(job.sessionId != sessionId)
                return true;

            cancelJobs.push(job);
            return false;
        });
        console.log("Cancelling jobs: "+cancelJobs.map(job => job.jobId));
        cancelJobs.forEach(job => this._eventEmitter.emit("jobCancel", job.jobId));
    }

    uploadFile(media,  uploadSessionId=null, permission={"role": "reader","type": "anyone"}) {
        let jobId = uuidv4();
        let job = new QueueJob("uploadFile", {media: media, permission: permission}, jobId, uploadSessionId);
        this._jobQueue.push(job);
        return new Promise((resolve, reject) => {
            let finishListener = () => {
                if(jobId in this.jobResponse) {
                    this._eventEmitter.off("jobFinish", finishListener);
                    if(this.jobResponse[jobId].error) {
                        console.error("Failed to upload file");
                        reject(this.jobResponse[jobId].error);
                    } else {
                        console.log("Done uploading file");
                        resolve(this.jobResponse[jobId].response);
                    }

                }
            }
            let cancelListener = (cancelId) => {
                if(jobId === cancelId) {
                    this._eventEmitter.off("jobCancel", cancelListener);
                    console.log("Cancelled upload jobId "+jobId);
                    reject(jobId+" was cancelled.");
                }
            }
            this._eventEmitter.on("jobFinish", finishListener);
            this._eventEmitter.on("jobCancel", cancelListener);
        });
    }


    async _uploadFile(aux) {
        aux = {
            ...aux,
            permission: {
                "role": "reader",
                "type": "anyone", 
                ...(aux.permission ? aux.permission : {})
            }
        }
        let availableAccount = await this.getMostAvailableStorageAccount().catch(e => console.error(e));

        if(!availableAccount)
            throw "No available accounts";

        let googleFileId = await availableAccount.uploadFile(aux.media).catch(e => console.error(e));
        if(!googleFileId)
            throw "Failed to upload";

        if(!(await availableAccount.updateFilePermission(googleFileId, aux.permission).catch(e => console.error(e))))
            throw "Failed to upload file permission";

        return googleFileId;
    }

    addAccount(account) {
        if(account.identifier in this.accounts)
            return account.identifier;

        this.accounts[account.identifier] = account;

        return account.identifier;
    } 

    stop() {
        this.stopRoutine = true;
    }

    async updateAccountsMetadata() {
        let routines = Object.values(this.accounts).map(acc => {
            return acc.authClient.updateMetadata().catch(e => console.log(e));
        });

        await Promise.all(routines);
    }   

    async getMostAvailableStorageAccount() {
        let updateRoutines = []
        for(const key of Object.keys(this.accounts))
            updateRoutines.push(this.accounts[key].updateMetadata().catch(e => console.error(e)));

        await Promise.all(updateRoutines).catch(e => console.error(e));
        return Object.values(this.accounts).sort()[0];
    }
 }


