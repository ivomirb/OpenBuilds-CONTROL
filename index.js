process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = '1';

var foceShowGui = false;

process.on('uncaughtException', function(err) {
  if (DEBUG) {
    debug_log(err)
  } else {
    console.log(err);
  }
})

// To see console.log output run with `DEBUGCONTROL=true electron .` or set environment variable for DEBUGCONTROL=true
// debug_log debug overhead
var DEBUG = false;
if (process.env.DEBUGCONTROL) {
  DEBUG = true;
  console.log("Console Debugging Enabled")
}

function debug_log() {
  if (DEBUG) {
    console.log.apply(this, arguments);
  }
} // end Debug Logger

debug_log("Starting OpenBuilds CONTROL v" + require('./package').version)

var config = {};
config.webPorts = [3000, 3020, 3200, 3220];
config.webPortIdx = 0;
config.nextWebPort = function() {
  config.webPort = config.webPorts[config.webPortIdx]
  config.webPortIdx++
  if (config.webPortIdx == config.webPorts.length) {
    throw new Error(`No ports were available to start the http server.\r\rWe tried ports ${config.webPorts.join(",")}.`);
  }
  return config.webPort;
}
config.webPort = process.env.WEB_PORT || config.nextWebPort();
config.posDecimals = process.env.DRO_DECIMALS || 3;
config.singleCommandMode = true; // set to false to send as many commands as will fit in the RX buffer
config.aggressiveHomeReset = true;
config.maxRecentFiles = 10;

// Individual settings are stored and restores wholesale.
// If you add a new sub-field to the initial settings, it will be destroyed on load
var persistentConfig = {
  autoStart: true,
  defaultPaths: {},
  recentFiles: [],
  persistDisplayMode: false,
  grblWaitTime1: 3, // timeout for the first handshake attempt (Cltr+X)
  grblWaitTime2: 3, // timeout for the second handshake attempt (DTR Enable)
};

var express = require("express");
var app = express();
var http = require("http").Server(app);
var https = require('https');

const {
  Server: ioServer
} = require('socket.io');

var io = new ioServer();

var fs = require('fs');
var path = require("path");
const join = require('path').join;
const {
  mkdirp
} = require('mkdirp')


function savePersistentConfig() {
  try {
    var text = JSON.stringify(persistentConfig, null, 2);
    fs.writeFileSync(configFilePath, text, 'utf8');
  } catch (err) {}
}

function loadPersistentConfig() {
  try {
    var text = fs.readFileSync(configFilePath, 'utf8');
    var stored = JSON.parse(text);
    for (var prop in stored) {
      if (prop in persistentConfig && typeof(stored[prop]) == typeof(persistentConfig[prop])) {
        persistentConfig[prop] = stored[prop];
      }
    }
  } catch (err) {}

  persistentConfig.grblWaitTime1 = Math.max(persistentConfig.grblWaitTime1, 0.1);
  persistentConfig.grblWaitTime2 = Math.max(persistentConfig.grblWaitTime2, 0.1);
}

// FluidNC test
var fluidncConfig = "";
// FluidNC end test

app.use(express.static(path.join(__dirname, "app")));
//app.use(express.limit('200M'));

app.use(function setCommonHeaders(req, res, next) {
  res.set("Access-Control-Allow-Private-Network", "true");
  next();
});

app.all('/*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.header("Access-Control-Allow-Private-Network", "true");
  next();
});


// Interface firmware flash
app.post('/uploadCustomFirmware', (req, res) => {
  // 'firmwareBin' is the name of our file input field in the HTML form
  let upload = multer({
    storage: uploadFileStorage
  }).single('firmwareBin');

  upload(req, res, function(err) {
    // req.file contains information of uploaded file
    // req.body contains information of text fields, if there were any
    if (err instanceof multer.MulterError) {
      return res.send(err);
    } else if (err) {
      return res.send(err);
    }

    // Display uploaded image for user validation
    firmwareImagePath = req.file.path;
    res.send(req.file.path);
  });
});
// end Interface Firmware flash


//Note when renewing Convert zerossl cert first `openssl.exe rsa -in domain-key.key -out domain-key.key`
// fix error:    App threw an error during load
//               Error: error:06000066:public key routines:OPENSSL_internal:DECODE_ERROR

var httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'privkey1.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'fullchain1.pem'))
};

const httpsserver = https.createServer(httpsOptions, app).listen(3001, function() {
  debug_log('https: listening on:' + ip.address() + ":3001");
});

const httpserver = http.listen(config.webPort, '0.0.0.0', httpServerSuccess).on('error', httpServerError);

function httpServerSuccess() {
  debug_log('http:  listening on:' + ip.address() + ":" + config.webPort);
  if (jogWindow) {
    jogWindow.loadURL(`http://localhost:${config.webPort}/`);
  }
}

function httpServerError(error) {
  // If unable to start (port in use) - try next port in array from config.nextWebPort()
  console.error(error.message);
  httpserver.listen(config.nextWebPort());
}

io.attach(httpserver);
io.attach(httpsserver);

const grblStrings = require("./grblStrings.js");

// Serial
const {
  SerialPort
} = require('serialport')
const {
  ReadlineParser
} = require('@serialport/parser-readline')

var port;
var connectTimeout;


// telnet
const net = require('net');
var ip = require("ip");
const Evilscan = require('evilscan');

var md5 = require('md5');
var _ = require('lodash');
var formidable = require('formidable')
var lastsentuploadprogress = 0;

// Electron app
const electron = require('electron');
const electronApp = electron.app;

electronApp.setAppUserModelId("openbuilds.control")

const {
  dialog
} = require('electron')
electronApp.commandLine.appendSwitch('ignore-gpu-blacklist')
electronApp.commandLine.appendSwitch('enable-gpu-rasterization')
electronApp.commandLine.appendSwitch('enable-zero-copy')
debug_log("Local User Data: " + electronApp.getPath('userData'))

const BrowserWindow = electron.BrowserWindow;
const Tray = electron.Tray;
const nativeImage = require('electron').nativeImage
const Menu = require('electron').Menu
var forceQuit

var appIcon = null,
  jogWindow = null;
var autoUpdater


var updateIsDownloading = false;
{
  autoUpdater = require("electron-updater").autoUpdater
  var availversion = '0.0.0'

  autoUpdater.on('checking-for-update', () => {
    var string = 'Starting update... Please wait';
    var output = {
      'command': 'autoupdate',
      'response': string
    }
    io.sockets.emit('updatedata', output);
  })
  autoUpdater.on('update-available', (ev, info) => {
    updateIsDownloading = true;
    var string = "Starting Download: v" + ev.version;
    availversion = ev.version
    var output = {
      'command': 'autoupdate',
      'response': string
    }
    io.sockets.emit('updatedata', output);
    debug_log(JSON.stringify(ev))
  })
  autoUpdater.on('update-not-available', (ev, info) => {
    var string = 'Update not available. Installed version: ' + require('./package').version + " / Available version: " + ev.version + ".\n";
    if (require('./package').version === ev.version) {
      string += "You are already running the latest version!"
    }
    var output = {
      'command': 'autoupdate',
      'response': string
    }
    io.sockets.emit('updatedata', output);
    debug_log(JSON.stringify(ev))
  })
  autoUpdater.on('error', (ev, err) => {
    if (err) {
      var string = 'Error in auto-updater: \n' + err.split('SyntaxError')[0];
    } else {
      var string = 'Error in auto-updater';
    }
    var output = {
      'command': 'autoupdate',
      'response': string
    }
    io.sockets.emit('updatedata', output);
  })
  autoUpdater.on('download-progress', (ev, progressObj) => {
    updateIsDownloading = true;
    var string = 'Download update ... ' + ev.percent.toFixed(1) + '%';
    debug_log(string)
    var output = {
      'command': 'autoupdate',
      'response': string
    }
    io.sockets.emit('updatedata', output);
    io.sockets.emit('updateprogress', ev.percent.toFixed(0));
  })

  autoUpdater.on('update-downloaded', (info) => {
    var string = "New update ready";
    var output = {
      'command': 'autoupdate',
      'response': string
    }
    io.sockets.emit('updatedata', output);
    io.sockets.emit('updateready', availversion);
    // repeat every minute
    setTimeout(function() {
      io.sockets.emit('updateready', availversion);
    }, 1000 * 60 * 60 * 8) // 8hrs before alerting again if it was snoozed
    updateIsDownloading = false;
  });
}

var uploadsDir = electronApp.getPath('userData') + '/upload/';
var configDir = electronApp.getPath('userData');

var jobStartTime = false;
var jobIsJob = false;
var jobStatusInternal = 0; // 0 - no job, 1 - running, 2 - jog job running, 3 - wait for idle, 4 - jog job waiting for idle
var jobCompletedMsg = ""; // message sent when job is done
var uploadedgcode = ""; // var to store uploaded gcode
var uploadedworkspace = ""; // var to store uploaded OpenBuildsCAM Workspace

mkdirp(uploadsDir).then(made =>
  debug_log('Created Uploads Temp Directory'))

// Check USB Selective Suspend Settings
function checkPowerSettings() {
  if (process.platform == 'win32') {
    debug_log("Checking Power Settings")
    var powerplan = "",
      usbselectiveAC = false,
      usbselectiveDC = false;
    const {
      exec
    } = require('child_process');

    const cfg = exec('powercfg /GETACTIVESCHEME', function(error, stdout, stderr) {
      if (error) {
        debug_log(error.stack);
        debug_log('Error code: ' + error.code);
        debug_log('Signal received: ' + error.signal);
      }
      // console.log('Child Process STDOUT: ' + stdout);
      // console.log('Child Process STDERR: ' + stderr);
      powerplan = stdout.split(":")[1].split("()")[0].trim()
    });

    cfg.on('exit', function(code) {
      debug_log('powercfg /GETACTIVESCHEME exited with exit code ' + code);
      if (code == 0) {
        const usbsetting = exec('powercfg /q ' + powerplan, function(error, stdout, stderr) {
          if (error) {
            debug_log(error.stack);
            debug_log('Error code: ' + error.code);
            debug_log('Signal received: ' + error.signal);
          }
          // console.log('Child Process STDOUT: ' + stdout);
          // console.log('Child Process STDERR: ' + stderr);
          usbselective = (stdout.slice(stdout.search("USB selective suspend setting") - 1)).split("\n")
          usbselective.length = 7;

          if (usbselective[5].indexOf("0x00000000") != -1) {
            debug_log("USB Selective Suspend DISABLED on AC power ")
            status.driver.powersettings.usbselectiveAC = false;
          } else if (usbselective[5].indexOf("0x00000001") != -1) {
            debug_log("USB Selective Suspend ENABLED on AC power ")
            status.driver.powersettings.usbselectiveAC = true;
          }

          if (usbselective[6].indexOf("0x00000000") != -1) {
            debug_log("USB Selective Suspend DISABLED on DC power ")
            status.driver.powersettings.usbselectiveDC = false;
          } else if (usbselective[6].indexOf("0x00000001") != -1) {
            debug_log("USB Selective Suspend ENABLED on DC power ")
            status.driver.powersettings.usbselectiveDC = true;
          }
        });
        usbsetting.on('exit', function(code) {
          debug_log('powercfg /q exited with exit code ' + code);
          setTimeout(function() {
            debug_log(status.driver.powersettings.usbselectiveDC, status.driver.powersettings.usbselectiveAC)
          }, 100);
        })
      }
    });
    //  end USB Selective Suspend
  }
}

function setAutoStart(enabled) {
  if (enabled != persistentConfig.autoStart) {
    persistentConfig.autoStart = enabled;
    status.misc.autoStart = enabled;
    savePersistentConfig();
    electronApp.setLoginItemSettings({
      openAtLogin: enabled,
      args: []
    })
    if (enabled) {
      if (!appIcon) {
        createTrayIcon();
      }
    }
    else {
      if (appIcon) {
        appIcon.destroy();
        appIcon = null;
      }
    }
  }
}

var oldiplist;
var oldpinslist;
const iconPath = path.join(__dirname, 'app/icon.png');
const iconNoComm = path.join(__dirname, 'app/icon-notconnected.png');
const iconPlay = path.join(__dirname, 'app/icon-play.png');
const iconStop = path.join(__dirname, 'app/icon-stop.png');
const iconPause = path.join(__dirname, 'app/icon-pause.png');
const iconAlarm = path.join(__dirname, 'app/icon-bell.png');
const configFilePath = path.join(configDir, "config.json");

var iosocket;
var lastCommand = false
var gcodeQueue = [];
var queuePointer = 0;
var statusLoop;
var frontEndUpdateLoop, sysinfoUpdateLoop

var queueCounter;
var listPortsLoop;

var GRBL_RX_BUFFER_SIZE = 127; // 128 characters
var GRBLHAL_RX_BUFFER_SIZE = 1023; // 128 characters
var sentBuffer = [];

var feedOverride = 100,
  spindleOverride = 100;


//regex to identify MD5hash on sdupload later
var re = new RegExp("^[a-f0-9]{32}");

var status = {
  driver: {
    version: require('./package').version,
    ipaddress: ip.address(),
    operatingsystem: false,
    powersettings: {
      usbselectiveAC: null,
      usbselectiveDC: null
    },
  },
  machine: {
    name: '',
    has4thAxis: false,
    inputs: [],
    overrides: {
      feedOverride: 100, //
      spindleOverride: 100, //
      realFeed: 0, //
      realSpindle: 0 //
    },
    //
    tool: {
      nexttool: {
        number: 0,
        line: ""
      }
    },
    modals: {
      //motionmode: "G0", // G0, G1, G2, G3, G38.2, G38.3, G38.4, G38.5, G80
      coordinatesys: "G54", // G54, G55, G56, G57, G58, G59
      plane: "G17", // G17, G18, G19
      distancemode: "G90", // G90, G91
      arcdistmode: "G91.1", // G91.1
      feedratemode: "G94", // G93, G94
      unitsmode: "G21", // G20, G21
      radiuscomp: "G40", // G40
      tlomode: "G49", // G43.1, G49
      // programmode: "M0", // M0, M1, M2, M30
      spindlestate: "M5", // M3, M4, M5
      coolantstate: "M9", // M7, M8, M9
      homedRecently: false
      // tool: "0",
    },
    probe: {
      x: 0.00,
      y: 0.00,
      z: 0.00,
      state: -1
    },
    position: {
      work: {
        x: 0,
        y: 0,
        z: 0,
        a: 0,
        e: 0
      },
      offset: {
        x: 0,
        y: 0,
        z: 0,
        a: 0,
        e: 0
      }

    },
    firmware: {
      type: "",
      platform: "",
      version: "",
      date: "",
      buffer: [],
      features: [],
      blockBufferSize: 0,
      rxBufferSize: 0,
    },
  },
  comms: {
    connectionStatus: 0, //0 = not connected, 1 = opening, 2 = connected, 3 = playing, 4 = paused, 5 = alarm, 6 = firmware upgrade
    runStatus: "Pending",
    queue: 0,
    blocked: false,
    paused: false,
    interfaces: {
      type: "",
      ports: "",
      networkDevices: [],
      activePort: "" // or activeIP in the case of wifi/telnet?
    },
    alarm: ""
  },
  interface: {
    diskdrive: false,
    firmware: {
      availVersion: "",
      installedVersion: "",
    },
    connected: false,
  },
  misc: { // information to pass to the frontend
    jobStatus: 0, // 0 - no job, 1 - running, 2 - jog job running (can't be paused)
    autoStart: true,
    lastFilePath: "",
  },
};


async function findPorts() {
  const ports = await SerialPort.list()
  // console.log(ports)
  status.comms.interfaces.ports = ports;
  for (var i = 0; i < status.comms.interfaces.ports.length; i++) {
    var data = friendlyPort(status.comms.interfaces.ports[i])
    status.comms.interfaces.ports[i].img = data.img;
    status.comms.interfaces.ports[i].note = data.note;
  }
}
findPorts()

// async function findDisks() {
//   const drives = await drivelist.list();
//   status.interface.diskdrives = drives;
// } // removed in 1.0.350 due to Drivelist stability issues

var PortCheckinterval = setInterval(function() {
  if (status.comms.connectionStatus == 0) {
    findPorts();
  }
  //findDisks(); // removed in 1.0.350 due to Drivelist stability issues
}, 1000);

// var telnetCheckinterval = setInterval(function() {
//   if (status.comms.connectionStatus == 0) {
//     scanForTelnetDevices();
//   }
// }, 30000);
// scanForTelnetDevices();

checkPowerSettings()

// JSON API
app.get('/api/version', (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  data = {
    "application": "OMD",
    "version": require('./package').version,
    "ipaddress": ip.address() + ":" + config.webPort
  }
  res.send(JSON.stringify(data), null, 2);
})

app.get('/activate', (req, res) => {
  debug_log(req.hostname)
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.send('Host: ' + req.hostname + ' asked to activate OpenBuilds CONTROL v' + require('./package').version);
  showJogWindow()
  setTimeout(function() {
    io.sockets.emit('activate', req.hostname);
  }, 500);
})

// Upload
app.get('/upload', (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.sendFile(__dirname + '/app/upload.html');
})

app.get('/gcode', (req, res) => {
  if (uploadedgcode.indexOf('$') != 0) { // Ignore grblSettings jobs
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.send(uploadedgcode);
  }
})

app.get('/workspace', (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.send(uploadedworkspace);
})

// http-post version of runJob


app.post('/runjob', (req, res) => {
  let upload = multer({
    storage: memoryStorage
  }).single('file');

  upload(req, res, function(err) {
    // req.file contains information of uploaded file
    // req.body contains information of text fields, if there were any
    if (err instanceof multer.MulterError) {
      return res.send(err);
    } else if (err) {
      return res.send(err);
    }
    var object = {
      isJob: true,
      data: req.file.buffer.toString(),
    }
    runJob(object)

    res.send(`Running ` + req.file.path);

  });
});


// Saves a file to disk
app.post('/saveFile', (req, res) => {
  let upload = multer({
    preservePath: true,
    storage: saveFileStorage
  }).single('file');

  upload(req, res, function(err) {
    if (err) {
      if (req.body.showErrorDlg == "true") {
        dialog.showMessageBox(jogWindow, {
          type: 'error',
          buttons: ['OK'],
          message: err.toString()
        });
      }
      res.send(err.toString());
    } else {
      if (req.body.updateLastFilePath == "true") {
        status.misc.lastFilePath = req.file.originalname;
        addRecentFile(req.file.originalname);
      }
      res.send("");
    }
  });
});

// File Post
app.post('/upload', function(req, res) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  //debug_log(req)
  uploadprogress = 0
  var form = new formidable.IncomingForm();
  form.maxFileSize = 300 * 1024 * 1024;
  form.parse(req, function(err, fields, files) {
    // debug_log(files);
  });

  form.on('fileBegin', function(name, file) {
    debug_log(JSON.stringify(name));
    debug_log(JSON.stringify(file));
    debug_log('Uploading ' + file.filepath);
  });

  form.on('progress', function(bytesReceived, bytesExpected) {
    uploadprogress = parseInt(((bytesReceived * 100) / bytesExpected).toFixed(0));
    if (uploadprogress != lastsentuploadprogress) {
      lastsentuploadprogress = uploadprogress;
    }
    debug_log('Progress ' + uploadprogress + "% / " + bytesReceived + "b");

  });

  form.on('file', function(name, file) {
    debug_log('Uploaded ' + file.filepath);
    showJogWindow()
    readFile(file.filepath, true);
  });

  form.on('aborted', function() {
    // Emitted when the request was aborted by the user. Right now this can be due to a 'timeout' or 'close' event on the socket. After this event is emitted, an error event will follow. In the future there will be a separate 'timeout' event (needs a change in the node core).
  });

  form.on('end', function() {
    //Emitted when the entire request has been received, and all contained files have finished flushing to disk. This is a great place for you to send your response.
    res.end();

  });

  res.sendFile(__dirname + '/app/upload.html');
});

app.on('certificate-error', function(event, webContents, url, error,
  certificate, callback) {
  event.preventDefault();
  callback(true);
});

// Handles the data coming from the controller
function onParserData(data) {
  var command = sentBuffer[0];

  if (command == "$CD" && data != "ok") {
    fluidncConfig = fluidncConfig += data + "\n"
  }

  if (data.indexOf("<") != 0) {
    debug_log('data:', data)
  }

  // Grbl $I parser
  if (data.indexOf("[VER:") === 0) {
    // Extracting the full version (1.1f)
    const version = data.split(':')[1].split('.')[0] + '.' + data.split(':')[1].split('.')[1];
    // Extracting the date (20240402)
    const date = data.split(':')[1].split('.')[2];

    status.machine.firmware.version = version;
    status.machine.firmware.date = date;

    io.sockets.emit("status", status);

    status.machine.name = data.split(':')[2].split(']')[0].toLowerCase()
    io.sockets.emit("machinename", data.split(':')[2].split(']')[0].toLowerCase());
  }

  if (data.indexOf("[OPT:") === 0) {

    var startOpt = data.search(/opt:/i) + 4;
    var grblOpt;
    if (startOpt > 4) {
      var grblOptLen = data.substr(startOpt).search(/]/);
      grblOpts = data.substr(startOpt, grblOptLen).split(/,/);

      status.machine.firmware.blockBufferSize = grblOpts[1];
      status.machine.firmware.rxBufferSize = grblOpts[2];

      var features = []

      var i = grblOpts[0].length;
      while (i--) {
        features.push(grblOpts[0].charAt(i))
        switch (grblOpts[0].charAt(i)) {
          case 'Q':
            debug_log('SPINDLE_IS_SERVO Enabled')
            //
            break;
          case 'V': // Variable spindle enabled
            debug_log('Variable spindle enabled')
            //
            break;
          case 'N': // Line numbers enabled
            debug_log('Line numbers enabled')
            //
            break;
          case 'M': // Mist coolant enabled
            debug_log('Mist coolant enabled')
            //
            break;
          case 'C': // CoreXY enabled
            debug_log('CoreXY enabled')
            //
            break;
          case 'P': // Parking motion enabled
            debug_log('Parking motion enabled')
            //
            break;
          case 'Z': // Homing force origin enabled
            debug_log('Homing force origin enabled')
            //
            break;
          case 'H': // Homing single axis enabled
            debug_log('Homing single axis enabled')
            //
            break;
          case 'T': // Two limit switches on axis enabled
            debug_log('Two limit switches on axis enabled')
            //
            break;
          case 'A': // Allow feed rate overrides in probe cycles
            debug_log('Allow feed rate overrides in probe cycles')
            //
            break;
          case '$': // Restore EEPROM $ settings disabled
            debug_log('Restore EEPROM $ settings disabled')
            //
            break;
          case '#': // Restore EEPROM parameter data disabled
            debug_log('Restore EEPROM parameter data disabled')
            //
            break;
          case 'I': // Build info write user string disabled
            debug_log('Build info write user string disabled')
            //
            break;
          case 'E': // Force sync upon EEPROM write disabled
            debug_log('Force sync upon EEPROM write disabled')
            //
            break;
          case 'W': // Force sync upon work coordinate offset change disabled
            debug_log('Force sync upon work coordinate offset change disabled')
            //
            break;
          case 'L': // Homing init lock sets Grbl into an alarm state upon power up
            debug_log('Homing init lock sets Grbl into an alarm state upon power up')
            //
            break;
        }
      }
      status.machine.firmware.features = features;
      io.sockets.emit("features", features);
    }
  }

  // [PRB:0.000,0.000,0.000:0]
  if (data.indexOf("[PRB:") === 0) {
    debug_log(data)
    var prbLen = data.substr(5).search(/\]/);
    var prbData = data.substr(5, prbLen).split(/,/);
    var success = data.split(':')[2].split(']')[0];
    status.machine.probe.x = prbData[0];
    status.machine.probe.y = prbData[1];
    status.machine.probe.z = prbData[2].split(':')[0];
    status.machine.probe.state = success;
    if (command != "$#" && command != undefined) {
      if (success > 0) {
        var output = {
          'command': '[ PROBE ]',
          'response': "Probe Completed.",
          'type': 'success'
        }
        io.sockets.emit('data', output);
      } else {
        var output = {
          'command': '[ PROBE ]',
          'response': "Probe move ERROR - probe did not make contact within specified distance",
          'type': 'error'
        }
        io.sockets.emit('data', output);
      }
    }

    io.sockets.emit('prbResult', status.machine.probe);
  };

  if (data.indexOf("[GC:") === 0) {
    gotModals(data)
  }

  if (data.indexOf("[INTF:") === 0) {
    var output = {
      'command': 'connect',
      'response': "Detected an OpenBuilds Interface on port " + port.path,
      'type': 'success'
    }
    io.sockets.emit('data', output);
    status.interface.connected = true;
    if (data.split(":")[1].indexOf("ver") == 0) {
      var installedVersion = parseFloat(data.split(":")[1].split("]")[0].split("-")[1])
      status.interface.firmware.installedVersion = installedVersion
      var output = {
        'command': 'connect',
        'response': "OpenBuilds Interface Firmware Version: v" + installedVersion,
        'type': 'info'
      }
      io.sockets.emit('data', output);
      if (installedVersion < status.interface.firmware.availVersion) {
        var output = {
          'command': 'connect',
          'response': "OpenBuilds Interface Firmware OUTDATED: v" + installedVersion + " can be upgraded to v" + status.interface.firmware.availVersion,
          'type': 'error'
        }
        io.sockets.emit('data', output);
        io.sockets.emit('interfaceOutdated', status);
      }
    }
    io.sockets.emit("status", status);
  }

  // Reset greeting
  if (data.startsWith("Grbl") || data.startsWith("[FIRMWARE:grblHAL]")) { // Check if it's Grbl
    debug_log(data)
    // Machine Identification
    if (status.comms.connectionStatus == 1) {
      if (data.startsWith("GrblHAL")) {
        status.machine.firmware.type = "grbl";
        status.machine.firmware.platform = "grblHAL";
        status.machine.firmware.version = data.substr(8, 4); // get version
      } else if (data.startsWith("[FIRMWARE:grblHAL]")) {
        status.machine.firmware.type = "grbl";
        status.machine.firmware.platform = "grblHAL";
        // Parse version from seperate [VER:...] line not here for this response
      } else if (data.indexOf("FluidNC") != -1) { // Grbl 3.6 [FluidNC v3.6.5 (wifi) '$' for help]
        status.machine.firmware.type = "grbl";
        status.machine.firmware.platform = "FluidNC";
        status.machine.firmware.version = data.substr(19, 5); // get version
      } else {
        status.machine.firmware.type = "grbl";
        status.machine.firmware.platform = "gnea";
        status.machine.firmware.version = data.substr(5, 4); // get version
      }
      if (parseFloat(status.machine.firmware.version) < 1.1) { // If version is too old
        if (status.machine.firmware.version.length < 3) {
          debug_log('invalid version string, stay connected')
        } else {
          if (status.comms.connectionStatus > 0) {
            debug_log('WARN: Closing Port ' + port.path + " /  v" + parseFloat(status.machine.firmware.version));
            // stopPort();
          } else {
            debug_log('ERROR: Machine connection not open!');
          }
          var output = {
            'command': command,
            'response': "Detected an unsupported version: Grbl " + status.machine.firmware.version + ". This is sadly outdated. Please upgrade to Grbl 1.1 or newer to use this software.  Go to http://github.com/gnea/grbl",
            'type': 'error'
          }
          io.sockets.emit('data', output);
        }
      }

      onConnection();
    }
    // end of machine identification

    status.comms.blocked = false;
    if (config.aggressiveHomeReset) {
      // when aggressiveHomeReset is true (the default), reset the home state on every grbl reset
      status.machine.modals.homedRecently = false;
    }

    // after reset, immediately ask for modals
    gcodeQueue.splice(queuePointer, 0, "$G");
    send1Q();
  }

  // Machine Feedback: Position
  if (data.indexOf("<") === 0) {
    // debug_log(' Got statusReport (Grbl)')
    // statusfeedback func
    parseFeedback(data)
    if (command == "?") {
      var output = {
        'command': command,
        'response': data,
        'type': 'info'
      }
      // debug_log(output.response)
      io.sockets.emit('data', output);
    }

    // debug_log(data)
  } else if (data.indexOf("ok") === 0) { // Got an OK so we are clear to send
    io.sockets.emit('ok', command); // added per #325
    // debug_log('got OK from ' + command)
    sentBuffer.shift();
    if (command == "$CD") {
      io.sockets.emit('fluidncConfig', fluidncConfig);
    }
    status.comms.blocked = false;
    io.sockets.emit("queueCount", [gcodeQueue.length + sentBuffer.length - queuePointer, gcodeQueue.length]);
    if (queuePointer < gcodeQueue.length) {
      send1Q();
    } else if (sentBuffer.length == 0) {
      clearGcodeQueue(true);
      if (jobStatusInternal == 1 || jobStatusInternal == 2) {
        jobStatusInternal += 2; // last command was accepted, just wait for idle
      }
    }
  } else if (data.indexOf('ALARM') === 0) {
    debug_log("ALARM:  " + data)

    var alarmCode = parseInt(data.split(':')[1]);

    if (!config.aggressiveHomeReset) {
      // when aggressiveHomeReset is false, certain alarm codes will be safe and will not reset the home state
      const safeAlarmCodes = [0, 2, 4, 5, 12];
      if (!safeAlarmCodes.includes(alarmCode)) {
        status.machine.modals.homedRecently = false;
      }
    }

    debug_log('ALARM: ' + alarmCode + ' - ' + grblStrings.alarms(alarmCode));
    status.comms.alarm = alarmCode + ' - ' + grblStrings.alarms(alarmCode)
    if (alarmCode != 5) {
      io.sockets.emit("toastErrorAlarm", 'ALARM: ' + alarmCode + ' - ' + grblStrings.alarms(alarmCode) + " [ " + command + " ]")
    }
    var output = {
      'command': '',
      'response': 'ALARM: ' + alarmCode + ' - ' + grblStrings.alarms(alarmCode) + " [ " + command + " ]",
      'type': 'error'
    }
    io.sockets.emit('data', output);

    clearGcodeQueue(false);
    status.comms.connectionStatus = 5;
  } else if (data.indexOf('WARNING: After HALT you should HOME as position is currently unknown') != -1) {
    clearGcodeQueue(false);
    status.comms.connectionStatus = 2;
  } else if (data.indexOf('Emergency Stop Requested') != -1) {
    debug_log("Emergency Stop Requested")
    clearGcodeQueue(false);
    status.comms.connectionStatus = 5;
  } else if (data.indexOf('wait') === 0) { // Got wait from Repetier -> ignore
    // do nothing
  } else if (data.indexOf('error') === 0) { // Error received -> stay blocked stops queue
    var errorCode = parseInt(data.split(':')[1]);

    var lastAlarm = "";
    if (errorCode == 9 && status.comms.connectionStatus == 5 && status.comms.alarm.length > 0) {
      lastAlarm = "<hr>This error may just be a symptom of an earlier event:<br> ALARM: " + status.comms.alarm
    }
    debug_log('error: ' + errorCode + ' - ' + grblStrings.errors(errorCode) + " [ " + command + " ]");
    var output = {
      'command': '',
      'response': 'error: ' + errorCode + ' - ' + grblStrings.errors(errorCode) + " [ " + command + " ]" + lastAlarm,
      'type': 'error'
    }
    io.sockets.emit('data', output);
    io.sockets.emit("toastError", 'error: ' + errorCode + ' - ' + grblStrings.errors(errorCode) + " [ " + command + " ]" + lastAlarm)

    debug_log("error;")
    clearGcodeQueue(false);
    status.comms.connectionStatus = 5;
  } else if (data === ' ') {
    // nothing
  } else {
    // do nothing with +data
  }

  if (data.indexOf("[MSG:Reset to continue]") === 0) {
    clearGcodeQueue(false);
    debug_log("[MSG:Reset to continue] -> Sending Reset")
    addQRealtime(String.fromCharCode(0x18)); // ctrl-x
  }


  if (command) {
    command = command.replace(/(\r\n|\n|\r)/gm, "");
    // debug_log("CMD: " + command + " / DATA RECV: " + data.replace(/(\r\n|\n|\r)/gm, ""));

    if (command != "?" && command != "M105" && data.length > 0 && data.indexOf('<') == -1) {
      var string = "";
      if (status.comms.sduploading) {
        string += "SD: "
      }
      string += data //+ "  [ " + command + " ]"
      var output = {
        'command': command,
        'response': string,
        'type': 'info'
      }
      // debug_log(output.response)
      io.sockets.emit('data', output);
    }
  } else {
    if (data.indexOf("<") != 0) {
      var output = {
        'command': "",
        'response': data,
        'type': 'info'
      }
      io.sockets.emit('data', output);
    }
  }
}

function onConnection() {
  clearTimeout(connectTimeout);
  connectTimeout = undefined;
  debug_log("GRBL detected");
  setTimeout(function() {
    io.sockets.emit('grbl', status.machine.firmware);
  }, 100)
  // Start interval for status queries
  clearInterval(statusLoop);
  statusLoop = setInterval(function() {
    if (status.comms.connectionStatus > 0) {
      addQRealtime("?");
    }
  }, 200);

  status.comms.connectionStatus = 2;
  status.machine.modals.homedRecently = false;

  var output = {
    'command': 'connect',
    'response': "Firmware Detected:  " + status.machine.firmware.platform + " version " + status.machine.firmware.version + " dated " + status.machine.firmware.date + " on " + status.comms.interfaces.activePort,
    'type': 'success'
  }
  io.sockets.emit('data', output);
}

// Initiates handshake with the controller
function connectController(data) {
  // set status
  status.comms.connectionStatus = 1;

  // Log attempt 1
  debug_log("PORT INFO: Connected to " + port.path + " at " + port.baudRate);
  var output = {
    'command': 'connect',
    'response': "PORT INFO: Port is now open: " + port.path + " - Attempting to detect Controller...",
    'type': 'info'
  }
  console.log(port, friendlyPort(port));
  io.sockets.emit('data', output);
  // do attempt 1
//  addQRealtime("\n"); // this causes grblHAL to send the welcome string (No, it doesn't)

  var output = {
    'command': 'connect',
    'response': "Attempting to detect Controller (1): (Ctrl+X)",
    'type': 'info'
  }
  io.sockets.emit('data', output);

  addQRealtime(String.fromCharCode(0x18)); // ctrl-x (needed for rx/tx connection)
  debug_log("Sent: Ctrl+x");

  connectTimeout = setTimeout(function() {
    debug_log("Didn't detect firmware after Ctrl+X. Lets try toggling DTR");
    var output = {
      'command': 'connect',
      'response': "Attempting to detect Controller (2): (DTR Enable)",
      'type': 'info'
    }
    io.sockets.emit('data', output);

    // toggle DTR on
    port.set({
      "dtr": true
    }, console.log("Set DTR"));

    // then try Ctrl+X again (but why twice 100ms apart? not sure - it was in the original code)
    addQRealtime(String.fromCharCode(0x18)); // ctrl-x (needed for rx/tx connection)
    debug_log("Sent: Ctrl+x after DTR toggle");

    setTimeout(function() {
      addQRealtime(String.fromCharCode(0x18)); // ctrl-x (needed for rx/tx connection)
    }, 100);

    connectTimeout = setTimeout(function() {
      debug_log("No supported firmware detected. Closing port " + port.path);
      if (status.interface.connected) {
        var output = {
          'command': 'connect',
          'response': `ERROR!:  Connection established to INTERFACE, but no response from Grbl on the upstream controller. See https://github.com/OpenBuilds/docs-migrated/wiki for more details. Closing port ` + port.path,
          'type': 'error'
        }
      } else {
        var output = {
          'command': 'connect',
          'response': `ERROR!:  No Response from Controller - See https://github.com/OpenBuilds/docs-migrated/wiki for troubleshooting information. Closing port ` + port.path,
          'type': 'error'
        }
      }
      io.sockets.emit('data', output);
      stopPort();
      connectTimeout = undefined;
    }, persistentConfig.grblWaitTime2 * 1000);
  }, persistentConfig.grblWaitTime1 * 1000);

  if (data.type == "usb") {
    status.comms.interfaces.activePort = port.path;
    status.comms.interfaces.type = data.type
    status.comms.interfaces.activeBaud = port.baudRate;
  } else if (data.type == "telnet") {
    status.comms.interfaces.activePort = data.ip;
    status.comms.interfaces.type = data.type
    status.comms.interfaces.activeBaud = "net";
  }
}

io.on("connection", function(socket) {

  debug_log("New IO Connection ");

  io.sockets.emit("sysinfo", systemInformation);

  iosocket = socket;

  io.sockets.emit('grbl', status.machine.firmware);

  // Global Update loop
  clearInterval(frontEndUpdateLoop);
  frontEndUpdateLoop = setInterval(function() {
    io.sockets.emit("status", status);
  }, 100);

  clearInterval(sysinfoUpdateLoop);
  sysinfoUpdateLoop = setInterval(function() {
    io.sockets.emit("sysinfo", systemInformation);
  }, 1000 * 60);

  socket.on("scannetwork", function(data) {
    scanForTelnetDevices(data)
  })

  socket.on("saveFileDialog", function(data, callback) {
    var defaultPath = persistentConfig.defaultPaths[data.id || "default"] || persistentConfig.defaultPaths["last"];

    if (data.fileName) {
      defaultPath = defaultPath ? path.join(defaultPath, data.fileName) : data.fileName;
    }

    dialog.showSaveDialog(jogWindow, {
      title: data.title,
      filters: data.filters,
      defaultPath: defaultPath,
      properties: ['dontAddToRecent']
    }).then(result => {
      if (!result.canceled) {
        persistentConfig.defaultPaths[data.id || "default"] = path.dirname(result.filePath);
        persistentConfig.defaultPaths["last"] = path.dirname(result.filePath);
        savePersistentConfig();
        callback(result.filePath);
      }
    }).catch(err => {
      console.log(err)
    })
  })

  socket.on("openFileDialog", function(data, callback) {
    var defaultPath = persistentConfig.defaultPaths[data.id || "default"] || persistentConfig.defaultPaths["last"];

    dialog.showOpenDialog(jogWindow, {
      title: data.title,
      filters: data.filters,
      defaultPath: defaultPath,
      properties: ['openFile']
    }).then(result => {
      if (!result.canceled && result.filePaths.length > 0) {
        persistentConfig.defaultPaths[data.id || "default"] = path.dirname(result.filePaths[0]);
        persistentConfig.defaultPaths["last"] = path.dirname(result.filePaths[0]);
        savePersistentConfig();
        callback(result.filePaths[0]);
      }
    }).catch(err => {
      console.log(err)
    })
  })

  // generic function for reading a text file
  socket.on("readTextFile", function(filePath, params, callback) {
    fs.readFile(filePath, 'utf8',
      function(err, data) {
        if (params.showErrorDlg) {
          if (err) {
            dialog.showMessageBox(jogWindow, {
              type: 'error',
              buttons: ['OK'],
              message: err.toString()
            });
          } else {
            if (params.setJobStorage) {
              jobStorage = data;
            }
            callback(data);
          }
        }
        else {
          if (params.setJobStorage) {
            jobStorage = data;
          }
          callback(err ? err.toString() : "", data);
        }
      });
  })

  socket.on("openFile", function() {
    var defaultPath = persistentConfig.defaultPaths["gcode"] || persistentConfig.defaultPaths["last"];

    dialog.showOpenDialog(jogWindow, {
      title: "Open G-code",
      filters: [
        {name: "G-code files", extensions: ["gcode", "gc", "tap", "nc", "cnc"]},
        {name: "All files", extensions: ["*"]},
      ],
      defaultPath: defaultPath,
      properties: ['openFile']
    }).then(result => {
      console.log(result.canceled)
      console.log(result.filePaths)
      if (!result.canceled && result.filePaths.length > 0) {
        const openFilePath = result.filePaths[0];
        persistentConfig.defaultPaths["gcode"] = path.dirname(openFilePath);
        persistentConfig.defaultPaths["last"] = path.dirname(openFilePath);
        savePersistentConfig();
        debug_log("path" + openFilePath);
        readFile(openFilePath, true, addRecentFile);
      }

    }).catch(err => {
      console.log(err)
    })
  })

  socket.on("reopenFile", function(filePath) {
    filePath = filePath || status.misc.lastFilePath;
    if (filePath !== "") {
      debug_log("path" + filePath);
      readFile(filePath, true, addRecentFile);
    }
  })

  socket.on("clearRecentFiles", clearRecentFiles);

  socket.on("openInterfaceDir", function(data) {
    dialog.showOpenDialog(jogWindow, {
      properties: ['openDirectory'],
      title: "Select the USB Flashdrive you want to use with Interface"
    }).then(result => {
      console.log(result.canceled)
      console.log(result.filePaths)
      io.sockets.emit("interfaceDrive", result.filePaths[0]);
      status.interface.diskdrive = result.filePaths[0]
    }).catch(err => {
      console.log(err)
    })
  })

  socket.on("openbuilds", function(data) {
    const {
      shell
    } = require('electron')
    shell.openExternal('https://github.com/OpenBuilds/OpenBuilds-CONTROL')
  });

  socket.on("opencam", function(data) {
    const {
      shell
    } = require('electron')
    shell.openExternal('https://github.com/OpenBuilds/OpenBuilds-CAM')
  });

  socket.on("opendocs", function(data) {
    const {
      shell
    } = require('electron')
    shell.openExternal('https://github.com/OpenBuilds/docs-migrated/wiki')
  });

  socket.on("openforum", function(data) {
    const {
      shell
    } = require('electron')
    shell.openExternal('https://github.com/OpenBuilds/docs-migrated/wiki')
  });

  socket.on("gpuinfo", function(data) {
    // GPU
    var gpuInfoWindow = new BrowserWindow({
      // 1366 * 768 == minimum to cater for
      width: 800,
      height: 800,
      fullscreen: false,
      center: true,
      resizable: true,
      maximizable: true,
      title: "OpenBuilds CONTROL: Chromium's GPU Report",
      frame: true,
      autoHideMenuBar: true,
      //icon: '/app/favicon.png',
      icon: nativeImage.createFromPath(
        path.join(__dirname, "/app/favicon.png")
      ),
      webgl: true,
      experimentalFeatures: true,
      experimentalCanvasFeatures: true,
      offscreen: true,
      backgroundColor: "#fff"
    });
    gpuInfoWindow.loadURL("chrome://gpu");

    gpuInfoWindow.once('ready-to-show', () => {
      gpuInfoWindow.show()
      gpuInfoWindow.setAlwaysOnTop(true);
      gpuInfoWindow.focus();
      gpuInfoWindow.setAlwaysOnTop(false);
    })
  });

  socket.on("minimisetotray", function(data) {
    if (persistentConfig.autoStart) {
      jogWindow.hide();
    } else {
      if (appIcon) {
        appIcon.destroy();
      }
      electronApp.exit(0);
    }
  });

  socket.on("minimize", function(data) {
    jogWindow.minimize();
  });

  socket.on("maximize", function(data) {
    if (jogWindow.isFullScreen()) {
      jogWindow.setFullScreen(false);
    }
    if (jogWindow.isMaximized()) {
      jogWindow.unmaximize();
    } else {
      jogWindow.maximize();
    }
  });

  socket.on("fullscreen", function(data) {
    if (jogWindow.isFullScreen()) {
      jogWindow.setFullScreen(false);
    } else {
      jogWindow.setFullScreen(true);
    }
  });

  socket.on("quit", function(data) {
    if (appIcon) {
      appIcon.destroy();
    }
    electronApp.exit(0);
  });

  socket.on("applyUpdate", function(data) {
    autoUpdater.quitAndInstall();
  })

  socket.on("downloadUpdate", function(data) {
    if (!updateIsDownloading) {
      if (typeof autoUpdater !== 'undefined') {
        autoUpdater.checkForUpdates();
      } else {
        debug_log("autoUpdater not found")
      }
    }
  })

  socket.on("autoStart", setAutoStart);

  socket.on("flashGrbl", function(data) {

    var port = data.port;
    var customImg = data.customImg
    console.log(__dirname, file, data.file)
    if (customImg) {
      var firmwarePath = data.file
    } else {
      var firmwarePath = path.join(__dirname, data.file)
    }

    console.log("-------------------------------------------")
    console.log(firmwarePath)
    console.log("-------------------------------------------")

    if (status.comms.connectionStatus > 0) {
      debug_log('WARN: Closing Port ' + port);
      stopPort();
    } else {
      debug_log('ERROR: Machine connection not open!');
    }

    function flashGrblCallback(debugString, port) {
      debug_log(port, debugString);
      var data = {
        'port': port,
        'string': debugString
      }
      io.sockets.emit("progStatus", data);
    }
  })

  socket.on("flashGrblHal", function(data) {
    if (status.comms.connectionStatus > 0) {
      debug_log('WARN: Closing Port ' + port);
      stopPort();
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
    console.log(JSON.stringify(data), null, 4);
    flashGrblHal(data)
  })

  socket.on("flashInterface", function(data) {
    if (status.comms.connectionStatus > 0) {
      debug_log('WARN: Closing Port ' + port);
      stopPort();
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
    flashInterface(data)
  })

  socket.on("writeInterfaceUsbDrive", function(data) {

    debug_log(data)
    //data.drive = mountpoint dest
    //data.controller = type of controller
    if (data.controller == "blackbox4x" || data.controller == "genericgrbl") {
      var probesrc = path.join(__dirname, './app/wizards/interface/PROBE/');
      var profilesrc = path.join(__dirname, './app/wizards/interface/PROFILESGRBL/');
    } else if (data.controller == "blackboxx32" || data.controller == "genericgrblhal") {
      var probesrc = path.join(__dirname, './app/wizards/interface/PROBE/');
      var profilesrc = path.join(__dirname, './app/wizards/interface/PROFILESHAL/');
    }

    var probedest = path.join(data.drive, "/PROBE/");
    var profiledest = path.join(data.drive, "/PROFILES/");

    var ncp = require('ncp').ncp;
    ncp.limit = 16;

    var output = {
      'command': 'Interface USB Drive',
      'response': "Starting to copy data to " + data.drive,
      'type': 'info'
    }
    io.sockets.emit('data', output);

    var errorCount = 0;

    if (data.ssid && data.psk) {


      const folderPath = path.join(data.drive, "CONFIG");

      // Create the subfolder if it doesn't exist and then write the file
      fs.mkdir(folderPath, {
        recursive: true
      }, (err) => {
        if (err) {
          var output = {
            'command': 'Interface USB Drive',
            'response': `Failed to create folder ${folderPath}! Error: ${err}`,
            'type': 'error'
          };
          io.sockets.emit('data', output);
        } else {
          var fileContent = `${data.ssid}\n${data.psk}`;

          fs.writeFile(path.join(folderPath, "wifi.cfg"), fileContent, (err) => {
            if (err) {
              errorCount++;
              var output = {
                'command': 'Interface USB Drive',
                'response': `Failed to create Wifi Configuration file in ${folderPath}! Error: ${err}`,
                'type': 'error'
              };
              io.sockets.emit('data', output);
            } else {
              var output = {
                'command': 'Interface USB Drive',
                'response': `Created Wifi Configuration file in ${folderPath} successfully!`,
                'type': 'success'
              };
              io.sockets.emit('data', output);
            }
          });
        }
      });

    }

    ncp(probesrc, probedest, function(err) {
      if (err) {
        var output = {
          'command': 'Interface USB Drive',
          'response': "Failed to copy PROBE macros to " + probedest + ":  " + JSON.stringify(err),
          'type': 'error'
        }
        io.sockets.emit('data', output);
        errorCount++
      } else {
        var output = {
          'command': 'Interface USB Drive',
          'response': "Copied PROBE macros to " + probedest + " succesfully!",
          'type': 'success'
        }
        io.sockets.emit('data', output);
      }
    });


    ncp(profilesrc, profiledest, function(err) {
      if (err) {
        var output = {
          'command': 'Interface USB Drive',
          'response': "Failed to copy MACHINE PROFILES to " + profiledest + ":  " + JSON.stringify(err),
          'type': 'error'
        }
        io.sockets.emit('data', output);
        errorCount++
      } else {
        var output = {
          'command': 'Interface USB Drive',
          'response': "Copied MACHINE PROFILES to " + profiledest + " succesfully!",
          'type': 'success'
        }
        io.sockets.emit('data', output);
      }
    });



    setTimeout(function() {
      if (errorCount == 0) {
        var output = {
          'command': 'Interface USB Drive',
          'response': "Finished copying supporting files to Drive " + data.drive,
          'type': 'success'
        }
        io.sockets.emit('data', output);
        var output = {
          'command': 'Interface USB Drive',
          'response': "Please Eject the drive (Safely Remove) and insert it into your Interface's USB port",
          'type': 'info'
        }
        io.sockets.emit('data', output);
      }
    }, 500);
  });

  socket.on("connectTo", function(data) { // If a user picks a port to connect to, open a Node SerialPort Instance to it

    if (status.comms.connectionStatus < 1) {

      if (data.type == "usb") {
        console.log("connect", "Connecting to " + data.port + " via " + data.type);

        var allowRtsCts = false
        var allowHupcl = false
        if (process.platform == 'darwin') {
          allowRtsCts = true // Fix for autoreset getting stuck on MacOS with Silabs Chip
          allowHupcl = true // Fix for autoreset getting stuck on MacOS with Silabs Chip
        }

        port = new SerialPort({
          path: data.port,
          baudRate: parseInt(data.baud),
          rtscts: allowRtsCts,
          hupcl: allowHupcl // Don't set DTR - useful for X32 Reset
        });
      } else if (data.type == "telnet") {
        console.log("connect", "Connecting to " + data.ip + " via " + data.type);
        port = net.connect(23, data.ip);
        port.isOpen = true;
      }

      const parser = port.pipe(new ReadlineParser({
        delimiter: '\r\n'
      }))


      port.on("error", function(err) {
        if (err.message != "Port is not open") {
          debug_log("Error: ", err.message);
          var output = {
            'command': '',
            'response': "PORT ERROR: " + err.message,
            'type': 'error'
          }
          io.sockets.emit('data', output);

          if (status.comms.connectionStatus > 0) {
            debug_log('WARN: Closing Port ' + port.path);
            status.comms.connectionStatus = 0;
            stopPort();
          } else {
            debug_log('ERROR: Machine connection not open!');
          }
        }

      });

      port.on("ready", function(e) {
        portOpened(port, data)
      });

      port.on("open", function(e) {
        portOpened(port, data)
      });

      port.on("close", function() { // open errors will be emitted as an error event
        debug_log("PORT INFO: Port closed");
        var output = {
          'command': 'disconnect',
          'response': "PORT INFO: Port closed",
          'type': 'info'
        }
        io.sockets.emit('data', output);
        status.comms.connectionStatus = 0;
        stopPort() // also clear queues etc
      }); // end port.onclose


      function portOpened(port, data) {
        // setup listeners first
        parser.on("data", onParserData);

        // Then try to connect
        connectController(data);
      }


    }
  });

  socket.on('runJob', function(object) {
    // debug_log(data)
    runJob(object);
  });

  socket.on('forceQueue', function(data) {
    send1Q();
  });

  socket.on('serialInject', function(data) {
    // Inject a live command into Serial stream in real-time (dev tool) even while a job is running, etc (straight Port.write from machineSendRealtime)
    machineSendRealtime(data);
  });

  socket.on("dump", function(data) {
    console.log(queuePointer);
    console.log(gcodeQueue);
    console.log(sentBuffer);
  })

  socket.on('runCommand', function(data) {
    debug_log('Run Command (' + data.replace('\n', '|') + ')');
    if (status.comms.connectionStatus > 0) {
      if (data) {
        addLinesToQueue(data);
        status.comms.runStatus = 'Running'
        // debug_log('sending ' + JSON.stringify(gcodeQueue))
        send1Q();
      }
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
  });

  // Unused, kept for backwards compatibility
  socket.on('jog', function(data) {
    debug_log('Jog ' + data);
    if (status.comms.connectionStatus > 0) {
      data = data.split(',');
      var dir = data[0];
      var dist = parseFloat(data[1]);
      var feed;
      if (data.length > 2) {
        feed = parseInt(data[2]);
        if (feed) {
          feed = 'F' + feed;
        }
      }
      if (dir && dist && feed) {
        debug_log('Adding jog commands to queue. Firmw=' + status.machine.firmware.type + ', blocked=' + status.comms.blocked + ', paused=' + status.comms.paused + ', Q=' + gcodeQueue.length);
        addQToEndAndKick('$J=G91G21' + dir + dist + feed);
      } else {
        debug_log('ERROR: Invalid params!');
      }
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
  });

  // Unused, kept for backwards compatibility
  socket.on('jogXY', function(data) {
    debug_log('Jog XY' + data);
    if (status.comms.connectionStatus > 0) {
      var xincrement = parseFloat(data.x);
      var yincrement = parseFloat(data.y);
      var feed = parseFloat(data.feed)
      if (feed) {
        feed = 'F' + feed;
      }

      if (xincrement && yincrement && feed) {
        debug_log('Adding jog commands to queue. blocked=' + status.comms.blocked + ', paused=' + status.comms.paused + ', Q=' + gcodeQueue.length);
        addQToEndAndKick('$J=G91G21X' + xincrement + " Y" + yincrement + " " + feed);
      } else {
        debug_log('ERROR: Invalid params!');
      }
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
  });

  // Unused, kept for backwards compatibility
  socket.on('jogTo', function(data) { // data = {x:xVal, y:yVal, z:zVal, mode:0(absulute)|1(relative), feed:fVal}
    debug_log('JogTo ' + JSON.stringify(data));
    if (status.comms.connectionStatus > 0) {
      if (data.x !== undefined || data.y !== undefined || data.z !== undefined) {
        var xVal = (data.x !== undefined ? 'X' + parseFloat(data.x) : '');
        var yVal = (data.y !== undefined ? 'Y' + parseFloat(data.y) : '');
        var zVal = (data.z !== undefined ? 'Z' + parseFloat(data.z) : '');
        var mode = ((data.mode == 0) ? 0 : 1);
        var feed = (data.feed !== undefined ? 'F' + parseInt(data.feed) : '');
        debug_log('Adding jog commands to queue. blocked=' + status.comms.blocked + ', paused=' + status.comms.paused + ', Q=' + gcodeQueue.length);
        addQToEndAndKick('$J=G91G21' + mode + xVal + yVal + zVal + feed);
      } else {
        debug_log('error Invalid params!');
      }
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
  });

  // Unused, kept for backwards compatibility
  socket.on('setZero', function(data) {
    debug_log('setZero(' + data + ')');
    if (status.comms.connectionStatus > 0) {
      switch (data) {
        case 'x':
          addQToEndAndKick('G10 L20 P0 X0');
          break;
        case 'y':
          addQToEndAndKick('G10 L20 P0 Y0');
          break;
        case 'z':
          addQToEndAndKick('G10 L20 P0 Z0');
          break;
        case 'a':
          addQToEndAndKick('G10 L20 P0 A0');
          break;
        case 'all':
          addQToEndAndKick('G10 L20 P0 X0 Y0 Z0');
          break;
        case 'xyza':
          addQToEndAndKick('G10 L20 P0 X0 Y0 Z0 A0');
          break;
      }
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
  });

  // Unused, kept for backwards compatibility
  socket.on('gotoZero', function(data) {
    debug_log('gotoZero(' + data + ')');
    if (status.comms.connectionStatus > 0) {
      switch (data) {
        case 'x':
          addQToEndAndKick('G0 X0');
          break;
        case 'y':
          addQToEndAndKick('G0 Y0');
          break;
        case 'z':
          addQToEndAndKick('G0 Z0');
          break;
        case 'a':
          addQToEndAndKick('G0 A0');
          break;
        case 'all':
          addQToEndAndKick('G0 X0 Y0 Z0');
          break;
        case 'xyza':
          addQToEndAndKick('G0 X0 Y0 Z0 A0');
          break;
      }
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
  });

  // Unused, kept for backwards compatibility
  socket.on('setPosition', function(data) {
    debug_log('setPosition(' + JSON.stringify(data) + ')');
    if (status.comms.connectionStatus > 0) {
      if (data.x !== undefined || data.y !== undefined || data.z !== undefined) {
        var xVal = (data.x !== undefined ? 'X' + parseFloat(data.x) + ' ' : '');
        var yVal = (data.y !== undefined ? 'Y' + parseFloat(data.y) + ' ' : '');
        var zVal = (data.z !== undefined ? 'Z' + parseFloat(data.z) + ' ' : '');
        var aVal = (data.a !== undefined ? 'A' + parseFloat(data.a) + ' ' : '');
        addQToEndAndKick('G10 L20 P0 ' + xVal + yVal + zVal + aVal);
      }
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
  });

  // Unused, kept for backwards compatibility
  socket.on('probe', function(data) {
    debug_log('probe(' + JSON.stringify(data) + ')');
    if (status.comms.connectionStatus > 0) {
      addQToEndAndKick('G38.2 ' + data.direction + '-5 F1');
      addQToEndAndKick('G92 ' + data.direction + ' ' + data.probeOffset);
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
  });

  socket.on('feedOverride', function(data) {
    debug_log(data)
    if (status.comms.connectionStatus > 0) {
      debug_log("current FRO = " + status.machine.overrides.feedOverride)
      debug_log("requested FRO = " + data)
      var curfro = parseInt(status.machine.overrides.feedOverride)
      var reqfro = parseInt(data)
      var delta;

      if (reqfro == 100) {
        addQRealtime(String.fromCharCode(0x90));
      } else if (curfro < reqfro) {
        // FRO Increase
        delta = reqfro - curfro
        debug_log("delta = " + delta)
        var tens = Math.floor(delta / 10)

        debug_log("need to send " + tens + " x10s increase")
        for (let i = 1; i < tens + 1; i++) {
          setTimeout(function timer() {
            addQRealtime(String.fromCharCode(0x91));
            addQRealtime("?");
          }, i * 50);
        }

        var ones = delta - (10 * tens);
        debug_log("need to send " + ones + " x1s increase")
        for (let i = 1; i < ones + 1; i++) {
          setTimeout(function timer() {
            addQRealtime(String.fromCharCode(0x93));
            addQRealtime("?");
          }, i * 50);
        }
      } else if (curfro > reqfro) {
        // FRO Decrease
        delta = curfro - reqfro
        debug_log("delta = " + delta)

        var tens = Math.floor(delta / 10)
        debug_log("need to send " + tens + " x10s decrease")
        for (let i = 1; i < tens + 1; i++) {
          setTimeout(function timer() {
            addQRealtime(String.fromCharCode(0x92));
            addQRealtime("?");
          }, i * 50);
        }

        var ones = delta - (10 * tens);
        debug_log("need to send " + ones + " x1s decrease")
        for (let i = 1; i < ones + 1; i++) {
          setTimeout(function timer() {
            addQRealtime(String.fromCharCode(0x94));
            addQRealtime("?");
          }, i * 50);
        }
      }
      addQRealtime("?");
      status.machine.overrides.feedOverride = parseInt(reqfro); // Set now, but will be overriden from feedback from Grbl itself in next queryloop
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
  });

  socket.on('spindleOverride', function(data) {
    if (status.comms.connectionStatus > 0) {
      debug_log("current SRO = " + status.machine.overrides.spindleOverride)
      debug_log("requested SRO = " + data)
      var cursro = parseInt(status.machine.overrides.spindleOverride)
      var reqsro = parseInt(data)
      var delta;

      if (reqsro == 100) {
        addQRealtime(String.fromCharCode(153));
      } else if (cursro < reqsro) {
        // FRO Increase
        delta = reqsro - cursro
        debug_log("delta = " + delta)
        var tens = Math.floor(delta / 10)

        debug_log("need to send " + tens + " x10s increase")
        for (let i = 1; i < tens + 1; i++) {
          setTimeout(function timer() {
            addQRealtime(String.fromCharCode(154));
            addQRealtime("?");
          }, i * 50);
        }

        var ones = delta - (10 * tens);
        debug_log("need to send " + ones + " x1s increase")
        for (let i = 1; i < ones + 1; i++) {
          setTimeout(function timer() {
            addQRealtime(String.fromCharCode(156));
            addQRealtime("?");
          }, i * 50);
        }
      } else if (cursro > reqsro) {
        // FRO Decrease
        delta = cursro - reqsro
        debug_log("delta = " + delta)

        var tens = Math.floor(delta / 10)
        debug_log("need to send " + tens + " x10s decrease")
        for (let i = 1; i < tens + 1; i++) {
          setTimeout(function timer() {
            addQRealtime(String.fromCharCode(155));
            addQRealtime("?");
          }, i * 50);
        }

        var ones = delta - (10 * tens);
        debug_log("need to send " + ones + " x1s decrease")
        for (let i = 1; i < ones + 1; i++) {
          setTimeout(function timer() {
            addQRealtime(String.fromCharCode(157));
            addQRealtime("?");
          }, i * 50);
        }
      }
      addQRealtime("?");
      status.machine.overrides.spindleOverride = parseInt(reqsro); // Set now, but will be overriden from feedback from Grbl itself in next queryloop
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
  });

  socket.on('laserTest', function(data) { // Laser Test Fire
    laserTest(data);
  });

  socket.on('pause', function() {
    pause();
  });

  socket.on('resume', function() {
    unpause();
  });

  socket.on('stop', function(data) {
    stop(data);
  });

  socket.on('clearAlarm', function(data) { // Clear Alarm
    if (status.comms.connectionStatus > 0) {
      data = parseInt(data);
      debug_log('Clearing Queue: Method ' + data);
      switch (data) {
        case 1:
          debug_log('Clearing Lockout');
          addQRealtime('$X\n');
          debug_log('Resuming Queue Lockout');
          var output = {
            'command': '[clear alarm]',
            'response': "Operator clicked Clear Alarm: Cleared Lockout",
            'type': 'info'
          }
          io.sockets.emit('data', output);
          break;
        case 2:
          debug_log('Emptying Queue');
          status.comms.queue = 0
          queuePointer = 0;
          gcodeQueue.length = 0; // Dump the queue
          sentBuffer.length = 0; // Dump bufferSizes
          debug_log('Clearing Lockout');

          clearInterval(queueCounter);
          if (jogWindow) {
            jogWindow.setProgressBar(0);
          }
          addQRealtime(String.fromCharCode(0x18)); // ctrl-x
          setTimeout(function() {
            debug_log('Sent: $X');
            addQToEndAndKick("$X");
          }, 500);
          status.comms.blocked = false;
          status.comms.paused = false;

          var output = {
            'command': '[clear alarm]',
            'response': "Operator clicked Clear Alarm: Cleared Lockout and Emptied Queue",
            'type': 'info'
          }
          io.sockets.emit('data', output);
          break;
      }
      status.comms.runStatus = 'Stopped'
      status.comms.connectionStatus = 2;
      status.comms.alarm = "";
      io.sockets.emit('errorsCleared', true);
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
  });

  socket.on('resetMachine', function() {
    if (status.comms.connectionStatus > 0) {
      debug_log('Reset Machine');
      addQRealtime(String.fromCharCode(0x18)); // ctrl-x
      debug_log('Sent: Code(0x18)');
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
  });

  socket.on('closePort', function(data) { // Close machine port and dump queue
    if (status.comms.connectionStatus > 0) {
      debug_log('WARN: Closing Port ' + port.path);
      stopPort();
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
  });


  socket.on('aggrressiveHomeReset', function(state) {
    config.aggressiveHomeReset = state;
  });

  socket.on('captureWcsHistory', function(data) {
    io.sockets.emit('captureWcsHistory', data);
  });

  socket.on('refreshGui', function() {
    if (uploadedgcode) {
      var payload = {
        gcode: uploadedgcode,
        filename: path.basename(status.misc.lastFilePath)
      }
      io.sockets.emit('gcodeupload', payload);
    }
    io.sockets.emit('recentFiles', persistentConfig.recentFiles);
  });

});

function readFile(filePath, showErrorDlg, onSuccess) {
  if (filePath) {
    if (filePath.length > 1) {
      debug_log('readfile: ' + filePath)
      fs.readFile(filePath, 'utf8',
        function(err, data) {
          if (err) {
            if (showErrorDlg) {
              dialog.showMessageBox(jogWindow, {
                type: 'error',
                buttons: ['OK'],
                message: err.toString()
              });
            }
            debug_log(err);
          } else if (data) {
            if (filePath.endsWith('.obc')) { // OpenBuildsCAM Workspace
              uploadedworkspace = data;
              const {
                shell
              } = require('electron')
              shell.openExternal('https://github.com/OpenBuilds/OpenBuilds-CAM')
            } else { // GCODE
              uploadedgcode = data;
              status.misc.lastFilePath = filePath;
              var payload = {
                gcode: uploadedgcode,
                filename: path.basename(status.misc.lastFilePath)
              }
              io.sockets.emit('gcodeupload', payload);
              if (onSuccess) {
                onSuccess(filePath, data);
              }
            }
          }
        });
    }
  }
}

function addRecentFile(filePath) {
  var file_path = filePath.toLowerCase();
  var index = persistentConfig.recentFiles.findIndex(x => x.toLowerCase() == file_path);
  if (index == 0 && persistentConfig.recentFiles[0] == filePath) return;

  if (index >= 0) {
    persistentConfig.recentFiles.splice(index, 1);
  }
  persistentConfig.recentFiles.unshift(filePath);
  if (persistentConfig.recentFiles.length > config.maxRecentFiles) {
    persistentConfig.recentFiles.length = config.maxRecentFiles;
  }
  savePersistentConfig();
  io.sockets.emit('recentFiles', persistentConfig.recentFiles);
}

function clearRecentFiles() {
  persistentConfig.recentFiles = [];
  savePersistentConfig();
  io.sockets.emit('recentFiles', persistentConfig.recentFiles);
}

function machineSendRealtime(gcode) {
  debug_log("SENDING: " + gcode)
  if (port.isOpen) {
    // realtime commands doesnt count toward the queue, does not generate OK
    port.write(gcode);
  } else {
    debug_log("PORT NOT OPEN")
  }
}

function machineSend(gcode) {
  debug_log("SENDING: " + gcode)
  if (port.isOpen) {
    if (gcode.match(/T([\d.]+)/i)) {
      var tool = parseFloat(RegExp.$1);
      status.machine.tool.nexttool.number = tool
      status.machine.tool.nexttool.line = gcode
    }
    port.write(gcode);
    debug_log("SENT: " + gcode)
  } else {
    debug_log("PORT NOT OPEN")
  }
}

// Splits the data into lines and adds them to the queue
// Removes comments
function addLinesToQueue(data) {
  var lineCount = 0;
  data = data.split('\n');
  for (var i = 0; i < data.length; i++) {

    var line = data[i].replace("%", "").split(';')[0]; // Remove everything after ; = comment

    // remove () comments
    var commentStart = line.indexOf('(');
    while (commentStart >= 0) {
      const commentEnd = line.indexOf(')', commentStart);
      if (commentEnd < 0) {
        line = line.slice(0, commentStart);
        break;
      }
      line = line.slice(0, commentStart) + line.slice(commentEnd + 1);
      commentStart = line.indexOf('(');
    }

    var tosend = line.trim();
    if (tosend.length > 0) {
      addQToEnd(tosend);
      lineCount++;
    }
  }

  return lineCount > 0;
}

function runJob(object) {
  jobStartTime = false;
  var data = object.data;

  jobIsJob = object.isJob;
  jobStartTime = new Date().getTime();
  if (object.isJob) {
    uploadedgcode = data;
  }

  if (object.completedMsg) {
    jobCompletedMsg = object.completedMsg
  }

  // debug_log('Run Job (' + data.length + ')');
  if (status.comms.connectionStatus == 0) {
    debug_log('ERROR: Machine connection not open!');
    return;
  }
  if (jobStatusInternal > 0) {
    debug_log('ERROR: Another job still in progress.');
    return;
  }
  if (data && addLinesToQueue(data)) {
    // Start interval for qCount messages to socket clients
    queueCounter = setInterval(function() {
      status.comms.queue = gcodeQueue.length - queuePointer + sentBuffer.length;
      if (jogWindow) {
        jogWindow.setProgressBar(queuePointer / gcodeQueue.length)
      }
    }, 500);
    jobStatusInternal = 1;
    status.misc.jobStatus = 1;
    send1Q(); // send first line
    status.comms.connectionStatus = 3;
  }
}

function stopPort() {
  clearInterval(queueCounter);
  clearInterval(statusLoop);
  if (jogWindow) {
    jogWindow.setProgressBar(0);
  }

  status.comms.interfaces.activePort = false;
  status.comms.interfaces.activeBaud = false;
  status.comms.connectionStatus = 0;
  status.comms.queue = 0;
  status.machine.firmware.type = "";
  status.machine.firmware.version = ""; // get version
  status.machine.firmware.date = "";
  status.machine.firmware.buffer = "";
  status.machine.modals.homedRecently = false;
  gcodeQueue.length = 0;
  sentBuffer.length = 0; // dump bufferSizes
  queuePointer = 0;
  // port.drain(port.close());

  if (status.comms.interfaces.type == "usb") {
    if (port.isOpen) {
      port.drain(port.close());
    }
  } else if (status.comms.interfaces.type == "telnet") {
    if (port.isOpen) {
      port.destroy();
      port.isOpen = false;
    }
  }
}

function parseFeedback(data) {
  //debug_log(data)
  var state = data.substring(1, data.search(/(,|\|)/));
  status.comms.runStatus = state
  if (state == "Idle") {
    if (jobStatusInternal >= 3 && (new Date().getTime()) > jobStartTime + 100) {
      finalizeJob(true); // Idle after at least 100ms after the "ok" for the last line, declare the job as done
    }
  } else if (state == "Alarm") {
    // debug_log("ALARM:  " + data)
    status.comms.connectionStatus = 5;
  } else if (state == "Hold:0") {
    pause();
  }

  // Extract work offset (for Grbl > 1.1 only!)
  const startWCO = data.search(/wco:/i) + 4;
  if (startWCO > 4) {
    const wcoLen = data.substr(startWCO).search(/>|\|/);
    const wcoArray = data.substr(startWCO, wcoLen).split(',', 4).map(parseFloat);

    const xOffset = wcoArray[0];
    const yOffset = wcoArray[1];
    const zOffset = wcoArray[2];
    const aOffset = wcoArray.length > 3 ? wcoArray[3] : 0;

    status.machine.position.offset.x = parseFloat(xOffset.toFixed(config.posDecimals));
    status.machine.position.offset.y = parseFloat(yOffset.toFixed(config.posDecimals));
    status.machine.position.offset.z = parseFloat(zOffset.toFixed(config.posDecimals));
    status.machine.position.offset.a = parseFloat(aOffset.toFixed(config.posDecimals));
  }

  // Extract wPos/mPos (for Grbl > 1.1 only!)
  const startWPos = data.search(/wpos:/i) + 5;
  const startMPos = data.search(/mpos:/i) + 5;
  const isMPos = startMPos > 5;
  const startPos = isMPos ? startMPos : startWPos;

  if (startPos > 5) {
    const posLen = data.substr(startPos).search(/>|\|/);
    const posArray = data.substr(startPos, posLen).split(',', 4).map(parseFloat);

    status.machine.has4thAxis = posArray.length > 3;

    var xPos = posArray[0];
    var yPos = posArray[1];
    var zPos = posArray[2];
    var aPos = status.machine.has4thAxis ? posArray[3] : 0;

    if (isMPos) {
      //If the status includes machine coordinates, subtract the offset to convert to work space
      xPos -= status.machine.position.offset.x;
      yPos -= status.machine.position.offset.y;
      zPos -= status.machine.position.offset.z;
      aPos -= status.machine.position.offset.a;
    }

    status.machine.position.work.x = parseFloat(xPos.toFixed(config.posDecimals));
    status.machine.position.work.y = parseFloat(yPos.toFixed(config.posDecimals));
    status.machine.position.work.z = parseFloat(zPos.toFixed(config.posDecimals));
    status.machine.position.work.a = parseFloat(aPos.toFixed(config.posDecimals));
  }

  // Extract override values (for Grbl > v1.1 only!)
  var startOv = data.search(/ov:/i) + 3;
  if (startOv > 3) {
    var ov = data.replace(">", "").substr(startOv).split(/,|\|/, 3);
    if (Array.isArray(ov)) {
      if (ov[0]) {
        status.machine.overrides.feedOverride = parseInt(ov[0]);
      }
      if (ov[1]) {
        status.machine.overrides.rapidOverride = parseInt(ov[1]);
      }
      if (ov[2]) {
        status.machine.overrides.spindleOverride = parseInt(ov[2]);
      }
    }
  }
  // Extract realtime Feed and Spindle (for Grbl > v1.1 only!)
  var startFS = data.search(/\|FS:/i) + 4;
  if (startFS > 4) {
    var fs = data.replace(">", "").substr(startFS).split(/,|\|/);
    if (Array.isArray(fs)) {
      if (fs[0]) {
        status.machine.overrides.realFeed = parseInt(fs[0]);
      }
      if (fs[1]) {
        status.machine.overrides.realSpindle = parseInt(fs[1]);
      }
    }
  }

  // extras realtime feed (if variable spindle is disabled)
  var startF = data.search(/\|F:/i) + 3;
  if (startF > 3) {
    var f = data.replace(">", "").substr(startF).split(/,|\|/);
    console.log(JSON.stringify(f, null, 4))
    if (Array.isArray(f)) {
      if (f[0]) {
        status.machine.overrides.realFeed = parseInt(f[0]);
      }
    }
  }

  // Extract Pin Data
  var startPin = data.search(/Pn:/i) + 3;
  if (startPin > 3) {
    var pinsdata = data.replace(">", "").replace("\r", "").substr(startPin).split(/,|\|/, 1);
    var pins = pinsdata[0].split('')
    status.machine.inputs = pins;
    if (!_.isEqual(pins, oldpinslist)) {
      if (pins.includes('H') && !pins.includes('D')) {
        // pause
        pause();
        var output = {
          'command': '[external from hardware]',
          'response': "OpenBuilds CONTROL received a FEEDHOLD notification from Grbl: This could be due to someone pressing the HOLD button (if connected)",
          'type': 'info'
        }
        io.sockets.emit('data', output);
      } // end if HOLD

      if (pins.includes('D')) {
        // pause
        pause();
      }

      if (pins.includes('R')) {
        // abort
        stop(true);
        var output = {
          'command': '[external from hardware]',
          'response': "OpenBuilds CONTROL received a RESET/ABORT notification from Grbl: This could be due to someone pressing the RESET/ABORT button (if connected)",
          'type': 'info'
        }
        io.sockets.emit('data', output);
      } // end if ABORT

      if (pins.includes('S')) {
        // abort
        unpause();
        var output = {
          'command': '[external from hardware]',
          'response': "OpenBuilds CONTROL received a CYCLESTART/RESUME notification from Grbl: This could be due to someone pressing the CYCLESTART/RESUME button (if connected)",
          'type': 'info'
        }
        io.sockets.emit('data', output);
      } // end if RESUME/START
    }
  } else {
    status.machine.inputs = [];
  }
  oldpinslist = pins;
  // Extract Buffer Data
  var startBuf = data.search(/Bf:/i) + 3;
  if (startBuf > 3) {
    var buffer = data.replace(">", "").replace("\r", "").substr(startBuf).split(/,|\|/, 2);
    // debug_log("BUF: " + JSON.stringify(buffer, null, 2));
    status.machine.firmware.buffer = buffer;
  } else {
    status.machine.firmware.buffer = [];
  }
  // end statusreport
}

const coordinateSysCommands = ["G54", "G55", "G56", "G57", "G58", "G59"];
const planeCommands = ["G17", "G18", "G19"];
const distanceModeCommands = ["G90", "G91"];
const feedrateModeCommands = ["G93", "G94"];
const unitModeCommands = ["G20", "G21"];
const tloModeCommands = ["G49", "G43.1"];
const spindleStateCommands = ["M3", "M4", "M5"];
const coolantStateCommands = ["M7", "M8", "M9"];

function gotModals(data) {
  // as per https://github.com/gnea/grbl/wiki/Grbl-v1.1-Commands#g---view-gcode-parser-state
  // The shown g-code are the current modal states of Grbl's g-code parser.
  // This may not correlate to what is executing since there are usually
  // several motions queued in the planner buffer.
  // [GC:G0 G54 G17 G21 G90 G94 M5 M9 T0 F0.0 S0]

  // defaults

  data = data.split(/:|\[|\]/)[2].split(" ")

  for (i = 0; i < data.length; i++) {

    if (coordinateSysCommands.includes(data[i])) {
      status.machine.modals.coordinatesys = data[i]; // handle G54, G55, G56, G57, G58, G59
    }

    if (planeCommands.includes(data[i])) {
      status.machine.modals.plane = data[i]; // handle G17, G18, G19
    }

    if (distanceModeCommands.includes(data[i])) {
      status.machine.modals.distancemode = data[i]; // handle G90, G91
    }

    if (data[i] == "G91.1") {
      status.machine.modals.arcdistmode = data[i];
    }

    if (feedrateModeCommands.includes(data[i])) {
      status.machine.modals.feedratemode = data[i]; // handle G93, G94
    }

    if (unitModeCommands.includes(data[i])) {
      status.machine.modals.unitsmode = data[i]; // handle G20, G21
    }

    //   status.machine.modals.radiuscomp = "G40"; // G40
    if (data[i] == "G40") {
      status.machine.modals.radiuscomp = data[i];
    }

    if (tloModeCommands.includes(data[i])) {
      status.machine.modals.tlomode = data[i]; // handle G49, G43.1
    }

    if (spindleStateCommands.includes(data[i])) {
      status.machine.modals.spindlestate = data[i]; // handle M3, M4, M5
    }

    if (coolantStateCommands.includes(data[i])) {
      status.machine.modals.coolantstate = data[i]; // handle M7, M8, M9
    }

    // //   status.machine.modals.tool = "0",
    // if (data[i].indexOf("T") === 0) {
    //   status.machine.modals.tool = parseFloat(data[i].substr(1))
    // }
    //
    // //   status.machine.modals.spindle = "0"
    // if (data[i].indexOf("S") === 0) {
    //   status.machine.modals.spindle = parseFloat(data[i].substr(1))
    // }
    //
    // //   status.machine.modals.feedrate = "0"
    // if (data[i].indexOf("F") === 0) {
    //   status.machine.modals.feedrate = parseFloat(data[i].substr(1))
    // }
  }
} // end gotModals

function laserTest(data) {
  if (status.comms.connectionStatus > 0) {
    data = data.split(',');
    var power = parseFloat(data[0]);
    var duration = parseInt(data[1]);
    var maxS = parseFloat(data[2]);
    if (power > 0) {
      if (!laserTestOn) {
        // laserTest is off
        // debug_log('laserTest: ' + 'Power ' + power + ', Duration ' + duration + ', maxS ' + maxS);
        if (duration >= 0) {
          addQToEndAndKick('G1F1');
          addQToEndAndKick('M3S' + parseInt(power * maxS / 100));
          laserTestOn = true;
          io.sockets.emit('laserTest', power);
          if (duration > 0) {
            addQToEndAndKick('G4 P' + duration / 1000);
            addQToEndAndKick('M5S0');
            laserTestOn = false;
          }
        }
      } else {
        // debug_log('laserTest: ' + 'Power off');
        addQToEndAndKick('M5S0');
        laserTestOn = false;
        io.sockets.emit('laserTest', 0);
      }
    }
  } else {
    debug_log('ERROR: Machine connection not open!');
  }
}

// queue
function BufferSpace() {
  const len = sentBuffer.length;
  var total = len; // account for the \n at the end
  for (var i = 0; i < len; i++) {
    total += sentBuffer[i].length;
  }
  if (status.machine.firmware.rxBufferSize > 0) {
    return (status.machine.firmware.rxBufferSize - 1) - total;
  } else {
    if (status.machine.firmware.platform == "grblHAL") {
      return GRBLHAL_RX_BUFFER_SIZE - total;
    } else {
      return GRBL_RX_BUFFER_SIZE - total;
    }
  }
}

function send1Q() {
  // console.time('send1Q');
  if (status.comms.connectionStatus > 0) {
    if (queuePointer == 0) {
      io.sockets.emit("queueCount", [gcodeQueue.length, gcodeQueue.length]);
    }
    while ((gcodeQueue.length - queuePointer) > 0 && !status.comms.blocked && !status.comms.paused) {
      const spaceLeft = BufferSpace();

      // Do we have enough space in the buffer?
      if (gcodeQueue[queuePointer].length < spaceLeft) {
        const gcode = gcodeQueue[queuePointer];
        if (jobStatusInternal == 1 && gcode.startsWith("$J")) {
          jobStatusInternal = 2;
          status.misc.jobStatus = 2;
        }
        queuePointer++;
        sentBuffer.push(gcode);
        machineSend(gcode + '\n');
        // debug_log('Sent: ' + gcode + ' Q: ' + (gcodeQueue.length - queuePointer) + ' Bspace: ' + (spaceLeft - gcode.length - 1));
      } else {
        status.comms.blocked = true;
      }

      if (config.singleCommandMode) break;
    }
  } else {
    debug_log('Not Connected')
  }
  // console.timeEnd('send1Q');
}

// Clears the queue and generates a queueComplete event
function clearGcodeQueue(success) {
  if (gcodeQueue.length > 0) {
    var data = {
      failed: !success,
    }
    io.sockets.emit('queueComplete', data);
    const queueLeft = gcodeQueue.length - queuePointer + sentBuffer.length;
    const queueTotal = gcodeQueue.length;
    io.sockets.emit("queueCount", [queueLeft, queueTotal]);
  }

  clearInterval(queueCounter);
  if (jogWindow) {
    jogWindow.setProgressBar(0);
  }
  status.comms.queue = 0;
  gcodeQueue.length = 0; // Dump the Queue
  queuePointer = 0;

  if (!success) {
    finalizeJob(false); // on failure, also finalize the job right now
  } else if (jobStatusInternal == 0) {
    status.comms.connectionStatus = 2; // finished non-job queue
  }
}

// If a job is currently in progress, sends the jobComplete message
function finalizeJob(success) {
  if (jobStatusInternal > 0) {
    var data = {
      completed: true, // always true, kept for backwards compatibility
      failed: !success,
      jobCompletedMsg: jobCompletedMsg,
      jobStartTime: jobIsJob ? jobStartTime : false,
      jobEndTime: new Date().getTime()
    }
    io.sockets.emit('jobComplete', data);
    jobCompletedMsg = "";
    jobStartTime = false;
    jobStatusInternal = 0;
    status.misc.jobStatus = 0;
    status.comms.connectionStatus = 2;
  }
}

var modalCommands = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59', 'G17', 'G18', 'G19', 'G90', 'G91', 'G91.1', 'G93', 'G94', 'G20', 'G21', 'G40', 'G43.1', 'G49', 'M0', 'M1', 'M2', 'M30', 'M3', 'M4', 'M5', 'M7', 'M8', 'M9']
var modalCommandsRegExp = new RegExp(modalCommands.join("|"));

function addQToEnd(gcode) {
  // debug_log('added ' + gcode)
  gcodeQueue.push(gcode);

  var testGcode = gcode.toUpperCase()
  if (testGcode.indexOf("$H") != -1) {
    status.machine.modals.homedRecently = true;
  }
  if (testGcode == "$CD") {
    fluidncConfig = ""; // empty string
  }
  if (!gcode.startsWith("$J=") && modalCommandsRegExp.test(testGcode)) {
    gcodeQueue.push("$G");
  }
  if (gcode.match(/T([\d.]+)/i)) {
    gcodeQueue.push("$G");
  }
}

// Adds a line to the queue and kicks the sender if currently idle
function addQToEndAndKick(gcode) {
  addQToEnd(gcode);
  if (sentBuffer.length == 0)
    send1Q(); // nothing in the pending buffer, start the queue
}

function addQRealtime(gcode) {
  // realtime command skip the queue as it doesnt respond with an ok
  // doesn't count towards the RX buffer limit
  machineSendRealtime(gcode);
}

function stop(data) {
  if (status.comms.connectionStatus > 0) {
    status.comms.paused = true;
    debug_log('STOP');

    if (data.jog) {
      addQRealtime(String.fromCharCode(0x85)); // canceljog
      debug_log('Sent: 0x85 Jog Cancel');
      debug_log(queuePointer, gcodeQueue)
    }

    if (!data.abort && !data.jog) { // pause motion first.
      addQRealtime('!'); // hold
      debug_log('Sent: !');
    }

    if (status.machine.firmware.version === '1.1d') {
      addQRealtime(String.fromCharCode(0x9E)); // Stop Spindle/Laser
      debug_log('Sent: Code(0x9E)');
    }

    debug_log('Cleaning Queue');
    if (!data.jog) {
      setTimeout(function() {
        addQRealtime(String.fromCharCode(0x18)); // ctrl-x
        debug_log('Sent: Code(0x18)');
      }, 200);
    }

    laserTestOn = false;
    status.comms.runStatus = 'Stopped';
    status.comms.alarm = "";
    sentBuffer.length = 0; // Dump the queue
    status.comms.blocked = false;
    status.comms.paused = false;
    clearGcodeQueue(false);
  } else {
    debug_log('ERROR: Machine connection not open!');
  }
}

function pause() {
  if (status.comms.connectionStatus == 3) {
    status.comms.paused = true;
    debug_log('PAUSE');
    addQRealtime('!'); // Send hold command
    debug_log('Sent: !');
    if (status.machine.firmware.version === '1.1d') {
      addQRealtime(String.fromCharCode(0x9E)); // Stop Spindle/Laser
      debug_log('Sent: Code(0x9E)');
    }
    status.comms.runStatus = 'Paused';
    status.comms.connectionStatus = 4;
  } else {
    debug_log('ERROR: Machine connection not open!');
  }
}

function unpause() {
  if (status.comms.connectionStatus > 0) {
    debug_log('UNPAUSE');
    addQRealtime('~'); // Send resume command
    debug_log('Sent: ~');
    status.comms.paused = false;
    status.comms.blocked = false;
    setTimeout(function() {
      send1Q(); // restart queue
    }, 200);
    status.comms.runStatus = 'Resuming';
    status.comms.connectionStatus = 3;
  } else {
    debug_log('ERROR: Machine connection not open!');
  }
}


function showJogWindow() {
  if (jogWindow === null) {
    createJogWindow();
  }
  jogWindow.show()
  jogWindow.setAlwaysOnTop(true);
  jogWindow.focus();
  jogWindow.setAlwaysOnTop(false);
}

loadPersistentConfig();

// Electron
{
  const gotTheLock = electronApp.requestSingleInstanceLock()
  var lauchGUI = true;
  if (!gotTheLock) {
    debug_log("Already running! Check the System Tray")
    electronApp.exit(0);
    electronApp.quit();
  } else {
    electronApp.on('second-instance', (event, commandLine, workingDirectory) => {
      //Someone tried to run a second instance, we should focus our window.
      // debug_log('SingleInstance')

      function checkFileType(fileName) {
        var fileNameLC = fileName.toLowerCase();
        if (fileNameLC.endsWith('.obc') || fileName.endsWith('.gcode') || fileName.endsWith('.gc') || fileName.endsWith('.tap') || fileName.endsWith('.nc') || fileName.endsWith('.cnc')) {
          return fileName;
        }
      }

      debug_log(commandLine)
      lauchGUI = true;

      var openFilePath = commandLine.find(checkFileType);
      if (openFilePath !== "") {
        readFile(openFilePath, false);
        if (openFilePath !== undefined) {
          if (openFilePath.endsWith('.obc')) {
            lauchGUI = false;
          } else {
            lauchGUI = true;
          }
        }
      }

      if (lauchGUI) {
        showJogWindow()
      }
    })
    // Create myWindow, load the rest of the app, etc...
    electronApp.on('ready', () => {
      if (process.platform == 'win32') {
        // Don't show window - sit in Tray
      } else {
        showJogWindow() // Macos and Linux - launch GUI
      }
    })
  }

  if (electronApp) {
    // Module to create native browser window.

    function createApp() {
      status.misc.autoStart = persistentConfig.autoStart;
      if (process.platform != 'win32' || persistentConfig.autoStart)
        createTrayIcon();
      if (process.platform == 'darwin') {
        debug_log("Creating MacOS Menu");
        status.driver.operatingsystem = 'macos';
        createMenu();
      }
      if (process.platform == 'win32') {
        status.driver.operatingsystem = 'windows';
        const pathIndex = electronApp.isPackaged ? 1 : 2;
        if (process.argv.length > pathIndex) {
          var openFilePath = process.argv[pathIndex];
          if (openFilePath !== "") {
           debug_log("path" + openFilePath);
            readFile(openFilePath, false);
          }
        }
      }

      foceShowGui = uploadedgcode.length > 1 || process.argv.indexOf("-showGui") > 0;
      if (process.argv.indexOf("-resetSize") > 0)
        BrowserWindow.clearPersistedState('main-window');
      if (foceShowGui || process.platform == 'darwin' || (process.platform == 'win32' && !persistentConfig.autoStart)) {
        showJogWindow();
        if (process.argv.indexOf("-debug") > 0)
          jogWindow.webContents.openDevTools();
      }

    }

    function createMenu() {

      var template = [{
        label: "Application",
        submenu: [{
          label: "Quit",
          accelerator: "Command+Q",
          click: function() {
            if (appIcon) {
              appIcon.destroy();
            }
            electronApp.exit(0);
          }
        }]
      }, {
        label: "Edit",
        submenu: [{
            label: "Cut",
            accelerator: "CmdOrCtrl+X",
            selector: "cut:"
          },
          {
            label: "Copy",
            accelerator: "CmdOrCtrl+C",
            selector: "copy:"
          },
          {
            label: "Paste",
            accelerator: "CmdOrCtrl+V",
            selector: "paste:"
          },
          {
            label: "Select All",
            accelerator: "CmdOrCtrl+A",
            selector: "selectAll:"
          }
        ]
      }, {
        label: "View",
        submenu: [{
            label: "Reload",
            accelerator: "F5",
            click: (item, focusedWindow) => {
              if (focusedWindow) {
                // on reload, start fresh and close any old
                // open secondary windows
                if (focusedWindow.id === 1) {
                  BrowserWindow.getAllWindows().forEach(win => {
                    if (win.id > 1) win.close();
                  });
                }
                focusedWindow.reload();
              }
            }
          },
          {
            label: "Toggle Dev Tools",
            accelerator: "F12",
            click: () => {
              jogWindow.webContents.toggleDevTools();
            }
          }
        ]
      }];

      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    }

    function createTrayIcon() {
      if (process.platform !== 'darwin') {
        appIcon = new Tray(
          nativeImage.createFromPath(iconPath)
        )
        const contextMenuTemplate = [{
          label: 'Open User Interface (GUI)',
          click() {
            // debug_log("Clicked Systray")
            showJogWindow()
          }
        }, {
          label: 'Quit OpenBuilds CONTROL (Disables all integration until started again)',
          click() {
            if (appIcon) {
              appIcon.destroy();
            }
            electronApp.exit(0);
          }
        }];
        if (process.platform == 'win32') {
          contextMenuTemplate.push({type: 'separator'});
          contextMenuTemplate.push({
            label: 'Disable Auto Start and the Tray Icon',
            click() {
              showJogWindow();
              setAutoStart(false);
              dialog.showMessageBox(jogWindow, {
                type: 'info',
                buttons: ['OK'],
                message: 'Auto Start and the tray icon have been disabled.\n\nThey can be restored from the Application Settings menu in the Troubleshooting tab.'
              });
              if (appIcon) {
                appIcon.destroy();
              }
              appIcon = null;
            }
          });
        }

        const contextMenu = Menu.buildFromTemplate(contextMenuTemplate);
        if (appIcon) {
          appIcon.on('click', function() {
            // debug_log("Clicked Systray")
            showJogWindow()
          })
        }

        if (appIcon) {
          appIcon.on('balloon-click', function() {
            // debug_log("Clicked Systray")
            showJogWindow()
          })
        }

        // Call this again for Linux because we modified the context menu
        if (appIcon) {
          appIcon.setContextMenu(contextMenu)
        }

        if (appIcon) {
          appIcon.displayBalloon({
            icon: nativeImage.createFromPath(iconPath),
            title: "OpenBuilds CONTROL Started",
            content: "OpenBuilds CONTROL has started successfully"
          })
        }
      } else {
        const dockMenu = Menu.buildFromTemplate([{
          label: 'Quit OpenBuilds CONTROL (Disables all integration until started again)',
          click() {
            // appIcon.destroy();
            electronApp.exit(0);
          }
        }])
        electronApp.dock.setMenu(dockMenu)
      };

      console.log("Created tray icon");
    }

    function createJogWindow() {
      // Create the browser window.
      jogWindow = new BrowserWindow({
        // 1366 * 768 == minimum to cater for
        width: 1000,
        minWidth: 1000,
        height: 850,
        minHeight: 850,
        fullscreen: false,
        center: true,
        resizable: true,
        maximizable: true,
        title: "OpenBuilds CONTROL ",
        name: "main-window", // name for the persisted state
        frame: false,
        autoHideMenuBar: true,
        //icon: '/app/favicon.png',
        icon: nativeImage.createFromPath(
          path.join(__dirname, "/app/favicon.png")
        ),
        webgl: true,
        experimentalFeatures: true,
        experimentalCanvasFeatures: true,
        offscreen: true,
        backgroundColor: "#fff",
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        },
        windowStatePersistence: {
          bounds: true,
          displayMode: persistentConfig.persistDisplayMode
        }
      });

      jogWindow.setOverlayIcon(nativeImage.createFromPath(iconPath), 'Icon');
      var ipaddr = ip.address();
      // jogWindow.loadURL(`//` + ipaddr + `:3000/`)
      jogWindow.loadURL(`http://localhost:${config.webPort}/`);
      //jogWindow.webContents.openDevTools()

      jogWindow.on('close', function(event) {
        if (!forceQuit) {
          jogWindow.hide();
          return false;
        }
      });

      // Emitted when the window is closed.
      jogWindow.on('closed', function() {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        jogWindow = null;
      });
      jogWindow.once('ready-to-show', () => {
        showJogWindow()
      })
    }

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    electronApp.on('ready', createApp);

    electronApp.on('before-quit', function() {
      forceQuit = true;
    })

    electronApp.on('will-quit', function(event) {
      // On OS X it is common for applications and their menu bar
      // to stay active until the user quits explicitly with Cmd + Q
      // We don't take that route, we close it completely
      if (appIcon) {
        appIcon.destroy();
      }
      electronApp.exit(0);
    });

    // Quit when all windows are closed.
    electronApp.on('window-all-closed', function() {
      // On OS X it is common for applications and their menu bar
      // to stay active until the user quits explicitly with Cmd + Q
      if (appIcon) {
        appIcon.destroy();
      }
      electronApp.exit(0);
    });

    electronApp.on('activate', function() {
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      createApp();
    });

    // Autostart on Login
    if (process.platform == 'win32' && persistentConfig.autoStart) {
      electronApp.setLoginItemSettings({
        openAtLogin: true,
        args: []
      })
    }
  }
}

function isJson(item) {
  item = typeof item !== "string" ?
    JSON.stringify(item) :
    item;

  try {
    item = JSON.parse(item);
  } catch (e) {
    return false;
  }

  if (typeof item === "object" && item !== null) {
    return true;
  }

  return false;
}

// Interface Programming

var firmwareImagePath = path.join(uploadsDir, './firmware.bin');
var spawn = require('child_process').spawn;
const multer = require('multer');

// Used for running gcode
const memoryStorage = multer.memoryStorage();

// Used for uploading firmware
const uploadFileStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadsDir);
  },
  // By default, multer removes file extensions so let's add them back
  filename: function(req, file, cb) {
    cb(null, file.fieldname + '-' + new Date().toJSON().replace(new RegExp(':', 'g'), '.') + path.extname(file.originalname));
  }
});

// Used for save as
const saveFileStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.dirname(file.originalname));
  },
  // By default, multer removes file extensions so let's add them back
  filename: function(req, file, cb) {
    cb(null, path.basename(file.originalname));
  }
});


function flashInterface(data) {
  status.comms.connectionStatus = 6;

  var port = data.port;
  var file = data.file;
  var erase = data.erase

  console.log("Flashing Interface on " + port + " with file: " + file)

  var data = {
    'port': port,
    'string': "[Starting...]"
  }
  io.sockets.emit("progStatus", data);

  var esptool_opts = [
    '--chip', 'esp32',
    '--port', port,
    '--baud', '921600',
    '--before', 'default_reset',
    '--after', 'hard_reset',
    'write_flash',
    '-z',
    '--flash_mode', 'dio',
    '--flash_freq', '80m',
    '--flash_size', 'detect',
    '0xe000', path.join(__dirname, "./boot_app0.bin").replace('app.asar', 'app.asar.unpacked'),
    '0x1000', path.join(__dirname, "./bootloader_qio_80m.bin").replace('app.asar', 'app.asar.unpacked'),
    '0x10000', path.resolve(firmwareImagePath).replace('app.asar', 'app.asar.unpacked'),
    '0x8000', path.join(__dirname, "./firmware.partitions.bin").replace('app.asar', 'app.asar.unpacked')
  ];

  if (erase == true) {
    esptool_opts.push('--erase-all');
  }

  if (process.platform == 'linux') {
    //path.join(__dirname, "..", "lib", "resources", "vad.onnx"),
    fs.chmodSync(path.join(__dirname, "./esptool-linux").replace('app.asar', 'app.asar.unpacked'), 0o755);
    var child = spawn(path.join(__dirname, "./esptool-linux").replace('app.asar', 'app.asar.unpacked'), esptool_opts);
  } else if (process.platform == 'win32') {
    var child = spawn(path.join(__dirname, "./esptool.exe").replace('app.asar', 'app.asar.unpacked'), esptool_opts);
  } else if (process.platform == 'darwin') {
    fs.chmodSync(path.join(__dirname, "./esptool-mac").replace('app.asar', 'app.asar.unpacked'), 0o755);
    var child = spawn(path.join(__dirname, "./esptool-mac").replace('app.asar', 'app.asar.unpacked'), esptool_opts);
  }




  child.stdout.on('data', function(data) {
    var debugString = data.toString();
    console.log(debugString)
    var data = {
      'port': port,
      'string': debugString
    }
    io.sockets.emit("progStatus", data);
    status.comms.connectionStatus = 6;

  });

  child.stderr.on('data', function(data) {
    var debugString = data.toString();
    console.log(debugString)
    var data = {
      'port': port,
      'string': debugString
    }
    io.sockets.emit("progStatus", data);
    status.comms.connectionStatus = 6;

  });

  child.on('close', (code) => {
    var data = {
      'port': port,
      'string': `[exit:` + code + `]`,
      'code': code
    }
    io.sockets.emit("progStatus", data);
    status.comms.connectionStatus = 0;

  });
}
// end Interface Programming

function flashGrblHal(data) {

  console.log(JSON.stringify(data))

  status.comms.connectionStatus = 6;

  var port = data.port;
  var file = data.file;
  var customImg = data.customImg
  var erase = data.erase

  if (customImg == true) {
    var firmwarePath = firmwareImagePath
  } else {
    var firmwarePath = path.join(__dirname, file)
  }

  console.log("Flashing BlackBoxX32 on " + port + " with file: " + path.resolve(firmwarePath).replace('app.asar', 'app.asar.unpacked'))
  var data = {
    'port': port,
    'string': "[Starting...]"
  }
  io.sockets.emit("progStatus", data);

  var esptool_opts = [
    '--port', port,
    '--baud', '460800',
    '--before', 'default_reset',
    '--after', 'hard_reset',
    '--chip', 'esp32',
    'write_flash',
    '--flash_mode', 'dio',
    '--flash_size', 'detect',
    '--flash_freq', '40m',
    '0x1000', path.join(__dirname, "./grblhal-bootloader.bin").replace('app.asar', 'app.asar.unpacked'),
    '0x8000', path.join(__dirname, "./grblhal-partition-table.bin").replace('app.asar', 'app.asar.unpacked'),
    '0x10000', path.resolve(firmwarePath).replace('app.asar', 'app.asar.unpacked')
  ];

  if (erase == true) {
    esptool_opts.push('--erase-all');
  }

  if (process.platform == 'linux') {
    fs.chmodSync(path.join(__dirname, "./esptool-linux").replace('app.asar', 'app.asar.unpacked'), 0o755);
    var child = spawn(path.join(__dirname, "./esptool-linux").replace('app.asar', 'app.asar.unpacked'), esptool_opts);
  } else if (process.platform == 'win32') {
    var child = spawn(path.join(__dirname, "./esptool.exe").replace('app.asar', 'app.asar.unpacked'), esptool_opts);
  } else if (process.platform == 'darwin') {
    console.log("Running on MacOS")
    fs.chmodSync(path.join(__dirname, "./esptool-mac").replace('app.asar', 'app.asar.unpacked'), 0o755);
    var child = spawn(path.join(__dirname, "./esptool-mac").replace('app.asar', 'app.asar.unpacked'), esptool_opts);
  }


  child.stdout.on('data', function(data) {
    var debugString = data.toString();
    console.log(debugString)
    var data = {
      'port': port,
      'string': debugString
    }
    io.sockets.emit("progStatus", data);
    status.comms.connectionStatus = 6;

  });

  child.stderr.on('data', function(data) {
    var debugString = data.toString();
    console.log(debugString)
    var data = {
      'port': port,
      'string': debugString
    }
    io.sockets.emit("progStatus", data);
    status.comms.connectionStatus = 6;

  });

  child.on('close', (code) => {
    var data = {
      'port': port,
      'string': `[exit:` + code + `]`,
      'code': code
    }
    io.sockets.emit("progStatus", data);
    status.comms.connectionStatus = 0;

  });
}
// end BlackBoxX32 Programming


// LAN Scanner for BlackBox X32, Interface, SwitchBlox etc //
function scanForTelnetDevices(range) {
  //var localNetwork = ip.address().split('.');
  //var network = localNetwork[0] + '.' + localNetwork[1] + '.' + localNetwork[2];
  //var range = network + ".1-" + network + ".254"

  var networkDevices = []
  oldiplist = status.comms.interfaces.networkDevices;
  const telnetScanOptions = {
    target: range,
    port: '23',
    status: 'TROU', // Timeout, Refused, Open, Unreachable
    banner: true
  };

  var output = {
    'command': 'network',
    'response': "Starting network scan for: " + telnetScanOptions.target,
    'type': 'success'
  }
  io.sockets.emit('data', output);

  new Evilscan(telnetScanOptions, (err, scan) => {

    if (err) {
      var output = {
        'command': 'network',
        'response': "Network Scan error: " + err,
        'type': 'success'
      }
      io.sockets.emit('data', output);
      //console.log(err);
      return;
    }

    scan.on('result', data => {
      // fired when item is matching options
      //console.log(data);
      if (data.status == "open") {
        var type = false;
        if (data.banner.indexOf("GrblHAL") != -1) {
          type = "grblHAL"
        } else if (data.banner.indexOf("Grbl") != -1) {
          type = "grbl"
        }
        networkDevices.push({
          ip: data.ip,
          type: type,
          banner: data.banner
        })
      }

    });

    scan.on('error', err => {
      //throw new Error(data.toString());
    });

    scan.on('done', () => {
      // finished !
      networkDevices.sort((a, b) => {
        return a.ip.split('.')[3] - b.ip.split('.')[3];
      });
      status.comms.interfaces.networkDevices = networkDevices;
      if (!_.isEqual(status.comms.interfaces.networkDevices, oldiplist)) {
        var newTelnetPorts = _.differenceWith(status.comms.interfaces.networkDevices, oldiplist, _.isEqual)
        if (newTelnetPorts.length > 0) {
          debug_log("Detected new device: " + newTelnetPorts[0].ip);
        }
        var removedTelnetPorts = _.differenceWith(oldiplist, status.comms.interfaces.networkDevices, _.isEqual)
        if (removedTelnetPorts.length > 0) {
          debug_log("No longer detecting device: " + removedTelnetPorts[0].ip);
        }
      }
      oldiplist = status.comms.interfaces.networkDevices;
      if (status.comms.interfaces.networkDevices.length > 0) {
        var output = {
          'command': 'network',
          'response': "Network Scan completed. Found " + status.comms.interfaces.networkDevices.length + " devices.  Network addresses added to the Port selection dropdown.",
          'type': 'success'
        }
      } else {
        var output = {
          'command': 'network',
          'response': "Network Scan completed. Found " + status.comms.interfaces.networkDevices.length + " devices",
          'type': 'error'
        }
      }

      io.sockets.emit('data', output);
    });

    scan.run();
  });
}
// end LAN Scanner

// USB port details

function friendlyPort(port) {
  // var likely = false;
  var img = 'usb.png';
  var note = '';
  var manufacturer = port.manufacturer
  if (manufacturer == `(Standard port types)`) {
    img = 'serial.png'
    note = 'Motherboard Serial Port';
  } else if (port.productId && port.vendorId) {
    if (port.productId == '6001' && port.vendorId == '0403') {
      // found FTDI FT232
      img = 'usb.png';
      note = 'FTDI USB to Serial';
    }
    if (port.productId == '6015' && port.vendorId == '0403') {
      // found FTDI FT230x
      img = 'usb.png';
      note = 'FTDI USD to Serial';
    }
    if (port.productId == '606D' && port.vendorId == '1D50') {
      // found TinyG G2
      img = 'usb.png';
      note = 'Tiny G2';
    }
    if (port.productId == '003D' && port.vendorId == '2341') {
      // found Arduino Due Prog Port
      img = 'due.png';
      note = 'Arduino Due Prog';
    }
    if (port.productId == '0043' && port.vendorId == '2341' || port.productId == '0001' && port.vendorId == '2341' || port.productId == '0043' && port.vendorId == '2A03') {
      // found Arduino Uno
      img = 'uno.png';
      note = 'Arduino Uno';
    }
    if (port.productId == '2341' && port.vendorId == '0042') {
      // found Arduino Mega
      img = 'mega.png';
      note = 'Arduino Mega';
    }
    if (port.productId == '7523' && port.vendorId == '1A86') {
      // found CH340
      img = 'uno.png';
      note = 'WCH.cn CH340 USB to UART';
    }
    if (port.productId == 'EA60' && port.vendorId == '10C4') {
      // found CP2102
      img = 'silabs.png';
      note = 'Silicon Labs USB to UART';
    }
    if (port.productId == '000A' && port.vendorId == '2E8A') {
      // found CP2102
      img = 'pipico.png';
      note = 'Raspberry Pi Pico CDC UART';
    }
    if (port.productId == '4001' && port.vendorId == '303A') {
      // found CP2102
      img = 'blox.png';
      note = 'OpenBuilds BLOX (with grblHAL)';
    }
    if (port.productId == '1001' && port.vendorId == '303A') {
      // found CP2102
      img = 'blox.png';
      note = 'OpenBuilds BLOX (Alternate Firmware)';
    }
    if (port.productId == '2303' && port.vendorId == '067B') {
      // found CP2102
      // img = 'nodemcu.png';
      note = 'Prolific USB to Serial';
    }
  } else {
    img = "usb.png";
  }

  return {
    img: img,
    note: note
  };
}

// End USB Port details

// System Info on startup

const os = require('os');
const si = require('systeminformation');

var systemInformation;

async function getSystemInfo() {
  // Basic OS and hardware details
  const osType = os.type(); // 'Linux', 'Darwin' (Mac), 'Windows_NT'
  const osPlatform = os.platform(); // 'win32', 'linux', 'darwin', etc.
  const osRelease = os.release(); // OS version
  const arch = os.arch(); // 'x64', 'arm', 'arm64', etc.
  const totalMemory = os.totalmem();
  const networkInterfaces = os.networkInterfaces();
  const cpu = os.cpus();

  // Additional system information using systeminformation
  const [baseboard, graphics, osInfo] = await Promise.all([
    si.baseboard(),
    si.graphics(),
    si.osInfo()
  ]);

  // Prepare systemInformation JSON object
  systemInformation = {
    operatingSystem: {
      type: osType,
      platform: osPlatform,
      release: osRelease,
      arch: arch,
      distro: osInfo.distro || "N/A",
      version: osInfo.release || "N/A",
      codename: osInfo.codename || "N/A",
    },
    hardware: {
      cpu: cpu.map(core => ({
        model: core.model,
        speed: core.speed, // in MHz
        times: core.times
      })),
      motherboard: {
        manufacturer: baseboard.manufacturer,
        model: baseboard.model,
        version: baseboard.version,
        serialNumber: baseboard.serial,
      },
      gpu: graphics.controllers.map(gpu => ({
        model: gpu.model,
        vendor: gpu.vendor,
        vram: gpu.vram, // in MB
        bus: gpu.bus
      })),
      memory: {
        total: (totalMemory / 1024 / 1024 / 1024).toFixed(2) + " GB",
        free: (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + " GB",
      },
    },
    network: Object.keys(networkInterfaces).map(iface => ({
      interface: iface,
      addresses: networkInterfaces[iface].map(addr => ({
        address: addr.address,
        family: addr.family,
        internal: addr.internal,
      })),
    })),
  };

  // Timer to update free memory every minute
  setInterval(() => {
    systemInformation.hardware.memory.free = (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + " GB";
  }, 60000); // 60,000 ms = 1 minute

  // Log the initial systemInformation object
  debug_log(JSON.stringify(systemInformation, null, 2));

  // Return the systemInformation object (if needed for further use)
  io.sockets.emit("sysinfo", systemInformation);

  return systemInformation;
}

// Call the function
getSystemInfo().catch(err => console.error("Error retrieving system information:", err));


// End system info on startup

process.on('exit', () => debug_log('exit'))
