var http = require('http');
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..', 'src');
var mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png'
};
http.createServer(function (req, res) {
  var urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') { urlPath = '/default.html'; }
  var file = path.normalize(path.join(root, urlPath));
  if (file.indexOf(root) !== 0) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8765, '127.0.0.1', function () {
  console.log('static server on http://127.0.0.1:8765/');
});
