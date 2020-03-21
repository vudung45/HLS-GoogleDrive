import {Schema} from "mongoose";
import {ChunkSchema} from "./chunks_collection.js"
import {ObjectID} from 'mongodb';


export const StorageType = {
    ORIGINAL: 0, // original file uploaded by user
    CONVERTED_FILE: 1,// processed file by us
    IMPORTED_FILE: 2,
}


export const FileSchema = new Schema({
    fileType: {type: String, required: true},
    chunks: [{type: Schema.Types.ObjectId, ref: "chunks"}],
    status: Number,
    aux: Schema.Types.Mixed,
    storageType: {type: Number, required: true, default: StorageType.ORIGINAL}
});

export class FileMetadata {
    constructor(obj){
        let indexes = FileSchema.paths;
        this._payload = {}
        for(const key of Object.keys(indexes)){
            // { fileType: SchemaString { ... }, status: SchemaNumber { ... } }
            if(key in obj){
                this._payload[key] = obj[key];
            }
        }
    }

    payload() {
        return this._payload;
    }
}


export class HLSFileMetadata extends FileMetadata {
    constructor(obj){
        super(obj);
        this._payload["fileType"] = "hls";
    }

    payload() {
        return this._payload;
    }
}

class FilesCollection {

    static async addFile(metadata) {
        if(metadata instanceof FileMetadata)
            metadata = metadata.payload();

        let doc = await this.create({...metadata});
        return doc;
    }

    static async updateFile(fileId, updateQuery) {
        if(!(fileId instanceof ObjectID))
            fileId = ObjectID(fileId);

        let res = await this.findOneAndUpdate({
            "_id": fileId
        }, 
        updateQuery, {
            new: true
        }).exec();

        return res;
    }

    static async getFile(fileId, options=null) {
        if(!(fileId instanceof ObjectID))
            fileId = ObjectID(fileId);
        
    

        let res = this.findOne({
            "_id": fileId
        });

        if(options && options.populate)
            res = res.populate(options.populate);

        res = await res.exec();

        return res;
    }

    static async updateConvertedFile(fileId, convertedFileId) {
        if(!(fileId instanceof ObjectID))
            fileId = ObjectID(fileId);

        if(typeof(convertedFileId) != ObjectID)
            convertedFileId = ObjectID(convertedFileId);
        

        let res = await this.findOneAndUpdate({
            "_id": fileId
        }, {
            "$set": {
                "convertedFile": convertedFileId
            }
        }, {
            new: true
        }).exec();

        return res;
    }

    static async addChunks(fileId, chunks) {
        if(!(fileId instanceof ObjectID))
            fileId = ObjectID(fileId);

        chunks = chunks.map(chunk => {
            if(typeof(chunk) != ObjectID)
                return ObjectID(chunk);
            return chunk;
        })
        
        let res = await this.findOneAndUpdate({
            "_id": fileId
        }, {
            "$push": {
                "chunks": {
                     "$each": chunks
                }
            }
        }, {
            new : true
        }).exec(); 

        return res;
    }
}

FileSchema.loadClass(FilesCollection);