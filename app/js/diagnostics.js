var disable3Dviewer = false;
var disable3Dcontrols = false;
var disable3Dskybox = false;
var disable3Drealtimepos = false;
var disable3Dgcodepreview = false;
var disableSerialLog = false;
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
  AddRemoveClass('#disableAggressiveHomeResetTick', "checked", disableAggressiveHomeReset);

  localStorage.setItem('disable4thAxis', disable4thAxis);
  AddRemoveClass('#disable4thAxisTick', "checked", disable4thAxis);
}

function initDiagnostics() {
  disable3Dviewer = localStorage.getItem('disable3Dviewer') && (JSON.parse(localStorage.getItem('disable3Dviewer')) == true);
  AddRemoveClass('#disable3DviewerTick', "checked", disable3Dviewer);
  EnableViaClass("#disable3DcontrolsTick, #disable3DskyboxTick, #disable3DrealtimeposTick, #disable3DgcodepreviewTick", !disable3Dviewer);

  disable3Dcontrols = localStorage.getItem('disable3Dcontrols') && (JSON.parse(localStorage.getItem('disable3Dcontrols')) == true);
  AddRemoveClass('#disable3DcontrolsTick', "checked", disable3Dcontrols);

  disable3Dskybox = localStorage.getItem('disable3Dskybox') && (JSON.parse(localStorage.getItem('disable3Dskybox')) == true);
  AddRemoveClass('#disable3DskyboxTick', "checked", disable3Dskybox);

  disable3Drealtimepos = localStorage.getItem('disable3Drealtimepos') && (JSON.parse(localStorage.getItem('disable3Drealtimepos')) == true);
  AddRemoveClass('#disable3DrealtimeposTick', "checked", disable3Drealtimepos);

  disable3Dgcodepreview = localStorage.getItem('disable3Dgcodepreview') && (JSON.parse(localStorage.getItem('disable3Dgcodepreview')) == true);
  AddRemoveClass('#disable3DgcodepreviewTick', "checked", disable3Dgcodepreview);

  disableSerialLog = localStorage.getItem('disableSerialLog') && (JSON.parse(localStorage.getItem('disableSerialLog')) == true);
  AddRemoveClass('#disableSerialLogTick', "checked", disableSerialLog);

  disableDROupdates = localStorage.getItem('disableDROupdates') && (JSON.parse(localStorage.getItem('disableDROupdates')) == true);
  AddRemoveClass('#disableDROupdatesTick', "checked", disableDROupdates);

  disableAggressiveHomeReset = localStorage.getItem('disableAggressiveHomeReset') && (JSON.parse(localStorage.getItem('disableAggressiveHomeReset')) == true);
  AddRemoveClass('#disableAggressiveHomeResetTick', "checked", disableAggressiveHomeReset);

  $('#disableAutoStartTick').toggle(typeof process !== "undefined" && (process.platform == 'win32' || process.platform == 'linux'));
  if (typeof process !== "undefined" && process.platform == 'linux') {
    $('#disableAutoStartLabel').html("Disable Tray Icon"); // no autostart on linux
  }

  disable4thAxis = localStorage.getItem('disable4thAxis') && (JSON.parse(localStorage.getItem('disable4thAxis')) == true);
  AddRemoveClass('#disable4thAxisTick', "checked", disable4thAxis);

  $('#runSimBtn').parent().toggle(!disable3Drealtimepos && !disable3Dgcodepreview);
};

function toggleAutoStart() {
  if (typeof process !== "undefined" && (process.platform == 'win32' || process.platform == 'linux')) {
    socket.emit('autoStart', !laststatus.misc.autoStart);
  }
}

initDiagnostics();
