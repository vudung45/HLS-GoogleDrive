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