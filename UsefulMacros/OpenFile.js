// Removes the dropdown menu from the Open G-Code button
// Based on Thayne Co work here: https://thayneco.com/single-click-to-open-a-file-browser-in-openbuilds-control/

var openFileButtons = `
<button id="file" class="ribbon-button" onclick="socket.emit('openFile')">
	<span class="icon">
		<span class="fa-layers fa-fw">
			<i class="fas fa-folder-open fg-amber"></i>
		</span>
	</span>
	<span class="caption grblmode">Open<br>G-Code</span>
</button>`;

$("#openGcodeBtnElectron19").attr('id', "old_openGcodeBtnElectron19");
$("#old_openGcodeBtnElectron19").parent().hide();
$("#old_openGcodeBtnElectron19").parent().after(openFileButtons);
