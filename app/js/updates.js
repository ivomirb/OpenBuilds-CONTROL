"use strict";

var updateCountdown = 10

function updatesDocReady() {
// Ivo: disable update checks until there is a public version
//  checkUpdate()
}

// eslint-disable-next-line no-unused-vars
function checkUpdate() {

  if (!isMac && webgl) {

    setTimeout(function() {
      printLog("<span class='fg-darkRed'>[ update ] </span><span class='fg-darkGray'>Checking for Updates</span>")
      $.getJSON("https://api.github.com/repos/OpenBuilds/OpenBuilds-CONTROL/releases/latest", {
        crossDomain: true
      }).done(function(release) {
        let availVersion;
        if (release.name.indexOf("v") == 0) {
          availVersion = release.name.substr(1)
        } else {
          availVersion = release.name
        }

        const currentVersion = laststatus.driver.version
        if (versionCompare(availVersion, currentVersion) == 1) {
          updateCountdown = 10
          printLog("<span class='fg-darkRed'>[ Update Available! ] </span><span class='fg-green'>OpenBuilds CONTROL <code>" + availVersion + "</code>. is available now.</span>")
          printLog("<span class='fg-darkRed'>[ Update Available! ] </span><span class='fg-darkGray'>Download will start in <span class='tally' id='countdown'>10</span> seconds (<a href='#' onclick='cancelUpdateTimer();'>cancel</a>) </span>")
          printLog("<span class='fg-darkRed'>[ Update Available! ] </span><span class='fg-darkGray'>You will be prompted when its ready to be installed </span>")
          setTimeout(function() {
            updateTime();
          }, 1000);
        } else {
          printLog("<span class='fg-darkRed'>[ update ] </span><span class='fg-green'>You are already running OpenBuilds CONTROL " + currentVersion + "</span>")
          // setTimeout(function() {
          //   checkUpdate()
          // }, 60 * 60 * 1000) // 60 mins
          // disable regular check - once on startup is enough
        }
      });
    }, 1000)
  }
}


function updateTime() {
  updateCountdown--
  if (updateCountdown > 0) {
    $('#countdown').html(updateCountdown)
    setTimeout(function() {
      updateTime();
    }, 1000);
  } else if (updateCountdown == 0) {
    $('#countdown').html(updateCountdown)
    socket.emit('downloadUpdate', true)
  }
}

function cancelUpdateTimer() {
  updateCountdown = -1
  $('#countdown').html('cancelled')
  printLog("<span class='fg-darkRed'>[ Update Deferred! ] </span><span class='fg-darkGray'>No problem, we will ask you again next time</span>")
}
