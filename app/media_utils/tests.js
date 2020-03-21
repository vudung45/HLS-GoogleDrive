import fs from "fs";
import rp from "request-promise";
import request from "request";
import {PassThrough} from "stream";


import HLSConverter from "./hlsconverter.js";

(async function() {
    let converter = new HLSConverter("./test_upload.mp4");
    let chunkInfo;
    let error = null;
    while(chunkInfo = await converter.getNextProcessedChunk().catch(e => {console.log(e); error=e;})) {
        console.log(chunkInfo);
    }
    console.log(converter.m3u8Header);
})();



(async function() {
    let converter = new HLSConverter("https://www.googleapis.com/drive/v3/files/1ywcM3ev4FIYve3sep2HT58zkynbAcfZb?alt=media&key=AIzaSyADkl6gP47jplINbMvxOOe-XzmZq4UHEaU");
    let chunkInfo;
    let error = null;
    while(chunkInfo = await converter.getNextProcessedChunk().catch(e => {console.log(e); error=e;})) {
        console.log(chunkInfo);
    }
    console.log(converter.m3u8Header);
})();


