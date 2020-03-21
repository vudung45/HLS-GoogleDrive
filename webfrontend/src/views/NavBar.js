import React from 'react';
import { Link } from "react-router-dom";


export default class SideBar extends React.Component {
    constructor(props) {
        super(props)
    }

    componentDidMount() {
           
    }

    render() {
        return (
            <nav className="navbar navbar-expand-md navbar-dark bg-dark">
                <Link className="navbar-brand" to="/">EZStream</Link>
                <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarCollapse" aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
                  <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse" id="navbarCollapse">
                  <ul className="navbar-nav mr-auto">
                    <li className="nav-item active">
                      <Link className="nav-link" to="/">Home <span className="sr-only">(current)</span></Link>
                    </li>
                    <li className="nav-item">
                      <a className="nav-link" href="#">Link</a>
                    </li>
                  </ul>
                </div>
            </nav>
      )

    }
}