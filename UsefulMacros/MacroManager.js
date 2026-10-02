// This JavaScript macro enables the creation of groups for the macro buttons. This improves the management
// of large number of macros.
// Set it to run on startup.
//
// You can right-click on a macro button and click on "Move To Group" to set which group it should belong to.
// Pick from existing groups or add a new one by typing its name.
// Right-click on the background behind the macro buttons to select if the group tabs should be displayed
// horizontally, vertically, or disabled. You also get options to back up all macros into a single file.
// Right-click on a group tab to rename it.
//
// The group named "Default" always exists and is always first.
// The rest of the groups are sorted alphabetically.
// To control the order, name the groups like "1. Setup", "2. Probing", etc.

var g_TabVisibility = 2; // 0 - hidden, 1 - horizontal, 2 - vertical
var g_CurrentGroupLower = ""; // empty when g_TabVisibility is 0

var g_Groups = [ "" ]; // first item is always empty string
var g_GroupsLower = [ "" ];
var g_SelectedGroup = undefined;

var g_ButtonsCopy;

var g_bMacroContextMenuHack = false;

function MacroButtonAltContextMenu(event)
{
	var offset = $("#" + event.currentTarget.id).offset();
	$("#macroContextMenuAlt").css({
		left: offset.left + 20,
		top: offset.top + 20
	}).data('dropdown').close(true);
	$('#macroContextToggle').click();
}

function SanitizeGroupName(string)
{
	if (string == undefined)
	{
		return "";
	}
	return string.replaceAll('&', ' ').replaceAll('<', ' ').replaceAll('>', ' ').replaceAll('"', ' ').replaceAll("'", ' ');
}

// Cleans up old instance of the plugin. useful when iterating on the code
function CleanupOldVersion()
{
	var observer = $('#macroBackgroundContextMenu').prop('Observer');
	if (observer) observer.disconnect();

	$('#macroBackgroundContextMenu').remove();
	$('#macroManagerContextMenuItems').remove();
	$('#macroTabContextMenu').remove();
	$('#macroBackgroundContextToggle').remove();
	$('#macroTabContextToggle').remove();

	$('#macroVerticalTabs').parent().remove();
	$('#macroHorizontalDiv').after($('#macros'));
	$('#macroHorizontalDiv').remove();

	$('#macros').off('contextmenu');
	$('#macrostab').off('contextmenu');
	$('.macrobtn').off('contextmenu');
}

function StoreSettings()
{
	localStorage.setItem("MacroManagerSettings", JSON.stringify({tabVisibility: g_TabVisibility, currentGroupLower: g_CurrentGroupLower}));
}

function SetTabVisibility(vis)
{
	if (g_TabVisibility != vis)
	{
		if (vis == 0)
		{
			g_CurrentGroupLower = "";
		}
		g_TabVisibility = vis;
		StoreSettings();
	}
}

function SetCurrentGroup(groupLower)
{
	if (g_CurrentGroupLower != groupLower)
	{
		g_CurrentGroupLower = groupLower;
		StoreSettings();
	}
}

function RebuildGroupNames()
{
	g_Groups = [ "" ];
	g_GroupsLower = [ "" ];
	for (var i = 0; i < buttonsarray.length; i++)
	{
		var groupName = SanitizeGroupName(buttonsarray[i].group);
		var groupNameLower = groupName.toLowerCase();
		if (g_GroupsLower.indexOf(groupNameLower) == -1)
		{
			g_Groups.push(groupName);
			g_GroupsLower.push(groupNameLower);
		}
	}

	g_Groups.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

	g_GroupsLower = [];
	for (var i = 0; i < g_Groups.length; i++)
	{
		g_GroupsLower.push(g_Groups[i].toLowerCase());
	}
}

function IsButtonVisible(button)
{
	if (button.group == undefined)
	{
		return g_CurrentGroupLower == "";
	}
	else
	{
		return button.group.toLowerCase() === g_CurrentGroupLower;
	}
}

function RefreshButtonVisibility()
{
	for (var i = 0; i < buttonsarray.length; i++)
	{
		var button = buttonsarray[i];
		var visible = g_TabVisibility == 0 || IsButtonVisible(button);
		var element = $('#macroBtn' + i);
		if (visible)
		{
			element.show();
		}
		else
		{
			element.hide();
		}
	}
}

function RenameGroup(groupIdx, newName)
{
	var oldName = g_Groups[groupIdx];
	var oldNameLower = oldName.toLowerCase()
	newName = SanitizeGroupName(newName);
	if (g_CurrentGroupLower == oldNameLower)
	{
		SetCurrentGroup(newName.toLowerCase());
	}

	var saveRequired = false;
	for (var i = 0; i < buttonsarray.length; i++)
	{
		var button = buttonsarray[i];
		if (button.group != undefined && button.group.toLowerCase() == oldNameLower)
		{
			button.group = newName;
			saveRequired = true;
		}
	}

	if (saveRequired)
	{
		localStorage.setItem('macroButtons', JSON.stringify(buttonsarray));
	}
	RebuildGroupUI();
}

window.RenameSelectedGroup = function()
{
	var dialogContent = `
<div class="row mb-2">
<label class="cell-sm-4 pt-1">Group Name:</label>
<div class="cell-sm-6">
<input id="MacroGroupRename" data-role="input" data-clear-button="false" data-editable="true" />
</div>
</div>
`;
	Metro.dialog.create({
		title: "Rename Macro Group",
		clsDialog: "dark",
		width: 600,
		content: dialogContent,
		dataToTop: true,
		actions: [{
				caption: "Cancel",
				cls: "js-dialog-close",
				onclick: function() {}
			},
			{
				caption: "Apply",
				cls: "js-dialog-close success",
				onclick: function() {
					RenameGroup(g_SelectedGroup, $('#MacroGroupRename').val());
					g_SelectedGroup = undefined;
				}
			}
		]
	});

	$('#MacroGroupRename').val(g_Groups[g_SelectedGroup]);
}

window.MacroTabContextMenu = function(event, groupIdx)
{
	g_SelectedGroup = groupIdx;

	$("#macroTabContextMenu").css({
		left: event.clientX,
		top: event.clientY
	}).data('dropdown').close(true);
	$("#macroTabContextToggle").click();
}

window.SelectMacroGroup = function(groupIdx)
{
	SetCurrentGroup(g_GroupsLower[groupIdx]);
	RefreshButtonVisibility();
}

function CreateTabContents(tabs, activeIdx)
{
	var justify = "";
	var space = "";
	if (tabs.attr('id') == 'macroVerticalTabs')
	{
		 justify = ` style="justify-content: left;"`;
		 space = `&nbsp;`;
	}
	tabs.empty();
	const styleHtml = `
<style>
#macroHorizontalTabs > li,
#macroVerticalTabs > li
{
	white-space: nowrap;
	padding-left: 8px;
	padding-right: 8px;
}
#macroHorizontalTabs > li.active,
#macroVerticalTabs > li.active
{
	background-color: lightgray;
}
<style/>`;
	tabs.append(styleHtml);

	const classActiveHtml = `class="active"`;
	var lineHtml = `<li onclick="SelectMacroGroup(0);"` + (activeIdx == 0 ? classActiveHtml : "") + `><a href="#"` + justify + `>Default` + space + `</a></li>`;
	tabs.append(lineHtml);
	for (var i = 1; i < g_Groups.length; i++)
	{
		lineHtml = `<li onclick="SelectMacroGroup(` + i + `);" oncontextmenu="MacroTabContextMenu(event, ` + i + `)"` +
		(activeIdx == i ? classActiveHtml : "") + 
		`><a href="#"` + justify + `>` + g_Groups[i] + space+space+space+ `</a></li>`;
		tabs.append(lineHtml);
	}
}

function CreateGroupTabs()
{
	var activeIdx = Math.max(0, g_GroupsLower.indexOf(g_CurrentGroupLower));
	if (g_TabVisibility == 1)
	{
		CreateTabContents($('#macroHorizontalTabs'), activeIdx);
	}
	if (g_TabVisibility == 2)
	{
		CreateTabContents($('#macroVerticalTabs'), activeIdx);
	}
}

function RebuildGroupUI()
{
	RebuildGroupNames();
	CreateGroupTabs();
	RefreshButtonVisibility();
}

var g_bInOnMacrosChanged = false;

function OnMacrosChanged()
{
	if (g_bInOnMacrosChanged) return; // attempt to prevent reentrancy (may not be necessary)
	g_bInOnMacrosChanged = true;

	var populateRequired = false;
	var saveRequired = false;

	// Look for a swapped pair to detect move left/right. If a visible button was moved after
	// a hidden button, move further until the order in the group actually changes.
	if (g_TabVisibility != 0 && buttonsarray.length == g_ButtonsCopy.length)
	{
		for (var i = 0; i < buttonsarray.length - 1; i++)
		{
			if (g_ButtonsCopy[i] == buttonsarray[i+1] && g_ButtonsCopy[i+1] == buttonsarray[i])
			{
				var vis1 = IsButtonVisible(buttonsarray[i]);
				var vis2 = IsButtonVisible(buttonsarray[i+1]);
				if (vis1 && !vis2)
				{
					// button i+1 was moved left to i, move before the prevoius visible
					for (var j = i - 1; j >= 0; j--)
					{
						if (IsButtonVisible(buttonsarray[j]))
						{
							// move i before j
							var button = buttonsarray[i];
							buttonsarray.splice(i, 1);
							buttonsarray.splice(j, 0, button);
							populateRequired = true;
							break;
						}
					}
					break;
				}
				else if (!vis1 && vis2)
				{
					// button i was moved right to i+1, move after the next visible
					for (var j = i + 2; j < buttonsarray.length; j++)
					{
						if (IsButtonVisible(buttonsarray[j]))
						{
							// move i+1 after j
							var button = buttonsarray[i+1];
							buttonsarray.splice(i+1, 1);
							buttonsarray.splice(j, 0, button);
							populateRequired = true;
							break;
						}
					}
					break;
				}
			}
		}
	}

	// capture new button order
	g_ButtonsCopy = [];
	for (var i = 0; i < buttonsarray.length; i++)
	{
		var button = buttonsarray[i];
		g_ButtonsCopy.push(button);

		// move newly created buttons to the current group
		if (button.group == undefined)
		{
			var activeIdx = g_TabVisibility == 0 ? 0 : Math.max(0, g_GroupsLower.indexOf(g_CurrentGroupLower));
			button.group = g_Groups[activeIdx];
			saveRequired = true;
		}
	}

	if (populateRequired)
	{
		populateMacroButtons(); // also saves
		if (g_bMacroContextMenuHack)
		{
			$('.macrobtn').off('contextmenu');
			$('.macrobtn').on('contextmenu', MacroButtonAltContextMenu);
		}
	}
	else if (saveRequired)
	{
		localStorage.setItem('macroButtons', JSON.stringify(buttonsarray));
	}

	RebuildGroupUI();
	g_bInOnMacrosChanged = false;
}

window.SetMacroTabsVisibility = function(vis)
{
	var activeIdx = Math.max(0, g_GroupsLower.indexOf(g_CurrentGroupLower));
	if (vis == 1)
	{
		SetTabVisibility(1);
		$('#macroHideGroups > a > .icon').hide();
		$('#macroVertGroups > a > .icon').hide();
		$('#macroHorGroups > a > .icon').show();
		CreateTabContents($('#macroHorizontalTabs'), activeIdx);
		$('#macroVerticalTabs').parent().hide();
		$('#macroHorizontalTabs').parent().show();
		$('#macros').css('height', 'calc(100vh - 537px)');
	}
	else if (vis == 2)
	{
		SetTabVisibility(2);
		$('#macroHideGroups > a > .icon').hide();
		$('#macroHorGroups > a > .icon').hide();
		$('#macroVertGroups > a > .icon').show();
		CreateTabContents($('#macroVerticalTabs'), activeIdx);
		$('#macroHorizontalTabs').parent().hide();
		$('#macroVerticalTabs').parent().show();
		$('#macros').css('height', 'calc(100vh - 495px)');
	}
	else
	{
		SetTabVisibility(0);
		$('#macroHorGroups > a > .icon').hide();
		$('#macroVertGroups > a > .icon').hide();
		$('#macroHideGroups > a > .icon').show();
		$('#macroHorizontalTabs').parent().hide();
		$('#macroVerticalTabs').parent().hide();
		$('#macros').css('height', 'calc(100vh - 495px)');
	}

	RefreshButtonVisibility();
}

function ApplyMoveMacro(buttonIdx)
{
	var saveRequired = false;
	var groupIdx = Number($('#MacroGroup').val());
	if (groupIdx != -1)
	{
		buttonsarray[buttonIdx].group = g_Groups[groupIdx];
		saveRequired = true;
	}
	else
	{
		var groupName = $('#MacroGroupName').val();
		groupName = SanitizeGroupName(groupName);
		var groupNameLower = groupName.toLowerCase();
		var groupIdx = (groupNameLower == "default") ? 0 : g_GroupsLower.indexOf(groupNameLower);
		if (groupIdx == -1)
		{
			g_Groups.push(groupName);
			g_GroupsLower.push(groupNameLower);
			buttonsarray[buttonIdx].group = groupName;
			saveRequired = true;
		}
		else
		{
			buttonsarray[buttonIdx].group = g_Groups[groupIdx];
			saveRequired = true;
		}
	}

	if (saveRequired)
	{
		localStorage.setItem('macroButtons', JSON.stringify(buttonsarray));
	}
	RebuildGroupUI();
}

window.MoveMacroToGroup = function()
{
	var src = window.event.srcElement;
	var onclick = src.parentElement.parentElement.parentElement.firstElementChild.firstElementChild.getAttribute("onclick");
	if (typeof(onclick) == 'string' && onclick.startsWith("edit("))
	{
		var buttonIdx = Number(onclick.substring(5).split(')')[0]);
		if (buttonIdx >= 0 && buttonIdx < buttonsarray.length)
		{
			var dialogContent = `
<div class="row mb-2">
  <label class="cell-sm-4 pt-1" title="Move to existing group">Group:</label>
  <div class="cell-sm-6">
  <select id="MacroGroup" data-role="select" data-clear-button="true" data-filter="false" onchange="if (Number($('#MacroGroup').val()) == -1) $('#MacroGroupNameRow').show(); else $('#MacroGroupNameRow').hide()">
    <option value="0">Default</option>
`;
			for (var i = 1; i < g_Groups.length; i++)
			{
				dialogContent += `
<option value="` + i + `">` + g_Groups[i] + `</option>
`;
			}
			dialogContent += `
    <option value="-1">&amp;lt;New Group&amp;gt;</option>
  </select>
  </div>
</div>
<div id="MacroGroupNameRow" class="row mb-2">
  <label class="cell-sm-4 pt-1" title="Enter the name for the new group">Group Name:</label>
  <div class="cell-sm-6">
    <input id="MacroGroupName" data-role="input" data-clear-button="false" data-editable="true" />
  </div>
</div>
`;
			Metro.dialog.create({
				title: "Move Macro To Group",
				clsDialog: "dark",
				width: 600,
				content: dialogContent,
				dataToTop: true,
				actions: [{
						caption: "Cancel",
						cls: "js-dialog-close",
						onclick: function() {}
					},
					{
						caption: "Apply",
						cls: "js-dialog-close success",
						onclick: function() {
							ApplyMoveMacro(buttonIdx);
						}
					}
				]
			});

			var groupName = SanitizeGroupName(buttonsarray[buttonIdx].group);
			var groupNameLower = groupName.toLowerCase();
			var groupIdx = Math.max(0, g_GroupsLower.indexOf(groupNameLower));
			$('#MacroGroup').val(groupIdx);
		}
	}
}

function MacroBackgroundContextMenu(event)
{
	if (event.target.id == 'macros' || event.target.id == 'macrostab')
	{
		var menu = $("#macroBackgroundContextMenu");
		menu.css({
			visibility: "hidden",
			display: "block",
		});
		const menuRect = menu[0].getBoundingClientRect();
		const parentRect = document.body.getBoundingClientRect();
		const left = Math.max(Math.min(event.clientX, parentRect.right - menuRect.width - 4), 0);
		const top = Math.max(Math.min(event.clientY, parentRect.bottom - menuRect.height - 4), 0);

		menu.css({
			left: left,
			top: top,
			visibility: "visible",
		}).data('dropdown').close(true);
		$("#macroBackgroundContextToggle").click();
	}
}

window.ExportAll = function()
{
	var blob = new Blob([JSON.stringify(buttonsarray, null, 2)], {type: "plain/text"});
	var date = new Date();

	if (typeof invokeSaveAsDialogNew == 'function')
	{
		var saveFileParams = {
			id: "macros",
			title: "Backup Macros",
			filters: macroFileFilters,
			fileName: 'macro-backup-' + date.yyyymmdd() + '.json'
		};
		invokeSaveAsDialogNew(blob, saveFileParams);
	}
	else{
		invokeSaveAsDialog(blob, 'macro-backup-' + date.yyyymmdd() + '.json');
	}
}

function FileReadError(message)
{
	if (message == undefined)
	{
		message = "Unspecified Error";
	}
	Metro.dialog.create({
		title: "File read error",
		clsDialog: "dark",
		width: 600,
		content: escapeHTML(message),
		dataToTop: true,
		actions: [{
				caption: "OK",
				cls: "js-dialog-close alert",
				onclick: function() {}
			}
		]
	});
}

function ImportAll(data)
{
	var newButtons = undefined;
	try
	{
		newButtons = JSON.parse(data);
	}
	catch (error)
	{
		FileReadError(error.message);
	}
	if (newButtons != undefined)
	{
		buttonsarray = newButtons;
		populateMacroButtons();
		if (g_bMacroContextMenuHack)
		{
			$('.macrobtn').off('contextmenu');
			$('.macrobtn').on('contextmenu', MacroButtonAltContextMenu);
		}
	}
}

function ImportAllOld(event)
{
	var files = event.target.files || event.dataTransfer.files;
	var file = files[0];
	document.getElementById('macroImportAllFile').value = '';
	if (file)
	{
		var r = new FileReader();
		r.readAsText(file);
		r.onload = function()
		{
			ImportAll(this.result);
		}
		r.onerror = function()
		{
			FileReadError(r.error.message);
		}
	}
}

window.ImportAllNew = function()
{
	var loadFileParams = {
		id: "macros",
		title: "Import All",
		filters: macroFileFilters,
		showErrorDlg: false,
	};

	invokeOpenDialogReadFile(loadFileParams).then(({err, data}) =>
	{
		if (err)
			FileReadError(err);
		else
			ImportAll(data);
	});
}

const contextMenusHtml = `
<div id="macroBackgroundContextToggle">
	<ul class="d-menu context drop-shadow pos-fixed" id="macroBackgroundContextMenu" data-role="dropdown" data-toggle-element="#macroBackgroundContextToggle">
		<li id="macroHorGroups"  onclick="SetMacroTabsVisibility(1)"><a href="#"><i class="fa fa-circle icon"></i> Horizontal Group Tabs</a></li>
		<li id="macroVertGroups" onclick="SetMacroTabsVisibility(2)"><a href="#"><i class="fa fa-circle icon"></i> Vertical Group Tabs</a></li>
		<li id="macroHideGroups" onclick="SetMacroTabsVisibility(0)"><a href="#"><i class="fa fa-circle icon"></i> Disable Groups</a></li>
		<li class="divider"></li>
		<li onclick="ExportAll()"><a href="#"><i class="fas fa-save icon"></i> Export All Macros</a></li>
		<li class="btn-file" title="" id="macroImportAllOld"><a href="#"><input class="btn-file" id="macroImportAllFile" type="file" accept=".json" /><i class="fas fa-upload icon"></i> Import All Macros</a></li>
		<li  id="macroImportAllNew" onclick="ImportAllNew()"><a href="#"><i class="fas fa-upload icon"></i> Import All Macros</a></li>
	</ul>
</div>
<div id="macroTabContextToggle">
	<ul class="d-menu context drop-shadow pos-fixed" id="macroTabContextMenu" data-role="dropdown" data-duration="40" data-toggle-element="#macroTabContextToggle">
		<li onclick="RenameSelectedGroup()"><a href="#">Rename Group</a></li>
	</ul>
</div>
`;

const groupContextMenuHtml = `
<span id="macroManagerContextMenuItems">
	<li class="divider"></li>
	<li onclick="MoveMacroToGroup()"><a href="#">Move To Group</a></li>
</span>
`;

$(document).ready(function()
{
	CleanupOldVersion();

	var macrosElement = document.getElementById('macros');

	// create context menu for the background
	$('body').append(contextMenusHtml);

if (typeof invokeOpenDialog == 'function')
	{
		$('#macroImportAllOld').remove();
	}
	else
	{
		$('#macroImportAllNew').remove();
		$('#macroImportAllFile').on('change', ImportAllOld);
	}

	// add items to button context menu
	$('#macroContextMenuItems').after(groupContextMenuHtml);

	RebuildGroupNames();

	// make copy of the buttons to track changes
	g_ButtonsCopy = [];
	for (var i = 0; i < buttonsarray.length; i++)
	{
		var button = buttonsarray[i];
		g_ButtonsCopy.push(button);
		if (button.group == undefined)
		{
			button.group = "";
		}
	}

	// read and validate settings
	if (localStorage.getItem("MacroManagerSettings"))
	{
		var settings = JSON.parse(localStorage.getItem("MacroManagerSettings"));
		g_TabVisibility = typeof(settings.tabVisibility) == "number" ? settings.tabVisibility : 2;
		if (g_TabVisibility != 0 && typeof(settings.currentGroupLower) == "string" && g_GroupsLower.indexOf(settings.currentGroupLower) != -1)
		{
			g_CurrentGroupLower = settings.currentGroupLower;
		}
		else
		{
			g_CurrentGroupLower = "";
		}
	}

	// create vertical tabs
	$('#macros').before(`<ul id="macroVerticalTabs" data-tabs-position="vertical" data-role="tabs" data-expand="true" vertical></ul>`);

	// create horizontal tabs
	$('#macros').after(`<div id="macroHorizontalDiv" style="width:100%;"><ul id="macroHorizontalTabs" data-role="tabs" data-expand="true"></ul></div>`);
	$('#macroHorizontalDiv').append($('#macros'));

	var observer = new MutationObserver(OnMacrosChanged); // monitor the button elements for changes
	observer.observe(macrosElement, { childList: true, subtree: false});

	$('#macros').on('contextmenu', MacroBackgroundContextMenu);
	$('#macrostab').on('contextmenu', MacroBackgroundContextMenu);
	$('#macrostab').children().css('pointer-events', 'none');

	// store some objects in props to be cleaned up later
	$('#macroBackgroundContextMenu').prop('MacroBackgroundContextMenu', () => { return MacroBackgroundContextMenu; });
	$('#macroBackgroundContextMenu').prop('Observer', () => { return observer; });

	if ($('#macroContextMenu').attr('data-toggle-element') == '#context_toggle')
	{
		// Super ugly hack to fix a bug where the macro context menu has the wrong toggle parent and doesn't close the previously open menu.
		// The hack involves doing surgery on the DOM, and then reaching deep into the Metro structures to reinitialize the dropdown object.
		// The menu is renamed to macroContextMenuAlt to stop the code in setMacroContextMenuPosition from opening it the wrong way.
		// The correct way to open a dropdown is by clicking the parent toggle.
		$('#macroContextMenu').before(`<div id="macroContextToggle" />`);
		$('#macroContextToggle').append($('#macroContextMenu'));
		$('#macroContextMenu').addClass('pos-fixed').attr('data-toggle-element', '#macroContextToggle').attr('id', 'macroContextMenuAlt');
		$("#macroContextMenuAlt").data('dropdown').options.toggleElement = "#macroContextToggle";
		$("#macroContextMenuAlt").data('dropdown')._create();
		g_bMacroContextMenuHack = true;
		// The editor context menu has a similar issue, but it is less of a problem because there are no other context menus on that page
	}
	else if ($("#macroContextMenuAlt").length > 0)
	{
		// in case this is the second run of the macro
		g_bMacroContextMenuHack = true;
	}

	if (g_bMacroContextMenuHack)
	{
		$('.macrobtn').off('contextmenu');
		$('.macrobtn').on('contextmenu', MacroButtonAltContextMenu);
	}

	setTimeout(function()
	{
		SetMacroTabsVisibility(g_TabVisibility);
	}, 100);
});
