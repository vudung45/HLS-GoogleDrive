import express from "express";
import { FileUploader } from "../../../files_manager/uploader.js";
import GoogleCredentialsConfig from "../../../configs/googlecredentials.js";
import MONGODB_CREDENTIALS from "../../../credentials/mongodb.js";
import MongoDBModels from "../../../database/models.js";
import { JobManager, JobStatus } from "../../../workers/jobs_manager.js";
import request from "request";

const router = express.Router();
const MONGODB_MODELS = new MongoDBModels(MONGODB_CREDENTIALS.loginURI, MONGODB_CREDENTIALS.dbName);
const JOB_MANAGER = new JobManager(MONGODB_CREDENTIALS.loginURI, MONGODB_CREDENTIALS.dbName);
router.use(express.json());

router.get("/download", async (req, res) => {
    try {
        if (!req.query.chunkId) {
            res.status(501).json({
                status: 0,
                error: "Misising params"
            });
            return;
        }

        let chunkDoc = await MONGODB_MODELS.chunksCollection.getChunk(req.query.chunkId).catch(e => console.log(e));
        if(!chunkDoc) {
            res.status(404).json({
                status: 0,
                error: "Unable to retrieve metadata for fileId "+req.query.chunkId
            });
            return;
        }
        if(!chunkDoc.replicas || !chunkDoc.replicas.length) {
            res.status(404).json({
                status: 0,
                error: "This chunk has no replicas"
            });
            return;
        }
        let googleFileId = chunkDoc.replicas[0]; // just pick the first replica for now
        // request({
        //         uri: `https://drive.google.com/uc?id=${googleFileId}&export=download`,
        //         followAllRedirects: false,
        //         followRedirect: false,
        //         method: "HEAD",
        //     }, (err, resp, body) => {
        //         if(resp && resp.headers && resp.headers.location) {
        //             res.redirect(resp.headers.location);
        //         }
        //         else {
        //             res.status(500).json({
        //                 status: 0,
        //                 error: "Failed to get google drive direct download link"
        //             });
        //         }
                
        // });
        res.redirect("//images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&url="+encodeURIComponent(`https://drive.google.com/uc?id=${googleFileId}&export=download`));
    } catch (e) {
        console.log(e)
        res.status(500).json({
            status: 0,
            error: "Something went wrong!"
        });
    }
});

module.exports = router;