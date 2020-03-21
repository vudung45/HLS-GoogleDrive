import MongoDBModels from "./models.js"
import MONGODB_CREDENTIALS from "../../credentials/mongodb.js";
import { FilesCollection, FileMetadata } from "./files_collection.js";



//TEST -- Creating a chunk
(async function(){
    const MONGODB_MODELS = new MongoDBModels(MONGODB_CREDENTIALS.loginURI, MONGODB_CREDENTIALS.dbName);
    const CHUNKS_COLLECTION = MONGODB_MODELS.chunksCollection; // test db
    let r =  await CHUNKS_COLLECTION.addChunk({
        "fileType": "text/plain",
        "replicas": [],
        "aux": {
            "origin": "test_video",
            "duration": 10.0 // 10 seconds for example
        }
    }).catch(e => {
        console.log("[FAILED] TEST adding chunk 1");
        console.log(e);
    });
    console.log("Test adding chunk 1");
    console.log(r);
    await MONGODB_MODELS.close();
    return;
})();



//TEST -- Adding replicas to a chunk
(async function(){
    const MONGODB_MODELS = new MongoDBModels(MONGODB_CREDENTIALS.loginURI, "hls_test");
    const CHUNKS_COLLECTION = MONGODB_MODELS.chunksCollection; // test db
    let r =  await CHUNKS_COLLECTION.addChunk({
        "fileType": "text/plain",
        "replicas": [],
        "aux": {
            "origin": "test_video",
            "duration": 10.0 // 10 seconds for example
        }
    }).catch(e => {
        console.log("[FAILED] Test adding replica to chunk");
        console.log(e);
    });
    r = await CHUNKS_COLLECTION.addReplicas(r._id, [0,1,2,3]).catch(e =>  {
        console.log("[FAILED] Test adding replica to chunk");
        console.log(e);
    });
    console.log(`Test adding replicas [0,1,2,3] to chunk ${r._id}`);
    console.log(r);
    await MONGODB_MODELS.close();
    return;
})();


//TEST -- Adding file
(async function(){
    const MONGODB_MODELS = new MongoDBModels(MONGODB_CREDENTIALS.loginURI, "hls_test");
    const CHUNKS_COLLECTION = MONGODB_MODELS.chunksCollection; // test db
    const FILES_COLLECTION = MONGODB_MODELS.filesCollection;

    //first create a chunk
    let r =  await CHUNKS_COLLECTION.addChunk({
        "fileType": "text/plain",
        "replicas": [],
        "aux": {
            "origin": "test_video",
            "duration": 10.0 // 10 seconds for example
        }
    }).catch(e => {
        console.log("[FAILED] TEST -- Adding file with 1 chunk");
        console.log(e);
    });
    
    r =  await FILES_COLLECTION.addFile({
        fileType: "octa-stream",
        chunks: [r._id],
        aux: {
            "movie_name": "hello_world"
        }
    }).catch(e => {
        console.log("[FAILED] TEST -- Adding file with 1 chunk");
        console.log(e);
    });

    console.log(r);
    await MONGODB_MODELS.close();
    return;
})();