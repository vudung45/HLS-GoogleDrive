import {Schema, createConnection} from "mongoose";
import {ObjectID} from 'mongodb';


export const ChunkSchema = new Schema({
    fileType: String,
    replicas: Array,
    aux: Schema.Types.Mixed
});

class ChunksCollection {
    static async addChunk(metadata) {
        let doc = await this.create({...metadata});
        return doc;
    }

    static async getChunk(chunkId) {
        if(typeof(chunkId) != ObjectID)
            chunkId = ObjectID(chunkId);
    
        let doc = await this.findOne({"_id": chunkId}).exec();

        return doc;
    }

    static async addReplicas(chunkId, replicas) {
        if(typeof(chunkId) != ObjectID)
            chunkId = ObjectID(chunkId);


        let res = await this.findOneAndUpdate({
            "_id": chunkId
        }, {
            "$addToSet": {
                "replicas": {
                     "$each": replicas
                }
            }
        }, {
            new: true
        }).exec(); 
        
        return res;
    }
}

ChunkSchema.loadClass(ChunksCollection); //virtualize all functions from ChunksCollection