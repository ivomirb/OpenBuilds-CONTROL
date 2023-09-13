// Analyzes the Gcode before entering the job menu
// Checks if the ZMIN is below MACHINE_MIN_Z
// Checks if a tool change was requested
// Adds a pause after M3
// Restores rapid moves

const MACHINE_MIN_Z = -102; // set to undefined to disable
const SPINDLE_START_DELAY = 3; // 3 seconds (set to 0 to disable)

var ShowPendantDialog;

var g_LastToolName = undefined;

// Finds the first tool comment and parses the tool name and the ZMIN value
function GetToolInfo()
{
	var doc = editor.session.doc;
	var lineCount = doc.getLength();
	var optimzed = false;
	for (var lineIdx = 0; lineIdx < lineCount; lineIdx++)
	{
		var line = doc.getLine(lineIdx);
		if (line.startsWith("(T"))
		{
			var toolName = line.replace(/T\d+ /, "").replace(/ ZMIN.*-/, "");
			var minZ = line.match(/ZMIN=(-?[\d\.]+)/);
			minZ = minZ == null ? undefined : Number(minZ[1]);
			return {toolName: toolName, minZ: minZ};
		}
	}

	return undefined;
}

// Optimizes the Gcode currently in the editor
// Can be used on its own
function OptimizeGCode()
{
	var doc = editor.session.doc;
	var lineCount = doc.getLength();
	var optimize = false;
	for (var lineIdx = 0; lineIdx < lineCount; lineIdx++)
	{
		var line = doc.getLine(lineIdx);
		if (line.startsWith("(When using Fusion 360 for Personal Use"))
		{
			doc.replace({start: {row: lineIdx, column: 1}, end: {row: lineIdx, column: 1}}, "OPTIMIZED: ");
			optimize = true;
			break;
		}
		if (line.startsWith("(OPTIMIZED: When using Fusion 360 for Personal Use"))
		{
			return;
		}
	}

	if (!optimize)
	{
		return;
	}

	var curZ = undefined;
	var curG = undefined;
	var curF = undefined;
	var feedZ = undefined;
	var restoreF = false;
	var optimized = false;

	for (var lineIdx = 0; lineIdx < lineCount; lineIdx++)
	{
		var line = doc.getLine(lineIdx);
		if (line.startsWith("(When using Fusion 360 for Personal Use"))
		{
			feedZ = undefined; // new operation is starting, reacquire feedZ
		}
		if (line.startsWith("("))
		{
			continue; // ignore comments
		}

		if (SPINDLE_START_DELAY > 0 && line.indexOf("M3") != -1)
		{
			doc.insertFullLines(lineIdx + 1, ["G4 P" + SPINDLE_START_DELAY.toFixed(0)]); // pause after the spindle start
			lineIdx++;
			lineCount++;
			continue;
		}

		var lastZ = curZ;

		var g = line.match(/^G(\d+)/);
		g = (g == null) ? undefined : Number(g[1]);
		if (g != undefined) { curG = g; }

		var z = line.match(/Z(-?[\d\.]+)/);
		z = (z == null) ? undefined : Number(z[1]);
		if (z != undefined) { curZ = z; }

		var f = line.match(/F([\d\.]+)/);
		f = (f == null) ? undefined : Number(f[1]);
		if (f != undefined) { curF = f; }

		if (curG == 1 && feedZ == undefined && curZ != undefined && lastZ != undefined && curZ < lastZ)
		{
			// first G1 that moves Z down - use as feedZ
			feedZ = curZ;
		}
		else if (curG == 1 && feedZ != undefined && curZ >= feedZ && curZ >= lastZ)
		{
			// a G1 at or above the feedZ - convert to G0
			var lineLength = line.length;
			if (g != undefined)
			{
				line = line.replace(/^G(\d+)/, "G0"); // replace G1 with G0
			}
			else
			{
				line = "G0 " + line; // prepend G0
			}
			doc.replace({start: {row: lineIdx, column: 0}, end: {row: lineIdx, column: lineLength}}, line);
			restoreF = true;
			optimized = true;
		}
		else if (restoreF)
		{
			doc.insertFullLines(lineIdx, ["G1 F" + curF.toFixed(0)]); // restore feed rate
			lineCount++;
			restoreF = false;
		}
	}

	if (optimized)
	{
		printLog("<span class='fg-darkRed'>[ pendant ] </span><span class='fg-blue'>The Gcode was optimized</span>")
	}
}

// Executes before the pendant enters the job menu
// Optimizes the Gcode, validates the min Z, and warns about a tool change
function OnEnterJobMenu(callback)
{
	OptimizeGCode();
	var toolInfo = GetToolInfo();
	if (toolInfo == undefined)
	{
		callback();
		return;
	}

	if (MACHINE_MIN_Z == undefined || toolInfo.minZ + laststatus.machine.position.offset.z >= MACHINE_MIN_Z)
	{
		OnEnterJobMenuPart2(toolInfo.toolName, callback);
	}
	else
	{
		ShowPendantDialog({
			title: "Low Z Warning",
			text: [
				"Gcode exceeds the",
				"Z axis limit."],
			lButton: ["!IGNORE", function() { OnEnterJobMenuPart2(toolInfo.toolName, callback); } ],
			rButton: ["Back"],
		});
	}
}

function OnEnterJobMenuPart2(toolName, callback)
{
	if (g_LastToolName == undefined || g_LastToolName == toolName)
	{
		g_LastToolName = toolName;
		callback();
	}
	else
	{
		ShowPendantDialog({
			title: "New tool requested",
			text: [
				"Tool change",
				"complete?"],
			lButton: ["!Yes", function() { g_LastToolName = toolName; callback(); } ],
			rButton: ["No"],
		});
	}
}

$(document).ready(function()
{
	ShowPendantDialog = $('#pendant').prop('ShowDialog');
	$('#pendant').prop('OnEnterJobMenu', () => { return OnEnterJobMenu; });
});
