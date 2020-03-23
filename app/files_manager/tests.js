import { AccountManager } from "../google/accounts.js";
import { generateAccounts } from "../google/utils/helper.js";
import { FileUploader } from "./uploader.js";
import fs from 'fs';
import GoogleCredentialsConfig from "../configs/googlecredentials.js";
import MONGODB_CREDENTIALS from "../credentials/mongodb.js";
import MongoDBModels from "../database/models.js"


// (async function (){
//     let uploaderManager = new AccountManager();
//     let accounts = await generateAccounts(GoogleCredentialsConfig.service_accounts);
//     accounts.forEach(account => {
//         uploaderManager.addAccount(account, false);
//     });
//     let fileUploader = new FileUploader(MONGODB_CREDENTIALS.loginURI, MONGODB_CREDENTIALS.dbName);
//     fileUploader.loadAccountManager(uploaderManager);
//     let file = await fileUploader.uploadFile(fs.createReadStream("./test_upload.mp4"), {fileType:"mp4", chunkSize: 630125 * 10});
//     console.log("Test uploading chunkified file")
//     console.log(file);
//     await fileUploader.close();
// })();

(async function (){
    let uploaderManager = new AccountManager();
    let accounts = await generateAccounts(GoogleCredentialsConfig.service_accounts);
    accounts.forEach(account => {
        uploaderManager.addAccount(account, false);
    });
    let fileUploader = new FileUploader(MONGODB_CREDENTIALS.loginURI, MONGODB_CREDENTIALS.dbName);
    fileUploader.loadAccountManager(uploaderManager);
    let file = await fileUploader.uploadFile(fs.createReadStream("./test_upload.mp4"), {fileType:"mp4", chunkSize: 0});
    await fileUploader.close();
})();