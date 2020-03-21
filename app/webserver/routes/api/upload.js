    import express from "express";
import { FileUploader } from "../../../files_manager/uploader.js";
import GoogleCredentialsConfig from "../../../configs/googlecredentials.js";
import MONGODB_CREDENTIALS from "../../../credentials/mongodb.js";
import MongoDBModels from "../../../database/models.js";

const router = express.Router();
const MONGODB_MODELS = new MongoDBModels(MONGODB_CREDENTIALS.loginURI, MONGODB_CREDENTIALS.dbName);
const FILE_UPLOADER = new FileUploader(MONGODB_CREDENTIALS.loginURI, MONGODB_CREDENTIALS.dbName);
router.use(express.json());

function getFileType(mimeType) {
    let fileType = null;    
    switch(mimeType) {
        case "video/x-flv":
            fileType = "flv";
            break;
        case "video/mp4":
            fileType = "mp4";
            break;
        case "video/MP2T":
            fileType = "ts";
            break;
        case "video/3gpp";
            fileType = "3gp";
            break;
        case "video/quicktime":
            fileType = "mov";
            break;
        case "video/x-msvideo":
            fileType = "avi";
            break;
        case "video/x-ms-wmv":
            fileType = "wmv"
            break;
        case "video/x-matroska":
            fileType = "mkv"
            break;
        default:
            break;
    }
    return fileType;

}
router.get("/get", async (req, res) => {
    try {
        if (!req.query.uploadId) {
            res.status(501).json({
                status: 0,
                error: "Missing params"
            });
            return;
        }

        let uploadDoc = await MONGODB_MODELS.uploadsCollection.get(req.query.uploadId).catch(e => console.log(e));
        if(!uploadDoc) {
            res.status(404).json({
                status: 0,
                error: "Unable to retrieve metadata for uploadId "+req.query.uploadId
            });
            return;
        }
        res.json({
            status: 1,
            response: uploadDoc
        });
    } catch (e) {
        console.log(e)
        res.status(500).json({
            status: 0,
            error: "Something went wrong!"
        });
    }
});

router.get("/googledrive", async (req, res) => {
     try {
        if (!req.query.fileId) {
            res.json({
                status: 0,
                error: "Missing params"
            });
            return;
        }

        let googleFileId = req.query.fileId;
        let uploadName = req.query.uploadName ? req.query.uploadName : "";
        let googleFileMetadata = await FILE_UPLOADER.getGoogleDriveFile(googleFileId).catch(e => console.error(e));
        if(!googleFileMetadata) {
            res.status(404).json({
                status: 0,
                error: "Failed to get this file. This could mean that the file doesn't exist, or is not public!"
            });
            return;
        }
        let fileType = req.query.fileType ? req.query.fileType : getFileType(googleFileMetadata.data.mimeType);
        if(!fileType) {
            res.status(501).json({
                status: 0,
                error: "Failed to detect fileType, please specify (Ex: mp4, avi, etc.)"
            });
            return;
        }

        // if this file has previously been uploaded
        let uploadDoc = await MONGODB_MODELS.findUpload(googleFileId, "googledrive");
        if(uploadDoc) {
            uploadDoc = await MONGODB_MODELS.updateUploadMetadata(uploadDoc._id, {
                                                                externalFileId: googleFileId,
                                                                source: "googledrive", 
                                                                identifier: googleFileId, //unique identifier to avoid double uploading
                                                                fileType: fileType, 
                                                                fileSize: googleFileMetadata.data.size,
                                                                uploadName: uploadName
                                                            }).catch(e => console.error(e));
            res.json({
                status: 1,
                response: uploadDoc
            });
            return;
        }
        
        uploadDoc = await MONGODB_MODELS.importUpload({
                        externalFileId: googleFileId,
                        source: "googledrive", 
                        identifier: googleFileId, //unique identifier to avoid double uploading
                        fileType: fileType, 
                        fileSize: googleFileMetadata.data.size,
                        uploadName: uploadName
                }).catch(e => console.error(e));
        
        if(!uploadDoc) {
            res.status(501).json({
                status: 0,
                error: "Failed to create new upload document"
            });
            return;
        }
        
        res.json({
                status: 1,
                response: uploadDoc
        });
    } catch (e) {
        console.error(e)
        res.status(500).json({
            status: 0,
            error: "Something went wrong!"
        });
    }
});


module.exports = router;