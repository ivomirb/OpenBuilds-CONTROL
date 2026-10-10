// grblPort.js handles the connection port (USB, telnet) for the controller

"use strict";

// System dependencies
const {
  SerialPort
} = require('serialport')

const _ = require('lodash');
const net = require('net');
const Evilscan = require('evilscan');


// App dependencies
const {
  debug_log,
  status,
} = require('./core.js');

const {
  serverEmitOutput,
  addConnectionHandler,
} = require('./server.js');


// Global variables
var port = null;
var oldIpList;
var portOpenHandlers = [];
var portCloseHandlers = [];


function friendlyPort(port) {
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

async function findPorts() {
  const ports = await SerialPort.list()
  status.comms.interfaces.ports = ports;
  for (var i = 0; i < status.comms.interfaces.ports.length; i++) {
    var data = friendlyPort(status.comms.interfaces.ports[i])
    status.comms.interfaces.ports[i].img = data.img;
    status.comms.interfaces.ports[i].note = data.note;
  }
}

function onPortError(err) {
  if (err.message != "Port is not open") {
    debug_log("Error: ", err.message);
    serverEmitOutput({
      command: '',
      response: "PORT ERROR: " + err.message,
      type: 'error'
    });

    if (status.comms.connectionStatus > 0) {
      debug_log('WARN: Closing Port ' + port.path);
      status.comms.connectionStatus = 0;
      closePort();
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
  }
}

function onPortClose() {
  debug_log("PORT INFO: Port closed");
  serverEmitOutput({
    command: 'disconnect',
    response: "PORT INFO: Port closed",
    type: 'info'
  });
  closePort();
  port = null;
}

function connectTo(data) { // If a user picks a port to connect to, open a Node SerialPort Instance to it

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

    port.on("error", onPortError);

    port.on("ready", function() {
      portOpenHandlers.forEach((x) => x(port, data));
    });

    port.on("open", function() {
      portOpenHandlers.forEach((x) => x(port, data));
    });

    port.on("close", onPortClose);
  }
}

function closePort() {
  portCloseHandlers.forEach((x) => x());
  if (!port) return;

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

function addPortOpenHandler(handler) {
  portOpenHandlers.push(handler);
}

function addPortCloseHandler(handler) {
  portCloseHandlers.push(handler);
}

// LAN Scanner for BlackBox X32, Interface, SwitchBlox etc //
function scanForTelnetDevices(range) {
  //var localNetwork = ip.address().split('.');
  //var network = localNetwork[0] + '.' + localNetwork[1] + '.' + localNetwork[2];
  //var range = network + ".1-" + network + ".254"

  var networkDevices = []
  oldIpList = status.comms.interfaces.networkDevices;
  const telnetScanOptions = {
    target: range,
    port: '23',
    status: 'TROU', // Timeout, Refused, Open, Unreachable
    banner: true
  };

  serverEmitOutput({
    command: 'network',
    response: "Starting network scan for: " + telnetScanOptions.target,
    type: 'success'
  });

  new Evilscan(telnetScanOptions, (err, scan) => {

    if (err) {
      serverEmitOutput({
        command: 'network',
        response: "Network Scan error: " + err,
        type: 'success'
      });
      return;
    }

    scan.on('result', data => {
      // fired when item is matching options
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

    // eslint-disable-next-line no-unused-vars
    scan.on('error', err => {
      //throw new Error(data.toString());
    });

    scan.on('done', () => {
      // finished !
      networkDevices.sort((a, b) => {
        return a.ip.split('.')[3] - b.ip.split('.')[3];
      });
      status.comms.interfaces.networkDevices = networkDevices;
      if (!_.isEqual(status.comms.interfaces.networkDevices, oldIpList)) {
        var newTelnetPorts = _.differenceWith(status.comms.interfaces.networkDevices, oldIpList, _.isEqual)
        if (newTelnetPorts.length > 0) {
          debug_log("Detected new device: " + newTelnetPorts[0].ip);
        }
        var removedTelnetPorts = _.differenceWith(oldIpList, status.comms.interfaces.networkDevices, _.isEqual)
        if (removedTelnetPorts.length > 0) {
          debug_log("No longer detecting device: " + removedTelnetPorts[0].ip);
        }
      }
      oldIpList = status.comms.interfaces.networkDevices;
      if (status.comms.interfaces.networkDevices.length > 0) {
        serverEmitOutput({
          command: 'network',
          response: "Network Scan completed. Found " + status.comms.interfaces.networkDevices.length + " devices.  Network addresses added to the Port selection dropdown.",
          type: 'success'
        });
      } else {
        serverEmitOutput({
          command: 'network',
          response: "Network Scan completed. Found " + status.comms.interfaces.networkDevices.length + " devices",
          type: 'error'
        });
      }
    });

    scan.run();
  });
}

function onConnection(socket) {
  socket.on("scannetwork", scanForTelnetDevices);

  socket.on("connectTo", connectTo);

  socket.on('closePort', function() { // Close machine port and dump queue
    if (status.comms.connectionStatus > 0) {
      debug_log('WARN: Closing Port ' + port.path);
      closePort();
    } else {
      debug_log('ERROR: Machine connection not open!');
    }
  });
}

function initGrblPort() {
  addConnectionHandler(onConnection);

  findPorts();
  setInterval(function() {
    if (status.comms.connectionStatus == 0) {
      findPorts();
    }
  }, 1000);
}

module.exports = {
  closePort,
  addPortOpenHandler,
  addPortCloseHandler,
  initGrblPort,
};
