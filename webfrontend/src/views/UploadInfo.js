import React from 'react';
import styled from 'styled-components';
import ConversionsBox from "./ConversionsBox.js"
import { withRouter, useParams, Link } from "react-router-dom";

const LeftAlignedDiv = styled.div`
    text-align: left;
`;

class InfoBox extends React.Component {
    constructor(props) {
        super(props);
        this.handleClick = this.handleClick.bind(this);
    }

    handleClick(event) {
        event.preventDefault();
        this.props.switchTab();
    }

    render() {
        return ( 
            <LeftAlignedDiv className="card-body">
                <h5 className="card-title">{this.props.uploadName}</h5>
                <p className="card-text">UploadId: <i>{this.props._id}</i></p>
                <p className="card-text">EZStream FileId: <i>{this.props.fileId}</i> </p>
                <p className="card-text">Source: <i>{this.props.source}</i></p>
                <p className="card-text">ExternalFileId: <i>{this.props.externalFileId}</i> (Ex: Google Drive ID, DropboxID, ...)</p>
                <div className="row">
                    <div className="col-sm-3">
                        <a href="" className="btn btn-primary" onClick={this.handleClick}>View all conversion jobs</a>
                    </div>
                    <div className="col-sm-3">
                        <Link to={"/watch?uploadId="+this.props._id} className="btn btn-primary">Watch Video</Link>
                    </div>
                </div>
            </LeftAlignedDiv>
        )
    }
}

class UploadInfo extends React.Component {
    constructor(props) {
        super(props);
        this.tabs = {
            info: {
                label: "Info"
            },
            conversions: {
                label: "Conversions"
            }
        }
        this.state = {
            uploadInfo : {},
            selection: "info"
        }
        this.switchTab = this.switchTab.bind(this);
    }

    switchTab(tab) {
        this.setState({selection: tab})
    }


    async componentDidMount() {

        let uploadId = this.props.match.params.uploadId;
        let resp = await fetch("/api/upload/get?uploadId="+uploadId).catch(e => console.error(e));
        let jsonResp = await resp.json().catch(e => console.error(e));
        if(!jsonResp)
            throw "Error json parsing";

        if(!jsonResp.status) {
            console.log(jsonResp);
            return;
        }
        this.setState({uploadInfo: jsonResp.response});
    }


    render() {
        let tabs = Object.keys(this.tabs).map(tab => {
            return (<li key={tab} className="nav-item">
                    <a key={tab} className={tab == this.state.selection ? "nav-link active" : "nav-link"} href="#" onClick={(e) => {e.preventDefault(); this.switchTab(tab)}}>{this.tabs[tab].label}</a>
                  </li>
            );
        });
        let content = null;
        switch(this.state.selection) {
            case "info":
                content = <InfoBox switchTab={this.switchTab.bind(this, "conversions")} {...this.state.uploadInfo}/>;
                break;

            case "conversions":
                content = <ConversionsBox fileId={this.state.uploadInfo.fileId}/>
                break;

            default:
                content = null;
        }
        return (
            <div className="card text-center">
              <div className="card-header">
                <ul className="nav nav-pills card-header-pills">
                  {tabs}
                </ul>
              </div>
              {content}
            </div>
        );
    }
} 

export default withRouter(UploadInfo);