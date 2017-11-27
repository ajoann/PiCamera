var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');

var spawn = require('child_process').spawn;
var proc;

app.use('/', express.static(path.join(__dirname, 'stream')));


app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

var sockets = {};

io.on('connection', function(socket) {

  sockets[socket.id] = socket;
  console.log("Total clients connected : ", Object.keys(sockets).length);

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
  // if (Object.keys(sockets).length == 0) {
    app.set('watchingFile', false);
    if (proc) proc.kill();
    fs.unwatchFile('./stream/image_stream.jpg');
  // }
}

function startStreaming(io) {

  if (app.get('watchingFile')) {
    io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000));
    return;
  }

  var args = ["-w", "640", "-h", "480", "-o", "./stream/image_stream.jpg", "-t", "10000", "-tl", "1000"];
  proc = spawn('raspistill', args);

  console.log('Watching for changes...');

  app.set('watchingFile', true);
  var i = 0;

  // set interval to go every 1 sec
  var intrvl = setInterval(function() {
    insertPicIntoGDrive("./stream/image_stream.jpg", i);
    console.log("emitting again");
    io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000));
    i++;
  }, 1000);
  // set timeout to clear interval after 10 seconds.
  setTimeout(function () {
    console.log("clearing interval");
    clearInterval(intrvl);
  }, 10*1000);

  // fs.watchFile('./stream/image_stream.jpg', function(current, previous) {
  //   io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000));
  // })

}

function insertPicIntoGDrive(pic, i) {
  // code to save pic to google drive:
  // THIS CODE IS ADAPTED FROM GOOGLE'S TUTORIALs:
  // https://developers.google.com/drive/v2/web/manage-uploads
  // https://github.com/google/google-api-nodejs-client#oauth2-client
  var readline = require('readline');
  var google = require('googleapis');
  var googleAuth = require('google-auth-library');
  var axios = require('axios');
  // var ImageModel = require('./models/models').ImageModel;
  // var axios = require('axios');

  // If modifying these scopes, delete your previously saved credentials
  // at ~/.credentials/drive-nodejs-quickstart.json
  const MY_PICTURE_FOLDER = '0B7knwYcCq901X2l1NXZZblB0blU';

  var SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive/file'];
  var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
  var TOKEN_PATH = TOKEN_DIR + 'drive-nodejs-quickstart.json';
  // Load client secrets from a local file.
  fs.readFile('/home/pi/Public/Mirror/backend/client_secret.json', function processClientSecrets(err, content) {
    console.log('1');
    if (err) {
      console.log('Error loading client secret file: ' + err);
      return;
    }
    // Authorize a client with the loaded credentials, then call the
    // Drive API.
    setTimeout(function(){authorize(JSON.parse(content), insertPicture)}, 10000);
  });
  /**
    * Create an OAuth2 client with the given credentials, and then execute the
    * given callback function.
    *
    * @param {Object} credentials The authorization client credentials.
    * @param {function} callback The callback to call with the authorized client.
    */
  function authorize(credentials, callback) {
    console.log('2');

    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function(err, token) {
      if (err) {
        getNewToken(oauth2Client, callback);
      } else {
        console.log('3');
        oauth2Client.credentials = JSON.parse(token);
        callback(oauth2Client);
      }
    });
  }

  /**
    * Get and store new token after prompting for user authorization, and then
    * execute the given callback with the authorized OAuth2 client.
    *
    * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
    * @param {getEventsCallback} callback The callback to call with the authorized
    *     client.
    */
  function getNewToken(oauth2Client, callback) {
    console.log('4');
    var authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
      rl.close();
      oauth2Client.getToken(code, function(err, token) {
        console.log('5');
        if (err) {
          console.log('Error while trying to retrieve access token', err);
          return;
        }
        oauth2Client.credentials = token;
        storeToken(token);
        callback(oauth2Client);
      });
    });
  }
  /**
    * Store token to disk be used in later program executions.
    *
    * @param {Object} token The token to store to disk.
    */
  function storeToken(token) {
    try {
      console.log('6');
      fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
      if (err.code != 'EEXIST') {
        throw err;
      }
    }
    console.log('7');
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
  }

  /**
    * Lists the names and IDs of up to 10 files.
    *
    * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
    */
  function insertPicture(auth) {

    var drive = google.drive('v2');
    // var fs = require('fs');

    picName = pic.split('/');
    picName = picName[picName.length-1] + i;
    console.log("pic name: ", picName);
    var fileMetadata = {
      name: picName,
      mimeType: 'image/jpg',
      title: picName,
      parents: MY_PICTURE_FOLDER ? [{id: MY_PICTURE_FOLDER}] : []
    };

    var media = {
      mimeType: 'image/jpg',
      body: fs.createReadStream(pic)
    };

    drive.files.insert({
      resource: fileMetadata,
      media: media,
      auth: auth,
      fields: 'id',
      title: fileMetadata.title
    }, function(err, file) {
      if(err) {
        console.log(err);
        return;
      } else {
        console.log("inserted file", file);
        // drive.files.get({
        //    fileId: file.id,
        //    auth: auth,
        // }, function (err, stuff) {
        //   if(err) {
        //     console.log(err);
        //     return;
        //   }
        //   console.log("got file", stuff.id);
          // else {
          //   // console.log('RESPONSE: ', stuff);
          //   sendMessage(stuff.embedLink);
          //   var image = new ImageModel({
          //     link : stuff.embedLink
          //   });
          //   axios.get('http://api.openweathermap.org/data/2.5/weather?q=SanFrancisco&APPID=89fdd5afd3758c1feb06e06a64c55260')
          //   .then( resp => {
          //     image.description = resp.data.weather[0].description;
          //     image.min =  resp.data.main.temp_min-273.15;
          //     image.max =  resp.data.main.temp_max-273.15;
          //
          //     image.save();
          //   })
            // .catch( err => {
            //   console.log (':( error', err);
            // })
          // }
        // });
      }
    });
  }
}
