import {retryableAsync} from "./helper.js"


(async function() {
    console.log(await retryableAsync((async function() {
        throw "error";
        return "Hi";
    })(), (e) => {
        return true;
    }));
})();