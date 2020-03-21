import React from 'react';

export default class JWMoviePlayer extends React.Component {
    

    constructor(props){
        super(props)
        this.updatePlayer = this.updatePlayer.bind(this)
        this.errorQualites = new Set();
        this.playlist = []
        this.currentQuality = 0;
        this.currentPlaylist = 0;
    }

    shouldComponentUpdate(nextProps, nextState) {
        // this.updatePlayer(nextProps.movieSrcs);
        // // requires switching from 
        // if(nextProps.movieSrcs && nextProps.movieSrcs.length > 0 && nextProps.movieSrcs[0].type == "iframe" && this.props.movieSrcs != "iframe")
        //     return true;
        return false;
    }

    updatePlayer(newSrcs) {
        if(newSrcs == null)
            return;

        if(!this.player)
            this.player = window.jwplayer(this.videoNode);

        this.playlist = [{
                sources: newSrcs.map(m => { return {
                            file: m["src"],
                            label: m["label"],
                            type: m["type"],
                        
                        }}),
        }];

        this.player.setup({
            playlist: this.playlist,
            width: "100%", 
            aspectratio: "16:9", 
            primary: "html5", 
            autostart: true, 
            allowscriptaccess: "always"
        });   
        this.player.on("error", (code, message, sourceErrro, type) => {
            this.playlist[this.currentPlaylist].sources.splice(this.currentQuality, 1);
            console.log("Failed to load a playlist item, try to play the next one");
            if(this.playlist[0].sources.length > 0) {
                this.player.load(this.playlist);
                this.player.play();
                this.currentQuality = 0;
                this.player.playlistItem(this.currentPlaylist);
            }
        })

        this.player.on("levelsChanged", (obj) => {
                this.currentQuality = obj.currentQuality;
        });

        this.player.on("playlistItem", (obj) => {
            this.currentPlaylist = obj.index;
        });
    }   



    componentDidMount(){
        this.updatePlayer(this.props.movieSrcs);
    }

    componentWillUnmount() {
        if(this.player)
            this.player.remove()
    }

    render() {
        return(   
            <div>
                <video ref={ node => this.videoNode = node } className="jwplayer"></video>
            </div>
        );

    }
}