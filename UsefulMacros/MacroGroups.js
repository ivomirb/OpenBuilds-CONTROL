// This JavaScript macro enables the creation of groups for the macro buttons. This improves the management
// of large number of macros.
// Set it to run on startup.
//
// You can right-click on a macro button and click on "Move To Group" to set which group it should belong to.
// Pick from existing groups or add a new one by typing its name.
// Right-click on the background behind the macro buttons to select if the group tabs should be displayed
// horizontally, vertically, or disabled.
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

function CreateFromHtml(html)
{
	var template = document.createElement('template');
	template.innerHTML = html;
	return template.content.firstElementChild;
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
	var contextmenu = $('#macroBackgroundContextMenu').prop('MacroBackgroundContextMenu');
	if (contextmenu != undefined)
	{
		document.getElementById('macros').removeEventListener('contextmenu', contextmenu);

		var observer = $('#macroBackgroundContextMenu').prop('Observer');
		observer.disconnect();

		$('#macroBackgroundContextMenu').remove();
		$('#macroGroupContextMenuItems').remove();
		$('#macroTabContextMenu').remove();
		$('#macroMenuDivider').remove();

		var verticalTabs = document.getElementById('macroVerticalTabs').parentElement;
		verticalTabs.remove();
		var horizontalTabs = document.getElementById('macroHorizontalTabs').parentElement;
		horizontalTabs.remove();

		var macrosElement = document.getElementById('macros');
		var newDiv = macrosElement.parentElement;
		newDiv.removeChild(macrosElement);
		newDiv.parentElement.appendChild(macrosElement);
		newDiv.remove();
	}
}

function StoreSettings()
{
	localStorage.setItem("MacroGroupSettings", JSON.stringify({tabVisibility: g_TabVisibility, currentGroupLower: g_CurrentGroupLower}));
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

	for (var i = 0; i < buttonsarray.length; i++)
	{
		var button = buttonsarray[i];
		if (button.group != undefined && button.group.toLowerCase() == oldNameLower)
		{
			button.group = newName;
		}
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
	event.preventDefault();
	event.stopPropagation();
	console.log("MENU");
	$('#macroTabContextMenu').css({
		display: 'block',
		left: event.clientX,
		top: event.clientY
	});
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
	if (tabs.id == 'macroVerticalTabs')
	{
		 justify = ` style="justify-content: left;"`;
		 space = `&nbsp;`;
	}
	tabs.replaceChildren();
	var style= CreateFromHtml(`
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
<style/>`);
	tabs.appendChild(style);
	var line = CreateFromHtml(`<li onclick="SelectMacroGroup(0);"><a href="#"` + justify + `>Default` + space + `</a></li>`);
	if (activeIdx == 0) { line.classList.add("active"); }
	tabs.appendChild(line);
	for (var i = 1; i < g_Groups.length; i++)
	{
		var html = `<li onclick="SelectMacroGroup(` + i + `);" oncontextmenu="MacroTabContextMenu(event, ` + i + `)"><a href="#"` + justify + `>` + g_Groups[i] + space+space+space+ `</a></li>`;
		var line = CreateFromHtml(html);
		if (i == activeIdx) { line.classList.add("active"); }
		tabs.appendChild(line);
	}
}

function CreateGroupTabs()
{
	var activeIdx = Math.max(0, g_GroupsLower.indexOf(g_CurrentGroupLower));
	if (g_TabVisibility == 1)
	{
		CreateTabContents(document.getElementById('macroHorizontalTabs'), activeIdx);
	}
	if (g_TabVisibility == 2)
	{
		CreateTabContents(document.getElementById('macroVerticalTabs'), activeIdx);
	}
}

function RebuildGroupUI()
{
	RebuildGroupNames();
	CreateGroupTabs();
	RefreshButtonVisibility();
}

function MoveMacroButton(name, nameBefore)
{
	var buttonElement = document.getElementById(name);
	var parentElement = buttonElement.parentElement;
	var beforeElement;
	if (nameBefore == "")
	{
		beforeElement = document.getElementById("macroBtn" + (buttonsarray.length - 1));
		beforeElement = beforeElement.nextElementSibling;
	}
	else
	{
		beforeElement = document.getElementById(nameBefore);
	}
	parentElement.removeChild(buttonElement);
	parentElement.insertBefore(buttonElement, beforeElement);
	var element = parentElement.firstElementChild;
	for (var i = 0; i < buttonsarray.length; i++)
	{
		element.id = "macroBtn" + i;
		element.setAttribute("oncontextmenu", "macroContextMenu(" + i + ")");
		if (element.getAttribute("onclick").startsWith("runJsMacro"))
		{
			element.setAttribute("onclick", "runJsMacro('" + i + "');");
		}
		element = element.nextElementSibling;
	}
}

var g_bInOnMacrosChanged = false;

function OnMacrosChanged()
{
	if (g_bInOnMacrosChanged) return; // attempt to prevent reentrancy (may not be necessary)
	g_bInOnMacrosChanged = true;

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
							MoveMacroButton("macroBtn" + i, "macroBtn" + j);
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
							MoveMacroButton("macroBtn" + (i+1), j < buttonsarray.length - 1 ? "macroBtn" + (j+1) : "");
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
		}
	}

	RebuildGroupUI();
	g_bInOnMacrosChanged = false;
}

window.SetMacroTabsVisibility = function(vis)
{
	var activeIdx = Math.max(0, g_GroupsLower.indexOf(g_CurrentGroupLower));
	var horizontalTabs = document.getElementById('macroHorizontalTabs');
	var verticalTabs = document.getElementById('macroVerticalTabs');
	if (vis == 1)
	{
		SetTabVisibility(1);
		$('#macroHideGroups > a > .icon').hide();
		$('#macroVertGroups > a > .icon').hide();
		$('#macroHorGroups > a > .icon').show();
		CreateTabContents(horizontalTabs, activeIdx);
		verticalTabs.parentElement.hidden = true;
		horizontalTabs.parentElement.hidden = false;
	}
	else if (vis == 2)
	{
		SetTabVisibility(2);
		$('#macroHideGroups > a > .icon').hide();
		$('#macroHorGroups > a > .icon').hide();
		$('#macroVertGroups > a > .icon').show();
		CreateTabContents(verticalTabs, activeIdx);
		horizontalTabs.parentElement.hidden = true;
		verticalTabs.parentElement.hidden = false;
	}
	else
	{
		SetTabVisibility(0);
		$('#macroHorGroups > a > .icon').hide();
		$('#macroVertGroups > a > .icon').hide();
		$('#macroHideGroups > a > .icon').show();
		horizontalTabs.parentElement.hidden = true;
		verticalTabs.parentElement.hidden = true;
	}

//	$('#macroBackgroundContextMenu').css({display: 'none'});
//	$('#macroTabContextMenu').css({display: 'none'});
	RefreshButtonVisibility();
}

function ApplyMoveMacro(buttonIdx)
{
	var groupIdx = Number($('#MacroGroup').val());
	if (groupIdx != -1)
	{
		buttonsarray[buttonIdx].group = g_Groups[groupIdx];
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
		}
		else
		{
			buttonsarray[buttonIdx].group = g_Groups[groupIdx];
		}
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
	if (event.target.id == 'macros')
	{
		event.preventDefault();
		event.stopPropagation();
		$('#macroBackgroundContextMenu').css({
			display: 'block',
			left: event.clientX,
			top: event.clientY
		});
	}
}

$(document).ready(function()
{
	CleanupOldVersion();

	var macrosElement = document.getElementById('macros');

	// create context menu for the background
	var backgroundMenu = `
<ul class="d-menu context drop-shadow" id="macroBackgroundContextMenu" data-role="dropdown">
	<li id="macroHorGroups"  onclick="SetMacroTabsVisibility(1)"><a href="#"><i class="fa fa-circle icon"></i> Horizontal Group Tabs</a></li>
	<li id="macroVertGroups" onclick="SetMacroTabsVisibility(2)"><a href="#"><i class="fa fa-circle icon"></i> Vertical Group Tabs</a></li>
	<li id="macroHideGroups" onclick="SetMacroTabsVisibility(0)"><a href="#"><i class="fa fa-circle icon"></i> Disable Groups</a></li>
</ul>
`;
	document.body.appendChild(CreateFromHtml(backgroundMenu));
	macrosElement.addEventListener('contextmenu', MacroBackgroundContextMenu);

	// for some reason without this divider, closing the first menu opens the second
	document.body.appendChild(CreateFromHtml(`<div id="macroMenuDivider"/>`));

	// create tab context menu
	var tabMenu = `
<ul class="d-menu context drop-shadow" id="macroTabContextMenu" data-role="dropdown">
	<li onclick="RenameSelectedGroup()"><a href="#">Rename Group</a></li>
</ul>
`;
	document.body.appendChild(CreateFromHtml(tabMenu));

	// add item to button context menu
	var groupContextMenu = `
<span id="macroGroupContextMenuItems">
	<li class="divider"></li>
	<li onclick="MoveMacroToGroup()"><a href="#">Move To Group</a></li>
</span>
`;
	$('#macroContextMenuItems').after(groupContextMenu);

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
	if (localStorage.getItem("MacroGroupSettings"))
	{
		var settings = JSON.parse(localStorage.getItem("MacroGroupSettings"));
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

	// create tabs
	var horizontalTabs = CreateFromHtml(`<ul id="macroHorizontalTabs" data-role="tabs" data-expand="true"></ul>`);
	var verticalTabs = CreateFromHtml(`<ul id="macroVerticalTabs" data-tabs-position="vertical" data-role="tabs" data-expand="true" vertical></ul>`);

	macrosElement.parentElement.appendChild(verticalTabs);
	var newDiv = CreateFromHtml(`<div style="width:100%;"></div>`);
	macrosElement.parentElement.appendChild(newDiv);
	newDiv.appendChild(horizontalTabs);
	macrosElement.parentElement.removeChild(macrosElement);
	newDiv.appendChild(macrosElement);

	var observer = new MutationObserver(OnMacrosChanged); // monitor the button elements for changes
	observer.observe(macrosElement, { childList: true, subtree: false});

	// store some objects in props to be cleaned up later
	$('#macroBackgroundContextMenu').prop('MacroBackgroundContextMenu', () => { return MacroBackgroundContextMenu; });
	$('#macroBackgroundContextMenu').prop('Observer', () => { return observer; });

	setTimeout(function()
	{
		SetMacroTabsVisibility(g_TabVisibility);
	}, 100);
});
