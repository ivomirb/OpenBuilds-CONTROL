// files.js handles file operatons like browsing, loading, saving

"use strict";

// System dependencies
var path = require("path");
var fs = require("fs");
var formidable = require('formidable');
const multer = require('multer');
const {
  dialog,
  shell,
} = require('electron');


// App dependencies
const {
  rootDir,
  debug_log,
  status,
  config,
  persistentConfig,
  savePersistentConfig,
} = require('./core.js');

const {
  jogWindowAPI
} = require('./jogWindowAPI.js');

const {
  app,
  serverEmit,
  addConnectionHandler,
  addDocReadyHandler,
} = require('./server.js');

const {
  getCurrentGcode,
  setCurrentGcode,
} = require('./grblSender.js');


// Global variables
var uploadedWorkspace = ""; // var to store uploaded OpenBuildsCAM Workspace
var bypassFileSec = false; // when false, only files from the allowedFilePaths set can be accessed
var allowedFilePaths = new Set();

// multer disk storage for saving files
const saveFileStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    if (bypassFileSec || allowedFilePaths.has(file.originalname)) {
      cb(null, path.dirname(file.originalname));
    } else {
      cb(new Error("Saving file " + file.originalname + " is not allowed." + fileSecurityMessage), "");
    }
  },
  // By default, multer removes file extensions so let's add them back
  filename: function(req, file, cb) {
    if (bypassFileSec || allowedFilePaths.has(file.originalname)) {
      cb(null, path.basename(file.originalname));
    } else {
      cb(new Error("Saving file " + file.originalname + " is not allowed." + fileSecurityMessage), "");
    }
  }
});

const fileSecurityMessage = `

For security reasons, only files that are picked from a file browser can be accessed.

This could be caused by a buggy or malicious Javascript macro.`;

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
  serverEmit('recentFiles', persistentConfig.recentFiles);
}

function clearRecentFiles() {
  persistentConfig.recentFiles = [];
  savePersistentConfig();
  serverEmit('recentFiles', persistentConfig.recentFiles);
}

function openFileDialog(data, callback) {
  var defaultPath = persistentConfig.defaultPaths[data.id || "default"] || persistentConfig.defaultPaths["last"];

  dialog.showOpenDialog(jogWindowAPI.getJogWindow(), {
    title: data.title,
    filters: data.filters,
    defaultPath: defaultPath,
    properties: ['openFile']
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      allowedFilePaths.add(result.filePaths[0]);
      persistentConfig.defaultPaths[data.id || "default"] = path.dirname(result.filePaths[0]);
      persistentConfig.defaultPaths["last"] = path.dirname(result.filePaths[0]);
      savePersistentConfig();
      callback(result.filePaths[0]);
    }
  }).catch(err => {
    console.log(err)
  })
}

function saveFileDialog(data, callback) {
  var defaultPath = persistentConfig.defaultPaths[data.id || "default"] || persistentConfig.defaultPaths["last"];

  if (data.fileName) {
    defaultPath = defaultPath ? path.join(defaultPath, data.fileName) : data.fileName;
  }

  dialog.showSaveDialog(jogWindowAPI.getJogWindow(), {
    title: data.title,
    filters: data.filters,
    defaultPath: defaultPath,
    properties: ['dontAddToRecent']
  }).then(result => {
    if (!result.canceled) {
      allowedFilePaths.add(result.filePath);
      persistentConfig.defaultPaths[data.id || "default"] = path.dirname(result.filePath);
      persistentConfig.defaultPaths["last"] = path.dirname(result.filePath);
      savePersistentConfig();
      callback(result.filePath);
    }
  }).catch(err => {
    console.log(err)
  })
}

// generic function for reading a text file
function readTextFile(filePath, params, callback) {
  if (!bypassFileSec && !allowedFilePaths.has(filePath)) {
    if (params.showErrorDlg) {
      dialog.showMessageBox(jogWindowAPI.getJogWindow(), {
        type: 'error',
        buttons: ['OK'],
        message: "Reading file " + filePath + " is not allowed." + fileSecurityMessage
      });
    } else {
      callback("Reading file " + filePath + " is not allowed." + fileSecurityMessage, "");
    }
    return;
  }

  fs.readFile(filePath, 'utf8', function(err, data) {
    if (params.showErrorDlg) {
      if (err) {
        dialog.showMessageBox(jogWindowAPI.getJogWindow(), {
          type: 'error',
          buttons: ['OK'],
          message: err.toString()
        });
      } else {
        callback(data);
      }
    }
    else {
      callback(err ? err.toString() : "", data);
    }
  });
}

function openGcodeFile() {
  var defaultPath = persistentConfig.defaultPaths["gcode"] || persistentConfig.defaultPaths["last"];

  dialog.showOpenDialog(jogWindowAPI.getJogWindow(), {
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
      allowedFilePaths.add(result.filePaths[0]);
      const openFilePath = result.filePaths[0];
      persistentConfig.defaultPaths["gcode"] = path.dirname(openFilePath);
      persistentConfig.defaultPaths["last"] = path.dirname(openFilePath);
      savePersistentConfig();
      debug_log("path" + openFilePath);
      readGcodeFile(openFilePath, true, addRecentFile);
    }

  }).catch(err => {
    console.log(err)
  })
}

function reopenGcodeFile(filePath) {
  filePath = filePath || status.misc.lastFilePath;
  if (filePath !== "") {
    debug_log("path" + filePath);
    readGcodeFile(filePath, true, addRecentFile);
  }
}

function readGcodeFile(filePath, showErrorDlg, onSuccess) {
  debug_log('readfile: ' + filePath)
  if (!filePath || filePath.length == 0) return;

  if (!bypassFileSec && !allowedFilePaths.has(filePath)) {
    if (showErrorDlg) {
      dialog.showMessageBox(jogWindowAPI.getJogWindow(), {
        type: 'error',
        buttons: ['OK'],
        message: "Reading file " + filePath + " is not allowed." + fileSecurityMessage
      });
    }
    return;
  }

  fs.readFile(filePath, 'utf8', function(err, data) {
    if (err) {
      if (showErrorDlg) {
        dialog.showMessageBox(jogWindowAPI.getJogWindow(), {
          type: 'error',
          buttons: ['OK'],
          message: err.toString()
        });
      }
      debug_log(err);
    } else if (data) {
      if (filePath.endsWith('.obc')) { // OpenBuildsCAM Workspace
        uploadedWorkspace = data;
        shell.openExternal('https://github.com/OpenBuilds/OpenBuilds-CAM')
      } else { // GCODE
        setCurrentGcode(data);
        status.misc.lastFilePath = filePath;
        var payload = {
          gcode: data,
          filename: path.basename(status.misc.lastFilePath)
        }
        serverEmit('gcodeupload', payload);
        if (onSuccess) {
          onSuccess(filePath, data);
        }
      }
    }
  });
}

// app.post('/saveFile')
function saveFileRequest(req, res) {
  let upload = multer({
    preservePath: true,
    storage: saveFileStorage
  }).single('file');

  upload(req, res, function(err) {
    if (err) {
      if (req.body.showErrorDlg == "true") {
        dialog.showMessageBox(jogWindowAPI.getJogWindow(), {
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
}

// app.post('/upload')
function uploadGcodeRequest(req, res) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

  var uploadprogress = 0;
  var lastsentuploadprogress = 0;

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
    jogWindowAPI.showJogWindow();
    readGcodeFile(file.filepath, true);
  });

  form.on('aborted', function() {
    // Emitted when the request was aborted by the user. Right now this can be due to a 'timeout' or 'close' event on the socket. After this event is emitted, an error event will follow. In the future there will be a separate 'timeout' event (needs a change in the node core).
  });

  form.on('end', function() {
    //Emitted when the entire request has been received, and all contained files have finished flushing to disk. This is a great place for you to send your response.
    res.end();

  });

  res.sendFile(rootDir + '/app/upload.html');
}

function onConnection(socket) {
  socket.on("saveFileDialog", saveFileDialog);

  socket.on("openFileDialog", openFileDialog);

  socket.on("readTextFile", readTextFile);

  socket.on("openFile", openGcodeFile);

  socket.on("reopenFile", reopenGcodeFile);

  socket.on("clearRecentFiles", clearRecentFiles);
}

function onDocReady(result) {
  result.gcode = getCurrentGcode();
  result.filename = path.basename(status.misc.lastFilePath);
  result.recentFiles = persistentConfig.recentFiles;
}

function initFiles() {
  app.get('/upload', (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.sendFile(rootDir + '/app/upload.html');
  })

  app.get('/gcode', (req, res) => {
    const gcode = getCurrentGcode();
    if (gcode.indexOf('$') != 0) { // Ignore grblSettings jobs
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.send(gcode);
    }
  })

  app.get('/workspace', (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.send(uploadedWorkspace);
  })

  app.post('/saveFile', saveFileRequest);
  app.post('/upload', uploadGcodeRequest);

  addConnectionHandler(onConnection);
  addDocReadyHandler(onDocReady);

  persistentConfig.recentFiles.forEach((x) => allowedFilePaths.add(x));
}

module.exports = {
  readGcodeFile,
  initFiles
};
