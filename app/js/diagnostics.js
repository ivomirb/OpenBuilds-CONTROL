var disable3Dviewer = false;
var disable3Dcontrols = false;
var disable3Dskybox = false;
var disable3Drealtimepos = false;
var disable3Dgcodepreview = false;
var disableSerialLog = false; // todo also hide tab when set to true
var disableDROupdates = false;
var disableAggressiveHomeReset = false;
var disable4thAxis = false;

function saveDiagnostics() {
  localStorage.setItem('disable3Dviewer', disable3Dviewer);
  localStorage.setItem('disable3Dcontrols', disable3Dcontrols);
  localStorage.setItem('disable3Dskybox', disable3Dskybox);
  localStorage.setItem('disable3Drealtimepos', disable3Drealtimepos);
  localStorage.setItem('disable3Dgcodepreview', disable3Dgcodepreview);
  localStorage.setItem('disableSerialLog', disableSerialLog);
  localStorage.setItem('disableDROupdates', disableDROupdates);

  localStorage.setItem('disableAggressiveHomeReset', disableAggressiveHomeReset);
  if (disableAggressiveHomeReset)
    $('#disableAggressiveHomeResetTick').addClass("checked");
  else
    $('#disableAggressiveHomeResetTick').removeClass("checked");

  localStorage.setItem('disable4thAxis', disable4thAxis);
  if (disable4thAxis)
    $('#disable4thAxisTick').addClass("checked");
  else
    $('#disable4thAxisTick').removeClass("checked");
}

function initDiagnostics() {
  if (localStorage.getItem('disable3Dviewer')) {
    if (JSON.parse(localStorage.getItem('disable3Dviewer')) == true) {
      disable3Dviewer = true;
      $('#disable3DviewerTick').addClass("checked");
      $("#disable3DcontrolsTick").addClass("disabled");
      $("#disable3DskyboxTick").addClass("disabled");
      $("#disable3DrealtimeposTick").addClass("disabled");
      $("#disable3DgcodepreviewTick").addClass("disabled");
    }
  } else {
    disable3Dviewer = false;
  }

  if (localStorage.getItem('disable3Dcontrols')) {
    if (JSON.parse(localStorage.getItem('disable3Dcontrols')) == true) {
      disable3Dcontrols = true;
      $('#disable3DcontrolsTick').addClass("checked");
    }
  } else {
    disable3Dcontrols = false;
  }

  if (localStorage.getItem('disable3Dskybox')) {
    if (JSON.parse(localStorage.getItem('disable3Dskybox')) == true) {
      disable3Dskybox = true;
      $('#disable3DskyboxTick').addClass("checked");
    }
  } else {
    disable3Dskybox = false;
  }

  if (localStorage.getItem('disable3Drealtimepos')) {
    if (JSON.parse(localStorage.getItem('disable3Drealtimepos')) == true) {
      disable3Drealtimepos = true;
      $('#disable3DrealtimeposTick').addClass("checked");
    }
  } else {
    disable3Drealtimepos = false;
  }

  if (localStorage.getItem('disable3Dgcodepreview')) {
    if (JSON.parse(localStorage.getItem('disable3Dgcodepreview')) == true) {
      disable3Dgcodepreview = true;
      $('#disable3DgcodepreviewTick').addClass("checked");
    }
  } else {
    disable3Dgcodepreview = false;
  }

  if (localStorage.getItem('disableSerialLog')) {
    if (JSON.parse(localStorage.getItem('disableSerialLog')) == true) {
      disableSerialLog = true;
      $('#disableSerialLogTick').addClass("checked");
      $('#consoletab').hide()
      $('#gcodeeditortab').click()
    }
  } else {
    disableSerialLog = false;
  }

  if (localStorage.getItem('disableDROupdates')) {
    if (JSON.parse(localStorage.getItem('disableDROupdates')) == true) {
      disableDROupdates = true;
      $('#disableDROupdatesTick').addClass("checked");
    }
  } else {
    disableDROupdates = false;
  }



  if (localStorage.getItem('disableAggressiveHomeReset')) {
    if (JSON.parse(localStorage.getItem('disableAggressiveHomeReset')) == true) {
      disableAggressiveHomeReset = true;
      $('#disableAggressiveHomeResetTick').addClass("checked");
    }
  } else {
    disableAggressiveHomeReset = false;
  }

  $('#disableAutoStartTick').toggle(typeof process !== "undefined" && process.platform == 'win32');

  if (localStorage.getItem('disable4thAxis')) {
    if (JSON.parse(localStorage.getItem('disable4thAxis')) == true) {
      disable4thAxis = true;
      $('#disable4thAxisTick').addClass("checked");
    }
  } else {
    disable4thAxis = false;
  }

  if (disable3Drealtimepos || disable3Dgcodepreview)
    $('#runSimBtn').parent().hide();
  else
    $('#runSimBtn').parent().show();
};

function toggleAutoStart() {
  if (typeof process !== "undefined" && process.platform == 'win32') {
    socket.emit('autoStart', !laststatus.interface.autoStart);
  }
}

initDiagnostics();
