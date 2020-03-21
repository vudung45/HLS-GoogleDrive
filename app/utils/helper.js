export function parseOptions(aux, template){
    let options = {...template, ...aux};
    Object.keys(aux).forEach(k => {
        if(k in template){
            if(template[k] && typeof(template[k]) != typeof(aux[k]))
                throw "Wrong type for argument: "+k
        }
        options[k] = aux[k];
    });
    Object.keys(options).forEach(k => {
        if(options[k] == null)
            throw "Missing argument "+k;
    });
    return options;
}


export async function retryableAsync(coroutine, retryPredicate, options) {

    options = {
        retries: 5,
        delay: 100, // 100ms
        scaleFactor: 2,
        maxDelay: 1000, // 5s
        maxRetry: 5,
        returnVal: null,
        ...options
    }
    try {
        options.returnVal = await coroutine;
    } catch (e) {
        if(!retryPredicate(e)) {
            throw e;
        }

        if(options.maxRetry <= 0)
            throw e;

        console.log("Retrying... Error:");
        console.error(e);
        let waitPromise = new Promise((resolve) => {
            let delay = options.delay;
            options.delay = Math.min(options.maxDelay, options.delay * options.scaleFactor);
            --options.maxRetry;
            setTimeout(() => {retryableAsync(coroutine, retryPredicate, options).then(() => resolve()).catch(e => throw e)}, delay);
        });
        await waitPromise;
    }
    return options.returnVal;
}