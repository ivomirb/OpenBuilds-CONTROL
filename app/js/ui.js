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

// Toolbar with USB port/connect/disconnect
function setConnectBar(val, status) {
  if (val == 0) { // Not Connected Yet
    // Status Badge
    $('#connectStatus').html("Port: Not Connected");
    // Connect/Disconnect Button
    $("#disconnectBtn").hide();
    $("#flashBtn").hide();
    $('#portUSB').parent().show();
    $("#connectBtn").show();
    $("#scanBtn").show();
    $("#driverBtn").show();
    if ($('#portUSB').val() != "") {
      $("#connectBtn").attr('disabled', false);
    } else {
      $("#connectBtn").attr('disabled', true);
    }
    $('#portUSB').parent(".select").addClass('success')
    $('#portUSB').parent(".select").removeClass('alert')
    $('.macrobtn').removeClass('disabled')
    $('.grblCalibrationMenu').addClass("disabled")
    // Set Port Dropdown to Current Value
    // Not applicable to Status 0 as its set by populatePortsMenu();
    if (!wcsHistoryEmpty) {
      clearWcsHistory();
    }

  } else if (val == 1 || val == 2) { // Connected, but not Playing yet
    // Status Badge
    $('#connectStatus').html("Port: Connected");
    // Connect/Disconnect Button
    $("#connectBtn").hide();
    $("#scanBtn").hide();
    $("#driverBtn").hide();
    $('#portUSB').parent().hide();
    $("#connectBtn").attr('disabled', false);
    $("#disconnectBtn").show();
    $("#flashBtn").hide();

    // Port Dropdown
    //$('#portUSB').parent(".select").addClass('disabled')
    $('#portUSB').parent(".select").removeClass('success')
    $('#portUSB').parent(".select").addClass('alert')
    // Set Port Dropdown to Current Value
    $("#portUSB").val(status.comms.interfaces.activePort);
    $('.macrobtn').removeClass('disabled')
    $('.grblCalibrationMenu').removeClass("disabled")

  } else if (val == 3) { // Busy Streaming GCODE
    // Status Badge
    $('#connectStatus').html("Port: Connected");
    // Connect/Disconnect Button
    $("#connectBtn").hide();
    $("#scanBtn").hide();
    $("#driverBtn").hide();
    $('#portUSB').parent().hide();
    $("#connectBtn").attr('disabled', false);
    $("#disconnectBtn").show();
    $("#flashBtn").hide();
    // Port Dropdown
    //$('#portUSB').parent(".select").addClass('disabled')
    $('#portUSB').parent(".select").removeClass('success')
    $('#portUSB').parent(".select").addClass('alert')
    // Set Port Dropdown to Current Value
    $("#portUSB").val(status.comms.interfaces.activePort);
    $('.macrobtn').addClass('disabled')
    $('.grblCalibrationMenu').addClass("disabled")

  } else if (val == 4) { // Paused
    // Status Badge
    $('#connectStatus').html("Port: Connected");
    // Connect/Disconnect Button
    $("#connectBtn").hide();
    $("#scanBtn").hide();
    $("#driverBtn").hide();
    $('#portUSB').parent().hide();
    $("#connectBtn").attr('disabled', false);
    $("#disconnectBtn").show();
    $("#flashBtn").hide();
    // Port Dropdown
    //$('#portUSB').parent(".select").addClass('disabled')
    $('#portUSB').parent(".select").removeClass('success')
    $('#portUSB').parent(".select").addClass('alert')
    // Set Port Dropdown to Current Value
    $("#portUSB").val(status.comms.interfaces.activePort);
    $('.macrobtn').removeClass('disabled')
    $('.grblCalibrationMenu').addClass("disabled")

  } else if (val == 5) { // Alarm State
    // Status Badge
    $('#connectStatus').html("Port: Connected");
    // Connect/Disconnect Button
    $("#connectBtn").hide();
    $("#scanBtn").hide();
    $("#driverBtn").hide();
    $('#portUSB').parent().hide();
    $("#connectBtn").attr('disabled', false);
    $("#disconnectBtn").show();
    $("#flashBtn").hide();
    // Port Dropdown
    //$('#portUSB').parent(".select").addClass('disabled')
    $('#portUSB').parent(".select").removeClass('success')
    $('#portUSB').parent(".select").addClass('alert')
    // Set Port Dropdown to Current Value
    $("#portUSB").val(status.comms.interfaces.activePort);
    $('.macrobtn').removeClass('disabled')
    $('.grblCalibrationMenu').addClass("disabled")
  } else if (val == 6) { // Firmware Upgrade State
    // Status Badge
    $('#connectStatus').html("Port: Flashing");
    // Connect/Disconnect Button
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
    $('.macrobtn').removeClass('disabled')
    $('.grblCalibrationMenu').addClass("disabled")
  }
}

// Toolbar with play/pause/stop
function setControlBar(val, status) {
  if (val == 0) { // Not Connected Yet
    if (toolchanges && toolchanges.length) {
      $('#runToolsBtn').hide().attr('disabled', true);
      $('#runBtn').hide().attr('disabled', true);
    } else {
      $('#runToolsBtn').hide().attr('disabled', true);
      $('#runBtn').hide().attr('disabled', true);
    }
    $('#grblProbeMenu').hide().attr('disabled', true);
    $('#chkSize').hide().attr('disabled', true);
    $('#resumeBtn').hide().attr('disabled', true);
    $('#pauseBtn').hide().attr('disabled', true);
    $('#stopBtn').hide().attr('disabled', true);
    $('#toolBtn').hide().attr('disabled', true);
    $('#toolBtn2').hide().attr('disabled', true);

    $('#homeBtn').hide().attr('disabled', grblParams['$22'] == 0);

    $('.estop').hide()
    $('#controlBtnGrp').hide();
    $("#grblSettings").hide(); // Hide Grbl Settings if it was Open
    $('#grblconfig').empty();
  } else if (val == 1 || val == 2) { // Connected, but not Playing yet
    $('#grblProbeMenu').show().attr('disabled', false);
    if (typeof ace !== 'undefined') {
      if (toolchanges.length) {
        if (status.machine.inputs.includes('D')) {
          $('#runToolsBtn').show().attr('disabled', true);
          $('#runBtn').hide().attr('disabled', true);
        } else {
          $('#runToolsBtn').show().attr('disabled', editor.session.getLength() < 2);
          $('#runBtn').hide().attr('disabled', editor.session.getLength() < 2);
        }
        if (webgl) {
          $('#chkSize').show().attr('disabled', editor.session.getLength() < 2);
        } else {
          $('#chkSize').show().attr('disabled', true);
        }

      } else {
        $('#runToolsBtn').hide().attr('disabled', editor.session.getLength() < 2);
        if (status.machine.inputs.includes('D')) {
          $('#runBtn').show().attr('disabled', true);
        } else {
          $('#runBtn').show().attr('disabled', editor.session.getLength() < 2);
        }

        if (webgl) {
          $('#chkSize').show().attr('disabled', editor.session.getLength() < 2);
        } else {
          $('#chkSize').show().attr('disabled', true);
        }
      }
    } else {
      if (status.machine.inputs.includes('D')) {
        $('#runBtn').show().attr('disabled', true);
      } else {
        $('#runBtn').show().attr('disabled', false);
      }
      $('#runToolsBtn').hide().attr('disabled', false);
    }
    $('#resumeBtn').hide().attr('disabled', true);
    $('#pauseBtn').hide().attr('disabled', true);
    $('#stopBtn').show().attr('disabled', true);
    $('#toolBtn').show().attr('disabled', false);
    $('#toolBtn2').show().attr('disabled', false);
    $('#homeBtn').show().attr('disabled', grblParams['$22'] == 0);
    $('.estop').show()
    $('#controlBtnGrp').show();
  } else if (val == 3) { // Busy Streaming GCODE
    $('#grblProbeMenu').show().attr('disabled', true);

    if (toolchanges.length) {
      $('#runToolsBtn').hide().attr('disabled', true);
      $('#runBtn').hide().attr('disabled', true);
    } else {
      $('#runToolsBtn').hide().attr('disabled', true);
      $('#runBtn').hide().attr('disabled', true);
    }
    $('#chkSize').show().attr('disabled', true);
    $('#resumeBtn').hide().attr('disabled', true);
    $('#pauseBtn').show().attr('disabled', false);
    $('#stopBtn').show().attr('disabled', false);
    $('#toolBtn').show().attr('disabled', false);
    $('#toolBtn2').show().attr('disabled', false);
    $('#homeBtn').show().attr('disabled', true);
    $('.estop').show()
    $('#controlBtnGrp').show();
  } else if (val == 4) { // Paused
    $('#grblProbeMenu').show().attr('disabled', true);

    if (toolchanges.length) {
      $('#runToolsBtn').hide().attr('disabled', true);
      $('#runBtn').hide().attr('disabled', true);
    } else {
      $('#runToolsBtn').hide().attr('disabled', true);
      $('#runBtn').hide().attr('disabled', true);
    }
    $('#chkSize').show().attr('disabled', true);
    if (status.machine.inputs.includes('D')) {
      $('#resumeBtn').hide().attr('disabled', true);
      $('#pauseBtn').show().attr('disabled', true);
    } else {
      $('#resumeBtn').show().attr('disabled', false);
      $('#pauseBtn').hide().attr('disabled', true);
    }

    $('#stopBtn').show().attr('disabled', false);
    $('#toolBtn').show().attr('disabled', false);
    $('#toolBtn2').show().attr('disabled', false);
    $('#homeBtn').show().attr('disabled', true);
    $('.estop').show()
    $('#controlBtnGrp').show();
  } else if (val == 5) { // Alarm State
    $('#grblProbeMenu').show().attr('disabled', true);

    if (toolchanges.length) {
      $('#runToolsBtn').show().attr('disabled', true);
      $('#runBtn').hide().attr('disabled', true);
    } else {
      $('#runToolsBtn').hide().attr('disabled', true);
      $('#runBtn').show().attr('disabled', true);
    }
    // $('#runBtn').show().attr('disabled', true);
    $('#chkSize').show().attr('disabled', true);
    $('#resumeBtn').hide().attr('disabled', true);
    $('#pauseBtn').hide().attr('disabled', true);
    $('#stopBtn').show().attr('disabled', true);
    $('#toolBtn').show().attr('disabled', true);
    $('#toolBtn2').show().attr('disabled', true);
    $('#homeBtn').show().attr('disabled', grblParams['$22'] == 0);
    $('.estop').show()
    $('#controlBtnGrp').show();
  } else if (val == 6) { // Firmware Upgrade State
    $('#grblProbeMenu').show().attr('disabled', true);

    if (toolchanges.length) {
      $('#runToolsBtn').hide().attr('disabled', true);
      $('#runBtn').hide().attr('disabled', true);
    } else {
      $('#runToolsBtn').hide().attr('disabled', true);
      $('#runBtn').hide().attr('disabled', true);
    }
    $('#chkSize').show().attr('disabled', true);
    $('#resumeBtn').hide().attr('disabled', true);
    $('#pauseBtn').hide().attr('disabled', true);
    $('#stopBtn').hide().attr('disabled', true);
    $('#toolBtn').hide().attr('disabled', true);
    $('#toolBtn2').hide().attr('disabled', true);
    $('#homeBtn').hide().attr('disabled', grblParams['$22'] == 0);
    $('.estop').hide()
    $('#controlBtnGrp').hide();
  }
}

function setJogPanel(val, status) {
  if (val == 0) { // Not Connected Yet
    if (editor) {
      editor.resize()
    }
    $('.jogbtn').attr('disabled', true);
    $('#xPos').html('0.00');
    $('#yPos').html('0.00');
    $('#zPos').html('0.00');
    $('#aPos').html('0.00');

  } else if (val == 1 || val == 2) { // Connected, but not Playing yet
    if (editor) {
      editor.resize()
    }
    $('.jogbtn').attr('disabled', false);

  } else if (val == 3) { // Busy Streaming GCODE
    if (editor) {
      editor.resize()
    }
    $('.jogbtn').attr('disabled', true);

  } else if (val == 4) { // Paused
    if (editor) {
      editor.resize()
    }
    $('.jogbtn').attr('disabled', true);

  } else if (val == 5) { // Alarm State
    if (editor) {
      editor.resize()
    }
    $('.jogbtn').attr('disabled', true);

  } else if (val == 6) { // Firmware Upgrade State
    if (editor) {
      editor.resize()
    }
    $('.jogbtn').attr('disabled', true);
    $('#xPos').html('0.00');
    $('#yPos').html('0.00');
    $('#zPos').html('0.00');
    $('#aPos').html('0.00');

  }
}

function setConsole(val, status) {
  if (val == 0) { // Not Connected Yet
    if (!$('#command').attr('disabled')) {
      $('#command').attr('disabled', true);
    }
    $("#sendCommand").prop('disabled', true);
  } else if (val == 0 || val == 2) { // Connected, but not Playing yet
    $("#command").attr('disabled', false);
    $("#sendCommand").prop('disabled', false);
  } else if (val == 3) { // Busy Streaming GCODE
    if (!$('#command').attr('disabled')) {
      $('#command').attr('disabled', true);
    }
    $("#sendCommand").prop('disabled', true);
  } else if (val == 4) { // Paused
    if (!$('#command').attr('disabled')) {
      $('#command').attr('disabled', true);
    }
    $("#sendCommand").prop('disabled', false);
  } else if (val == 5) { // Alarm State
    $("#command").attr('disabled', false);
    $("#sendCommand").prop('disabled', false);
  } else if (val == 6) { // Firmware Upgrade State
    if (!$('#command').attr('disabled')) {
      $('#command').attr('disabled', true);
    }
    $("#sendCommand").prop('disabled', true);
  }
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
