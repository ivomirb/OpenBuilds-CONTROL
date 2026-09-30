var simIdx, timefactor = 1,
  object, simRunning = false, simPaused = false,
  suppressProgress = false, simDragPaused = false;

var loader = new THREE.ObjectLoader();

var simTween = false;

// if simDisplayType is 0, the current line moves with the cone and the XYZ values are at the bottom
// if simDisplayType is 1, the current line and the XYZ values are at the top left corner
var simDisplayType = 1;

function convertParsedDataToObject(parsedData) {
  if (!parsedData.error) {
    try {
      const gArray = parsedData.gArray;
      const srcArray = parsedData.srcArray;
      const offsetArray = parsedData.offsetArray;
      const startArray = parsedData.startArray;
      const durationArray = parsedData.durationArray;
      const xArray = parsedData.xArray;
      const yArray = parsedData.yArray;
      const zArray = parsedData.zArray;

      var geometry = new THREE.BufferGeometry();

      var material = new THREE.LineBasicMaterial({
        vertexColors: THREE.VertexColors,
        transparent: true,
        opacity: 0.8,
      });
      var positions = [];
      var colors = [];

      const themeColors = Theme.lines;

      var gLast = undefined;
      var xLast = undefined;
      var yLast = undefined;
      var zLast = undefined;
      for (var i = 0; i < parsedData.pointCount; i++) {
        const g = gArray[i];
        const x = xArray[i];
        const y = yArray[i];
        const z = zArray[i];

        if (g == 0 || g == 1 || g == 2) {
          var color = themeColors[g];
        } else {
          var color = themeColors[3];
        }

        if (gLast != undefined && gLast != g) {
          // if switching colors, repeat the last point with the new color
          colors.push(color.R, color.G, color.B);
          positions.push(xLast, yLast, zLast);
        }
        positions.push(x, y, z);
        colors.push(color.R, color.G, color.B);
        gLast = g;
        xLast = x;
        yLast = y;
        zLast = z;
      }

      geometry.addAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.addAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      geometry.computeBoundingSphere();

      var line = new THREE.Line(geometry, material);
      line.geometry.computeBoundingBox();
      var box = line.geometry.boundingBox.clone();
      line.userData.pointCount = parsedData.pointCount;
      line.userData.gArray = parsedData.gArray;
      line.userData.srcArray = parsedData.srcArray;
      line.userData.offsetArray = parsedData.offsetArray;
      line.userData.startArray = parsedData.startArray;
      line.userData.durationArray = parsedData.durationArray;
      line.userData.xArray = parsedData.xArray;
      line.userData.yArray = parsedData.yArray;
      line.userData.zArray = parsedData.zArray;
      line.userData.bbbox2 = box;
      line.userData.totalTime = parsedData.totalTime;
      line.userData.toolRanges = parsedData.toolRanges;
      line.name = 'gcodeobject';
      return line;
    } catch (ex) {
      parsedData.error = ex.toString();
    }
  }
  printLog("<span class='fg-red'>[ g-code parser ]</span><span class='fg-darkGreen'> G-code Preview failed</span>");
  printLog("<span class='fg-red'>[ g-code parser ]</span><span class='fg-darkGreen'> " + escapeHTML(parsedData.error) + "</span>");
  return false;
}

function getGcodeLine(pointIndex) {
  const offset = object.userData.offsetArray[pointIndex];
  var end = currentGcode.indexOf('\n', offset);
  if (end > offset && currentGcode[end - 1]) {
    end--;
  }
  return currentGcode.slice(offset, end >= 0 ? end : undefined);
}

function parseGcodeInWebWorker(gcode) {
  currentGcode = gcode;
  simstop();
  if (object) {
    disposeGeometryAndRemove(object);
  }
  object = false;
  if (webgl && !disable3Dgcodepreview) {
    var worker = new Worker('lib/3dview/workers/verylitegcodeviewer.js');
    worker.addEventListener('message', function(e) {
      // console.log('webworker message', e)
      if (e.data.progress != undefined) {
        $('#3dviewlabel').html(' 3D View (rendering, please wait... ' + e.data.progress + '% )')
      } else {
        object = convertParsedDataToObject(e.data);
        if (!viewSettings.toolpath) {
          viewSettings.toolpath = true; // // force-show on load
          $('#viewToolpathSetting:checkbox').prop('checked', true);
          saveViewSettings();
        }

        if (object) {
          worker.terminate();
          scene.add(object);

          if (localStorage.getItem('unitsMode') == "in") {
            redrawGrid(object.userData.bbbox2.min.x / 25.4, object.userData.bbbox2.max.x / 25.4, object.userData.bbbox2.min.y / 25.4, object.userData.bbbox2.max.y / 25.4, true);
          } else {
            redrawGrid(object.userData.bbbox2.min.x, object.userData.bbbox2.max.x, object.userData.bbbox2.min.y, object.userData.bbbox2.max.y, false);
          }

          setTimeout(function() {
            if (webgl) {
              $('#gcodeviewertab').click();
            }
            clearSceneFlag = true;
            resetView(object);
            var timeremain = object.userData.totalTime;

            if (!isNaN(timeremain)) {
              //console.log(timeConvert(timeremain));
              // output formattedTime to UI here
              $('#timeRemaining').html(timeConvert(timeremain) + " / " + timeConvert(timeremain));
              printLog("<span class='fg-red'>[ g-code parser ]</span><span class='fg-darkGreen'> G-code Preview Rendered Succesfully: Estimated G-code Run Time: <b>" + timeConvert(timeremain) + "</b>")
            } else {
              $('#timeRemaining').html("");
            }
          }, 200);
          $('#3dviewicon').removeClass('fa-pulse');
          $('#3dviewlabel').html(' 3D View');
        } else {
          // Didn't get an Object
          if (!disableSerialLog) {
            $('#consoletab').click();
          }
          $('#timeRemaining').html("");
          $('#3dviewicon').removeClass('fa-pulse');
          $('#3dviewlabel').html(' 3D View');

        }
      }

    }, false);

    worker.postMessage({
      'data': gcode
    });

    $('#3dviewicon').addClass('fa-pulse');
    $('#3dviewlabel').html(' 3D View (rendering, please wait...)')

    // populateToolChanges(gcode)
  }
}

function simSpeed(speed) {
  timefactor = speed;
  $('#simspeedval').text(timefactor);

  if (simTween) {
    simTween.timeScale(timefactor);
  }
  simUpdateProgress();
}

function runSimFrom(startindex) {
  $('#gcodeviewertab').click()
  if (startindex > 1) {
    for (var i = 0; i < object.userData.pointCount; i++) {
      if (object.userData.srcArray[i] >= startindex-1) {
        sim(i, true);
        return;
      }
    }
  }
  sim(0, true);
}

function resetConePosition() {
  const idx = Math.max(Math.min(simIdx - 1, object.userData.pointCount - 1), 0);
  var posx = object.userData.xArray[idx];
  var posy = object.userData.yArray[idx];
  var posz = object.userData.zArray[idx];

  cone.position.x = posx;
  cone.position.y = posy;
  cone.position.z = posz;
}

function sim(fromLine, paused) {
  if (typeof(object) == 'undefined' || object.userData.pointCount == 0) {
    var message = `No Gcode in Preview yet: Please load G-code from the Open G-code button first before running simulation`
    Metro.toast.create(message, null, 3000, 'bg-red');
    simstop()
  } else {
    simIdx = fromLine;
    if (simDisplayType == 1) {
      $("#simText").show();
      $("#simText > span").html("");
    } else {
      $("#conetext").css('left', "0px").css('top', "0px");
      $("#conetext").show();
    }
    resetConePosition();
    if (!viewSettings.tool) { // force-show
      viewSettings.tool = true;
      cone.visible = true;
      $('#viewToolSetting:checkbox').prop('checked', true);
      saveViewSettings();
    }
    cone.material.dispose();
    cone.material = new THREE.MeshPhongMaterial({
      color: 0x28a745,
      specular: 0x08701f,
      shininess: 100,
      opacity: 0.6,
      transparent: true
    })

    $('#runSimBtn').hide();
    $('#simControls').show();
    if (paused) {
      $('#pauseSimBtn').hide();
      $('#resumeSimBtn').show();
    } else {
      $('#pauseSimBtn').show();
      $('#resumeSimBtn').hide();
    }

    $('#simBackBtn').attr('disabled', !paused).css('pointer-events', paused ? 'auto' : 'none');
    $('#simForwardBtn').attr('disabled', !paused).css('pointer-events', paused ? 'auto' : 'none');

    clearSceneFlag = true;
    simRunning = true;
    simPaused = paused;
    $('#simspeedval').text(timefactor);
    $('#editorContextMenu').hide() // sometimes we launch sim(linenum) from the context menu... close it once running
    runSim(); //kick it off
  }
}

function runSim() {
  // find next line
  var simTimeInSec = 0;
  var resetCone = false;

  for (;simIdx < object.userData.pointCount; simIdx++) {
    var simTimeMins = object.userData.durationArray[simIdx];
    if (object.userData.gArray[simIdx] == 0 && grblParams.$110 != undefined)
      simTimeMins *= 1000 / parseFloat(grblParams.$110); // adjust rapid speed if it is known
    simTimeInSec += simTimeMins * 60;
    if (simPaused) {
      simTimeInSec = Math.max(simTimeInSec, 0.01); // to prevent the paused tween from completing
      break;
    } else if (simTimeInSec > 0.03 * timefactor) { // if the sim is not paused, make sure we accumulate enough moves for 30ms
      break;
    }
    resetCone = true;
  }

  if (simIdx >= object.userData.pointCount) {
    simpause();
    if (simTween)
      simTween.kill();
    resetConePosition();
    simTween = TweenMax.to({x:0}, 0.1, { // create a dummy paused tween
      ease: Linear.easeNone,
      x: 1,
      onComplete: function() {
        simTween = false;
      }
    });
    simTween.pause();
    simUpdateProgress();
    if (simDisplayType == 0) {
      $("#conetext").html(`<span class="tally success drop-shadow">&lt;END&gt;</span>`);
    }
    return;
  }

  if (simDisplayType == 0) {
    const srcLine = object.userData.srcArray[simIdx];
    $("#conetext").html(`<span class="tally success drop-shadow">Line ` + (srcLine+1) + ": " + getGcodeLine(simIdx) + `</span>`);
  }

  var posx = object.userData.xArray[simIdx];
  var posy = object.userData.yArray[simIdx];
  var posz = object.userData.zArray[simIdx];

  if (simTween)
    simTween.kill();

  if (resetCone) // if we skip lines due to high playback speed, catch up the cone position
    resetConePosition();

  simTween = TweenMax.to(cone.position, simTimeInSec, {
    ease: Linear.easeNone,
    x: posx,
    y: posy,
    z: posz,
    onComplete: function() {
      simTween = false;
      if (simRunning) {
        simIdx++;
        runSim();
      }
    }
  });
  simTween.timeScale(timefactor);
  if (simPaused) {
    simTween.pause();
    simUpdateProgress();
  }
}

function simpause() {
  simPaused = true;
  $('#pauseSimBtn').hide();
  $('#resumeSimBtn').show();
  $('#simBackBtn').attr('disabled', false).css('pointer-events', 'auto');
  $('#simForwardBtn').attr('disabled', false).css('pointer-events', 'auto');
  if (simTween)
    simTween.pause();
}

function simStepBack() {
  var newIdx = undefined;
  var atEnd = simIdx >= object.userData.pointCount;
  var line = atEnd ? object.userData.srcArray[object.userData.pointCount-1] + 1 : object.userData.srcArray[simIdx];
  if (!atEnd && ((simTween && simTween.time() > 0) || (simIdx > 0 && object.userData.srcArray[simIdx-1] == line))) {
    // in the middle if a line, go back to the start
    for (var i = atEnd ? object.userData.pointCount - 1 : simIdx; i >= 0; i--) {
      var li = object.userData.srcArray[i];
      if (li == line)
        newIdx = i;
      else if (li < line)
        break;
    }
  } else {
    // already at the start of a line, find a previous line
    for (var i = simIdx - 1; i >= 0; i--) {
      var li = object.userData.srcArray[i];
      if (newIdx == undefined) {
        if (li < line) {
          line = li;
          newIdx = i;
        }
      }
      else if (li == line)
        newIdx = i;
      else if (li < line)
        break;
    }
  }

  if (newIdx != undefined) {
    simIdx = newIdx;
    if (simTween) {
      simTween.kill();
      simTween = false;
    }
    resetConePosition();
    runSim();
  }
}

function simSetProgress(progress) {
  if (object && simRunning && !suppressProgress) {
    var newIdx = undefined;
    var partial = 0;
    if (progress == 100) {
      newIdx = object.userData.pointCount;
    } else {
      var time = object.userData.totalTime * progress / 100;
      for (var i = 0; i < object.userData.pointCount; i++) {
        if (time == 0) {
          newIdx = i;
          break;
        }
        const startTime = object.userData.startArray[i];
        const timeMins = object.userData.durationArray[i];
        if (time >= startTime && time < startTime + timeMins) {
          // TODO: possible binary search optimization
          newIdx = i;
          partial = (time - startTime) / timeMins;
          break;
        }
      }
    }
    if (newIdx != undefined) {
      simIdx = newIdx;
      if (simTween) {
        simTween.kill();
        simTween = false;
      }
      resetConePosition();
      suppressProgress = true;
      runSim();
      suppressProgress = false;
      if (simTween && partial != undefined)
        simTween.progress(partial);
    }
  }
}

function simUpdateProgress() {
  if (!suppressProgress) {
    var progress = 0;
    if (object) {
      if (simIdx >= object.userData.pointCount || object.userData.totalTime == 0) {
        progress = 100;
      } else {
        progress = object.userData.startArray[simIdx];
        if (simTween)
          progress += object.userData.durationArray[simIdx] * simTween.progress();
        progress *= 100 / object.userData.totalTime;
      }
    }

    suppressProgress = true;
    $('#simProgress').data('slider').val(progress);
    suppressProgress = false;
  }
}

function simDragStart() {
  simDragPaused = !simPaused;
  simpause();
}

function simDragStop() {
  if (simDragPaused) {
    simDragPaused = false;
    simresume();
  }
}

function simStepForward() {
  if (simIdx >= object.userData.pointCount)
    return;

  var newIdx = object.userData.pointCount;
  const line = object.userData.srcArray[simIdx];
  // find the next line
  for (var i = simIdx + 1; i < object.userData.pointCount; i++)
    if (object.userData.srcArray[i] > line) {
      newIdx = i;
      break;
    }

  simIdx = newIdx;
  if (simTween) {
    simTween.kill();
    simTween = false;
  }
  resetConePosition();
  runSim();
}

function simresume() {
  if (simIdx < object.userData.pointCount) {
    simPaused = false;
    $('#pauseSimBtn').show();
    $('#resumeSimBtn').hide();
    $('#simBackBtn').attr('disabled', true).css('pointer-events', 'none');
    $('#simForwardBtn').attr('disabled', true).css('pointer-events', 'none');
    if (simTween)
      simTween.resume();
  }
}

function simstop() {
  if (simTween) {
    simTween.kill();
    simTween = false;
  }
  simIdx = 0;
  simRunning = false;
  simPaused = false;
  $('#runSimBtn').show();
  $('#simControls').hide();

  $('#simspeedval').text(timefactor);
  $("#conetext").hide();
  $("#simText").hide();
  if (simDisplayType == 0)
    $('#gcodesent').html("&nbsp;");
  clearSceneFlag = true;
  if (cone) {
    cone.material.dispose();
    cone.material = new THREE.MeshLambertMaterial({
      color: 0x0000ff
    });
  }
}

function simAnimate() {
  if (simRunning && cone && cone.position) {
    var posx = cone.position.x;
    var posy = cone.position.y;
    var posz = cone.position.z;
    if (unit == "in") {
      posx /= 25.4;
      posy /= 25.4;
      posz /= 25.4;
    }

    if (simDisplayType == 0) {
      var conepos = toScreenPosition(cone, camera)
      var offset = $("#renderArea").offset()
      var farside = $("#renderArea").offset().left + $("#renderArea").outerWidth()
      var bottomside = $("#renderArea").outerHeight()

      if (conepos.y < 25) {
        conepos.y = 25;
      }
      if (conepos.y > bottomside - 40) {
        conepos.y = bottomside - 40;
      }
      if (conepos.x < 0) {
        conepos.x = 0;
      }

      if (conepos.x > farside - $("#conetext").outerWidth()) {
        conepos.x = farside - $("#conetext").outerWidth();
      }

      $("#conetext").css('left', conepos.x + "px").css('top', conepos.y - 20 + "px");
      $('#gcodesent').html("X:" + posx.toFixed(2) + "&nbsp;&nbsp;&nbsp;Y:" + posy.toFixed(2) + "&nbsp;&nbsp;&nbsp;Z:" + posz.toFixed(2));
    } else {
      if (simIdx >= 0 && simIdx < object.userData.pointCount) {
        var srcLine = object.userData.srcArray[simIdx];
        var html = "Line " + (srcLine+1) + ": " + getGcodeLine(simIdx);
      } else {
        var html = "&lt;END&gt;";
      }
      $("#simText > span").html(html + "<br>X:" + posx.toFixed(2) + "&nbsp;&nbsp;&nbsp;Y:" + posy.toFixed(2) + "&nbsp;&nbsp;&nbsp;Z:" + posz.toFixed(2));
    }
    if (!simPaused)
      simUpdateProgress();
  }
}

function toScreenPosition(obj, camera) {
  var vector = new THREE.Vector3(obj.position.x, obj.position.y + 10, obj.position.z + 30);
  var widthHalf = 0.5 * renderer.getContext().canvas.width;
  var heightHalf = 0.5 * renderer.getContext().canvas.height;
  vector.project(camera);
  vector.x = (vector.x * widthHalf) + widthHalf;
  vector.y = -(vector.y * heightHalf) + heightHalf;
  return {
    x: vector.x,
    y: vector.y
  };
}
