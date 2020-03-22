import {PassThrough, Writable} from "stream";
import fs from "fs";
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from "fluent-ffmpeg";

import { parseOptions } from "../utils/helper.js";




const convertVideo_INPUT_OPTIONS_TEMPLATE = {
    
}

const convertVideo_OUTPUT_OPTIONS_TEMPLATE = {
    "c:a": "copy",
    "c:v": "copy",
    "f": "hls",
    "hls_time": 10,
    "hls_list_size": 0,
}

function convert(readStream, outputStream, inputCodecData, inputOptions, outputOptions) {
    inputOptions = inputOptions ? inputOptions : {};
    outputOptions = outputOptions ? outputOptions : {};
    inputOptions  = parseOptions(inputOptions, convertVideo_INPUT_OPTIONS_TEMPLATE);
    outputOptions = parseOptions(outputOptions, convertVideo_OUTPUT_OPTIONS_TEMPLATE);

    if(!("hls_segment_filename" in outputOptions)) 
        outputOptions.hls_segment_filename = uuidv4()+"_%03d.ts";
    
    let command = ffmpeg();
    command = command.input(readStream)
                  .inputOptions(Object.keys(inputOptions).map(k => {
                        return `-${k} ${inputOptions[k]}`
                  }))
                  .outputOptions(Object.keys(outputOptions).map(k => {
                        return `-${k} ${outputOptions[k]}`
                  })).on('start', function(commandLine) {
                        console.log('Spawned Ffmpeg with command: ' + commandLine);
                  });

    // Events Handlers
    command.on("error", (err, stdout, stderr) => {
        outputStream.emit("error", err);
    });
    command.on("end", () => {
        outputStream.end();
    });

    //parse input stream codec information
    command.on('codecData', function(data) {
        console.log(data);
        if(data.video_details) {
            let filterVideoBitrate = data.video_details.filter(m => m.includes("kb/s"));
            if(filterVideoBitrate.length)
                inputCodecData.videoBitrate = parseInt(filterVideoBitrate[0].match(/(\d*) kb\/s/)[1]) * 1000;

            let filterResolution = data.video_details.filter(m => m.match(/^\d*x\d*/));
            if(filterResolution.length)
                inputCodecData.resolution = filterResolution[0].match(/^(\d*x\d*)/)[1];
        }

        if(data.audio_details) {
            let filterAudioBitrate = data.audio_details.filter(m => m.includes("kb/s"));
            if(filterAudioBitrate.length)
                inputCodecData.audioBitrate = parseInt(filterAudioBitrate[0].match(/(\d*) kb\/s/)[1]) * 1000;
        }

        console.log(inputCodecData);
    });
    command.pipe(outputStream);
    return command;
}



export default class HLSConverter {
    /**
        @param {readSrc}, Readable Stream or path to media
    **/
    constructor(readSrc, inputOptions, outputOptions) {
        this.outputStream = new PassThrough();
        this.inputCodecData = {
            "videoBitrate": 0,
            "audioBitrate": 0,
            "resolution": "0x0"
        }
        this.processedChunk = [];
        this.distinctChunkPaths = new Set();
        this.error = false;
        this.errorMessage = null;
        this.done = false;
        this.m3u8Header = null;
        this.outputStream.on("data", (chunk) => {
            if(this.error) { //ignore
                this.outputStream.end();
                return; 
            }
            console.log("[HLSConverter] received new data...")
            // a bit in efficient, but who cares, its shorthand :D
            let chunkLines = chunk.toString().split(/\n+/).filter(_ => _ != "");

            try {
                if(chunkLines[chunkLines.length - 1].includes("EXT-X-ENDLIST"))
                    chunkLines.pop(); // remove last line

                if(!this.m3u8Header)
                    this.m3u8Header = chunkLines.slice(0, chunkLines.length - 2).join("\n");

                let chunkPathIndex = chunkLines.length - 1;
                while(chunkLines[chunkPathIndex].includes("EXTINF"))
                    chunkPathIndex--;

                let toAdd = [];
                while(chunkPathIndex >= 0 
                        && !this.distinctChunkPaths.has(chunkLines[chunkPathIndex])) {
                    if(!chunkLines[chunkPathIndex].includes(".ts")) {
                        chunkPathIndex-=2;
                        continue;
                    }
                    let extinf = parseFloat(chunkLines[chunkPathIndex- 1].match(/#EXTINF:(.*)/)[1])+"";
                    let chunkPath = chunkLines[chunkPathIndex];
                    this.distinctChunkPaths.add(chunkLines[chunkPathIndex]);
                    toAdd.push({
                        "status": 1,
                        "extinf": extinf,
                        "chunkPath": chunkPath
                    });
                    
                    chunkPathIndex-=2;
                }
                toAdd.reverse();
                console.log(toAdd);
                toAdd.forEach(item => this.processedChunk.push(item));
            } catch (e) {
                console.log(e);
                 this.error = true;
                this.errorMessage = e;
                this.outputStream.end();
            }
        });
        this.outputStream.on("error", (e) => {
            this.error = true;
            this.errorMessage = e;
            this.outputStream.end();
        });

        this.outputStream.on("end", () => {
            this.done = true;
            console.log("done processing");
        });


        //pipe ffmpege to outputstream
        this.command = convert(readSrc, this.outputStream, this.inputCodecData, inputOptions, outputOptions);;
    }

    stop() {
        this.command.kill();
        this.outputstream.end();
    }
    async getNextProcessedChunk() {
        if(this.error)
            throw this.errorMessage;

        if(this.processedChunk.length)
            return this.processedChunk.shift();
        else {
            if(!this.done) {
                await (new Promise((resolve, reject) => { 
                    let endListener = () => {
                        resolve();
                        this.outputStream.off("end", endListener);
                    }
                    let dataListener = () => {
                        resolve();
                        this.outputStream.off("data", dataListener);
                    }
                    this.outputStream.on("end", endListener);
                    this.outputStream.on("data", dataListener);
                    
                }));
                return await this.getNextProcessedChunk(); 
            }
        }
        return null;
    }
}