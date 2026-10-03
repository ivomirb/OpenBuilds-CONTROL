// This macro measures the Z height without changing the work Z origin.
// It moves down 20mm at rate 100mm/min to find the touch probe. Then it retracts 5mm.
// You can change the next 3 lines to adjust those parameters.

const MOVE_DOWN_DISTANCE = 20; // move 20mm down
const MOVE_DOWN_RATE = 100; // rate 100mm/min
const RETRACT_DISTANCE = 5; // move 5mm up after contact

socket.off('prbResult');
socket.on('prbResult', function(probe)
{
	socket.off('prbResult');
	if (probe.state == 0)
	{
		var content = "The probe did not make contact."
	}
	else
	{
		var content = `<span style="user-select: text;">The measured Z height is ` +
			(parseFloat(probe.z) - parseFloat(laststatus.machine.position.offset.z)).toFixed(2) + `mm in work coordinates.</span>`;
	}
	Metro.dialog.create({
		title: "Measure Z",
		content: content,
		clsDialog: 'dark',
		actions: [
			{
				caption: "OK",
				cls: probe.state == 0 ? "js-dialog-close alert" : "js-dialog-close",
				onclick: function()
				{
					if (probe.state == 0)
					{
						socket.emit('clearAlarm', 1);
					}
				}
			}
		],
	});
});

sendGcode("G38.2 G91 G21 Z" + (-MOVE_DOWN_DISTANCE).toFixed(2) + " F" + (MOVE_DOWN_RATE).toFixed(2) +
	"\nG0 Z" + (RETRACT_DISTANCE).toFixed(2));
