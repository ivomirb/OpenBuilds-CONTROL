// Example how to add a new main tab

// Customize the name and the html ids
const TabName = "New Tab";
const TabId = "newtab";
const SectionId = "tab-new";

const tabHtml = `<li id="` + TabId + `"><a href="#` + SectionId + `"><i class="fas fa-layer-group"></i> `+ TabName +`</a></li>`;

// Add your content to the inner div
const sectionHtml = `
<div class="section" id="` + SectionId + `">
	<div style="height: calc(100vh - 495px);width: 100%;border-top: 1px solid #ccc;box-shadow: 0 0 2px 2px #ddd;">
	</div>
</div>`

// Cleans up old instance of the macro. Useful when iterating on the code
function CleanupOldVersion()
{
	$('#' + TabId).remove();
	$('#' + SectionId).remove();
}

$(document).ready(function()
{
	CleanupOldVersion();

	// add a new tab to the end
	$('#gcodeeditortab').parent().after(tabHtml);

	// add a new section. the section's contents will automatically show when the tab is clicked
	$('#tab-one').after(sectionHtml);
});
