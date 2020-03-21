import React from 'react';
import styled from 'styled-components';

const LeftAlignedDiv = styled.div`
    text-align: left;
`;

class Modal extends React.Component {
    constructor(props) {
        super(props);
        this.modalNode = React.createRef();
    }


    componentDidUpdate(prevProps) {
      // Typical usage (don't forget to compare props):
      if (this.props.toggle !== prevProps.toggle) {
        if(this.modalNode.current){
            console.log(this.modalNode.current);
            window.$(this.modalNode.current).modal("toggle"); //call imported jquery from static index.html
        }
      }
    }

    render() {
        return (
            <div ref={this.modalNode} className="modal" tabIndex="-1" role="dialog">
              <div className="modal-dialog" role="document">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">{this.props.title}</h5>
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close">
                      <span aria-hidden="true">&times;</span>
                    </button>
                  </div>
                  <div className="modal-body">
                    <pre>{this.props.content}</pre>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" data-dismiss="modal">Close</button>
                  </div>
                </div>
              </div>
            </div>
        );
    }
}


export default class ConversionsBox extends React.Component {
    constructor(props) {
        super(props);
        this.handleClick = this.handleClick.bind(this);
        this.fetchData = this.fetchData.bind(this);
        this.toggleModal = this.toggleModal.bind(this);
        this.handleResolutionSelection = this.handleResolutionSelection.bind(this);
        this.addNewJob = this.addNewJob.bind(this);
        this.updateInterval = this.updateInterval.bind(this);
        this.resolutionSelection = "1080p";
        this._updateInterval = null;
        this.state = {
            error: null,
            jobs: [],
            modalTitle: "",
            modalContent: "",
            modalToggle: 0,
        }
        this.supportedResolutions = {
            "1080p": {
                "label": "1080p",
                "order": 1,
            },
            "720p": {
                "label": "720p",
                "order": 2
            },
            "360p": {
                "label": "360p",
                "order": 3
            }
        }
    }

    handleClick(event) {
        event.preventDefault();
    }

    handleResolutionSelection(event) {
        event.preventDefault();
        this.resolutionSelection = event.target.value;
    }

    async addNewJob() {
        if(!this.resolutionSelection) {
            this.setState({"error": "You have to select a resolution to convert"})
            return;
        }

        let resp = await fetch("/api/job/hls/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                fileId: this.props.fileId,
                resolution: this.resolutionSelection
            })
        }).catch(e => console.error(e));
        if(!resp) 
            throw "Failed to fetch data";

        let jsonResp = await resp.json().catch(e => console.error(e));
        if(!jsonResp)
            throw "Failed to json parse";

        if(!jsonResp.status) {
            console.log(jsonResp);
            
            this.setState({error: jsonResp.error});
            return;
        }

        this.toggleModal("Add Job API Response", JSON.stringify(jsonResp.response, null, 4));
        this.fetchData(this.props.fileId); // update
    }

    async fetchData(fileId) {
        let resp = await fetch("/api/job/hls/getConversionJobs?fileId="+fileId).catch(e => console.error(e));
        if(!resp) 
            throw "Failed to fetch data";

        let jsonResp = await resp.json().catch(e => console.error(e));
        if(!jsonResp)
            throw "Failed to json parse";

        if(!jsonResp.status) {
            console.log(jsonResp);
            
            this.setState({error: jsonResp.error});
            return;
        }

        this.setState({jobs: jsonResp.response});

    }

    async startJob(jobId) {

        let resp = await fetch("/api/job/hls/start", {
            "method": "POST",
            headers: {
                "Content-Type": "application/json"
            },
            "body": JSON.stringify({
                jobId: jobId
            })
        }).catch(e => console.error(e));
        if(!resp) 
            throw "Failed to fetch data";

        let jsonResp = await resp.json().catch(e => console.error(e));
        if(!jsonResp)
            throw "Failed to json parse";

        if(!jsonResp.status) {
            console.log(jsonResp);
    
            this.setState({error: jsonResp.error});
            return;
        }

        this.toggleModal("Start Job", JSON.stringify(jsonResp, null, 4));
    }

    updateInterval() {
        this.fetchData(this.props.fileId);
        this._updateInterval = setTimeout(() => this.updateInterval(), 5000);
    }

    toggleModal(title, content) {
        this.setState({modalTitle:title, modalContent: content, modalToggle: this.state.modalToggle + 1});
    }


    componentWillUnmount(){
        clearTimeout(this._updateInterval);
    }


    async componentDidMount() {
        this.updateInterval();
    }

    render() {
        let jobCols = this.state.jobs.map((job, index) => {
            return (<tr key={index}>
                        <th scope="row">{index}</th>
                        <td>{job._id}</td>
                        <td>{job.convertedFile}</td>
                        <td>{job.conversionType}</td>
                        <td>{job.status}</td>
                        <td>{job.aux.label}</td>
                        <td> <a className="btn btn-primary" href="#" onClick={(e) => {e.preventDefault(); this.toggleModal("Auxilary", JSON.stringify(job.aux, null, 4))}} >View</a></td>
                        <td> <a className="btn btn-primary" href="#" onClick={(e) => {e.preventDefault(); this.toggleModal("Job logs", JSON.stringify(job.messages, null, 4))}} >View</a></td>
                        <td> <a className="btn btn-primary" href="#" onClick={(e) => {e.preventDefault(); this.startJob(job._id);}}>Start</a></td>
                    </tr>);
        });

        return ( 
            <LeftAlignedDiv className="container">
                <div className="container">
                    <h6>-- Add new conversion job --</h6>
                    {this.state.error ? 
                      <div className="alert alert-warning">
                        {this.state.error}
                      </div> : null
                    }
                    <div className="form-group row">
                        <label className="col-sm-3">Conversion Type:</label>
                         <select className="col-sm-3 form-control" onChange={this.handleResolutionSelection}>
                          <option value="hls">hls</option>
                        </select>
                    </div>
                    <div className="form-group row">
                        <label className="col-sm-3">Select Resolution:</label>
                        <select className="col-sm-3 form-control" onChange={this.handleResolutionSelection}>
                          {Object.keys(this.supportedResolutions).sort((a,b) => this.supportedResolutions[a].order < this.supportedResolutions[b].order).map(resolution => {
                                return <option key={resolution} value={resolution}>{this.supportedResolutions[resolution].label}</option>
                          })}
                        </select>
                    </div>
                    <a href="" className="btn btn-primary" onClick={(e) => {e.preventDefault();this.addNewJob()}}>Add</a>
                </div>
                <Modal title={this.state.modalTitle} content={this.state.modalContent} toggle={this.state.modalToggle}/>
                <div style={{marginTop: "20px"}} className="container">
                    <table className="table table-bordered">
                          <thead>
                            <tr>
                                <th scope="col">#</th>
                                <th scope="col">Job Id</th>
                                <th scope="col">Converted FileId</th>
                                <th scope="col">Type</th>
                                <th scope="col">Status</th>
                                <th scope="col">Label</th>
                                <th scope="col">Auxilary Data</th>
                                <th scope="col">Logs</th>
                                <th scope="col"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {jobCols}
                          </tbody>
                     </table>
                </div>
            </LeftAlignedDiv>
        )
    }
}