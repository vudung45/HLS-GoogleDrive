import {ObjectID} from 'mongodb'; 
import {ConversionStatus} from "../database/conversions_collection.js";

export class Job {
    constructor(obj) { 
        this.identifier = obj.identifier;
    }

    isUnique() {
        return this.identifier != null;
    }

    genSearchParamaters(){
        if(!this.isUnique())
            throw "Can only generate matching query if identifier is specified";
        
        return {
            identifier: this.identifier
        };
    }

    async verifyInput(obj) {
        throw "need to implement";
    }

    payload() {
        throw "need to implement";
    }
}


export class ConvertHLSJob extends Job{
    constructor(obj) {
        super(obj);
        
        this.originalFile = ObjectID(obj.originalFile);
        this.convertedFile = obj.convertedFile ? ObjectID(obj.convertedFile) : null;
        if(this.convertedFile && !(this.convertedFile instanceof ObjectID))
            this.convertedFile = ObjectID(this.convertedFile);

        this.status = obj.status ? obj.status :  ConversionStatus.WAITING;
        if(obj.aux) {
            this.inputOptions = obj.aux.inputOptions;
            this.outputOptions = obj.aux.outputOptions;
            this.label = obj.aux.label;
        }
    }

    genSearchParamaters(){
        if(!this.isUnique())
            throw "Can only generate matching query if identifier is specified";

        return {
            originalFile: this.originalFile,
            identifier: this.identifier
        }
    }

    async verifyInputs(obj) {
        //verify that originalFile exists
        let fileDoc;
        if(!(fileDoc = await obj.models.filesCollection.getFile(this.originalFile).catch(e => console.error(e))))
            return false;
        
        return true;

    }

    payload() {
        return {
            "originalFile": this.originalFile,
            "convertedFile": this.convertedFile,
            "identifier": this.identifier,
            "conversionType": "hls",
            "status": this.status,
            "aux": {
                label : this.label,
                inputOptions: this.inputOptions,
                outputOptions: this.outputOptions
            }
        }
    }
}