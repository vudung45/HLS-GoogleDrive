import {google}  from 'googleapis';
import rp from "request-promise"
import fs from 'fs';
import Media from "../utils/media.js"
import { retryableAsync } from "../utils/helper.js";
import retry from 'async-retry';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryApi(apiCoroutine) {
    return await retry(async bail => {
        let error = null;
        const res = await apiCoroutine.catch(e => {
            error = e;
        });
        if(error) {
            if(error.code !== 403  || error.code !== 500) {
                bail(error);
                return;
            }
        }
        return res;
    }, {retries: 20, minTimeout: 2000, maxTimeout: 100000});
}

const DELAY_TIME = 500; // 100ms

export class Account {
    constructor(identifier, authClient) {
        this.identifier = identifier;
        this.authClient = authClient;
        this.drive_v3 = google.drive({version: 'v3', auth: this.authClient});
        this.needUpdate = true;
        this.metadata = {
            "limit": 0,
            "usage": 0,
            "usageInDrive": 0,
            "usageInDriveTrash": 0
        }
        this.lastApiCall = Date.now();
    }


    async genAPIHeaders() {
        const token = await this.authClient.authorize();
        return {
            "Accept": "application/json",
            "Authorization": "Bearer "+token.access_token
        }
    }


    async uploadFile(media) {
        while(Date.now() - this.lastApiCall < DELAY_TIME) {
            await sleep(Math.max(0, DELAY_TIME - Date.now() + this.lastApiCall));
        }

        this.lastApiCall = Date.now();
        let uploadResp = await retryApi(this.drive_v3.files.create({
            resource: {
                "name": media.name
            },
            media: media.payload(),
            fields: "id"
        })).catch(e => console.error(e));
        
        this.needUpdate = true;

        if(!uploadResp || !uploadResp.data || !("data" in uploadResp) || !("id" in uploadResp.data)) {
            throw "Failed to upload file";
            return null;
        }

        return uploadResp.data.id;
    }

    async getFile(fileId) {
        let getResp = await retryApi(this.drive_v3.files.get({
            fileId: fileId
        })).catch(e => console.error(e));

        if(!getResp)
            throw "Failed to get fileId "+fileId

        return getResp;
    }

    async copyFile(fileId) {
        
    }


    async updateFilePermission(fileId, permission = {"role": "reader","type": "anyone"}) {
        while(Date.now() - this.lastApiCall < DELAY_TIME) {
            await sleep(Math.max(0, DELAY_TIME - Date.now() + this.lastApiCall));
        }

        this.lastApiCall = Date.now();

        return await retryApi(this.drive_v3.permissions.create({
                requestBody: permission,
                fileId: fileId
        })).catch(e => console.error(e));
    }

    async updateMetadata() {
        if(!this.needUpdate)
            return;

        while(Date.now() - this.lastApiCall < DELAY_TIME) {
            await sleep(Math.max(0, DELAY_TIME - Date.now() + this.lastApiCall));
        }

        this.lastApiCall = Date.now();

        // for some reason, has to invoke this everytime
        let apiResp = await retryApi(this.drive_v3.about.get({
                          fields: "storageQuota"
                      })).catch(e=> console.error(e));


        if(!apiResp || !apiResp.data || !apiResp.data.storageQuota) {
            console.log(apiResp);
            return;
        }

        this.needUpdate = false;
        this.metadata = apiResp.data.storageQuota;
    }

    valueOf() {
        return this.metadata.limit - this.metadata.usage;
    }

    hashCode() {
        return this.identifier.hashCode();
    }

    toString() {
        return this.identifier;
    }
    
}

/* Managing multiple service accounts */
export class AccountManager {
    constructor(accounts=[]) {
        this.accounts = {}
        accounts.forEach((acc) => {
            accounts[acc.identifier] = acc;
        });
        this._last_updates = {}
    }

    addAccount(account) {
        if(account.identifier in this.accounts)
            return account.identifier;

        this.accounts[account.identifier] = account;

        return account.identifier;
    } 

    async updateAccountsMetadata() {
        let routines = Object.values(this.accounts).map(acc => {
            return acc.authClient.updateMetadata().catch(e => console.log(e));
        });

        await Promise.all(routines);
    }   

    async getMostAvailableStorageAccount() {
        let updateRoutines = []
        for(const key of Object.keys(this.accounts))
            updateRoutines.push(this.accounts[key].updateMetadata().catch(e => console.error(e)));

        await Promise.all(updateRoutines).catch(e => console.error(e));
        return Object.values(this.accounts).sort()[0];
    }
 }


