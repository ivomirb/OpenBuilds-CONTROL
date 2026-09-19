var simIdx, timefactor = 1,
  object, simRunning = false, simPaused = false;

var loader = new THREE.ObjectLoader();

var simTween = false;

// if simDisplayType is 0, the current line moves with the cone and the XYZ values are at the bottom
// if simDisplayType is 1, the current line and the XYZ values are at the top left corner
var simDisplayType = 1;

function convertParsedDataToObject(jsonData) {
  var parsedData;
  try {
    parsedData = JSON.parse(jsonData)
  } catch (e) {
    console.log(e, jsonData); // error in the above string (in this case, yes)!
    return;
  }

  var geometry = new THREE.BufferGeometry();

  var material = new THREE.LineBasicMaterial({
    vertexColors: THREE.VertexColors,
    transparent: true,
    opacity: 0.8,
  });
  var positions = [];
  var colors = [];

  const themeColors = Theme.lines;

  var lastPoint = undefined; // {x:0, y:0, z:0, g:-5}; (possibly use a fake point to draw a line from 0,0,0)
  for (var i = 0; i < parsedData.linePoints.length; i++) {
    var point = parsedData.linePoints[i];
    if (point.fake) continue;

    if (point.g == 0 || point.g == 1 || point.g == 2) {
      var color = themeColors[point.g];
    } else {
      var color = themeColors[3];
    }

    if (lastPoint != undefined && lastPoint.g != point.g) {
      // if switching colors, repeat the last point with the new color
      colors.push(color.R, color.G, color.B);
      positions.push(lastPoint.x, lastPoint.y, lastPoint.z);
    }
    positions.push(point.x, point.y, point.z);
    colors.push(color.R, color.G, color.B);
    lastPoint = point;
  }

  geometry.addAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.addAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  geometry.computeBoundingSphere();

  var line = new THREE.Line(geometry, material);
  line.geometry.computeBoundingBox();
  var box = line.geometry.boundingBox.clone();
  line.userData.linePoints = parsedData.linePoints;
  line.userData.bbbox2 = box;
  line.userData.inch = parsedData.inch;
  line.userData.totalTime = parsedData.totalTime;
  line.name = 'gcodeobject'
  return line;
}


function parseGcodeInWebWorker(gcode) {
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
        var gcObject = scene.getObjectByName('gcodeobject');
        if (gcObject) {
          disposeGeometryAndRemove(gcObject);
        }
        object = convertParsedDataToObject(e.data);
        if (!viewSettings.toolpath) {
          viewSettings.toolpath = true; // // force-show on load
          $('#viewToolpathSetting:checkbox').prop('checked', true);
          saveViewSettings();
        }
        //console.log(object)
        if (object && object.userData.linePoints.length > 1) {
          worker.terminate();
          scene.add(object);
          if (object.userData.inch) {
            // console.log(scaling)
            object.scale.x = 25.4
            object.scale.y = 25.4
            object.scale.z = 25.4
          }

          if (localStorage.getItem('unitsMode')) {
            if (localStorage.getItem('unitsMode') == "in") {
              if (object.userData.inch) {
                redrawGrid(object.userData.bbbox2.min.x, object.userData.bbbox2.max.x, object.userData.bbbox2.min.y, object.userData.bbbox2.max.y, true);
              } else {
                redrawGrid(object.userData.bbbox2.min.x / 25.4, object.userData.bbbox2.max.x / 25.4, object.userData.bbbox2.min.y / 25.4, object.userData.bbbox2.max.y / 25.4, true);
              }
            } else {
              if (object.userData.inch) {
                redrawGrid(object.userData.bbbox2.min.x * 25.4, object.userData.bbbox2.max.x * 25.4, object.userData.bbbox2.min.y * 25.4, object.userData.bbbox2.max.y * 25.4, false);
              } else {
                redrawGrid(object.userData.bbbox2.min.x, object.userData.bbbox2.max.x, object.userData.bbbox2.min.y, object.userData.bbbox2.max.y, false);
              }
            }
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
              printLog("<span class='fg-red'>[ GCODE Parser ]</span><span class='fg-darkGreen'> GCODE Preview Rendered Succesfully: Total lines: <b>" + object.userData.linePoints.length + "</b> / Estimated GCODE Run Time: <b>" + timeConvert(timeremain) + "</b>")
            }
          }, 200);
          $('#3dviewicon').removeClass('fa-pulse');
          $('#3dviewlabel').html(' 3D View')
        } else {
          // Didn't get an Object
          $('#3dviewicon').removeClass('fa-pulse');
          $('#3dviewlabel').html(' 3D View')
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
}

function runSimFrom(startindex) {
  $('#gcodeviewertab').click()
  if (startindex > 1) {
    for (var i = 0; i < object.userData.linePoints.length; i++) {
      if (object.userData.linePoints[i].src >= startindex-1) {
        sim(i, true);
        return;
      }
    }
  }
  sim(0, true);
}

function resetConePosition() {
  const idx = Math.max(Math.min(simIdx - 1, object.userData.linePoints.length - 1), 0);
  var posx = object.userData.linePoints[idx].x;
  var posy = object.userData.linePoints[idx].y;
  var posz = object.userData.linePoints[idx].z;

  if (object.userData.inch) {
    posx *= 25.4;
    posy *= 25.4;
    posz *= 25.4;
  }

  cone.position.x = posx;
  cone.position.y = posy;
  cone.position.z = posz;
}

function sim(fromLine, paused) {
  if (typeof(object) == 'undefined' || !scene.getObjectByName('gcodeobject')) {
    var message = `No Gcode in Preview yet: Please load GCODE from the Open GCODE button first before running simulation`
    Metro.toast.create(message, null, 3000, 'bg-red');
    simstop()
  } else {
    simIdx = fromLine;
    $("#conetext").css('left', "0px").css('top', "0px");
    $("#conetext").show();
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
  // find next non-fake line
  var simTimeInSec = 0;
  var resetCone = false;

  for (;simIdx < object.userData.linePoints.length; simIdx++) {
    var point = object.userData.linePoints[simIdx];
    if (!point.fake) {
      var simTimeMins = point.timeMins;
      if (point.g == 0 && grblParams.$110 != undefined)
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
  }

  if (simIdx >= object.userData.linePoints.length) {
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
    $("#conetext").html(`<span class="tally success drop-shadow">&lt;END&gt;</span>`);
    return;
  }

  if (simDisplayType == 0) {
    var srcLine = object.userData.linePoints[simIdx].src;
    $("#conetext").html(`<span class="tally success drop-shadow">Line ` + (srcLine+1) + ": " + editor.session.getLine(srcLine) + `</span>`);
  }

  var posx = object.userData.linePoints[simIdx].x;
  var posy = object.userData.linePoints[simIdx].y;
  var posz = object.userData.linePoints[simIdx].z;
  if (object.userData.inch) {
    posx *= 25.4;
    posy *= 25.4;
    posz *= 25.4;
  }

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
  if (simPaused)
    simTween.pause();
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
  var atEnd = simIdx >= object.userData.linePoints.length;
  var line = atEnd ? object.userData.linePoints.at(-1).src : object.userData.linePoints[simIdx].src;
  if (atEnd || (simTween && simTween.time() > 0) || (simIdx > 0 && object.userData.linePoints[simIdx-1].src == line)) {
    // in the middle if a line, go back to the start
    for (var i = atEnd ? object.userData.linePoints.length - 1 : simIdx; i >= 0; i--) {
      var li = object.userData.linePoints[i].src;
      if (li == line)
        newIdx = i;
      else if (li < line)
        break;
    }
  }
  else {
    // already at the start of a line, find a previous non-fake line
    for (var i = simIdx - 1; i >= 0; i--) {
      if (!object.userData.linePoints[i].fake) {
        var li = object.userData.linePoints[i].src;
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

function simStepForward() {
  if (simIdx >= object.userData.linePoints.length)
    return;

  var newIdx = object.userData.linePoints.length;
  const line = object.userData.linePoints[simIdx].src;
  // find the next non-fake line
  for (var i = simIdx + 1; i < object.userData.linePoints.length; i++)
    if (!object.userData.linePoints[i].fake && object.userData.linePoints[i].src > line) {
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
  if (simIdx < object.userData.linePoints.length) {
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
  editor.gotoLine(0)
  $("#conetext").hide();
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
      if (simIdx >= 0 && simIdx < object.userData.linePoints.length) {
        var srcLine = object.userData.linePoints[simIdx].src;
        $("#conetext").html(`<span class="tally success drop-shadow" style="text-align:left; margin-left:5px; margin-top:6px; padding:3px 6px; height:auto;">Line ` +
          (srcLine+1) + `: ` + editor.session.getLine(srcLine) +
          `<br>X:` + posx.toFixed(2) + `&nbsp;&nbsp;&nbsp;Y:` + posy.toFixed(2) + `&nbsp;&nbsp;&nbsp;Z:` + posz.toFixed(2) + `</span>`);
      } else {
        $("#conetext").html(`<span class="tally success drop-shadow" style="text-align:left; margin-left:5px; margin-top:6px; padding:3px 6px; height:auto;">&lt;END&gt;` +
          `<br>X:` + posx.toFixed(2) + `&nbsp;&nbsp;&nbsp;Y:` + posy.toFixed(2) + `&nbsp;&nbsp;&nbsp;Z:` + posz.toFixed(2) + `</span>`);
      }
    }
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
