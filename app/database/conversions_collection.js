
import {Schema, createConnection} from "mongoose";
import {ObjectID} from 'mongodb';
import {FileSchema} from "./files_collection.js";

export const ConversionSchema = new Schema({
    originalFile: {type: Schema.Types.ObjectId, ref: "files", required: true},
    convertedFile: {type: Schema.Types.ObjectId, ref: "files", required: false, default: null},
    identifier: {type: String, required: false},
    status: {type: Number, required: true}, //ConversionStatus
    messages: [{type: String, required: false, default: ""}],
    conversionType: {type: String, required: true, default: "hls"},
    aux: Schema.Types.Mixed
});


export const ConversionType =  {
    HLS : "hls"
}

export const ConversionStatus = {
    WAITING: 0, //enqueued
    PROCESSING: 1, //worker reaps the job
    READY: 2,
    FAILED: -1
};

class ConversionsCollections {
    static async add(metadata) {
        let doc = await this.create({...metadata});
        return doc;
    }

    static async get(_id) {
        if(typeof(_id) != ObjectID)
            _id = ObjectID(_id);
    
        let doc = await this.findOne({"_id": _id}).exec();

        return doc;
    }

    static async update(_id, query) {
        if(typeof(_id) != ObjectID)
            _id = ObjectID(_id);
    
        let doc = await this.findOneAndUpdate({"_id": _id}, query, {new: true}).exec();

        return doc;
    }
}

ConversionSchema.loadClass(ConversionsCollections); //virtualize all functions from ChunksCollection