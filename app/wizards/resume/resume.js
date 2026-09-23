// Courtesy of https://github.com/rlwoodjr/Basic-SENDER/commit/01f991b7b5171e5e60db59f6cbcba6a286794911#diff-e11dedd96127264342c2b083f0eeaa2e632fd0f9374c13aea861915577f949e8R602
// as per https://github.com/OpenBuilds/OpenBuilds-CONTROL/issues/96#issuecomment-1420150128
// Thanks @rlwoodjr

function recoverCrashedJob() {
  var resumeTemplate = `
  <form>
    Enter the starting line to recover the job from:
    <br>
    <span class="text-small">(Make sure you opened the GCODE first)</span>
    <hr>
    <input id="selectedLineNumber" data-prepend="<i class='fas fa-list-ol'></i> Start from line: " type="number" data-role="input"  data-clear-button="false" value="1" data-editable="true"></input>
  </form>
  <div class="remark success">
  Tip: You can pick the line from the GCODE Editor tab using the right-click context menu too.</span>
  </div>
  <hr>
  <div class="remark warning">
    NOTE: Use this tool at your own risk. Recovering GCODE is a risky operation. You are also responsible for ensuring that work origin is correctly set.  Use at your own risk.
  </div>
  `
  Metro.dialog.create({
    title: "<i class='fas fa-fw fa-route'></i> Recover Job From Line Number",
    content: resumeTemplate,
    //toTop: true,
    //width: '75%',
    clsDialog: 'dark',
    actions: [{
        caption: "Proceed to next step",
        cls: "js-dialog-close alert",
        onclick: function() {
          startFromHere($("#selectedLineNumber").val());
        }
      },
      {
        caption: "Cancel",
        cls: "js-dialog-close",
        onclick: function() {}
      }
    ]
  });
};


function startFromHere(lineNumber) {
  var moveType = undefined; // 0 or 1
  var arcPlane = undefined; // 17, 18 or 19
  var absolute = undefined; // 90 or 91
  var coordSys = undefined; // 54..59
  var coolant = undefined; // 7 or 8

  var lastX = undefined;
  var lastY = undefined;
  var lastZ = undefined;
  var lastA = undefined;
  var lastF = undefined;
  var lastPlungeF = undefined; // feed strictly down on Z
  var lastRampF = undefined; // feed in any down direction involving Z

  var preserveLines = undefined;

  var error = undefined;
  if (gcode)
    error = "The GCODE is too large to be edited.";
  else if (editor.session.getLength() <= 1)
    error = "No GCODE program is currently loaded.";
  else if (lineNumber < 1 || lineNumber > editor.session.getLength())
    error = "The line number " + lineNumber + " is out of range.";

console.log(error);

  for (var i = 0; i < lineNumber-1; i++) {
    if (error) break;
    var currentLine = editor.session.getLine(i);
    if (currentLine.length > 0) {
      currentLine = currentLine.split(/[;(]/); // Remove everything after ; or ( = comment
      line = currentLine[0]
      line = line.toUpperCase();

      const Xindex = line.indexOf("X");
      const Yindex = line.indexOf("Y");
      const Zindex = line.indexOf("Z");
      const Aindex = line.indexOf("A");
      const Findex = line.indexOf("F");

      // find G codes
      var gline = line;
      while (true) {
        var pos = gline.indexOf('G');
        if (pos == -1) break;
        gline = gline.slice(pos + 1);
        var g = parseInt(gline);
        if (g == 0) moveType = 0;
        if (g == 1 || g == 2 || g == 3) moveType = 1;
        if (g == 90 || g == 91) absolute = g;
        if (g == 17 || g == 18 || g == 19) arcPlane = g;
        if (g >= 54 && g <= 59) coordSys = g;
        if ((g == 28 || g == 30) && Zindex != -1) lastZ = 1000; // G28 or G30 may be used to raise Z to a safe, but unknown height
      }

      if (Findex >= 0)
        lastF = parseFloat(line.slice(Findex + 1));

      if (absolute != undefined) { // can't interpret coordinates if we don't know if they are absolute or relative
         const x0 = lastX;
         const y0 = lastY;
         const z0 = lastZ;

        if (Xindex >= 0) {
          const x = parseFloat(line.slice(Xindex + 1));
          if (absolute == 90) lastX = x;
          if (absolute == 91 && lastX != undefined) lastX += x;
        }

        if (Yindex >= 0) {
          const y = parseFloat(line.slice(Yindex + 1));
          if (absolute == 90) lastY = y;
          if (absolute == 91 && lastY != undefined) lastY += y;
        }

        if (Zindex >= 0) {
          const z = parseFloat(line.slice(Zindex + 1));
          if (absolute == 90) lastZ = z;
          if (absolute == 91 && lastZ != undefined) lastZ += z;
          if (moveType == 1 && lastF != undefined && z0 != undefined && lastZ < z0) { // Z is moving down
            if (Xindex == -1 && Yindex == -1 && Aindex == -1) // straight down plunge
              lastPlungeF = lastF;
            else if (x0 != undefined && y0 != undefined) { // move at an angle (ramp) - compute the Z component
              const dist = Math.sqrt((lastX-x0) * (lastX-x0) + (lastY-y0) * (lastY-y0) + (lastZ - z0) * (lastZ - z0));
              lastRampF = lastF * (z0 - lastZ) / dist;
            }
          }
        }

        if (Aindex >= 0) {
          const a = parseFloat(line.slice(Aindex + 1));
          if (absolute == 90) lastA = a;
          if (absolute == 91 && lastA != undefined) lastA += a;
        }
      }

      if (line.contains('M3') || line.contains('M03') || line.contains('M4') || line.contains('M04')) {
        preserveLines = i + 1;
        var nextLine = editor.session.getLine(i + 1).toUpperCase();
        if (nextLine.contains('G4') || nextLine.contains('G04'))
          preserveLines++;
      }

      if (line.contains('M7') || line.contains('M07')) coolant = 7;
      if (line.contains('M8') || line.contains('M08')) coolant = 8;
      if (line.contains('M9') || line.contains('M09')) coolant = undefined;
    }
  }

  if (lastPlungeF == undefined)
    lastPlungeF = lastRampF;

  if (error == undefined) {
    if (lastX == undefined || lastY == undefined)
      error = "Could not determine the starting XY location. There are no previous commands that move X and Y.";
    else if (lastZ == undefined)
      error = "Could not determine the starting Z location. There are no previous commands that move Z.";
    else if (lastPlungeF == undefined)
      error = "Could not determine the safe Z plunge rate. There are no previous commands that plunge Z downard.";
    else if (preserveLines == undefined)
      error = "Could not find a command to start the spindle.";
  }

  if (error != undefined) {
    Metro.dialog.create({
      title: "<i class='fas fa-exclamation-triangle'></i> GCODE parsing error",
      content: error,
      width: '400',
      clsDialog: 'dark',
      actions: [{
          caption: "OK",
          cls: "js-dialog-close alert",
          onclick: function() {}
        }
      ]
    });
    return;
  }

  var resumeXYA = "G0" + (coordSys ? (" G" + coordSys) : "") + (coolant ? (" M" + coolant) : "") + " G90 X" + lastX.toFixed(3) + " Y" + lastY.toFixed(3);
  if (lastA)
    resumeXYA += " A" + lastA.toFixed(3);

  if (lastPlungeF != undefined)
    var resumeZ = "G1 G90 Z" + lastZ.toFixed(3) + " F" + lastPlungeF.toFixed(0);
  else
    var resumeZ = "G0 G90 Z" + lastZ.toFixed(3);

  var context = "";
  if (moveType != undefined) context += "G" + moveType + " ";
  if (arcPlane != undefined) context += "G" + arcPlane + " ";
  if (absolute != undefined) context += "G" + absolute + " ";
  if (lastF != undefined) context += "F" + lastF.toFixed(0);

  var resumeFileTemplate = `
    <form>
      <div>
        The Recovery strategy will modify the currently loaded GCODE accordingly:
        <hr>
          <ul>
            <li>Keep the first <span class="tally dark" id="preserveLines"></span> lines of the file as header. It assumes that the header</li>
            <ul>
              <li>Establishes the units mm or inch for the entire program</li>
              <li>Raises Z to a safe height</li>
              <li>Turns on the spindle</li>
            </ul>
            <li>Move to entry position with GCODE: <span class="tally dark" id="resumeXYA"></span></li>
            <li>Plunge to cutting height with GCODE: <span class="tally dark" id="resumeZ"></span></li>
            <li>Restore the parser context with: <span class="tally dark" id="context"></span></li>
            <li>Run GCODE starting at line <span class="tally dark" id="resumeLastLine"></span> and continue with the job</li>
          </ul>
        Review the recovery strategy and click 'Proceed' to update the loaded gcode to reflect the changes, and update the 3D view.
      </div>
    </form>
    <div class="remark warning">
      NOTE: Use this tool at your own risk. Recovering GCODE is a risky operation. You are also responsible for ensuring that work origin is correctly set</span>.  Use at your own risk.
    </div>
    `

  Metro.dialog.create({
    title: "<i class='fas fa-fw fa-route'></i> Recover Job From Line Number",
    content: resumeFileTemplate,
    toTop: true,
    width: '75%',
    clsDialog: 'dark',
    actions: [{
        caption: "Proceed to next step",
        cls: "js-dialog-close alert",
        onclick: function() {
          redoJob();
        }
      },
      {
        caption: "Cancel",
        cls: "js-dialog-close",
        onclick: function() {}
      }
    ]
  });

  $('#preserveLines').html(preserveLines);
  $('#resumeXYA').html(resumeXYA);
  $('#resumeZ').html(resumeZ);
  $('#context').html(context);
  $('#resumeLastLine').html(lineNumber);
}

function redoJob() {
  var line = "";
  var gcode = "; Recovered GCODE. Use at your OWN RISK\n;===== Original header\n";

  var preserveLines = $('#preserveLines').html();
  var XYAGcode = $('#resumeXYA').html();
  var ZGcode = $('#resumeZ').html();
  var ContextGcode = $('#context').html();
  var resumeLineNumber = $('#resumeLastLine').html();
  var resumeLastNumber = editor.session.getLength();

  for (var i = 0; i < preserveLines; i++) {
    line = editor.session.getLine(i);
    gcode += line + '\n';
  }

  gcode += "\n;===== Rapid move to XY location\n";
  gcode += XYAGcode + '\n';

  gcode += "\n;===== Plunge to starting Z\n";
  gcode += ZGcode + '\n';

  gcode += "\n;===== Restore context\n";
  gcode += ContextGcode + '\n';

  gcode += "\n;===== The rest of the original program\n";
  for (var i = resumeLineNumber - 1; i < resumeLastNumber; i++) {
    line = editor.session.getLine(i);
    gcode += line + '\n'
  }

  editor.session.setValue("");
  editor.session.setValue(gcode);
  $('#controlTab').click();
  parseGcodeInWebWorker(gcode);
}
