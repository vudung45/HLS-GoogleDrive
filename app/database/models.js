import mongoose from "mongoose";
import Config from "../credentials/mongodb.js";
import {FileSchema, StorageType} from "./files_collection.js";
import {ChunkSchema} from "./chunks_collection.js";
import {UploadSchema} from "./uploads_collection.js";

import {ConversionSchema} from "./conversions_collection.js";
import Bluebird from "bluebird";


var SINGLETON = {

}
export default class MongoDBModels {
    constructor(loginURI=Config.loginURI, db="hls") {
        if(SINGLETON[loginURI+"_"+db]) {
            SINGLETON[loginURI+"_"+db]._shared_connections++;
            return SINGLETON[loginURI+"_"+db];
        }
        this.client = mongoose.createConnection(loginURI, {dbName: db, useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false});
        this.filesCollection = this.client.model("files", FileSchema);
        this.chunksCollection = this.client.model("chunks", ChunkSchema);
        this.conversionsCollection = this.client.model("conversions", ConversionSchema);
        this.uploadsCollection = this.client.model("uploads", UploadSchema);
        this._shared_connections = 1;
        this._loginURI = loginURI;
        this._db = db;
        SINGLETON[loginURI+"_"+db] = this;
        return this;
    }


    async getConversionJobs(fileId, options=null) {
        let fileDoc = await this.filesCollection.getFile(fileId).catch(e => console.log(e));

        if(!fileDoc) 
            throw "Failed to retrieve fileDoc";

        // now get all available hls conversion for this fileDoc
        let conversionDocs = this.conversionsCollection.find({
            originalFile: fileDoc._id
        });
        if(options && options.populate) {
            if(!(options.populate instanceof Array))
                options.populate = [options.populate];
            options.populate.forEach(toPopulate => {
                conversionDocs = conversionDocs.populate(toPopulate);
            });
        }

        conversionDocs = await conversionDocs.exec().catch(e => console.error(e));

        if(!conversionDocs)
            throw "Failed to retrieve conversionDocs"

        return conversionDocs;
    }

    async findUpload(identifier, source) {
        let uploadDoc = await this.uploadsCollection.findOne({
            identifier: identifier,
            source: source
        }).catch( e => console.error(e));
        return uploadDoc;
    }

    async updateUploadMetadata(uploadId, metadata) {
        let uploadDoc = await this.uploadsCollection.update(uploadId, metadata).catch(e => console.error(e));
        if(!uploadDoc)
            throw "Failed to update metadata for uploadId "+uploadId 

        return uploadDoc;
    }

    async importUpload(metadata) { 
        // import single chunked file externally (Ex: from google drive, previous created by an user)
        let chunkDoc =  await this.chunksCollection.addChunk({
                    fileType: metadata.fileType,
                    replicas: [metadata.externalFileId],
                    aux: {}
                }).catch(e => console.error(e));

        if(!chunkDoc)
             throw "Failed to create a new chunk";
  
        let fileDoc =  await this.filesCollection.addFile({
            fileType: metadata.fileType,
            chunks: [chunkDoc._id],
            storageType: StorageType.IMPORTED_FILE,
            aux: {
                fileSize: metadata.fileSize
            },
        }).catch(e => console.error(e));

        if(!fileDoc) 
            throw "Failed to create a new file doc";
    
        let uploadDoc = await this.uploadsCollection.add({   
            ...metadata,
            fileId: fileDoc._id
        }).catch(e => console.error(e));

        if(!uploadDoc)
            throw "Failed to create a new upload document";

        return uploadDoc;
    }


    async close() {
        this._shared_connections--;
        if(this._shared_connections <= 0) {
            delete SINGLETON[this._loginURI+"_"+this._db];
            console.log("Closing mongodb client. DBName: "+this._db);
            await this.client.close();
        }
    }

    hashCode() {
        return (this._loginURI+"_"+this._db).hashCode();
    }
}