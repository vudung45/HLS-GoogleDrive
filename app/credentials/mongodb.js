
module.exports = {
    "loginURI" : process.env.MONGOURI ? process.env.MONGOURI : "",
    "dbName": process.env.NODE_ENV == "production" ? "hls" : "hls_test"
}