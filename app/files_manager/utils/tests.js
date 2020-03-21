import { ChunkifyReadStream } from "./chunkify.js";
import {Readable, PassThrough, Transform} from "stream";
import fs from "fs";


(async function() {
    let chunkified = new ChunkifyReadStream(8);
    let passThrough = new PassThrough();
    passThrough.pipe(chunkified);
    passThrough.write("Testing 1 2 3 4 5 6. Try a longer paragraph hahahahaa");
    passThrough.end();

    let chunkStream;
    while(chunkStream = await chunkified.getNextChunkStream()){
        chunkStream.pipe(process.stdout);
    }
})();




(async function() {
    let chunkified2 = new ChunkifyReadStream(8*1024*1024);
    fs.createReadStream("./test_upload").pipe(chunkified2);
    let chunkStream;
    while(chunkStream = await chunkified2.getNextChunkStream()){
        chunkStream.pipe(process.stdout);
    }
})();