
import {Schema, createConnection} from "mongoose";
import {ObjectID} from 'mongodb';
import {FileSchema} from "./files_collection.js";

export const UploadSchema = new Schema({
    identifier: {type: String, required: false},
    fileType: {type: String, required: true},
    externalFileId: {type: String, required: true},
    source: {type: String, required: true}, // Google Drive, Google Photoes, etc.
    fileId: {type: Schema.Types.ObjectId, ref: "files", required: true},
    fileSize: {type: Number, required: true, default: 0},
    uploadName: {type: String, required: true, default: "Unnamed"},
    aux: Schema.Types.Mixed
});



class UploadsCollection {
    static async add(metadata, options) {
        let doc = null;
        if(!metadata.identifier)
            doc = this.create(metadata);
        else 
            doc = this.findOneAndUpdate({
                identifier: metadata.identifier,
                source: metadata.source
            }, metadata, {upsert:true, new: true});

        if(options && options.populate) {
            doc = doc.populate(options.populate)
        }
        return await doc.exec().catch(e => console.error(e));
    }

    static async get(_id) {
        if(typeof(_id) != ObjectID)
            _id = ObjectID(_id);
    
        let doc = await this.findOne({"_id": _id}).exec().catch(e => console.error(e));

        return doc;
    }

    static async update(_id, query) {
        if(typeof(_id) != ObjectID)
            _id = ObjectID(_id);
    
        let doc = await this.findOneAndUpdate({"_id": _id}, query, {new: true}).exec().catch(e => console.error(e));

        return doc;
    }
}

UploadSchema.loadClass(UploadsCollection); //virtualize all functions from ChunksCollection