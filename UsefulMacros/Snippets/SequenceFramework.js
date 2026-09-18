// Program sequence framework /////////////
//
// This framework helps with creating multi-step G-code execution sequences, where some code logic needs to run after each step.
//
// To use it, call RunProgramSequence with two functions.
//
// The first function is called for each step. It has a parameter "currentStep", which starts from 0 and auto-increments with each call.
// The function needs to return the G-code for the current step. If there are no more steps, return empty string or nothing.
//
// The second parameter is optional. It is a function that is called at the very end to clean up.

var g_StartCheckJobTimeout;
var g_CheckJobTimer;
var g_OnStep;
var g_OnClose;
var g_CurrentStep;

function ExecuteNextStep()
{
	g_CurrentStep++;
	var gcode = g_OnStep(g_CurrentStep);
	if (gcode != undefined && gcode != "")
	{
		console.log("ExecuteNextStep", gcode);
		socket.emit('runJob', {data: gcode, isJob: false, completedMsg: "ProgramSequence", fileName: ""});
	}
	else
	{
		CloseProgramSequence();
	}
}

function CheckJobCompleted()
{
	console.log("CheckJobCompleted", g_CheckJobTimer, laststatus.comms.runStatus, laststatus.comms.connectionStatus);

	if (laststatus.comms.connectionStatus == 5 || laststatus.comms.runStatus == "Alarm")
	{
		// Alarm detected
		CloseProgramSequence();
	}
	else if (laststatus.comms.runStatus == "Idle")
	{
		// runStatus=="Idle" is not enough. During a G4 command the status is temporarily set to idle. Also check the connectionStatus
		if (laststatus.comms.connectionStatus == 2)
		{
			// Idle reached
			clearInterval(g_CheckJobTimer);
			g_CheckJobTimer = undefined;
			ExecuteNextStep();
		}
	}
	else if (laststatus.comms.runStatus != "Jog" && laststatus.comms.runStatus != "Run" && laststatus.comms.runStatus != "Running")
	{
		// some other unexpected state
		CloseProgramSequence();
	}
}

function HandleJobComplete(data)
{
	if (data.jobCompletedMsg == "ProgramSequence")
	{
		console.log("HandleJobComplete", data.jobCompletedMsg);
		data.jobCompletedMsg = "";

		// HandleJobComplete is called when all commands have been sent to the machine, not when they are finished executing.
		// The machine may not yet have started doing anything and still be Idle.
		// To reliably detect when the execution is finished, wait 1000ms and then start checking for Idle state every 100ms.
		g_StartCheckJobTimeout = setTimeout(
			() => g_CheckJobTimer = setInterval(CheckJobCompleted, 100),
			1000);
	}
}

function RunProgramSequence(onStep, onClose)
{
	g_OnStep = onStep;
	g_OnClose = onClose;
	g_CheckJobTimer = undefined;
	g_StartCheckJobTimeout = undefined;
	socket._callbacks["$jobComplete"].splice(0,0, HandleJobComplete); // hack to inject our callback first to stop OpenBuilds from showing the job completed popup
	g_CurrentStep = -1;
	ExecuteNextStep();
}

function CloseProgramSequence()
{
	console.log("CloseProgramSequence");
	if (g_StartCheckJobTimeout != undefined)
	{
		clearTimeout(g_StartCheckJobTimeout);
		g_StartCheckJobTimeout = undefined;
	}
	if (g_CheckJobTimer != undefined)
	{
		clearInterval(g_CheckJobTimer);
		g_CheckJobTimer = undefined;
	}
	g_OnStep = undefined;
	socket.off('jobComplete', HandleJobComplete);
	if (g_OnClose)
	{
		g_OnClose();
	}
	g_OnClose = undefined;
}

///////////////////////////////////////////
// Example

function ExecuteStep(currentStep)
{
	switch (currentStep)
	{
		case 0: return "G1 G91 X10 F200";
		case 1: return "G1 G91 Y10 F200";
		case 2: return "G1 G91 X-10 F200";
		case 3: return "G1 G91 Y-10 F200";
	}
}

function Cleanup()
{
	sendGcode("G54 G21 G90"); // restore global state
}

RunProgramSequence(ExecuteStep, Cleanup);
