// jogWindowAPI.js provides access to the jog window to modules below main.js

"use strict";

var jogWindowAPI = {};

function jogWindowProgress(progress) {
  const jogWindow = jogWindowAPI.getJogWindow();
  if (jogWindow) {
    jogWindow.setProgressBar(progress);
  }
}

function initJogWindowAPI(getJogWindow, showJogWindow) {
  jogWindowAPI.getJogWindow = getJogWindow;
  jogWindowAPI.showJogWindow = showJogWindow;
}

module.exports = {
  jogWindowAPI,
  jogWindowProgress,
  initJogWindowAPI
};
