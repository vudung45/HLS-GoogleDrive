import fs from "fs";
import {Readable, PassThrough, Transform} from "stream";

export class ChunkStream extends PassThrough {
    constructor(options={objectMode: true}) {
        super(options);
    }

}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class ChunkifyReadStream extends Transform {
    constructor(chunkSize, options={objectMode:true}) {
        super(options);
        this.chunkSize = chunkSize;
        this.bytesRead = 0;
        this.chunks = [];
        this.ended = false;
        this._readableState.objectMode = true;
        this.on("end", function() {
            if(this.chunks.length != 0){
                this.chunks[this.chunks.length - 1].end();
            }
            this.ended = true;
        });
        this.on("finish", function() {
            if(this.chunks.length != 0){
                this.chunks[this.chunks.length - 1].end();
            }
            this.ended = true;
        });
    }

    async getNextChunkStream(){
        return new Promise((resolve, reject) => {
            if(this.chunks.length)
                resolve(this.chunks.shift());
            else {
                if(this.ended)
                    resolve(null);
                this.on("end", () => {
                    if(this.chunks.length){
                        resolve(this.chunks.shift());
                    } else {
                        resolve(null);
                    }
                });
                this.on("finish", () => {
                    if(this.chunks.length){
                        resolve(this.chunks.shift());
                    } else {
                        resolve(null);
                    }
                });
            }
        });
    }

    _transform(data, enc, cb) {
        while(data.length) {
            if(this.chunks.length < (this.bytesRead / this.chunkSize) + 1) {
                if(this.chunks.length != 0){
                    this.chunks[this.chunks.length - 1].end();
                }
                this.chunks.push(new ChunkStream());
            }
            let chunk = data.slice(0, Math.min(data.length, this.chunkSize - this.bytesRead % this.chunkSize));
            data = data.slice(Math.min(data.length, this.chunkSize - this.bytesRead % this.chunkSize));
            this.chunks[this.chunks.length-1].write(chunk);
            this.bytesRead += chunk.length;
        }
        cb();
    }
}

