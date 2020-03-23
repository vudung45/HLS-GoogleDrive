import express from "express";
import { FileUploader } from "../../../files_manager/uploader.js";
import GoogleCredentialsConfig from "../../../configs/googlecredentials.js";
import MONGODB_CREDENTIALS from "../../../credentials/mongodb.js";
import MongoDBModels from "../../../database/models.js";

const router = express.Router();
const MONGODB_MODELS = new MongoDBModels(MONGODB_CREDENTIALS.loginURI, MONGODB_CREDENTIALS.dbName);
router.use(express.json());

function generateM3U8Content(m3u8Header, chunks) {
    let lines = m3u8Header.split("\n");
    let content = m3u8Header + "\n";
    //generate extinfs
    chunks.forEach(chunk => {
        lines.push(`#EXTINF:${chunk.aux.extinf},`);
        lines.push(`/api/chunk/download?chunkId=${chunk._id.toString()}`);
    });
    lines.push("#EXT-X-ENDLIST");
    return lines.join("\n");
}

function generateM3U8MasterPlaylist(fileDocs) {
    let lines = ["#EXTM3U"];
    fileDocs.forEach(fileDoc => {
        lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(fileDoc.aux.videoBitrate) + parseInt(fileDoc.aux.audioBitrate)},RESOLUTION=${fileDoc.aux.resolution}`);
        lines.push("/api/watch/hls?fileId="+fileDoc._id)
    });
    return lines.join("\n");
}

router.get("/hlsPlaylist", async (req, res) => {
    try 
    {
        if(!req.query.fileId && !req.query.uploadId) {
            res.status(501).json({
                    status: 0,
                    error: "Missing params"
                });
            return;
        }
        let fileDoc = null;
        if(req.query.fileId){
            fileDoc = await MONGODB_MODELS.filesCollection.getFile(req.query.fileId).catch(e => console.log(e));
            if(!fileDoc) {
                res.status(404).json({
                    status: 0,
                    error: "Can't retrieve metadata for fileId "+req.query.fileId
                });
                return;
            }
            // if(fileDoc.storageType === 2) {
            //     res.status(501).json({
            //         status: 0,
            //         error: "Invalid storage type! Please make sure to provide a fileId of a non-converted file"
            //     });
            //     return;
            // }
        }
        
        if(!fileDoc && req.query.uploadId) {
            let uploadDoc = await MONGODB_MODELS.uploadsCollection.get(req.query.uploadId).catch(e => console.log(e));
            if(!uploadDoc) {
                res.status(404).json({
                    status: 0,
                    error: "Can't retrieve metadata for uploadId "+req.query.uploadId
                });
                return;
            }
            fileDoc = await MONGODB_MODELS.filesCollection.getFile(uploadDoc.fileId).catch(e => console.log(e));
        }

        if(!fileDoc) {
            res.status(404).json({
                    status: 0,
                    error: "Failed to retrieve fileDoc"
            });
            return;
        }

        // now get all available hls conversion for this fileDoc
        let conversionDocs = await MONGODB_MODELS.conversionsCollection.find({
            originalFile: fileDoc._id
        }).populate("convertedFile").exec().catch(e => console.log(e));

        if(!conversionDocs) {
            res.status(404).json({
                    status: 0,
                    error: "Failed to retrieve all converted files for fileId "+fileDoc.fileId
            });
            return;
        }
        //filter out unfinished conversion jobs
        conversionDocs = conversionDocs.filter(c => c.convertedFile != null);

        return res.set('Content-Type', "    application/x-mpegURL").send(generateM3U8MasterPlaylist(conversionDocs.map(c => c.convertedFile)));
    } catch(e) {
        console.log(e);
        res.status(500).json({
            status: 0,
            error: "Something went wrong!"
        })
    }

});

router.get("/hls", async (req, res) => {
    try {
        if (!req.query.fileId) {
            res.status(501).json({
                status: 0,
                error: "Missing params"
            });
            return;
        }

        let fileDoc = await MONGODB_MODELS.filesCollection.getFile(req.query.fileId, {populate: "chunks"}).catch(e => console.log(e));
        if(!fileDoc) {
            res.status(404).json({
                status: 0,
                error: "Unable to retrieve metadata for fileId "+req.query.fileId
            });
            return;
        }
        if(fileDoc.fileType !== "hls") {
            res.status(405).json({
                status: 0,
                error: "The provided fileId has fileType: "+fileDoc.fileType+", not hls"
            });
            return;
        }
        let m3u8Header = fileDoc.aux.m3u8Header;
        if(!m3u8Header) {
            res.status(500).json({
                status: 0,
                error: "Something went wrong! This hls file doesn't have m3u8Header"
            });
            return;
        }
        res.set('Content-Type', "application/x-mpegURL").send(generateM3U8Content(m3u8Header, fileDoc.chunks));
    } catch (e) {
        console.log(e)
        res.status(500).json({
            status: 0,
            error: "Something went wrong!"
        });
    }
});

module.exports = router;