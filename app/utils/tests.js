import retry from 'async-retry';

import {retryableAsync} from "./helper.js"


// (async function() {
//     console.log(await retryableAsync((async function() {
//         throw "error";
//         return "Hi";
//     })(), (e) => {
//         return true;
//     }, {delay: 1000, retries: 3}));
// })();

(async function() {
    console.log(await retry(async bail => {
        console.log("trying");
        throw "error";
    }, {retries: 2, minTimeout: 2000, maxTimeout: 2000}));
})();