import express from "express";
import { FileUploader } from "../../../files_manager/uploader.js";
import GoogleCredentialsConfig from "../../../configs/googlecredentials.js";
import MONGODB_CREDENTIALS from "../../../credentials/mongodb.js";
import MongoDBModels from "../../../database/models.js";
import { JobManager, JobStatus } from "../../../workers/jobs_manager.js";


const router = express.Router();
const MONGODB_MODELS = new MongoDBModels(MONGODB_CREDENTIALS.loginURI, MONGODB_CREDENTIALS.dbName);
const JOB_MANAGER = new JobManager(MONGODB_CREDENTIALS.loginURI, MONGODB_CREDENTIALS.dbName);
router.use(express.json());

// https://developer.apple.com/documentation/http_live_streaming/hls_authoring_specification_for_apple_devices#//apple_ref/doc/uid/DTS40009745-CH1-ENCODEYOURVARIANTSs
const HLS_RESOLUTION = {
    "1080p": {
        inputOptions: {},
        outputOptions: {
            "c:a": "copy",
            "c:v": "libx264",
            "s": "1920x1080",
            //"b:a": "64000",
            "b:v": "7800000",
            "crf": 23,
            "f": "hls",
            "hls_time": 6,
            "hls_list_size": 0,
            "preset": "veryfast"
        }
    },
    "720p": {
        inputOptions: {},
        outputOptions: {
            "c:a": "copy",
            "c:v": "libx264",
            "s": "1280x720",
            //"b:a": "64000",
            "b:v": "4500000",
            "crf": 23,
            "f": "hls",
            "hls_time": 6,
            "hls_list_size": 0,
            "preset": "veryfast"
        }
    },
    "360p": {
        inputOptions: {},
        outputOptions: {
            "c:a": "copy",
            "c:v": "libx264",
            "s": "640x360",
            //"b:a": "64000",
            "b:v": "365000",
            "crf": 23,
            "f": "hls",
            "hls_time": 6,
            "hls_list_size": 0,
            "preset": "veryfast"
        }
    },
    "original": {
        inputOptions: {},
        outputOptions: {
            "c:a": "copy",
            "c:v": "copy",
            "f": "hls",
            "hls_time": 6,
            "hls_list_size": 0,
        }
    }
}

router.get("/get", async (req, res) => {
    try {
        if (req.query.jobId) {
            let jobMetadata = await JOB_MANAGER.getJob("hls_converter", req.query.jobId).catch(e => console.log(e));
            if(!jobMetadata) {
                res.status(404).json({
                    status: 0,
                    error: "Failed to retrieve job!"
                });
                return;;
            }
            res.json(jobMetadata);
        } else {
            throw "Missing param url";
        }
    } catch (e) {
        res.status(404).json({
            status: 0,
            error: e.toString()
        });
    }
});

router.get("/getConversionJobs", async (req, res) => {
    try {
        if(!req.query.fileId && !req.query.uploadId){
            res.status(501).json({
                status: 0,
                error: "Missing argumetns"
            });
            return;
        }

        let fileId = req.query.fileId;
        if(!fileId && req.query.uploadId) {
            let uploadDoc = await MONGODB_MODELS.uploadsCollection.get(req.query.uploadId).catch(e => console.error(e)); 
            if(!uploadDoc) {
                res.status(404).json({
                    status: 0,
                    error: "Can't retrieve metadata for uploadId "+req.query.uploadId
                });
                return;
            }
            fileId = uploadDoc.fileId.toString();
        }

        try {
            let conversionDocs = (await MONGODB_MODELS.getConversionJobs(fileId)).filter(doc => doc.conversionType === "hls");
            return res.json({
                status:1,
                response: conversionDocs
            })
        } catch(e){
            console.log(e);
            res.status(500).json({
                    status: 0,
                    error: e
            });
            return;
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({
            status: 0,
            error: "Something went wrong!"
        });
    }
});


router.post("/create", async(req, res) => {
    try {
        console.log(req.body)
        let json = req.body;
        let fileId = json.fileId;
        let resolution = json.resolution;
        if(!fileId || !resolution) {
            res.status(501).json({
                status: 0,
                error: "Missing arguments"
            });
            return;
        }

        if(!(resolution in HLS_RESOLUTION)){
            res.status(501).json({
                status: 0,
                error: "Resolution "+resolution+" is not supported!"
            });
            return;
        }
        let fileDoc = await MONGODB_MODELS.filesCollection.getFile(fileId).catch(e => console.error(e));
        if(!(fileDoc)) {
            res.status(404).json({
                status: 0,
                error: "Failed to retrieve metadata for fileId: "+ fileId
            });
            return;
        }

        let inputOptions = HLS_RESOLUTION[resolution].inputOptions;
        inputOptions["f"] = fileDoc.fileType; //set file type
        let outputOptions = HLS_RESOLUTION[resolution].outputOptions;

        // use identifer to avoid creating the same job twice
        let identifier = JSON.stringify(inputOptions)+"_"+JSON.stringify(outputOptions);
        let jobDoc = await JOB_MANAGER.addJob("hls_converter", 
                    {
                        originalFile: fileId, 
                        identifier: identifier,
                        aux: {
                            label: resolution,
                            inputOptions: inputOptions, 
                            outputOptions: outputOptions
                        }
                    }).catch(e => console.error(e));

        if(!jobDoc) {
            res.status(500).json({
                status: 0,
                error: "Something went wrong! Failed to create new job"
            });
            return;
        }

        res.json({
            status: 1,
            response: jobDoc
        });
    } catch (e) {
        console.log(e);
        res.status(500).json({
            status: 0,
            error: "Something went wrong"
        });
    }

});

router.post("/start", async (req, res) => {
    try {
        if (!req.body.jobId) {
            res.status(501).json({
                status: 0,
                error: "Missing arguments"
            });
            return;
        }
        let jobMetadata = await JOB_MANAGER.getJob("hls_converter", req.body.jobId).catch(e => console.log(e));
        if(!jobMetadata) {
            res.status(404).json({
                status: 0,
                error: "Failed to retrieve metadata for jobId: "+ req.body.jobId
            });
            return;
        }

        if(jobMetadata.status == 2) {
            res.json({
                status: 1,
                message: "Job " + req.body.jobId +" has already finished successfully!"
            });
            return;
        }

        // if(jobMetadata.queueStatus && jobMetadata.queueStatus.state != JobStatus.FAILED_COMPLETELY) {
        //     res.json({
        //         status: 1,
        //         message: "Job " + req.body.jobId +" is already running!"
        //     });
        //     return;
        
        // }

        if(!(await JOB_MANAGER.startJob("hls_converter", req.body.jobId).catch(e => console.error(e)))) {
            res.status(500).json({
                status: 0,
                error: "Failed to start job "+ req.body.jobId
            });
            return;
        }

        res.json({
            status: 1,
            message: "Start job " + req.body.jobId +" successfully!"
        });
        
    } catch (e) {
        res.status(404).json({
            status: 0,
            error: "Invalid data"
        });
    }
});

module.exports = router;