import React from 'react';
import JWPlayer from "./player/jwvideoplayer.js"


export default class WatchBox extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        if(this.props.mediaType === "hls") {
            let queryString = ["fileId", "uploadId"].map(k => {
                if(this.props[k])
                    return k+"="+this.props[k];
                return "";
            })
            return (<JWPlayer movieSrcs={[{
                src: "/api/watch/hlsPlaylist?"+queryString.join("&"),
                label: "video",
                type: "hls"
            }]}/>)
        } else {
            return null;
        }
    }
}