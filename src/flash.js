// flash.js handles flashing OpenBuilds firmware

"use strict";

// System dependencies
var path = require("path");
var fs = require("fs");
const multer = require('multer');

const {
  spawn
} = require('child_process');

const {
  mkdirp
} = require('mkdirp')

const {
  dialog,
  app: electronApp,
} = require('electron');


// App dependencies
const {
  rootDir,
  debug_log,
  status,
} = require('./core.js');

const {
  jogWindowAPI
} = require('./jogWindowAPI.js');

const {
  app,
  serverEmit,
  serverEmitOutput,
  addConnectionHandler,
} = require('./server.js');

const {
  closePort,
} = require('./grblPort.js');


// Global variables
var uploadsDir;
var firmwareImagePath;

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

function uploadCustomFirmwareRequest(req, res) {
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
}

function onOpenInterfaceDir() {
  dialog.showOpenDialog(jogWindowAPI.getJogWindow(), {
    properties: ['openDirectory'],
    title: "Select the USB Flashdrive you want to use with Interface"
  }).then(result => {
    console.log(result.canceled)
    console.log(result.filePaths)
    serverEmit("interfaceDrive", result.filePaths[0]);
    status.interface.diskdrive = result.filePaths[0]
  }).catch(err => {
    console.log(err)
  })
}

function onFlashGrbl(data) {
  const port = data.port;
  const customImg = data.customImg;
  console.log(rootDir, data.file);
  const firmwarePath = customImg ? data.file : path.join(rootDir, data.file);

  console.log("-------------------------------------------")
  console.log(firmwarePath)
  console.log("-------------------------------------------")

  if (status.comms.connectionStatus > 0) {
    debug_log('WARN: Closing Port ' + port);
    closePort();
  } else {
    debug_log('ERROR: Machine connection not open!');
  }
}

function onFlashGrblHal(data) {
  if (status.comms.connectionStatus > 0) {
    debug_log('WARN: Closing Port ' + port);
    closePort();
  } else {
    debug_log('ERROR: Machine connection not open!');
  }
  console.log(JSON.stringify(data), null, 4);

  console.log(JSON.stringify(data))

  status.comms.connectionStatus = 6;

  var port = data.port;
  var file = data.file;
  var customImg = data.customImg;
  var erase = data.erase;
  var firmwarePath = (customImg == true) ? firmwareImagePath : path.join(rootDir, file);

  console.log("Flashing BlackBoxX32 on " + port + " with file: " + path.resolve(firmwarePath).replace('app.asar', 'app.asar.unpacked'))
  const progStatus = {
    'port': port,
    'string': "[Starting...]"
  }
  serverEmit("progStatus", progStatus);

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
    '0x1000', path.join(rootDir, "./grblhal-bootloader.bin").replace('app.asar', 'app.asar.unpacked'),
    '0x8000', path.join(rootDir, "./grblhal-partition-table.bin").replace('app.asar', 'app.asar.unpacked'),
    '0x10000', path.resolve(firmwarePath).replace('app.asar', 'app.asar.unpacked')
  ];

  if (erase == true) {
    esptool_opts.push('--erase-all');
  }

  var child;
  if (process.platform == 'linux') {
    fs.chmodSync(path.join(rootDir, "./esptool-linux").replace('app.asar', 'app.asar.unpacked'), 0o755);
    child = spawn(path.join(rootDir, "./esptool-linux").replace('app.asar', 'app.asar.unpacked'), esptool_opts);
  } else if (process.platform == 'win32') {
    child = spawn(path.join(rootDir, "./esptool.exe").replace('app.asar', 'app.asar.unpacked'), esptool_opts);
  } else if (process.platform == 'darwin') {
    console.log("Running on MacOS")
    fs.chmodSync(path.join(rootDir, "./esptool-mac").replace('app.asar', 'app.asar.unpacked'), 0o755);
    child = spawn(path.join(rootDir, "./esptool-mac").replace('app.asar', 'app.asar.unpacked'), esptool_opts);
  }


  child.stdout.on('data', function(data) {
    var debugString = data.toString();
    console.log(debugString)
    const progStatus = {
      'port': port,
      'string': debugString
    }
    serverEmit("progStatus", progStatus);
    status.comms.connectionStatus = 6;

  });

  child.stderr.on('data', function(data) {
    var debugString = data.toString();
    console.log(debugString)
    const progStatus = {
      'port': port,
      'string': debugString
    }
    serverEmit("progStatus", progStatus);
    status.comms.connectionStatus = 6;

  });

  child.on('close', (code) => {
    const progStatus = {
      'port': port,
      'string': `[exit:` + code + `]`,
      'code': code
    }
    serverEmit("progStatus", progStatus);
    status.comms.connectionStatus = 0;

  });
}

function onFlashInterface(data) {
  if (status.comms.connectionStatus > 0) {
    debug_log('WARN: Closing Port ' + port);
    closePort();
  } else {
    debug_log('ERROR: Machine connection not open!');
  }

  var port = data.port;
  var file = data.file;
  var erase = data.erase

  console.log("Flashing Interface on " + port + " with file: " + file)

  const progStatus = {
    'port': port,
    'string': "[Starting...]"
  }
  serverEmit("progStatus", progStatus);

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
    '0xe000', path.join(rootDir, "./boot_app0.bin").replace('app.asar', 'app.asar.unpacked'),
    '0x1000', path.join(rootDir, "./bootloader_qio_80m.bin").replace('app.asar', 'app.asar.unpacked'),
    '0x10000', path.resolve(firmwareImagePath).replace('app.asar', 'app.asar.unpacked'),
    '0x8000', path.join(rootDir, "./firmware.partitions.bin").replace('app.asar', 'app.asar.unpacked')
  ];

  if (erase == true) {
    esptool_opts.push('--erase-all');
  }

  var child;
  if (process.platform == 'linux') {
    //path.join(rootDir, "..", "lib", "resources", "vad.onnx"),
    fs.chmodSync(path.join(rootDir, "./esptool-linux").replace('app.asar', 'app.asar.unpacked'), 0o755);
    child = spawn(path.join(rootDir, "./esptool-linux").replace('app.asar', 'app.asar.unpacked'), esptool_opts);
  } else if (process.platform == 'win32') {
    child = spawn(path.join(rootDir, "./esptool.exe").replace('app.asar', 'app.asar.unpacked'), esptool_opts);
  } else if (process.platform == 'darwin') {
    fs.chmodSync(path.join(rootDir, "./esptool-mac").replace('app.asar', 'app.asar.unpacked'), 0o755);
    child = spawn(path.join(rootDir, "./esptool-mac").replace('app.asar', 'app.asar.unpacked'), esptool_opts);
  }

  child.stdout.on('data', function(data) {
    var debugString = data.toString();
    console.log(debugString)
    const progStatus = {
      'port': port,
      'string': debugString
    }
    serverEmit("progStatus", progStatus);
    status.comms.connectionStatus = 6;

  });

  child.stderr.on('data', function(data) {
    var debugString = data.toString();
    console.log(debugString)
    const progStatus = {
      'port': port,
      'string': debugString
    }
    serverEmit("progStatus", progStatus);
    status.comms.connectionStatus = 6;

  });

  child.on('close', (code) => {
    const progStatus = {
      'port': port,
      'string': `[exit:` + code + `]`,
      'code': code
    }
    serverEmit("progStatus", progStatus);
    status.comms.connectionStatus = 0;

  });
}

function onWriteInterfaceUsbDrive(data) {
  debug_log(data)
  //data.drive = mountpoint dest
  //data.controller = type of controller
  var probesrc;
  var profilesrc;
  if (data.controller == "blackbox4x" || data.controller == "genericgrbl") {
    probesrc = path.join(rootDir, './app/wizards/interface/PROBE/');
    profilesrc = path.join(rootDir, './app/wizards/interface/PROFILESGRBL/');
  } else if (data.controller == "blackboxx32" || data.controller == "genericgrblhal") {
    probesrc = path.join(rootDir, './app/wizards/interface/PROBE/');
    profilesrc = path.join(rootDir, './app/wizards/interface/PROFILESHAL/');
  }

  var probedest = path.join(data.drive, "/PROBE/");
  var profiledest = path.join(data.drive, "/PROFILES/");

  var ncp = require('ncp').ncp;
  ncp.limit = 16;

  serverEmitOutput({
    command: 'Interface USB Drive',
    response: "Starting to copy data to " + data.drive,
    type: 'info'
  });

  var errorCount = 0;

  if (data.ssid && data.psk) {

    const folderPath = path.join(data.drive, "CONFIG");

    // Create the subfolder if it doesn't exist and then write the file
    fs.mkdir(folderPath, {
      recursive: true
    }, (err) => {
      if (err) {
        serverEmitOutput({
          command: 'Interface USB Drive',
          response: `Failed to create folder ${folderPath}! Error: ${err}`,
          type: 'error'
        });
      } else {
        var fileContent = `${data.ssid}\n${data.psk}`;

        fs.writeFile(path.join(folderPath, "wifi.cfg"), fileContent, (err) => {
          if (err) {
            errorCount++;
            serverEmitOutput({
              command: 'Interface USB Drive',
              response: `Failed to create Wifi Configuration file in ${folderPath}! Error: ${err}`,
              type: 'error'
            });
          } else {
            serverEmitOutput({
              command: 'Interface USB Drive',
              response: `Created Wifi Configuration file in ${folderPath} successfully!`,
              type: 'success'
            });
          }
        });
      }
    });

  }

  ncp(probesrc, probedest, function(err) {
    if (err) {
      serverEmitOutput({
        command: 'Interface USB Drive',
        response: "Failed to copy PROBE macros to " + probedest + ":  " + JSON.stringify(err),
        type: 'error'
      });
      errorCount++
    } else {
      serverEmitOutput({
        command: 'Interface USB Drive',
        response: "Copied PROBE macros to " + probedest + " succesfully!",
        type: 'success'
      });
    }
  });

  ncp(profilesrc, profiledest, function(err) {
    if (err) {
      serverEmitOutput({
        command: 'Interface USB Drive',
        response: "Failed to copy MACHINE PROFILES to " + profiledest + ":  " + JSON.stringify(err),
        type: 'error'
      });
      errorCount++
    } else {
      serverEmitOutput({
        command: 'Interface USB Drive',
        response: "Copied MACHINE PROFILES to " + profiledest + " succesfully!",
        type: 'success'
      });
    }
  });

  setTimeout(function() {
    if (errorCount == 0) {
      serverEmitOutput({
        command: 'Interface USB Drive',
        response: "Finished copying supporting files to Drive " + data.drive,
        type: 'success'
      });
      serverEmitOutput({
        command: 'Interface USB Drive',
        response: "Please Eject the drive (Safely Remove) and insert it into your Interface's USB port",
        type: 'info'
      });
    }
  }, 500);
}


function onConnection(socket) {
  socket.on("openInterfaceDir", onOpenInterfaceDir);

  socket.on("flashGrbl", onFlashGrbl);

  socket.on("flashGrblHal", onFlashGrblHal);

  socket.on("flashInterface", onFlashInterface);

  socket.on("writeInterfaceUsbDrive", onWriteInterfaceUsbDrive);
}

function initFlash() {
  uploadsDir = electronApp.getPath('userData') + '/upload/';
  firmwareImagePath = path.join(uploadsDir, './firmware.bin');

  mkdirp(uploadsDir).then(() => debug_log('Created Uploads Temp Directory'));

  addConnectionHandler(onConnection);

  app.post('/uploadCustomFirmware', uploadCustomFirmwareRequest);
}

module.exports = {
  initFlash
};
