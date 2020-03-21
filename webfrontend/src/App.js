import React from 'react';
import { BrowserRouter as Router,
  Switch,
  Route,
  Link,
  useLocation} from "react-router-dom";

import logo from './logo.svg';
import UploadVideo from "./views/UploadVideo.js";
import UploadInfo from "./views/UploadInfo.js";
import NavBar from "./views/NavBar.js";
import WatchBox from "./views/WatchBox.js";


import './App.css';

// A custom hook that builds on useLocation to parse
// the query string for you.
function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function QueryParser() {
  let query = useQuery();
  return (<div>
        <header>
          <NavBar />
        </header>
        <div className="container">
          <Switch>
            <Route exact path="/">
              <UploadVideo />
            </Route>
            <Route path="/uploadInfo/:uploadId">
              <UploadInfo />
            </Route>
            <Route path="/watch" >
              <WatchBox fileId={query.get("fileId")} uploadId={query.get("uploadId")} mediaType={query.get("mediaType") ? query.get("mediaType"): "hls"}/>
            </Route>
          </Switch>
        </div>
      </div>);
}


function App() {
  return (
    <Router>
        <QueryParser />
    </Router>
  );
}


export default App;
