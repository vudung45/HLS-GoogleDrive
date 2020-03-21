import fs from "fs";
import {promisify} from 'util';
import {google} from "googleapis";
import path from "path";

import UploaderSettings from "../../configs/uploadersettings.js";
import { Account } from "../accounts.js";


const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);



export async function generateAccounts(credentials_path) {
    let files = await readdir(credentials_path, {withFileTypes: true}).catch(e => console.log(e));
    files = files.filter(file => file.name.includes(".json"));
    const filesRead = await Promise.all(files.map(file => {
        return readFile(path.join(credentials_path, file.name)).catch(e => console.log(e));
    }));

    const accounts = filesRead.map(content => {
        const credentials = JSON.parse(content);
        let authClient = new google.auth.JWT(credentials.client_email, null, credentials.private_key, UploaderSettings.scopes);

        return new Account(credentials.client_email, authClient);          
    });
    return accounts;
}