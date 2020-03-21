
import { v4 as uuidv4 } from 'uuid';

export default class Media {
    constructor(mimeType, body, name=null) {
        this.mimeType = mimeType;
        this.body = body;
        this.name = name;
        if(!name)
            this.name = uuidv4();
    }


    payload() {
        return {
            mimeType : this.mimeType,
            body: this.body
        }
    }
}