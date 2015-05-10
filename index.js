var express = require('express'),
  OpenTok = require('opentok'),
  reactTools = require('react-tools');

var apiKey = process.env.API_KEY,
  apiSecret = process.env.API_SECRET;

// check apiKey and secretKey
if (!apiKey || !apiSecret) {
  console.log('Missing API_KEY or API_SECRET');
  process.exit(1);
}

// Initialize app and opentok
var app = express();
app.set('port', process.env.PORT || 8888);
app.use(express.static(__dirname + '/public'));
var opentok = new OpenTok(apiKey, apiSecret);

// start opentok session
// NOTE: this is slow depending on the network connection
console.log(new Date().toISOString().slice(0, 16), 'Starting OpenTok session...');
opentok.createSession({
  mediaMode: 'routed'
}, function (err, session) {
  if (err) throw err;
  app.set('sessionId', session.sessionId);
  console.log('sessionID:', session.sessionId);
  init();
});

app.use(function (req, res, next) {

  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', true);

  // Pass to next layer of middleware
  next();
});

app.get('/', function (req, res) {
  res.render('index.ejs');
});

app.get('/host', function (req, res) {
  var sessionId = app.get('sessionId'),
    // generate token for host client
    token = opentok.generateToken(sessionId, {
      role: 'moderator'
    });

  res.render('host.ejs', {
    apiKey: apiKey,
    sessionId: sessionId,
    token: token
  });
});

app.get('/participant', function (req, res) {
  var sessionId = app.get('sessionId'),
    // generate token for participant client
    token = opentok.generateToken(sessionId, {
      role: 'moderator'
    });

  res.render('participant.ejs', {
    apiKey: apiKey,
    sessionId: sessionId,
    token: token
  });
});

app.get('/archives', function (req, res) {
  var page = req.param('page') || 1,
    offset = (page - 1) * 5;
  opentok.listArchives({
    offset: offset,
    count: 5
  }, function (err, archives, count) {
    if (err) return res.send(500, 'Unable to list archives. err msg=' + err.message);
    res.render('archives.ejs', {
      archives: archives,
      showPrevious: page > 1 ? ('/archives?page=' + (page - 1)) : null,
      showNext: (count > offset + 5) ? ('/archives?page=' + (page + 1)) : null
    });
  });
});

app.get('/start', function (req, res) {
  opentok.startArchive(app.get('sessionId'), {
    name: 'ChatShow Archive ' + new Date().toISOString().slice(0, 10)
  }, function (err, archive) {
    if (err) {
      var msg = 'Unable to start archive for session ' + sessionId + '. err msg=' + err.message;
      console.log('ERROR: ', msg);
      return res.send(500, msg);
    }

    // success started recording
    console.log('Starting recording success');
    res.json(archive);
  });
});

app.get('/stop/:archiveId', function (req, res) {
  var archiveId = req.param('archiveId');
  opentok.stopArchive(archiveId, function (err, archive) {
    if (err) return res.send(500, 'Could not stop archive ' + archiveId + '. error=' + err.message);
    console.log('Stoping recording');
    res.json(archive);
  });
});

app.get('/download/:archiveId', function (req, res) {
  var archiveId = req.param('archiveId');
  opentok.getArchive(archiveId, function (err, archive) {
    if (err) {
      var msg = 'Could not get archive ' + archiveId + '. error=' + err.message;
      console.log(msg);
      return res.send(500, msg);
    }
    res.redirect(archive.url);
  });
});

app.get('/embed.js', function (req, res) {
  var sessionId = req.query.ssid;

  res.setHeader('content-type', 'text/javascript');
  res.render('embedable.ejs', {
    sessionId: sessionId,
    serverHost: req.headers.host
  });
});

app.get('/stream_widget.js', function (req, res) {
  var sessionId = req.query.ssid;
  var token = opentok.generateToken(sessionId);

  res.setHeader('content-type', 'text/javascript');
  res.render('stream_widget.ejs', {
    apiKey: apiKey,
    sessionId: sessionId,
    token: token
  }, function(err, html){
    var response = reactTools.transform(html);
    res.send(response);
  });
});



// Start server
function init() {
  app.listen(app.get('port'), function () {
    console.log('Starting server at http://127.0.0.1:8888/');
  });
}