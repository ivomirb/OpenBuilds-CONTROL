"use strict";

var servo = false;
var penupval = 128;
var pendownval = 128;

if (localStorage.getItem("servo-calibration")) {
  servo = JSON.parse(localStorage.getItem("servo-calibration"));
  penupval = servo.up;
  pendownval = servo.down;
} else {
  servo = false;
  penupval = 128
  pendownval = 128
}

function servoDocReady() {
  $('#pP').on('click', function() {
    if (servo) {
      socket.emit('runCommand', "M3S" + servo.up + "\n");
    } else {
      servocalibrate()
    }
  })

  $('#pM').on('click', function() {
    if (servo) {
      socket.emit('runCommand', "M3S" + servo.down + "\n");
    } else {
      servocalibrate()
    }
  })
}