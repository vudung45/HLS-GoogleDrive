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
        delay: 100, // 100ms
        scaleFactor: 2,
        maxDelay: 10000, // 10s
        returnVal: null,
        retries: 5,
        ...options
    }
    let error = null;

    options.returnVal = await coroutine.catch(e => {error = e;});
    if(error) {
        if(!retryPredicate(error))
            throw error;

        if(options.retries <= 0)  {
            console.log("Maximum retry. Throwing exception!")
            throw error;
        }
        console.log("Retrying... Error");
        let waitPromise = new Promise((resolve, reject) => {
            let delay = options.delay;
            options.delay = Math.min(options.maxDelay, options.delay * options.scaleFactor);
            --options.retries;
            setTimeout(() => {retryableAsync(coroutine, retryPredicate, options).then(() => resolve()).catch(e => reject(e))}, delay);
        });
        await waitPromise.catch(e => {throw e;});
    }
    return options.returnVal;
}