// CODE SAMPLE TAKEN FROM: http://thejackalofjavascript.com/rpi-live-streaming/ tutorial

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');

var spawn = require('child_process').spawn;
var proc;
var url;

app.use('/', express.static(path.join(__dirname, 'stream')));


app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

var sockets = {};

io.on('connection', function(socket) {

  sockets[socket.id] = socket;
  console.log("Total clients connected : ", Object.keys(sockets).length);
  socket.emit('connection');

  socket.on('disconnect', function() {
    delete sockets[socket.id];

    // no more sockets, kill the stream
    if (Object.keys(sockets).length == 0) {
      app.set('watchingFile', false);
      if (proc) proc.kill();
      fs.unwatchFile('./stream/image_stream.jpg');
    }
  });

  socket.on('start-stream', function() {
    startStreaming(io);
  });

  socket.on('stop-stream', function() {
    stopStreaming();
  });

});

http.listen(3000, function() {
  console.log('listening on *:3000');
});

function stopStreaming() {
  console.log("going to stop proc:", proc.spawnargs);
  // if (Object.keys(sockets).length == 0) {
    app.set('watchingFile', false);
    if (proc) proc.kill();
    fs.unwatchFile('./stream/image_stream.jpg');
    console.log("stopping streaming");

    io.sockets.emit('stopStream', url);

  // }
}

function startStreaming(io) {
  console.log("starting streaming");

  if (app.get('watchingFile')) {
    console.log("starting streaming with url", url);
    url = 'image_stream.jpg?_t=' + (Math.random() * 100000);
    io.sockets.emit('liveStream', url);
    return;
  }

  var args = ["-w", "400", "-h", "300", "-o", "./stream/image_stream.jpg", "-t", "10000", "-tl", "10"];
  proc = spawn('raspistill', args);

  console.log('Watching for changes...');

  app.set('watchingFile', true);

  fs.watchFile('./stream/image_stream.jpg', function(current, previous) {
    console.log("starting streaming with url", url);
    url = 'image_stream.jpg?_t=' + (Math.random() * 100000);
    io.sockets.emit('liveStream', url);
  })

}
