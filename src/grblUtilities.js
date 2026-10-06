// grblSender.js provides non-essential utilities using the sender functionality

"use strict";

// App dependencies
const {
  debug_log,
  status,
} = require('./core.js');

const {
  serverEmit,
  addConnectionHandler,
} = require('./server.js');

const {
  addQToEnd,
  addQToEndAndKick,
  addQRealtime,
} = require('./grblSender.js');


function feedOverride(data) {
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
      const tens = Math.floor(delta / 10)

      for (let i = 1; i < tens + 1; i++) {
        setTimeout(function timer() {
          addQRealtime(String.fromCharCode(0x91));
          addQRealtime("?");
        }, i * 50);
      }

      const ones = delta - (10 * tens);
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

      const tens = Math.floor(delta / 10)
      debug_log("need to send " + tens + " x10s decrease")
      for (let i = 1; i < tens + 1; i++) {
        setTimeout(function timer() {
          addQRealtime(String.fromCharCode(0x92));
          addQRealtime("?");
        }, i * 50);
      }

      const ones = delta - (10 * tens);
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
}

function spindleOverride(data) {
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
      const tens = Math.floor(delta / 10)

      debug_log("need to send " + tens + " x10s increase")
      for (let i = 1; i < tens + 1; i++) {
        setTimeout(function timer() {
          addQRealtime(String.fromCharCode(154));
          addQRealtime("?");
        }, i * 50);
      }

      const ones = delta - (10 * tens);
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

      const tens = Math.floor(delta / 10)
      debug_log("need to send " + tens + " x10s decrease")
      for (let i = 1; i < tens + 1; i++) {
        setTimeout(function timer() {
          addQRealtime(String.fromCharCode(155));
          addQRealtime("?");
        }, i * 50);
      }

      const ones = delta - (10 * tens);
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
}

// Unused, kept for backwards compatibility
function jog(data) {
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
      addQToEndAndKick('$J=G91G21' + dir + dist + feed);
    } else {
      debug_log('ERROR: Invalid params!');
    }
  } else {
    debug_log('ERROR: Machine connection not open!');
  }
}

// Unused, kept for backwards compatibility
function jogXY(data) {
  debug_log('Jog XY' + data);
  if (status.comms.connectionStatus > 0) {
    var xincrement = parseFloat(data.x);
    var yincrement = parseFloat(data.y);
    var feed = parseFloat(data.feed)
    if (feed) {
      feed = 'F' + feed;
    }

    if (xincrement && yincrement && feed) {
      addQToEndAndKick('$J=G91G21X' + xincrement + " Y" + yincrement + " " + feed);
    } else {
      debug_log('ERROR: Invalid params!');
    }
  } else {
    debug_log('ERROR: Machine connection not open!');
  }
}

// Unused, kept for backwards compatibility
function jogTo(data) { // data = {x:xVal, y:yVal, z:zVal, mode:0(absulute)|1(relative), feed:fVal}
  debug_log('JogTo ' + JSON.stringify(data));
  if (status.comms.connectionStatus > 0) {
    if (data.x !== undefined || data.y !== undefined || data.z !== undefined) {
      var xVal = (data.x !== undefined ? 'X' + parseFloat(data.x) : '');
      var yVal = (data.y !== undefined ? 'Y' + parseFloat(data.y) : '');
      var zVal = (data.z !== undefined ? 'Z' + parseFloat(data.z) : '');
      var mode = ((data.mode == 0) ? 0 : 1);
      var feed = (data.feed !== undefined ? 'F' + parseInt(data.feed) : '');
      addQToEndAndKick('$J=G91G21' + mode + xVal + yVal + zVal + feed);
    } else {
      debug_log('error Invalid params!');
    }
  } else {
    debug_log('ERROR: Machine connection not open!');
  }
}

// Unused, kept for backwards compatibility
function setZero(data) {
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
}

// Unused, kept for backwards compatibility
function gotoZero(data) {
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
}

// Unused, kept for backwards compatibility
function setPosition(data) {
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
}

// Unused, kept for backwards compatibility
function probe(data) {
  debug_log('probe(' + JSON.stringify(data) + ')');
  if (status.comms.connectionStatus > 0) {
    addQToEndAndKick('G38.2 ' + data.direction + '-5 F1');
    addQToEndAndKick('G92 ' + data.direction + ' ' + data.probeOffset);
  } else {
    debug_log('ERROR: Machine connection not open!');
  }
}

function onConnection(socket) {
  socket.on('feedOverride', feedOverride);
  socket.on('spindleOverride', spindleOverride);

  socket.on('jog', jog);
  socket.on('jogXY', jogXY);
  socket.on('jogTo', jogTo);
  socket.on('setZero', setZero);
  socket.on('gotoZero', gotoZero);
  socket.on('setPosition', setPosition);
  socket.on('probe', probe);
}

function initGrblUtilities() {
  addConnectionHandler(onConnection);
}

module.exports = {
  initGrblUtilities
};
