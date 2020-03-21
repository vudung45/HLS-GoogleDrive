import express from "express";
const serveStatic = require('serve-static');
const path = require('path');

const app = express({ strict: true });
app.enable('strict routing');

// Middleware
app.use(express.json())

const importMedia = require("./routes/api/upload.js");
const chunksApi = require("./routes/api/chunk.js");
const watchApi = require("./routes/api/watch.js");
const hlsjob = require("./routes/api/hlsjob.js");

app.use(serveStatic(path.join(__dirname,'../../webfrontend/build')));
app.use("/api/upload/", importMedia);
app.use("/api/job/hls", hlsjob);
app.use("/api/chunk", chunksApi);
app.use("/api/watch", watchApi);
app.get('*', (req,res) =>{
    res.sendFile(path.join(__dirname,'../../webfrontend/build/index.html'));
});

const port = process.env.PORT || 5001

app.listen(port, () => console.log(`Server started on port ${port}`))