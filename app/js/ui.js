var MAX_WCS_HISTORY = 5;
var WCS_HISTORY_TIMEOUT = 3000; // WCS changes within that timeout of the last one are ignored

var wcsHistory = {
  G54: [],
  G55: [],
  G56: [],
  G57: [],
  G58: [],
  G59: [],
};

var wcsHistoryEmpty = true;
var lastWcsCapture = {};

function EnableViaClass(button, enabled) {
  if (typeof button == "string") {
    button = $(button);
  }
  if (enabled) {
    $(button).removeClass('disabled');
  } else {
    $(button).addClass('disabled');
  }
}

// Toolbar with USB port/connect/disconnect
function setConnectBar(val, status) {
  if (val == 0) { // Not Connected Yet
    $('#connectStatus').html("Port: Not Connected");
    $("#disconnectBtn").hide();
    $("#flashBtn").hide();
    $('#portUSB').parent().show();
    $("#connectBtn").show();
    $("#scanBtn").show();
    $("#driverBtn").show();
    $("#connectBtn").attr('disabled', $('#portUSB').val() == "");
    $('#portUSB').parent(".select").addClass('success');
    $('#portUSB').parent(".select").removeClass('alert');
    EnableViaClass('.macrobtn', false);
    EnableViaClass('.grblCalibrationMenu', false);

    if (!wcsHistoryEmpty) {
      clearWcsHistory();
    }

  } else if (val >= 1 && val <= 5) { // Normal operation
    // 1 - connecting
    // 2 - idle
    // 3 - running
    // 4 - paused
    // 5 - alarm

    $('#connectStatus').html("Port: Connected");
    $("#connectBtn").hide();
    $("#scanBtn").hide();
    $("#driverBtn").hide();
    $('#portUSB').parent().hide();
    $("#connectBtn").attr('disabled', false);
    $("#disconnectBtn").show();
    $("#flashBtn").hide();

    // Port Dropdown
    $('#portUSB').parent(".select").removeClass('success')
    $('#portUSB').parent(".select").addClass('alert')
    // Set Port Dropdown to Current Value
    $("#portUSB").val(status.comms.interfaces.activePort);

    EnableViaClass('.macrobtn', val != 3); // disable macros while running
    EnableViaClass('.grblCalibrationMenu', val == 2); // enable calibration only during idle
  } else if (val == 6) { // Firmware Upgrade State
    $('#connectStatus').html("Port: Flashing");
    $("#connectBtn").hide();
    $("#scanBtn").hide();
    $("#driverBtn").hide();
    $('#portUSB').parent().hide();
    $("#connectBtn").attr('disabled', false);
    $("#disconnectBtn").hide();
    $("#flashBtn").show();

    // Port Dropdown
    $('#portUSB').parent(".select").removeClass('success')
    $('#portUSB').parent(".select").addClass('alert')
    // Set Port Dropdown to Current Value
    $("#portUSB").val(status.comms.interfaces.activePort);

    EnableViaClass('.macrobtn', true);
    EnableViaClass('.grblCalibrationMenu', false);
  }
}

// Toolbar with play/pause/stop
function setControlBar(val, status) {
  if (val == 0) { // Not Connected Yet
    $('#runBtn').hide().attr('disabled', true);
    $('#grblProbeMenu').hide().attr('disabled', true);
    $('#chkSize').hide().attr('disabled', true);
    $('#resumeBtn').hide().attr('disabled', true);
    $('#pauseBtn').hide();
    $('#stopBtn').hide().attr('disabled', true);
    $('#toolBtn').hide();
    $('#toolBtn2').hide();

    $('#homeBtn').hide().attr('disabled', grblParams['$22'] == 0);

    $('.estop').hide();
    $('#controlBtnGrp').hide();
    $("#grblSettings").hide(); // Hide Grbl Settings if it was Open
    $('#grblconfig').empty();

  } else if (val >= 1 && val <= 5) { // Normal operation
    // 1 - connecting
    // 2 - idle
    // 3 - running
    // 4 - paused
    // 5 - alarm

    $('#grblProbeMenu').show().attr('disabled', val != 2);

    // The tool button's can't be disabled because the graphics look weird. Disable the menus instead
    EnableViaClass($('#toolBtn').show().next(), val == 2);
    EnableViaClass($('#toolBtn2').show().next(), val == 2);

    $('#chkSize').show().attr('disabled', val != 2 || !object);

    // Determine the correct state for Run/Play/Pause/Stop
    const hasJob = (editor && editor.session.getLength() > 1) || gcode;
    const activeJob = val == 3 || val == 4;
    const doorOpen = status.machine.inputs.includes('D');

    // Hide the Run button if running or paused. Enable if the door is closed and there is a job to run
    $('#runBtn').toggle(val != 3 && val != 4).attr('disabled', doorOpen || !hasJob);

    // Show the Resume button only if paused. Enable if the door is closed
    $('#resumeBtn').toggle(val == 4).attr('disabled', doorOpen);

    // Show the Pause button only if running
    $('#pauseBtn').toggle(val == 3);

    // Enable the Stop button if running or paused
    $('#stopBtn').show().attr('disabled', !activeJob);

    // Disable the Home button during a job or if the homing feature is disabled
    $('#homeBtn').show().attr('disabled', activeJob || grblParams['$22'] == 0);

    $('.estop').show();
    $('#controlBtnGrp').show();
  } else if (val == 6) { // Firmware Upgrade State
    $('#grblProbeMenu').show().attr('disabled', true);

    $('#runBtn').hide().attr('disabled', true);
    $('#chkSize').show().attr('disabled', true);
    $('#resumeBtn').hide().attr('disabled', true);
    $('#pauseBtn').hide();
    $('#stopBtn').hide().attr('disabled', true);
    $('#toolBtn').hide();
    $('#toolBtn2').hide();
    $('#homeBtn').hide().attr('disabled', grblParams['$22'] == 0);
    $('.estop').hide();
    $('#controlBtnGrp').hide();
  }
}

function setJogPanel(val, status) {
  if (val == 0 || val == 6) { // Not Connected Yet or Firmware Upgrade State
    $('.jogbtn').attr('disabled', true);
    $('#xPos').html('0.00');
    $('#yPos').html('0.00');
    $('#zPos').html('0.00');
    $('#aPos').html('0.00');

  } else if (val >= 1 && val <= 5) { // Normal operation
    // 1 - connecting
    // 2 - idle
    // 3 - running
    // 4 - paused
    // 5 - alarm

    $('.jogbtn').attr('disabled', val != 2);
  }
}

function setConsole(val, status) {
  // Allow typing on the console only during idle or alarm
  $("#command").attr('disabled', val != 2 && val != 5);
  $("#sendCommand").prop('disabled', val != 2 && val != 5);
}

function updateWcsHistory(wcs) {
  if (isJogWidget || !laststatus) return;

  $('#wcsHistory').nextAll().remove();

  wcs = wcs || laststatus.machine.modals.coordinatesys;
  const has4thAxis = laststatus.machine.has4thAxis && !disable4thAxis;
  const history = wcsHistory[wcs];

  var elements = ``;
  if (history == undefined || history.length == 0) {
    elements = `<li class="disabled">` + wcs + ` history will show here</li>`;
  } else {
    for (var i = 0; i < history.length; i++) {
      if (unit == "in") {
        var tooltip = "ORIGIN:  X = " + (history[i].x / 25.4).toFixed(3) + "in   Y = " + (history[i].y / 25.4).toFixed(3) + "in   Z = " + (history[i].z / 25.4).toFixed(3) + "in";
      } else {
        var tooltip = "ORIGIN:  X = " + history[i].x.toFixed(2) + "mm   Y = " + history[i].y.toFixed(2) + "mm   Z = " + history[i].z.toFixed(2) + "mm";
      }

      if (laststatus.machine.has4thAxis && !disable4thAxis)
        tooltip += "   A = " + history[i].a.toFixed(3) + '\u00b0';

      if (history[i].tooltip)
        tooltip += "\n" + history[i].tooltip;

      elements += `<li title="` + tooltip +`"><a href="#" onclick="gotoHistory(` + i + 
        `)"><span class="far fa-bookmark fg-darkGray icon"></span> ` + history[i].name + `</a></li>\n`;
    }
  }
  $('#wcsHistory').after(elements);
}

function captureWcsHistory(name, tooltip, isRunJob) {
  if (isJogWidget) {
    socket.emit('captureWcsHistory', {
      position: {
        x: laststatus.machine.position.offset.x,
        y: laststatus.machine.position.offset.y,
        z: laststatus.machine.position.offset.z,
        a: laststatus.machine.position.offset.a,
      },
      wcs: laststatus.machine.modals.coordinatesys,
      name: name,
      tooltip: tooltip,
      isRunJob: isRunJob});
  } else {
    captureWcsHistoryInternal(laststatus.machine.position.offset, laststatus.machine.modals.coordinatesys, name, tooltip, isRunJob);
  }
}

function captureWcsHistoryInternal(position, wcs, name, tooltip, isRunJob) {

  const has4thAxis = laststatus.machine.has4thAxis && !disable4thAxis;
  const history = wcsHistory[wcs];

  if (!isRunJob && lastWcsCapture.wcs == wcs && new Date().getTime() < lastWcsCapture.time + WCS_HISTORY_TIMEOUT)
    return; // ignore updates to the same WCS that are within the timeout, as they are likely related to the same user intent

  if (history.length > 0 && history[0].isRedo) {
    history.splice(index, 1);
  }

  name = name.replace("Modified by", "Before");
  var newItem = {
    x: position.x,
    y: position.y,
    z: position.z,
    a: position.a,
    name: isRunJob ? "Origin of latest <b>Job at " + (new Date()).toLocaleTimeString() + "</b>" : name,
    tooltip: tooltip,
    isRunJob: isRunJob,
    isLastJob: isRunJob == true,
  };

  var index = undefined;
  for (var i = 0; i < history.length; i++) {
    if (Math.abs(history[i].x - newItem.x) < 0.001 && Math.abs(history[i].y - newItem.y) < 0.001
      && Math.abs(history[i].z - newItem.z) < 0.001 && (!has4thAxis || Math.abs(history[i].a - newItem.a) < 0.001)) {
      // found matching offset
      index = i;
      break;
    }
  }

  if (index != undefined) {
    // found an existing item with the same coordinates: update it and bring it to the top
    if (!isRunJob && history[i].isRunJob) {
      newItem = history[i]; // keep the original if it is a job item
    }
    history.splice(index, 1);
  } else {
    if (history.length >= MAX_WCS_HISTORY) {
      // drop the last item, or the one before if the last is isLastJob
      if (history[history.length - 1].isLastJob)
        history.splice(history.length - 2, 1);
      else
        history.splice(history.length - 1, 1);
    }
    if (isRunJob) {
      for (var i = 0; i < history.length; i++) {
        if (history[i].isLastJob) {
          history[i].name = history[i].name.replace(" latest", "");
          history[i].isLastJob = false;
        }
      }
    }
  }
  history.unshift(newItem);
  if (wcs == laststatus.machine.modals.coordinatesys) {
    updateWcsHistory(wcs);
  }
  lastWcsCapture = {wcs: wcs, time: new Date().getTime()};
}

function gotoHistory(index) {
  const wcs = laststatus.machine.modals.coordinatesys;
  const has4thAxis = laststatus.machine.has4thAxis && !disable4thAxis;
  const history = wcsHistory[wcs];

  if (index >= 0 && index < history.length) {
    var gcode = "G10 G90 G21 L2 P0 X" + history[index].x.toFixed(3) + " Y" + history[index].y.toFixed(3) + " Z" +  + history[index].z.toFixed(3);
    if (has4thAxis) {
      gcode += " A" + history[index].a.toFixed(3);
    }

    if (history[index].isRedo)
    {
      history.splice(index, 1);
    } else {
      if (history[0].isRedo)
      {
        history.splice(0, 1);
      }
      var newItem = {
        x: laststatus.machine.position.offset.x,
        y: laststatus.machine.position.offset.y,
        z: laststatus.machine.position.offset.z,
        a: laststatus.machine.position.offset.a,
        name: "&lt;Restore latest&gt;",
        tooltip: "Restore the offset before the history was rolled back",
        isRedo: true,
      };
      history.unshift(newItem);
    }
    updateWcsHistory(wcs);
    lastWcsCapture = {};
    sendGcode(gcode);
  }

  wcsHistoryEmpty = false;
}

function clearWcsHistory() {
  wcsHistory.G54.length = 0;
  wcsHistory.G55.length = 0;
  wcsHistory.G56.length = 0;
  wcsHistory.G57.length = 0;
  wcsHistory.G58.length = 0;
  wcsHistory.G59.length = 0;
  updateWcsHistory();
  wcsHistoryEmpty = true;
}
