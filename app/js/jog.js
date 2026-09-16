var allowContinuousJog = false;
var continuousJogRunning = false;
var jogdistXYZ = 10;
var jogdistA = 10;
var safeToUpdateSliders = true;
var jogRateX = 4000
var jogRateY = 4000
var jogRateZ = 2000
var jogRateA = 2000

function jogOverride(newVal) {
  if (grblParams.hasOwnProperty('$110')) {
    jogRateX = (grblParams['$110'] * (newVal / 100)).toFixed(0);
    jogRateY = (grblParams['$111'] * (newVal / 100)).toFixed(0);
    jogRateZ = (grblParams['$112'] * (newVal / 100)).toFixed(0);
    if ($('#jro').data('slider').val() != newVal)
      $('#jro').data('slider').val(newVal)
  }
  if (grblParams.hasOwnProperty('$113')) {
    jogRateA = (grblParams['$113'] * (newVal / 100)).toFixed(0);
  }
  localStorage.setItem('jogOverride', newVal);
}

function setADist(newADist) {
  $("#distAAxislabel").html("A: " + newADist + "&deg;")
  jogdistA = newADist;
}

function mmMode() {
  unit = "mm";
  localStorage.setItem('unitsMode', unit);
  $('#dist01label').html('0.1mm')
  $('#dist1label').html('1mm')
  $('#dist10label').html('10mm')
  $('#dist100label').html('100mm')
  if (jogdistXYZ == 0.0254) {
    jogdistXYZ = 0.1
  }
  if (jogdistXYZ == 0.254) {
    jogdistXYZ = 1
  }
  if (jogdistXYZ == 2.54) {
    jogdistXYZ = 10
  }
  if (jogdistXYZ == 25.4) {
    jogdistXYZ = 100
  }
  if (typeof object !== 'undefined') {
    if (object.userData.inch) {
      if (typeof redrawGrid === "function") { // Check if function exists, because in Mobile view it does not
        redrawGrid(object.userData.bbbox2.min.x * 25.4, object.userData.bbbox2.max.x * 25.4, object.userData.bbbox2.min.y * 25.4, object.userData.bbbox2.max.y * 25.4, false);
      }
    } else {
      if (typeof redrawGrid === "function") { // Check if function exists, because in Mobile view it does not
        redrawGrid(object.userData.bbbox2.min.x, object.userData.bbbox2.max.x, object.userData.bbbox2.min.y, object.userData.bbbox2.max.y, false);
      }
    }
  } else {
    if (typeof redrawGrid === "function") { // Check if function exists, because in Mobile view it does not
      redrawGrid(xmin, xmax, ymin, ymax, false);
    }
  }
}

function inMode() {
  unit = "in";
  localStorage.setItem('unitsMode', unit);
  $('#dist01label').html('0.001"')
  $('#dist1label').html('0.01"')
  $('#dist10label').html('0.1"')
  $('#dist100label').html('1"')
  if (jogdistXYZ == 0.1) {
    jogdistXYZ = 0.0254
  }
  if (jogdistXYZ == 1) {
    jogdistXYZ = 0.254
  }
  if (jogdistXYZ == 10) {
    jogdistXYZ = 2.54
  }
  if (jogdistXYZ == 100) {
    jogdistXYZ = 25.4
  }

  if (typeof object !== 'undefined') {
    if (object.userData.inch) {
      if (typeof redrawGrid === "function") { // Check if function exists, because in Mobile view it does not
        redrawGrid(object.userData.bbbox2.min.x, object.userData.bbbox2.max.x, object.userData.bbbox2.min.y, object.userData.bbbox2.max.y, true);
      }
    } else {
      if (typeof redrawGrid === "function") { // Check if function exists, because in Mobile view it does not
        redrawGrid(object.userData.bbbox2.min.x / 25.4, object.userData.bbbox2.max.x / 25.4, object.userData.bbbox2.min.y / 25.4, object.userData.bbbox2.max.y / 25.4, true);
      }
    }
  } else {
    if (typeof redrawGrid === "function") { // Check if function exists, because in Mobile view it does not
      redrawGrid(xmin / 25.4, xmax / 25.4, ymin / 25.4, ymax / 25.4, true);
    }
  }

}

function cancelJog() {
  socket.emit('stop', {
    stop: false,
    jog: true,
    abort: false
  })
  continuousJogRunning = false;
}


$(document).ready(function() {

  if (localStorage.getItem('continuousJog')) {
    if (JSON.parse(localStorage.getItem('continuousJog')) == true) {
      $('#jogTypeContinuous').prop('checked', true)
      allowContinuousJog = true;
      $('.distbtn').hide()
    } else {
      $('#jogTypeContinuous').prop('checked', false)
      allowContinuousJog = false;
      $('.distbtn').show();
    }
  }

  $('#jogTypeContinuous').on('click', function() {
    if ($(this).is(':checked')) {
      localStorage.setItem('continuousJog', true);
      allowContinuousJog = true;
      $('.distbtn').hide();
    } else {
      localStorage.setItem('continuousJog', false);
      allowContinuousJog = false;
      $('.distbtn').show();
    }
    // console.log(document.activeElement)
    document.activeElement.blur();
  });

  if (localStorage.getItem('unitsMode')) {
    if (localStorage.getItem('unitsMode') == "mm") {
      mmMode()
      $('#mmMode').click()
    } else if (localStorage.getItem('unitsMode') == "in") {
      inMode();
      $('#inMode').click()
    }
  } else {
    // default to inches
    inMode();
    $('#inMode').click()
  }

  $(document).mousedown(function(e) {
    safeToUpdateSliders = false;
  }).mouseup(function(e) {
    safeToUpdateSliders = true;
    // Added to cancel Jog moves even when user moved the mouse off the button before releasing
    if (allowContinuousJog) {
      if (continuousJogRunning) {
        cancelJog()
      }
    }
  }).mouseleave(function(e) {
    safeToUpdateSliders = true;
  });

  $("#xPosDro").click(function() {
    $("#xPos").hide()
    $("#xPosDro").addClass("drop-shadow");
    if (unit == "mm") {
      $("#xPosInput").show().focus().val(laststatus.machine.position.work.x)
    } else if (unit == "in") {
      $("#xPosInput").show().focus().val((laststatus.machine.position.work.x / 25.4).toFixed(3))
    }
    document.getElementById("xPosInput").select();
  });

  $("#xPosInput").blur(function() {
    $("#xPosDro").removeClass("drop-shadow");
    $("#xPos").show()
    $("#xPosInput").hide()
  });

  $('#xPosInput').on('keypress', function(e) {
    console.log(e)
    if (e.key === "Enter" || e.key === "NumpadEnter") {
      //Disable textbox to prevent multiple submit
      $(this).attr("disabled", "disabled");
      $("#xPos").show()
      $("#xPosInput").hide()
      //Enable the textbox again if needed.
      $(this).removeAttr("disabled");
      if (unit == "mm") {
        if (e.shiftKey) {
          sendGcode("G21\nG10 P0 L20 X" + $("#xPosInput").val());
        } else {
          sendGcode("$J=G90 G21 X" + $("#xPosInput").val() + " F" + jogRateX);
        }

      } else if (unit == "in") {
        if (e.shiftKey) {
          sendGcode("G21\nG10 P0 L20 X" + ($("#xPosInput").val() * 25.4));
        } else {
          sendGcode("$J=G90 G20 X" + $("#xPosInput").val() + " F" + jogRateX);
        }
      }
    }
  });

  $("#yPosDro").click(function() {
    $("#yPos").hide()
    $("#yPosDro").addClass("drop-shadow");
    if (unit == "mm") {
      $("#yPosInput").show().focus().val(laststatus.machine.position.work.y)
    } else if (unit == "in") {
      $("#yPosInput").show().focus().val((laststatus.machine.position.work.y / 25.4).toFixed(3))
    }
    document.getElementById("yPosInput").select();
  });

  $("#yPosInput").blur(function() {
    $("#yPos").show()
    $("#yPosDro").removeClass("drop-shadow");
    $("#yPosInput").hide()
  });

  $('#yPosInput').on('keypress', function(e) {
    if (e.which === 13) {
      //Disable textbox to prevent multiple submit
      $(this).attr("disabled", "disabled");
      $("#yPos").show()
      $("#yPosInput").hide()
      //Enable the textbox again if needed.
      $(this).removeAttr("disabled");
      if (unit == "mm") {
        if (e.shiftKey) {
          sendGcode("G21\nG10 P0 L20 Y" + $("#yPosInput").val());
        } else {
          sendGcode("$J=G90 G21 Y" + $("#yPosInput").val() + " F" + jogRateY);
        }
      } else if (unit == "in") {
        if (e.shiftKey) {
          sendGcode("G21\nG10 P0 L20 Y" + ($("#yPosInput").val() * 25.4));
        } else {
          sendGcode("$J=G90 G20 Y" + $("#yPosInput").val() + " F" + jogRateY);
        }
      }
    }
  });

  $("#zPosDro").click(function() {
    $("#zPos").hide()
    $("#zPosDro").addClass("drop-shadow");
    if (unit == "mm") {
      $("#zPosInput").show().focus().val(laststatus.machine.position.work.z)
    } else if (unit == "in") {
      $("#zPosInput").show().focus().val((laststatus.machine.position.work.z / 25.4).toFixed(3))
    }
    document.getElementById("zPosInput").select();
  });

  $("#zPosInput").blur(function() {
    $("#zPos").show()
    $("#zPosDro").removeClass("drop-shadow");
    $("#zPosInput").hide()
  });

  $('#zPosInput').on('keypress', function(e) {
    if (e.which === 13) {
      //Disable textbox to prevent multiple submit
      $(this).attr("disabled", "disabled");
      $("#zPos").show()
      $("#zPosInput").hide()
      //Enable the textbox again if needed.
      $(this).removeAttr("disabled");
      if (unit == "mm") {
        if (e.shiftKey) {
          sendGcode("G21\nG10 P0 L20 Z" + $("#zPosInput").val());
        } else {
          sendGcode("$J=G90 G21 Z" + $("#zPosInput").val() + " F" + jogRateZ);
        }
      } else if (unit == "in") {
        if (e.shiftKey) {
          sendGcode("G21\nG10 P0 L20 Z" + ($("#zPosInput").val() * 25.4));
        } else {
          sendGcode("$J=G90 G20 Z" + $("#zPosInput").val() + " F" + jogRateZ);
        }
      }
    }
  });


  // A Axis DRO entry
  $("#aPosDro").click(function() {
    $("#aPos").hide()
    $("#aPosDro").addClass("drop-shadow");
    $("#aPosInput").show().focus().val(laststatus.machine.position.work.a)
    document.getElementById("aPosInput").select();
  });

  $("#aPosInput").blur(function() {
    $("#aPos").show()
    $("#aPosDro").removeClass("drop-shadow");
    $("#aPosInput").hide()
  });

  $('#aPosInput').on('keypress', function(e) {
    if (e.which === 13) {
      //Disable textbox to prevent multiple submit
      $(this).attr("disabled", "disabled");
      $("#aPos").show()
      $("#aPosInput").hide()
      //Enable the textbox again if needed.
      $(this).removeAttr("disabled");

      if (e.shiftKey) {
        sendGcode("G21\nG10 P0 L20 A" + $("#aPosInput").val());
      } else {
        sendGcode("$J=G90 G21 A" + $("#aPosInput").val() + " F" + jogRateA);
      }

    }
  });

  // End A-Axis DRO Entry


  $('#dist01').on('click', function(ev) {
    if (unit == "mm") {
      jogdistXYZ = 0.1;
    } else if (unit == "in") {
      jogdistXYZ = 0.0254;
    }
    $('.distbtn').removeClass('bd-openbuilds')
    $('#dist01').addClass('bd-openbuilds')
    $('.jogdistXYZ').removeClass('fg-openbuilds')
    $('.jogdistXYZ').addClass('fg-gray')
    $('#dist01label').removeClass('fg-gray')
    $('#dist01label').addClass('fg-openbuilds')
  })

  $('#dist1').on('click', function(ev) {
    if (unit == "mm") {
      jogdistXYZ = 1;
    } else if (unit == "in") {
      jogdistXYZ = 0.254;
    }
    $('.distbtn').removeClass('bd-openbuilds')
    $('#dist1').addClass('bd-openbuilds')
    $('.jogdistXYZ').removeClass('fg-openbuilds')
    $('.jogdistXYZ').addClass('fg-gray')
    $('#dist1label').removeClass('fg-gray')
    $('#dist1label').addClass('fg-openbuilds')
  })

  $('#dist10').on('click', function(ev) {
    if (unit == "mm") {
      jogdistXYZ = 10;
    } else if (unit == "in") {
      jogdistXYZ = 2.54;
    }
    $('.distbtn').removeClass('bd-openbuilds')
    $('#dist10').addClass('bd-openbuilds')
    $('.jogdistXYZ').removeClass('fg-openbuilds')
    $('.jogdistXYZ').addClass('fg-gray')
    $('#dist10label').removeClass('fg-gray')
    $('#dist10label').addClass('fg-openbuilds')
  })

  $('#dist100').on('click', function(ev) {
    if (unit == "mm") {
      jogdistXYZ = 100;
    } else if (unit == "in") {
      jogdistXYZ = 25.4;
    }
    $('.distbtn').removeClass('bd-openbuilds')
    $('#dist100').addClass('bd-openbuilds')
    $('.jogdistXYZ').removeClass('fg-openbuilds')
    $('.jogdistXYZ').addClass('fg-gray')
    $('#dist100label').removeClass('fg-gray')
    $('#dist100label').addClass('fg-openbuilds')
  })

  $('#gotozeroWPos').on('click', function(ev) {
    sendGcode('G21 G90');
    sendGcode('G0 Z5');
    sendGcode('G0 X0 Y0');
    sendGcode('G0 Z0');
  });

  $('#gotoXMinMpos').on('click', function(ev) {
    if (grblParams.$22 > 0) {
      const minX = computeMachineLimits(grblParams, laststatus.machine.firmware.features).minX;
      sendGcode("G0 G53 G90 G21 X" + minX.toFixed(2));
    }
  });

  $('#gotoXMaxMpos').on('click', function(ev) {
    if (grblParams.$22 > 0) {
      const maxX = computeMachineLimits(grblParams, laststatus.machine.firmware.features).maxX;
      sendGcode("G0 G53 G90 G21 X" + maxX.toFixed(2));
    }
  });

  $('#gotoYMinMpos').on('click', function(ev) {
    if (grblParams.$22 > 0) {
      const minY = computeMachineLimits(grblParams, laststatus.machine.firmware.features).minY;
      sendGcode("G0 G53 G90 G21 Y" + minY.toFixed(2));
    }
  });

  $('#gotoYMaxMpos').on('click', function(ev) {
    if (grblParams.$22 > 0) {
      const maxY = computeMachineLimits(grblParams, laststatus.machine.firmware.features).maxY;
      sendGcode("G0 G53 G90 G21 Y" + maxY.toFixed(2));
    }
  });

  $('#gotoZMinMpos').on('click', function(ev) {
    if (grblParams.$22 > 0) {
      const minZ = computeMachineLimits(grblParams, laststatus.machine.firmware.features).minZ;
      sendGcode("G0 G53 G90 G21 Z" + minZ.toFixed(2));
    }
  });

  $('#gotoZMaxMpos').on('click', function(ev) {
    if (grblParams.$22 > 0) {
      const maxZ = computeMachineLimits(grblParams, laststatus.machine.firmware.features).maxZ;
      sendGcode("G0 G53 G90 G21 Z" + maxZ.toFixed(2));
    }
  });

  $('#gotoAMinMpos').on('click', function(ev) {
    if (grblParams.$22 > 0) {
      const minA = computeMachineLimits(grblParams, laststatus.machine.firmware.features).minA;
      sendGcode("G0 G53 G90 G21 A" + minA.toFixed(2));
    }
  });

  $('#gotoAMaxMpos').on('click', function(ev) {
    if (grblParams.$22 > 0) {
      const maxA = computeMachineLimits(grblParams, laststatus.machine.firmware.features).maxA;
      sendGcode("G0 G53 G90 G21 A" + maxA.toFixed(2));
    }
  });

  $('#gotozeroZmPosXYwPos').on('click', function(ev) {
    const maxZ = computeMachineLimits(grblParams, laststatus.machine.firmware.features)().maxZ;
    sendGcode('G0 G53 G90 G21 Z' + maxZ.toFixed(2));
    sendGcode('G0 X0 Y0');
    sendGcode('G0 Z0');
  });

  $('#gotozeroMPos').on('click', function(ev) {
    const limits = computeMachineLimits(grblParams, laststatus.machine.firmware.features);
    if (limits.homingMask && limits.homingMask.z) {
      // Z0 at the bottom - first move XY, then Z
      sendGcode('G0 G53 X' + limits.X0.toFixed(2) + ' Y' + limits.Y0.toFixed(2));
      sendGcode('G0 G53 G90 G21 Z' + limits.Z0.toFixed(2));
    } else {
      // Z0 at the top - first move Z, then XY
      sendGcode('G0 G53 G90 G21 Z' + limits.Z0.toFixed(2));
      sendGcode('G0 G53 X' + limits.X0.toFixed(2) + ' Y' + limits.Y0.toFixed(2));
    }
  });




  $('.xM').on('touchstart mousedown', function(ev) {
    //console.log(ev)
    if (ev.which > 1) {
      return
    }
    ev.preventDefault();
    if (allowContinuousJog) { // startJog();
      if (!waitingForStatus && laststatus.comms.runStatus == "Idle" || laststatus.comms.runStatus == "Door:0") {
        var mcsX = parseFloat(laststatus.machine.position.offset.x) + parseFloat(laststatus.machine.position.work.x);
        var minX = mcsX - 1000;
        const hasSoftLimits = Object.keys(grblParams).length > 0 && parseInt(grblParams.$20) == 1;
        if (hasSoftLimits) {
          // Soft Limits is enabled so lets calculate maximum move distance
          minX = computeMachineLimits(grblParams, laststatus.machine.firmware.features, 1).minX;
          if (minX >= mcsX) {
            toastJogWillHit("X-");
          }
        }

        if (minX < mcsX) {
          socket.emit('runCommand', "$J=G53 G90 G21 X" + minX.toFixed(3) + " F" + jogRateX + "\n");
          continuousJogRunning = true;
          waitingForStatus = true;
          $('.xM').click();
        }
      } else {
        toastJogNotIdle();
      }
    } else {
      jog('X', '-' + jogdistXYZ, jogRateX);
    }
    $('#runNewProbeBtn').addClass("disabled")
    $('#confirmNewProbeBtn').removeClass("disabled")
  });
  $('.xM').on('touchend mouseup', function(ev) {
    ev.preventDefault();
    if (allowContinuousJog) {
      cancelJog()
    }
  });

  $('.xP').on('touchstart mousedown', function(ev) {
    // console.log("xp down")
    if (ev.which > 1) {
      return
    }
    ev.preventDefault();

    if (allowContinuousJog) { // startJog();
      if (!waitingForStatus && laststatus.comms.runStatus == "Idle" || laststatus.comms.runStatus == "Door:0") {
        var mcsX = parseFloat(laststatus.machine.position.offset.x) + parseFloat(laststatus.machine.position.work.x);
        var maxX = mcsX + 1000;
        const hasSoftLimits = Object.keys(grblParams).length > 0 && parseInt(grblParams.$20) == 1;
        if (hasSoftLimits) {
          // Soft Limits is enabled so lets calculate maximum move distance
          maxX = computeMachineLimits(grblParams, laststatus.machine.firmware.features, 1).maxX;
          if (maxX <= mcsX) {
            toastJogWillHit("X+");
          }
        }
        if (maxX > mcsX) {
          socket.emit('runCommand', "$J=G53 G90 G21 X" + maxX.toFixed(3) + " F" + jogRateX + "\n");
          continuousJogRunning = true;
          waitingForStatus = true;
          $('.xP').click();
        }
      } else {
        toastJogNotIdle();
      }
    } else {
      jog('X', jogdistXYZ, jogRateX);
    }
    $('#runNewProbeBtn').addClass("disabled")
    $('#confirmNewProbeBtn').removeClass("disabled")
  });
  $('.xP').on('touchend mouseup', function(ev) {
    // console.log("xp up")
    ev.preventDefault();
    if (allowContinuousJog) {
      cancelJog()
    }
  });

  $('.yM').on('touchstart mousedown', function(ev) {
    if (ev.which > 1) { // Ignore middle and right click
      return
    }
    ev.preventDefault();

    if (allowContinuousJog) { // startJog();
      if (!waitingForStatus && laststatus.comms.runStatus == "Idle" || laststatus.comms.runStatus == "Door:0") {
        var mcsY = parseFloat(laststatus.machine.position.offset.y) + parseFloat(laststatus.machine.position.work.y);
        var minY = mcsY - 1000;
        const hasSoftLimits = Object.keys(grblParams).length > 0 && parseInt(grblParams.$20) == 1;
        if (hasSoftLimits) {
          // Soft Limits is enabled so lets calculate maximum move distance
          minY = computeMachineLimits(grblParams, laststatus.machine.firmware.features, 1).minY;
          if (minY >= mcsY) {
            toastJogWillHit("Y-");
          }
        }

        if (minY < mcsY) {
          socket.emit('runCommand', "$J=G53 G90 G21 Y" + minY.toFixed(3) + " F" + jogRateY + "\n");
          continuousJogRunning = true;
          waitingForStatus = true;
          $('.yM').click();
        }
      } else {
        toastJogNotIdle();
      }
    } else {
      jog('Y', '-' + jogdistXYZ, jogRateY);
    }
    $('#runNewProbeBtn').addClass("disabled")
    $('#confirmNewProbeBtn').removeClass("disabled")
  });
  $('.yM').on('touchend mouseup', function(ev) {
    ev.preventDefault();
    if (allowContinuousJog) {
      cancelJog()
    }
  });

  $('.yP').on('touchstart mousedown', function(ev) {
    if (ev.which > 1) { // Ignore middle and right click
      return
    }
    ev.preventDefault();

    if (allowContinuousJog) { // startJog();
      if (!waitingForStatus && laststatus.comms.runStatus == "Idle" || laststatus.comms.runStatus == "Door:0") {
        var mcsY = parseFloat(laststatus.machine.position.offset.y) + parseFloat(laststatus.machine.position.work.y);
        var maxY = mcsY + 1000;
        const hasSoftLimits = Object.keys(grblParams).length > 0 && parseInt(grblParams.$20) == 1;
        if (hasSoftLimits) {
          // Soft Limits is enabled so lets calculate maximum move distance
          maxY = computeMachineLimits(grblParams, laststatus.machine.firmware.features, 1).maxY;
          if (maxY <= mcsY) {
            toastJogWillHit("Y+");
          }
        }
        if (maxY > mcsY) {
          socket.emit('runCommand', "$J=G53 G90 G21 Y" + maxY.toFixed(3) + " F" + jogRateY + "\n");
          continuousJogRunning = true;
          waitingForStatus = true;
          $('#yP').click();
        }
      } else {
        toastJogNotIdle();
      }
    } else {
      jog('Y', jogdistXYZ, jogRateY);
    }
    $('#runNewProbeBtn').addClass("disabled")
    $('#confirmNewProbeBtn').removeClass("disabled")
  });
  $('.yP').on('touchend mouseup', function(ev) {
    ev.preventDefault();
    if (allowContinuousJog) {
      cancelJog()
    }
  });

  $('.zM').on('touchstart mousedown', function(ev) {
    if (ev.which > 1) { // Ignore middle and right click
      return
    }
    ev.preventDefault();

    if (allowContinuousJog) { // startJog();
      if (!waitingForStatus && laststatus.comms.runStatus == "Idle" || laststatus.comms.runStatus == "Door:0") {
        var mcsZ = parseFloat(laststatus.machine.position.offset.z) + parseFloat(laststatus.machine.position.work.z);
        var minZ = mcsZ - 1000;
        const hasSoftLimits = Object.keys(grblParams).length > 0 && parseInt(grblParams.$20) == 1;
        if (hasSoftLimits) {
          // Soft Limits is enabled so lets calculate maximum move distance
          minZ = computeMachineLimits(grblParams, laststatus.machine.firmware.features, 1).minZ;
          if (minZ >= mcsZ) {
            toastJogWillHit("Z-");
          }
        }

        if (minZ < mcsZ) {
          socket.emit('runCommand', "$J=G53 G90 G21 Z" + minZ.toFixed(3) + " F" + jogRateZ + "\n");
          continuousJogRunning = true;
          waitingForStatus = true;
          $('.zM').click();
        }
      } else {
        toastJogNotIdle();
      }
    } else {
      jog('Z', '-' + jogdistXYZ, jogRateZ);
    }
    $('#runNewProbeBtn').addClass("disabled")
    $('#confirmNewProbeBtn').removeClass("disabled")
  });
  $('.zM').on('touchend mouseup', function(ev) {
    ev.preventDefault();
    if (allowContinuousJog) {
      cancelJog()
    }
  });

  $('.zP').on('touchstart mousedown', function(ev) {
    if (ev.which > 1) { // Ignore middle and right click
      return
    }
    ev.preventDefault();

    if (allowContinuousJog) { // startJog();
      if (!waitingForStatus && laststatus.comms.runStatus == "Idle" || laststatus.comms.runStatus == "Door:0") {
        var mcsZ = parseFloat(laststatus.machine.position.offset.z) + parseFloat(laststatus.machine.position.work.z);
        var maxZ = mcsZ + 1000;
        const hasSoftLimits = Object.keys(grblParams).length > 0 && parseInt(grblParams.$20) == 1;
        if (hasSoftLimits) {
          // Soft Limits is enabled so lets calculate maximum move distance
          maxZ = computeMachineLimits(grblParams, laststatus.machine.firmware.features, 1).maxZ;
          if (maxZ <= mcsZ) {
            toastJogWillHit("Z+");
          }
        }
        if (maxZ > mcsZ) {
          socket.emit('runCommand', "$J=G53 G90 G21 Z" + maxZ.toFixed(3) + " F" + jogRateZ + "\n");
          continuousJogRunning = true;
          waitingForStatus = true;
          $('.zP').click();
        }
      } else {
        toastJogNotIdle();
      }
    } else {
      jog('Z', jogdistXYZ, jogRateZ);
    }
    $('#runNewProbeBtn').addClass("disabled")
    $('#confirmNewProbeBtn').removeClass("disabled")
  });
  $('.zP').on('touchend mouseup', function(ev) {
    ev.preventDefault();
    if (allowContinuousJog) {
      cancelJog()
    }
  });

  $('.aM').on('touchstart mousedown', function(ev) {
    if (ev.which > 1) { // Ignore middle and right click
      return
    }
    ev.preventDefault();

    if (allowContinuousJog) { // startJog();
      if (!waitingForStatus && laststatus.comms.runStatus == "Idle" || laststatus.comms.runStatus == "Door:0") {
        var mcsA = parseFloat(laststatus.machine.position.offset.a) + parseFloat(laststatus.machine.position.work.a);
        var minA = mcsA - 1000;
        var travelA = parseFloat(grblParams.$133);
        const hasSoftLimits = Object.keys(grblParams).length > 0 && parseInt(grblParams.$20) == 1;
        if (hasSoftLimits && travelA > 0) {
          // Soft Limits is enabled so lets calculate maximum move distance
          minA = computeMachineLimits(grblParams, laststatus.machine.firmware.features, 0).minA;
          if (minA >= mcsA) {
            toastJogWillHit("A-");
          }
        }

        if (minA < mcsA) {
          socket.emit('runCommand', "$J=G53 G90 G21 A" + minA.toFixed(3) + " F" + jogRateA + "\n");
          continuousJogRunning = true;
          waitingForStatus = true;
          $('.aM').click();
        }
      } else {
        toastJogNotIdle();
      }
    } else {
      jog('A', '-' + jogdistA, jogRateA);
    }
    $('#runNewProbeBtn').addClass("disabled")
    $('#confirmNewProbeBtn').removeClass("disabled")
  });
  $('.aM').on('touchend mouseup', function(ev) {
    ev.preventDefault();
    if (allowContinuousJog) {
      cancelJog()
    }
  });

  $('.aP').on('touchstart mousedown', function(ev) {
    if (ev.which > 1) { // Ignore middle and right click
      return
    }
    ev.preventDefault();

    if (allowContinuousJog) { // startJog();
      if (!waitingForStatus && laststatus.comms.runStatus == "Idle" || laststatus.comms.runStatus == "Door:0") {
        var mcsA = parseFloat(laststatus.machine.position.offset.a) + parseFloat(laststatus.machine.position.work.a);
        var maxA = mcsA + 1000;
        var travelA = parseFloat(grblParams.$133);
        const hasSoftLimits = Object.keys(grblParams).length > 0 && parseInt(grblParams.$20) == 1;
        if (hasSoftLimits && travelA > 0) {
          // Soft Limits is enabled so lets calculate maximum move distance
          maxA = computeMachineLimits(grblParams, laststatus.machine.firmware.features, 0).maxA;
          if (maxA <= mcsA) {
            toastJogWillHit("A+");
          }
        }
        if (maxA > mcsA) {
          socket.emit('runCommand', "$J=G53 G90 G21 A" + maxA.toFixed(3) + " F" + jogRateA + "\n");
          continuousJogRunning = true;
          waitingForStatus = true;
          $('.aP').click();
        }
      } else {
        toastJogNotIdle();
      }
    } else {
      jog('A', jogdistA, jogRateA);
    }
    $('#runNewProbeBtn').addClass("disabled")
    $('#confirmNewProbeBtn').removeClass("disabled")
  });
  $('.aP').on('touchend mouseup', function(ev) {
    ev.preventDefault();
    if (allowContinuousJog) {
      cancelJog()
    }
  });


  $('#homeBtn').on('click', function(ev) {
    home();
  })

  $('#chkSize').on('click', function() {
    var bbox2 = new THREE.Box3().setFromObject(object);
    console.log('bbox for Draw Bounding Box: ' + object + ' Min X: ', (bbox2.min.x), '  Max X:', (bbox2.max.x), 'Min Y: ', (bbox2.min.y), '  Max Y:', (bbox2.max.y));
    var feedrate = 5000
    if (laststatus.machine.firmware.type === 'grbl') {
      var moves = `
        $J=G90G21X` + (bbox2.min.x).toFixed(3) + ` Y` + (bbox2.min.y).toFixed(3) + ` F` + feedrate + `\n
        $J=G90G21X` + (bbox2.max.x).toFixed(3) + ` Y` + (bbox2.min.y).toFixed(3) + ` F` + feedrate + `\n
        $J=G90G21X` + (bbox2.max.x).toFixed(3) + ` Y` + (bbox2.max.y).toFixed(3) + ` F` + feedrate + `\n
        $J=G90G21X` + (bbox2.min.x).toFixed(3) + ` Y` + (bbox2.max.y).toFixed(3) + ` F` + feedrate + `\n
        $J=G90G21X` + (bbox2.min.x).toFixed(3) + ` Y` + (bbox2.min.y).toFixed(3) + ` F` + feedrate + `\n
        `;
    } else {
      var moves = `
       G90\n
       G0 X` + (bbox2.min.x).toFixed(3) + ` Y` + (bbox2.min.y).toFixed(3) + ` F` + feedrate + `\n
       G0 X` + (bbox2.max.x).toFixed(3) + ` Y` + (bbox2.min.y).toFixed(3) + ` F` + feedrate + `\n
       G0 X` + (bbox2.max.x).toFixed(3) + ` Y` + (bbox2.max.y).toFixed(3) + ` F` + feedrate + `\n
       G0 X` + (bbox2.min.x).toFixed(3) + ` Y` + (bbox2.max.y).toFixed(3) + ` F` + feedrate + `\n
       G0 X` + (bbox2.min.x).toFixed(3) + ` Y` + (bbox2.min.y).toFixed(3) + ` F` + feedrate + `\n
       G90\n`;
    }
    socket.emit('runJob', {
      data: moves,
      isJob: false,
      fileName: ""
    });
  });

});

function changeStepSize(dir) {
  $('.distbtn').blur();
  if (jogdistXYZ == 0.1 || jogdistXYZ == 0.0254) {
    if (dir == 1) {
      if (unit == "mm") {
        jogdistXYZ = 1;
      } else if (unit == "in") {
        jogdistXYZ = .254;
      }
      $('.distbtn').removeClass('bd-openbuilds')
      $('#dist1').addClass('bd-openbuilds')
      $('.jogdistXYZ').removeClass('fg-openbuilds')
      $('.jogdistXYZ').addClass('fg-gray')
      $('#dist1label').removeClass('fg-gray')
      $('#dist1label').addClass('fg-dark')
    }
    if (dir == -1) {
      // do nothing
    }
  } else if (jogdistXYZ == 1 || jogdistXYZ == 0.254) {
    if (dir == 1) {
      if (unit == "mm") {
        jogdistXYZ = 10;
      } else if (unit == "in") {
        jogdistXYZ = 2.54;
      }
      $('.distbtn').removeClass('bd-openbuilds')
      $('#dist10').addClass('bd-openbuilds')
      $('.jogdistXYZ').removeClass('fg-openbuilds')
      $('.jogdistXYZ').addClass('fg-gray')
      $('#dist10label').removeClass('fg-gray')
      $('#dist10label').addClass('fg-openbuilds')
    }
    if (dir == -1) {
      if (unit == "mm") {
        jogdistXYZ = 0.1;
      } else if (unit == "in") {
        jogdistXYZ = 0.0254;
      }
      $('.distbtn').removeClass('bd-openbuilds')
      $('#dist01').addClass('bd-openbuilds')
      $('.jogdistXYZ').removeClass('fg-openbuilds')
      $('.jogdistXYZ').addClass('fg-gray')
      $('#dist01label').removeClass('fg-gray')
      $('#dist01label').addClass('fg-openbuilds')
    }
  } else if (jogdistXYZ == 10 || jogdistXYZ == 2.54) {
    if (dir == 1) {
      if (unit == "mm") {
        jogdistXYZ = 100;
      } else if (unit == "in") {
        jogdistXYZ = 25.4;
      }
      $('.distbtn').removeClass('bd-openbuilds')
      $('#dist100').addClass('bd-openbuilds')
      $('.jogdistXYZ').removeClass('fg-openbuilds')
      $('.jogdistXYZ').addClass('fg-gray')
      $('#dist100label').removeClass('fg-gray')
      $('#dist100label').addClass('fg-openbuilds')
    }
    if (dir == -1) {
      if (unit == "mm") {
        jogdistXYZ = 1;
      } else if (unit == "in") {
        jogdistXYZ = 0.254;
      }
      $('.distbtn').removeClass('bd-openbuilds')
      $('#dist1').addClass('bd-openbuilds')
      $('.jogdistXYZ').removeClass('fg-openbuilds')
      $('.jogdistXYZ').addClass('fg-gray')
      $('#dist1label').removeClass('fg-gray')
      $('#dist1label').addClass('fg-openbuilds')
    }
  } else if (jogdistXYZ == 100 || jogdistXYZ == 25.4) {
    if (dir == 1) {
      // do nothing
    }
    if (dir == -1) {
      if (unit == "mm") {
        jogdistXYZ = 10;
      } else if (unit == "in") {
        jogdistXYZ = 2.54;
      }
      $('.distbtn').removeClass('bd-openbuilds')
      $('#dist10').addClass('bd-openbuilds')
      $('.jogdistXYZ').removeClass('fg-openbuilds')
      $('.jogdistXYZ').addClass('fg-gray')
      $('#dist10label').removeClass('fg-gray')
      $('#dist10label').addClass('fg-openbuilds')
    }
  }

}

function jog(dir, dist, feed = null) {
  if (feed) {
    socket.emit('jog', dir + ',' + dist + ',' + feed);
  } else {
    socket.emit('jog', dir + ',' + dist);
  }
}

function jogXY(xincrement, yincrement, feed = null) {
  var data = {
    x: xincrement,
    y: yincrement,
    feed: feed
  }
  socket.emit('jogXY', data);
}

function home() {
  if (laststatus != undefined && laststatus.machine.firmware.type == 'grbl') {
    sendGcode('$H')
  } else if (laststatus != undefined && laststatus.machine.firmware.type == 'smoothie') {
    sendGcode('G28')
  }
}

function toastJogWillHit(axis) {
  printLog("<span class='fg-red'>[ jog ] </span><span class='fg-red'>Unable to jog toward " + axis + ", will hit soft-limit</span>")
  var toast = Metro.toast.create;
  toast("Unable to jog toward " + axis + ", will hit soft-limit", null, 1000, "bg-darkRed fg-white")
}

function toastJogNotIdle(axis) {
  printLog("<span class='fg-red'>[ jog ] </span><span class='fg-red'>Please wait for machine to be Idle, before jogging</span>")
  var toast = Metro.toast.create;
  toast("Please wait for machine to be Idle, before jogging. Try again once it is Idle", null, 1000, "bg-darkRed fg-white")
}