"use strict";

var servo = false;

if (localStorage.getItem("servo-calibration")) {
  servo = JSON.parse(localStorage.getItem("servo-calibration"));
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