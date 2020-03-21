import React from 'react';
import { withRouter, useParams, Link } from "react-router-dom";


function generateMessageObject(messageType, content) {
  return {
    type: messageType,
    content: content
  };
}

class UploadVideo extends React.Component {
    constructor(props) {
        super(props);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.inputExternalFileId = "";
        this.inputVideoName = "";
        this.uploadApi = this.uploadApi.bind(this);
        this.state = {
          message: null,
          uploadId: null
        }

    }

    async uploadApi(fileId) {
      let apiResp = await fetch("/api/upload/googledrive?fileId="+fileId+"&uploadName="+this.inputVideoName).catch(e => console.error(e));
      if(!apiResp)
        throw "Failed to call API";

      let jsonResp = await apiResp.json().catch(e => console.error(e));
      if(!jsonResp) {
        console.log(jsonResp);
        throw "Failed to resolve JSON";
      }

      if(!jsonResp.status)  {
        console.log(jsonResp);
        this.setState({message: generateMessageObject("error", jsonResp.error), uploadId: null});
        return;
      }
      console.log(jsonResp.response);

      this.setState({message: generateMessageObject("success", "Sucessfully imported. UploadId: "+jsonResp.response._id), uploadId: jsonResp.response._id});
    }

    handleInputChange(event, type) {
      event.preventDefault();
      if(type === "externalFileId")
        this.inputExternalFileId = event.target.value;
      else if(type === "videoName")
        this.inputVideoName = event.target.value;
      else
        throw "What are you trying to do buddy?"
    }

    handleSubmit(event) {
      event.preventDefault();
      this.uploadApi(this.inputExternalFileId).catch(e => console.error(e));
    }

    render(){
       return ( <div>
          <div className="container">
            {this.state.message ? 
              <div className={this.state.message.type === "success" ? "alert alert-success" : "alert alert-warning"}>
                {this.state.message.content}
                {this.state.message.type === "success" && this.state.uploadId ? 
                  <p><Link className="btn btn-primary" to={"/uploadInfo/"+this.state.uploadId} >View UploadInfo Page</Link></p>: null}
              </div> : null
            }
             <div className="form-group">
              <label>Google Drive ID</label>
              <input type="text" className="form-control" onChange={(e) => this.handleInputChange(e, "externalFileId")} placeholder="Google Drive File ID"/>
              <small className="form-text text-muted">Ex: https://drive.google.com/open?id=<b>1wgj7_eXNQEVhk25QwZZ7ZzKPPjZEJr_V</b></small>
              <label>Video Name: </label>
              <input type="text" className="form-control" onChange={(e) => this.handleInputChange(e, "videoName")} placeholder="Video Name"/>
            </div>
            <button type="submit" onClick={this.handleSubmit} className="btn btn-primary">Upload</button>
          </div>
        </div>)
    }
}   

export default withRouter(UploadVideo);