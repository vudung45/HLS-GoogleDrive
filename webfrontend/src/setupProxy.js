const proxy = require('http-proxy-middleware');
const CONFIG = require('./config.js')

module.exports = function(app) {
  app.use(
    '/api',
    proxy.createProxyMiddleware({
      target: CONFIG.API_SERVER,
      changeOrigin: true,
    })
  );
};