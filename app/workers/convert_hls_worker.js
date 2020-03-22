import  throng from 'throng';
import  Queue  from "bull";
import { MongoClient } from 'mongodb';
import fs from 'fs';

import { ChunksCollection } from "../database/chunks_collection.js";
import { AccountManager } from "../google/accounts.js";
import { FilesCollection, HLSFileMetadata, StorageType} from "../database/files_collection.js";
import { ConversionStatus } from "../database/conversions_collection.js";
import { generateAccounts } from "../google/utils/helper.js";
import {FileUploader} from "../files_manager/uploader.js";
import {ConvertHLSJob} from "./job.js";
import HLSConverter from "../media_utils/hlsconverter.js";
import MONGODB_CREDENTIALS from "../credentials/mongodb.js";
import GoogleCredentialsConfig from "../configs/googlecredentials.js";



// Connect to a local redis intance locally, and the Heroku-provided URL in production
let REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Spin up multiple processes to handle jobs to take advantage of more CPU cores
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
let workers = process.env.WEB_CONCURRENCY || 2;


// The maxium number of jobs each worker should process at once. This will need
// to be tuned for your application. If each job is mostly waiting on network 
// responses it can be much higher. If each job is CPU-intensive, it might need
// to be much lower.
let maxJobsPerWorker = 1;

var filesToCleanUp = [];

const FILE_UPLOADER =  new FileUploader(MONGODB_CREDENTIALS.loginURI, MONGODB_CREDENTIALS.dbName);


 function progressQueueItem(queueItem, value) {
    queueItem._progress = Math.min(100, queueItem._progress+value);
    queueItem.progress(queueItem._progress).catch(e => console.error(e));
}


async function convertAndUpload(src, fileType, fileUploader, inputOptions, outputOptions, jobDoc, queueItem) {
    let converter = new HLSConverter(src, inputOptions, outputOptions);
    let error = [];
    const filesCollection = fileUploader.filesCollection;
    const chunksCollection = fileUploader.chunksCollection;
    let chunkInfo;
    let routines = [];
    let chunkPaths = []
    let i = 0;
    while(!error.length && (chunkInfo = await converter.getNextProcessedChunk().catch(e => {console.log(e); error.push(e);}))) {
        progressQueueItem(queueItem, 1);
        console.log("Received a chunk from HLSConverter:");
        console.log(chunkInfo);
        routines.push(fileUploader.uploadChunk(fs.createReadStream(chunkInfo.chunkPath), {
            fileType: "hls-chunk",
            aux: {
                extinf: chunkInfo.extinf 
            }
        }).catch(e => {error.push(e); throw e}));
        chunkPaths.push(chunkInfo.chunkPath);
    }
    let chunks = await Promise.all(routines).catch(e => {console.log(e); error.push(e);});
    if(!chunks.length)
        error.push(new Error("Failed to chunkify this file. This could be due to failure to download"));

    filesToCleanUp.push(...chunkPaths);

    if(error.length)
        throw error;

    let file = await filesCollection.addFile(new HLSFileMetadata({
                    chunks: chunks.map(chunk => chunk._id),
                    storageType: StorageType.CONVERTED_FILE, 
                    aux: {
                        ...(jobDoc.aux ? jobDoc.aux : {}), 
                        "m3u8Header": converter.m3u8Header,
                        // if these information is not specified in outputOptions, then they should be the same as input bitrates
                        "videoBitrate": outputOptions["b:v"] ? parseInt(outputOptions["b:v"]) : converter.inputCodecData.videoBitrate,
                        "audioBitrate": outputOptions["b:a"] ? parseInt(outputOptions["b:a"]) : converter.inputCodecData.audioBitrate,
                        "resolution": outputOptions["s"] ? outputOptions["s"] : converter.inputCodecData.resolution
                    }
                }
               )).catch(e => {console.log(e); error.push(e);});
    if(error.length)
        throw error;

    console.log("Converted File: "+JSON.stringify(file));
    
    return file;
}

async function cleanupRoutine(){
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    while(true) {
        filesToCleanUp.forEach(f => {
            fs.unlink(f, (err) => {
                if(err) console.log(err);
                console.log("Cleaned up file: "+f);
            })
        });
        filesToCleanUp = [];
        await sleep(1000);
    }
}

async function processJob(jobDoc, fileUploader, queueItem) {
    let job = new ConvertHLSJob(jobDoc);
    const filesCollection = fileUploader.filesCollection;
    const chunksCollection = fileUploader.chunksCollection;

    let file = await filesCollection.getFile(job.originalFile, {populate: "chunks"}).catch(e => console.error(e));

    if(!file) {
        FILE_UPLOADER.models.conversionsCollection.update(jobDoc._id, {
            "$set": {
                "status": ConversionStatus.FAILED,
            },
            "$push": {
                "messages": "Error fetching original file data"
            }
        }).catch(e => console.error(e));
        queueItem.log("Error: Error fetching original file data").catch(e => console.error(e));
        throw "Error fetching original file data";
    }

    if(file.chunks.length != 1) {
        FILE_UPLOADER.models.conversionsCollection.update(jobDoc._id, {
            "$set": {
                "status": ConversionStatus.FAILED,
            },
            "$push": {
                "messages": "The chunk of this file has no replica"
            }
        }).catch(e => console.error(e));
        queueItem.log("Error: The chunk of this file has no replica").catch(e => console.error(e));
        throw "The chunk of this file has no replica";
    }

    let chunk = file.chunks[0];

    if(chunk.replicas.length == 0)  {
        FILE_UPLOADER.models.conversionsCollection.update(jobDoc._id, {
            "$set": {
                "status": ConversionStatus.FAILED,
            },
            "$push": {
                "messages": "The chunk of this file has no replica"
            }
        }).catch(e => console.error(e));
        queueItem.log("Error: The chunk of this file has no replica").catch(e => console.error(e));
        throw "The chunk of this file has no replica";
    }
    

    // just grab the first item for now, because usually these files shouldn't have replicas
    let googleFileId = chunk.replicas[0];
    progressQueueItem(queueItem, 10);
    console.log(`File to process: https://www.googleapis.com/drive/v3/files/${googleFileId}?alt=media&key=AIzaSyDPWehN3F84sGtK4d-gOg0Tqqq4pTDSGCA`);
    let hlsFile = await convertAndUpload(`https://www.googleapis.com/drive/v3/files/${googleFileId}?alt=media&key=AIzaSyDPWehN3F84sGtK4d-gOg0Tqqq4pTDSGCA`, 
                                          file.fileType, fileUploader, job.inputOptions, job.outputOptions, jobDoc, queueItem).catch(e => console.error(e));
    if(!hlsFile) {
        FILE_UPLOADER.models.conversionsCollection.update(jobDoc._id, {
                    "$set": {
                        "status": ConversionStatus.FAILED,
                    },
                    "$push": {
                        "messages": "Failed to convert file to HLS media type"
                    }
        }).catch(e => console.error(e));
        queueItem.log("Error: Failed to convert file to HLS media type").catch(e => console.error(e));
        throw "Failed to convert file to HLS media type";
    }
        
    progressQueueItem(queueItem, 100); //finish

    return await fileUploader.models.conversionsCollection.update(jobDoc._id, {
        "$set": {
            "status": ConversionStatus.READY,
            "convertedFile": hlsFile._id,
        }
    }).catch(e => {
        throw "Conversion completed, but failed to update convertedFile";
        console.log(e);
    });
}

function start() {
    cleanupRoutine().catch(e => console.error(e));
    // generate Accounts from config
    generateAccounts(GoogleCredentialsConfig.service_accounts).then( (accounts) => {
        // create AccountManager for all google service accounts we have
        let accountManager = new AccountManager();
        accounts.forEach(acc => {
            accountManager.addAccount(acc); // add each acc to AccountManager
        });            // Connect to the named work queue
        let workQueue = new Queue('hls_converter', REDIS_URL);
        FILE_UPLOADER.loadAccountManager(accountManager);
        workQueue.process(maxJobsPerWorker, async (queueItem, done) => {
            let jobDoc = await FILE_UPLOADER.models.conversionsCollection.get(queueItem.data.jobId).catch(e => console.error(e));
            console.log(jobDoc);
            if(!jobDoc) {
                queueItem.log("Error: Failed to retrieve jobDoc").catch(e => console.error(e));
                done(new Error("Failed to retrieve job metadata"));
                return;
            }

            //avoid double ready-processing
            if(jobDoc.status == ConversionStatus.READY) {
                queueItem.log("Finished! This job was processed before!").catch(e => console.error(e));
                done("Processing finished!");
                return;
            }

            jobDoc = await FILE_UPLOADER.models.conversionsCollection.update(jobDoc._id, {
                "$set": {
                    status: ConversionStatus.PROCESSING
                }
            })
            .catch(e => {
                FILE_UPLOADER.models.conversionsCollection.update(jobDoc._id, {
                    "$set": {
                        "status": ConversionStatus.FAILED,
                    },
                    "$push": {
                        "messages": e.toString()
                    }
                }).catch(e => console.error(e));
                console.error(e);
            });

            if(!jobDoc) {
                queueItem.log("Error: Failed to retrieve jobDoc").catch(e => console.error(e));
                done(new Error("Failed to retrieve jobDoc"));
                return;
            }

            progressQueueItem(queueItem, 10);
            let finishedConversion = await processJob(jobDoc, FILE_UPLOADER, queueItem).catch(e => console.error(e));
            if(!finishedConversion) {
                done("Error while converting to hls media type");
                return;
            }
            queueItem.log("Finished: Processing finished!").catch(e => console.error(e));
            done();
        });
    }).catch(e => console.error(e));

}

// Initialize the clustered worker process
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
throng({
    workers,
    start
});