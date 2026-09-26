const PRIMARY_GRID_COLOR = 0xF6A91C;
const SECONDARY_GRID_COLOR = 0x1CB9F6;
const FACE_COLOR = 0x1CB9F6;
const FACE_OPACITY = 0.3;
const HEIGHTMAP_GCODE_HEADER1 = "; This G-code was modified by the Heightmap tool. To restore the original state, select Heightmap -> Revert G-code changes";
const HEIGHTMAP_GCODE_HEADER2 = "; The original lines that were removed are prefixed with 'HM'. The new lines added in their place end with 'HM'";
const HEIGHTMAP_GCODE_END_MARKER = " ; HM";
const HEIGHTMAP_GCODE_START_MARKER = "; HM: ";

// Heightmap data
var g_HeightmapStart = {x: -50, y: -50};
var g_HeightmapSize = {x: 100, y: 100};
var g_HeightmapPointCount = {x: 5, y: 5};
var g_HeightmapAnchor = {x: 0, y: 0};
var g_HeightmapSeek = 15;
var g_HeigtmapFeed = 50;
var g_HeightmapRetract = 5;
var g_HeightmapDataZ0 = undefined;
var g_HeightmapData = undefined;
var g_HeightmapPending = undefined;
var g_bHeightmapDataValid = false;
var g_bShowHeightmap = false;
var g_HeightmapGeo = undefined;

// Heightmap settings (persistent)
var g_HeghtmapSettings =
{
	minSegmentLength: 1, // minimum length for linear and arc segments
	zThreshold: 0.01, // maximum Z deviation between the toolpath and the heightmap
	arcThreshold: 0.005, // maximum deviation when converting arcs to lines
	modifyRapids: false, // modify the height of rapid moves (G0 commands)
};

const heightmapFilters = [
	{name: "Comma Separate Values files", extensions: ["csv"]},
	{name: "All files", extensions: ["*"]},
];

function ClearHeightmapMesh()
{
	var geo = g_HeightmapGeo ? g_HeightmapGeo : workspace.getObjectByName("Heightmap");
	if (geo)
	{
		geo.children.forEach((child) =>
		{
			child.geometry.dispose();
			child.material.dispose();
		});
		workspace.remove(geo);
	}
	g_HeightmapGeo = undefined;
}

// Cleans up old instance of the plugin. useful when iterating on the code
function CleanupOldVersion()
{
	$('#heightmapBtn').parent().remove();

	ClearHeightmapMesh();
}

window.ShowHeightmap = function(show)
{
	if (show == undefined)
	{
		show = !g_bShowHeightmap;
	}
	if (show)
	{
		if (g_HeightmapGeo == undefined)
			GenerateHeightmapMesh();
		g_HeightmapGeo.visible = true;
		g_bShowHeightmap = true;
		$('#showHeightmap').addClass("checked");
	}
	else
	{
		if (g_HeightmapGeo != undefined)
			g_HeightmapGeo.visible = false;
		g_bShowHeightmap = false;
		$('#showHeightmap').removeClass("checked");
	}
}

window.OnSettingChange = function()
{
	var start = {x: Number($('#heightmapX').val()), y: Number($('#heightmapY').val())};
	var size = {x: Math.max(Number($('#heightmapW').val()), 1), y: Math.max(Number($('#heightmapL').val()), 1)};
	var pointCount = {x: Math.max(parseInt($('#heightmapNX').val()), 2), y: Math.max(parseInt($('#heightmapNY').val()), 2)};
	var anchor = {x: Number($('#heightmapAX').val()), y: $('#heightmapAY').val()};

	if (Math.abs(start.x-g_HeightmapStart.x) > 0.01 || Math.abs(start.y-g_HeightmapStart.y) > 0.01 ||
		Math.abs(size.x-g_HeightmapSize.x) > 0.01 || Math.abs(size.y-g_HeightmapSize.y) > 0.01 ||
		pointCount.x != g_HeightmapPointCount.x || pointCount.y != g_HeightmapPointCount.y ||
		Math.abs(anchor.x-g_HeightmapAnchor.x) > 0.01 || Math.abs(anchor.y-g_HeightmapAnchor.y) > 0.01)
	{
		$('#hightmapChangeWarning').css({color: "red"});
	}
	else
	{
		$('#hightmapChangeWarning').css({color: ""});
	}
}

const g_HeightmapSettingsDlg = `
<div class="row mb-2 pt-1 border-top bd-gray">
  <label class="cell-sm-3">Grid Dimensions</label>
  <label class="cell-sm-9" id="hightmapChangeWarning" style="display:none;"><small class="dark"><i>Changing these settings will clear the current heightmap data</i></small></label>
</div>

<div class="row mb-2 pt-1">
  <div class="cell-sm-2">
  </div>
</div>

<div class="row mb-2">
  <label class="cell-sm-3 pt-1" title="Starting corner of the heightmap grid">Start</label>
  <div class="cell-sm-4">
    <input id="heightmapX" type="number" style="text-align:right;" data-role="input" data-prepend="X" data-append="mm" data-clear-button="false" data-editable="true" onchange="OnSettingChange()"/>
  </div>
  <div class="cell-sm-4">
    <input id="heightmapY" type="number" style="text-align:right;" data-role="input" data-prepend="Y" data-append="mm" data-clear-button="false" data-editable="true"  onchange="OnSettingChange()"/>
  </div>
</div>

<div class="row mb-2">
  <label class="cell-sm-3 pt-1" title="Total size of the heightmap grid">Size<button
    id="HeightmapAutoSize" class="button" onclick="HeightmapAutoSize();" title="Updates the grid dimensions from the bounding box of the G-code" style="margin-left:50px; margin-bottom:-5px;">Auto Size</button>
  </label>
  <div class="cell-sm-4">
    <input id="heightmapW" type="number" style="text-align:right;" data-role="input" data-prepend="X (Width)" data-append="mm" data-clear-button="false" data-editable="true"  onchange="OnSettingChange()"/>
  </div>
  <div class="cell-sm-4">
    <input id="heightmapL" type="number" style="text-align:right;" data-role="input" data-prepend="Y (Length)" data-append="mm" data-clear-button="false" data-editable="true"  onchange="OnSettingChange()"/>
  </div>
</div>

<div class="row mb-2">
  <label class="cell-sm-3 pt-1" title="Number of probe points along X and Y">Probe Point Count</label>
  <div class="cell-sm-4">
    <input id="heightmapNX" type="number" style="text-align:right;" data-role="input" data-prepend="X" data-append="points" data-clear-button="false" data-editable="true"  onchange="OnSettingChange()"/>
  </div>
  <div class="cell-sm-4">
    <input id="heightmapNY" type="number" style="text-align:right;" data-role="input" data-prepend="Y" data-append="points" data-clear-button="false" data-editable="true"  onchange="OnSettingChange()"/>
  </div>
</div>

<div class="row mb-2">
  <label class="cell-sm-3 pt-1" title="The anchor point is the location where the initial Z0 measurement will be taken.
It has to match the Z0 of the G-code.">Anchor point</label>
  <div class="cell-sm-4">
    <input id="heightmapAX" type="number" style="text-align:right;" data-role="input" data-prepend="X" data-append="mm" data-clear-button="false" data-editable="true"  onchange="OnSettingChange()"/>
  </div>
  <div class="cell-sm-4">
    <input id="heightmapAY" type="number" style="text-align:right;" data-role="input" data-prepend="Y" data-append="mm" data-clear-button="false" data-editable="true"  onchange="OnSettingChange()"/>
  </div>
</div>

<div class="row mb-2 pt-1 border-top bd-gray">
  <label class="cell-sm-6">Z Probe Settings</label>
</div>

<div class="row mb-2">
  <label class="cell-sm-3 pt-1" title="Downward distance and feed rate to use during probing.">Seek</label>
  <div class="cell-sm-4">
    <input id="heightmapSeek" type="number" style="text-align:right;" data-role="input" data-prepend="Travel" data-append="mm" data-clear-button="false" data-editable="true" />
  </div>
  <div class="cell-sm-4">
    <input id="heightmapFeed" type="number" style="text-align:right;" data-role="input" data-prepend="Feed" data-append="mm/min" data-clear-button="false" data-editable="true" />
  </div>
</div>

<div class="row mb-2">
  <label class="cell-sm-3 pt-1" title="Retraction height after probing.
The height needs to be large enough to safely move above the material surface.
For flatter surfaces use smaller numbers to speed up the process.
This number should be smaller than the Seek distance.">Retract</label>
  <div class="cell-sm-4">
    <input id="heightmapRetract" type="number" style="text-align:right;" data-role="input" data-prepend="Travel" data-append="mm" data-clear-button="false" data-editable="true" />
  </div>
</div>

<div class="row mb-2 pt-1 border-top bd-gray">
  <label class="cell-sm-3" title="The heightmap tool needs to subdivide the toolpaths into small linear segments to follow the surface.
Smaller numbers will produce more accurate results, but will generate larger and slower G-code.">Toolpath Settings</label>
  <label class="cell-sm-9" ><small class="dark"><i>These settings are global, independent of the current heightmap</i></small></label>
</div>

<div class="row mb-2 pt-1">
  <label class="cell-sm-3" title="Minimum segment length for linear and arc segments">Min segment length</label>
  <div class="cell-sm-3">
    <input id="HeightmapMinLength" type="number" style="text-align:right;" data-role="input" data-append="mm" data-clear-button="false" data-editable="true" />
  </div>
</div>

<div class="row mb-2 pt-1">
  <label class="cell-sm-3" title="How closely the path will follow the surface">Z Threshold</label>
  <div class="cell-sm-3">
    <input id="HeightmapZThreshold" type="number" style="text-align:right;" data-role="input" data-append="mm" data-clear-button="false" data-editable="true" />
  </div>
  <label style="-webkit-box-flex:0; -ms-flex:0 0 18%; flex:0 0 18%; max-width:18%; text-align:right;" title="How closely the path will follow the arcs">Arc Threshold</label>
  <div class="cell-sm-3">
    <input id="HeightmapArcThreshold" type="number" style="text-align:right;" data-role="input" data-append="mm" data-clear-button="false" data-editable="true" />
  </div>
</div>

<div class="row mb-2 pt-1">
  <div class="cell-sm-3">
    <label title="When this is checked, the rapid moves will also be modified to follow the surface.
This could be useful for very uneven heightmaps.">Apply To Rapids</label>
  </div>
  <div class="cell-sm-3">
    <input id="HeightmapRaids" type="checkbox" data-role="checkbox" data-style="2"/>
  </div>
</div>
`;

function ReadHeightmapSettings()
{
	var start = {x: Number($('#heightmapX').val()), y: Number($('#heightmapY').val())};
	var size = {x: Math.max(Number($('#heightmapW').val()), 1), y: Math.max(Number($('#heightmapL').val()), 1)};
	var pointCount = {x: Math.max(parseInt($('#heightmapNX').val()), 2), y: Math.max(parseInt($('#heightmapNY').val()), 2)};
	var anchor = {x: Number($('#heightmapAX').val()), y: Number($('#heightmapAY').val())};

	if (Math.abs(start.x-g_HeightmapStart.x) > 0.01 || Math.abs(start.y-g_HeightmapStart.y) > 0.01 ||
		Math.abs(size.x-g_HeightmapSize.x) > 0.01 || Math.abs(size.y-g_HeightmapSize.y) > 0.01 ||
		pointCount.x != g_HeightmapPointCount.x || pointCount.y != g_HeightmapPointCount.y ||
		Math.abs(anchor.x-g_HeightmapAnchor.x) > 0.01 || Math.abs(anchor.y-g_HeightmapAnchor.y) > 0.01)
	{
		ClearHeightmapData();
	}

	g_HeightmapStart = start;
	g_HeightmapSize = size;
	g_HeightmapPointCount = pointCount;
	g_HeightmapAnchor = anchor;

	g_HeightmapSeek = Math.max(Number($('#heightmapSeek').val()), 0.1);
	g_HeigtmapFeed = Math.max(Number($('#heightmapFeed').val()), 1);
	g_HeightmapRetract = Math.max(Number($('#heightmapRetract').val()), 0.1);

	g_HeghtmapSettings.minSegmentLength = Math.max(Number($('#HeightmapMinLength').val()), 1);
	g_HeghtmapSettings.zThreshold = Math.max(Number($('#HeightmapZThreshold').val()), 0.01);
	g_HeghtmapSettings.arcThreshold = Math.max(Number($('#HeightmapArcThreshold').val()), 0.001);
	g_HeghtmapSettings.modifyRapids = $('#HeightmapRaids').prop('checked');

	localStorage.setItem("HeightmapSettings", JSON.stringify(g_HeghtmapSettings));
}

window.HeightmapAutoSize = function()
{
	if (object)
	{
		var bbox2 = new THREE.Box3().setFromObject(object);
		$('#heightmapX').val(bbox2.min.x.toFixed(2));
		$('#heightmapY').val(bbox2.min.y.toFixed(2));
		$('#heightmapW').val((bbox2.max.x - bbox2.min.x).toFixed(2));
		$('#heightmapL').val((bbox2.max.y - bbox2.min.y).toFixed(2));
		OnSettingChange();
	}
}

window.EditHeightmapSettings = function()
{
	Metro.dialog.create({
		title: "<i class='fas fa-layer-group'></i> Heightmap Settings",
		content: g_HeightmapSettingsDlg,
		width: 850,
		clsDialog: 'dark',
		actions: [
			{
				caption: "OK",
				cls: "js-dialog-close success",
				onclick: function()
				{
					ReadHeightmapSettings();
				}
			},
			{
				caption: "Cancel",
				cls: "js-dialog-close",
				onclick: function() {}
			},
		],
	});

	$('#heightmapX').val(g_HeightmapStart.x);
	$('#heightmapY').val(g_HeightmapStart.y);
	$('#heightmapW').val(g_HeightmapSize.x);
	$('#heightmapL').val(g_HeightmapSize.y);
	$('#heightmapNX').val(g_HeightmapPointCount.x);
	$('#heightmapNY').val(g_HeightmapPointCount.y);

	$('#heightmapAX').val(g_HeightmapAnchor.x);
	$('#heightmapAY').val(g_HeightmapAnchor.y);

	$('#heightmapSeek').val(g_HeightmapSeek);
	$('#heightmapFeed').val(g_HeigtmapFeed);
	$('#heightmapRetract').val(g_HeightmapRetract);

	$('#HeightmapMinLength').val(g_HeghtmapSettings.minSegmentLength);
	$('#HeightmapZThreshold').val(g_HeghtmapSettings.zThreshold);
	$('#HeightmapArcThreshold').val(g_HeghtmapSettings.arcThreshold);
	$('#HeightmapRaids').prop('checked', g_HeghtmapSettings.modifyRapids);

	$('#HeightmapAutoSize').prop('disabled', !object);
	if (g_bHeightmapDataValid)
		$('#hightmapChangeWarning').show();
}

function CubicInterpolation(z0, z1, z2, z3, d)
{
	return z1 + 0.5*d * (z2 - z0 + d * (2*z0 - 5*z1 + 4*z2 - z3 + d * (3*(z1 - z2) + z3 - z0)));
}

function ComputeHeightmapZ(x, y)
{
	if (g_HeightmapData == undefined)
		return 1;

	x -= g_HeightmapStart.x;
	y -= g_HeightmapStart.y;
	x = Math.max(Math.min(x, g_HeightmapSize.x), 0) * (g_HeightmapPointCount.x-1) / g_HeightmapSize.x; // [0..n-1]
	y = Math.max(Math.min(y, g_HeightmapSize.y), 0) * (g_HeightmapPointCount.y-1) / g_HeightmapSize.y; // [0..n-1]

	var ix1 = Math.floor(x);
	var ix0 = Math.max(ix1-1, 0);
	var ix2 = Math.min(ix1+1, g_HeightmapPointCount.x-1);
	var ix3 = Math.min(ix1+2, g_HeightmapPointCount.x-1);

	var iy1 = Math.floor(y);
	var iy0 = Math.max(iy1-1, 0);
	var iy2 = Math.min(iy1+1, g_HeightmapPointCount.y-1);
	var iy3 = Math.min(iy1+2, g_HeightmapPointCount.y-1);

	var dx = x - ix1;
	var dy = y - iy1;

	var row = g_HeightmapData[iy0];
	var z0 = CubicInterpolation(row[ix0], row[ix1], row[ix2], row[ix3], dx);
	row = g_HeightmapData[iy1];
	var z1 = CubicInterpolation(row[ix0], row[ix1], row[ix2], row[ix3], dx);
	row = g_HeightmapData[iy2];
	var z2 = CubicInterpolation(row[ix0], row[ix1], row[ix2], row[ix3], dx);
	row = g_HeightmapData[iy3];
	var z3 = CubicInterpolation(row[ix0], row[ix1], row[ix2], row[ix3], dx);

	return CubicInterpolation(z0, z1, z2, z3, dy);
}

function GenerateHeightmapMesh()
{
	ClearHeightmapMesh();
	g_HeightmapGeo = new THREE.Object3D();
	g_HeightmapGeo.name = "Heightmap";

	const subDivisionsX = 5;
	const subDivisionsY = 5;
	const subCellsX = (g_HeightmapPointCount.x - 1) * subDivisionsX;
	const subCellsY = (g_HeightmapPointCount.y - 1) * subDivisionsY;

	// create grid of vertices
	var dX = g_HeightmapSize.x / subCellsX;
	var dY = g_HeightmapSize.y / subCellsY;
	var grid = new Array(subCellsY + 1);
	for (var iy = 0; iy <= subCellsY; iy++)
	{
		var y = g_HeightmapStart.y + iy*dY;
		grid[iy] = new Array(subCellsX + 1);
		for (var ix = 0; ix <= subCellsX; ix++)
		{
			var x = g_HeightmapStart.x + ix*dX;
			grid[iy][ix] = new THREE.Vector3(x, y, ComputeHeightmapZ(x, y));
		}
	}

	// create the wireframe geometry
	var lineMtl1 = new THREE.LineBasicMaterial({color: PRIMARY_GRID_COLOR});
	var lineMtl2 = new THREE.LineBasicMaterial({color: SECONDARY_GRID_COLOR});
	for (var iy = 0; iy <= subCellsY; iy++)
	{
		var geo = new THREE.Geometry();
		geo.vertices = grid[iy];
		g_HeightmapGeo.add(new THREE.Line(geo, (iy%subDivisionsY == 0) ? lineMtl1 : lineMtl2));
	}

	for (var ix = 0; ix <= subCellsX; ix++)
	{
		var geo = new THREE.Geometry();
		for (var iy = 0; iy <= subCellsY; iy++)
		{
			geo.vertices.push(grid[iy][ix]);
		}

		g_HeightmapGeo.add(new THREE.Line(geo, (ix%subDivisionsX == 0) ? lineMtl1 : lineMtl2));
	}

	// create the mesh geometry for the faces
	var meshGeo = new THREE.BufferGeometry();

	var vertices = new Float32Array((subCellsX+1) * (subCellsY+1) * 3);
	var idx = 0;
	for (var iy = 0; iy <= subCellsY; iy++)
	{
		for (var ix = 0; ix <= subCellsX; ix++)
		{
			var point = grid[iy][ix];
			vertices[idx] = point.x;
			vertices[idx+1] = point.y;
			vertices[idx+2] = point.z;
			idx += 3;
		}
	}

	var indices = new Array(subCellsX * subCellsY * 6);
	idx = 0;
	for (var iy = 0; iy < subCellsY; iy++)
	{
		for (var ix = 0; ix < subCellsX; ix++)
		{
			indices[idx] = iy*(subCellsX+1) + ix;
			indices[idx + 1] = indices[idx] + 1;
			indices[idx + 2] = indices[idx] + subCellsX + 2;
			indices[idx + 3] = indices[idx];
			indices[idx + 4] = indices[idx + 2];
			indices[idx + 5] = indices[idx + 2] - 1;
			idx += 6;
		}
	}

	meshGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
	meshGeo.setIndex(indices);
	meshGeo.computeVertexNormals();

	const meshMtl = new THREE.MeshBasicMaterial({ color: FACE_COLOR, transparent: true, opacity: FACE_OPACITY });
	meshMtl.depthWrite = false;
	g_HeightmapGeo.add(new THREE.Mesh(meshGeo, meshMtl));
	workspace.add(g_HeightmapGeo);
}

function OnHeightmapSuccess()
{
	g_bHeightmapDataValid = true;
	ClearHeightmapMesh();
	ShowHeightmap(true);

	Metro.dialog.create({
		title: "<i class='fas fa-layer-group'></i> Heightmap",
		content: "The heightmap probing is completed.<br>You can now apply it to the current G-code or save it to a file.",
		clsDialog: 'dark',
		actions: [
			{
				caption: "OK",
				cls: "js-dialog-close",
				onclick: function() {}
			}
		],
	});
}

function ClearHeightmapData()
{
	g_HeightmapData = undefined;
	g_HeightmapDataZ0 = undefined;
	g_HeightmapPending = undefined;
	g_bHeightmapDataValid = false;
	ClearHeightmapMesh();
}

function OnProbeResult(probe)
{
	if (probe.state > 0)
	{
		var wx = Number(probe.x) - laststatus.machine.position.offset.x;
		var wy = Number(probe.y) - laststatus.machine.position.offset.y;
		if (g_HeightmapDataZ0 == undefined && Math.abs(wx - g_HeightmapAnchor.x) < 0.1 && Math.abs(wy - g_HeightmapAnchor.y) < 0.1)
		{
			g_HeightmapDataZ0 = Number(probe.z);
			return;
		}

		var ix = Math.round((wx-g_HeightmapStart.x) * (g_HeightmapPointCount.x-1) / g_HeightmapSize.x);
		var iy = Math.round((wy-g_HeightmapStart.y) * (g_HeightmapPointCount.y-1) / g_HeightmapSize.y);

		if (g_HeightmapDataZ0 != undefined &&
			ix >=0 && ix < g_HeightmapPointCount.x &&
			iy >=0 && iy < g_HeightmapPointCount.y &&
			g_HeightmapData[iy][ix] == undefined)
		{
			g_HeightmapData[iy][ix] = Number(probe.z) - g_HeightmapDataZ0;
			g_HeightmapPending--;
			if (g_HeightmapPending == 0)
			{
				socket.off('prbResult');
				OnHeightmapSuccess();
			}
		}
	}
}

function RunProbe()
{
	ShowHeightmap(false);
	ClearHeightmapMesh();
	ClearHeightmapData();
	g_HeightmapData = [];
	g_HeightmapPending = g_HeightmapPointCount.x * g_HeightmapPointCount.y;

	var gcode = "G0 G90 G21 X" + g_HeightmapAnchor.x.toFixed(3) + " Y" + g_HeightmapAnchor.y.toFixed(3) + "\n";
	gcode += "G38.2 G91 Z" + (-g_HeightmapSeek).toFixed(3) + " F" + g_HeigtmapFeed.toFixed(0) + "\n";
	gcode += "G0 Z" + g_HeightmapRetract.toFixed(3) + "\n";

	var direction = 1;
	var dX = g_HeightmapSize.x / (g_HeightmapPointCount.x - 1);
	var dY = g_HeightmapSize.y / (g_HeightmapPointCount.y - 1);
	var startX = g_HeightmapStart.x;
	var startY = g_HeightmapStart.y;
	for (var iy = 0; iy < g_HeightmapPointCount.y; iy++)
	{
		var y = startY + iy*dY;
		g_HeightmapData.push([]);
		for (var ix = 0; ix < g_HeightmapPointCount.x; ix++)
		{
			var x = startX + ix*dX*direction;

			gcode += "G0 G90 X" + x.toFixed(3) + " Y" + y.toFixed(3) + "\n";
			gcode += "G38.2 G91 Z" + (-g_HeightmapSeek).toFixed(3) + " F" + g_HeigtmapFeed.toFixed(0) + "\n";
			gcode += "G0 Z" + g_HeightmapRetract.toFixed(3) + "\n";
			g_HeightmapData[iy].push(undefined);
		}
		direction = -direction;
		startX = 2*g_HeightmapStart.x + g_HeightmapSize.x - startX;
	}

	socket.off('prbResult');
	socket.on('prbResult', OnProbeResult);
	socket.emit('runJob', {data: gcode, isJob: true, fileName: ""});
}

function ShowHeightmapError(error)
{
	Metro.dialog.create({
		clsDialog: 'dark',
		title: "<i class='fas fa-layer-group fg-red'></i> Heightmap Error",
		content: error,
		actions: [{
				caption: "Close",
				cls: "js-dialog-close alert",
				onclick: function() {}
			},
		]
	});
}

window.GenerateHeightmap = function()
{
	if (laststatus.comms.runStatus != "Idle" || laststatus.comms.connectionStatus != 2)
	{
		ShowHeightmapError("The machine needs to be connected and idle before creating a heightmap.");
		return;
	}
	if (Math.abs(g_HeightmapAnchor.x - laststatus.machine.position.work.x) > 5 ||
		Math.abs(g_HeightmapAnchor.y - laststatus.machine.position.work.y) > 5)
	{
		const error = `The probe is too far from the anchor point. Move the probe to the anchor position X=` +
			g_HeightmapAnchor.x.toFixed(2) + `mm, Y=` + g_HeightmapAnchor.y.toFixed(2) + `mm and up to ` +
			g_HeightmapSeek.toFixed(2) + `mm above the material, then try again.`;
		ShowHeightmapError(error);
		return;
	}

	Metro.dialog.create({
		clsDialog: 'dark',
		title: "<i class='fas fa-layer-group'></i> Generate Heightmap",
		content: "The measuring of the heightmap is about to begin.<br>Make sure the probe is connected and free to move above the surface.",
		actions: [
			{
				caption: "Continue",
				cls: "js-dialog-close success",
				onclick: RunProbe
			},
			{
				caption: "Cancel",
				cls: "js-dialog-close",
				onclick: function() {}
			},
		]
	});
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

function LoadHeightmap(file)
{
	try
	{
		var lines = file.split('\n');
		var config = lines[0].split(',').map(Number);
		if (config.length != 11)
		{
			throw new Error("Line 1 doesn't have the correct number of values. Expecting 11 numbers.");
		}

		var start = {x: config[0], y: config[1]};
		var size = {x: Math.max(config[2], 1), y: Math.max(config[3], 1)};
		var pointCount = {x: Math.max(Math.floor(config[4]), 2), y: Math.max(Math.floor(config[5]), 2)};
		var anchor = {x: config[6], y: config[7]};
		var seek = Math.max(config[8], 0.1);
		var feed = Math.max(config[9], 1);
		var retract = Math.max(config[10], 0.1);

		if (lines.length < pointCount.y + 1)
		{
			throw new Error("The file doesn't have the correct number of lines. Expecting " + (pointCount.y+1) + " lines.");
		}
		var data = [];
		for (var y = 0; y < pointCount.y; y++)
		{
			var row = lines[y+1].split(',').map(Number);
			row.splice(pointCount.x);
			if (row.length != pointCount.x)
			{
				throw new Error("Line " + (y+2) + " doesn't have the correct number of values. Expecting " + pointCount.x + " numbers.");
			}
			data.push(row);
		}

		g_HeightmapData = data;
		g_HeightmapStart = start;
		g_HeightmapSize = size;
		g_HeightmapPointCount = pointCount;
		g_HeightmapAnchor = anchor;
		g_HeightmapSeek = seek;
		g_HeigtmapFeed = feed;
		g_HeightmapRetract = retract;
		g_bHeightmapDataValid = true;
	}
	catch (error)
	{
		FileReadError(error.message);
		return;
	}

	ClearHeightmapMesh();
	ShowHeightmap(true);
}

function LoadHeightmapOld(event)
{
	var files = event.target.files || event.dataTransfer.files;
	var file = files[0];
	document.getElementById('loadHeightmapFile').value = '';

	if (file)
	{
		var r = new FileReader();
		r.readAsText(file);
		r.onload = function()
		{
			LoadHeightmap(this.result);
		}
		r.onerror = function()
		{
			FileReadError(r.error.message);
		}
	}
}

window.LoadHeightmapNew = function()
{
	var loadFileParams = {
		id: "heightmap",
		title: "Load Heightmap",
		filters: heightmapFilters,
	};

	invokeOpenDialogReadFile(loadFileParams).then(({err, data}) =>
	{
		if (err)
			FileReadError(err);
		else
			LoadHeightmap(data);
	});
}

window.SaveHeightmap = function()
{
	var heightmapTxt = g_HeightmapStart.x.toFixed(2) + "," + g_HeightmapStart.y.toFixed(2);
	heightmapTxt += "," + g_HeightmapSize.x.toFixed(2) + "," + g_HeightmapSize.y.toFixed(2);
	heightmapTxt += "," + g_HeightmapPointCount.x.toFixed(0) + "," + g_HeightmapPointCount.y.toFixed(0);
	heightmapTxt += "," + g_HeightmapAnchor.x.toFixed(2) + "," + g_HeightmapAnchor.y.toFixed(2);
	heightmapTxt += "," + g_HeightmapSeek.toFixed(2) + "," + g_HeigtmapFeed.toFixed(0) + "," + g_HeightmapRetract.toFixed(0) + "\n";

	for (var y = 0; y < g_HeightmapPointCount.y; y++)
	{
		for (var x = 0; x < g_HeightmapPointCount.x-1; x++)
		{
			heightmapTxt += g_HeightmapData[y][x].toFixed(2) + ",";
		}
		heightmapTxt += g_HeightmapData[y][g_HeightmapPointCount.x-1].toFixed(2) + "\n";
	}

	var blob = new Blob([heightmapTxt], {type: "plain/text"});
	var name = 'heightmap';
	if (loadedFileName != "")
	{
		name += '-' + loadedFileName.split('.')[0];
	}

	if (typeof invokeSaveAsDialogNew == 'function')
	{
		var saveFileParams = {
			id: "heightmap",
			title: "Save Heightmap",
			filters: heightmapFilters,
			fileName: name + '.csv'
		};
		invokeSaveAsDialogNew(blob, saveFileParams);
	}
	else
	{
		invokeSaveAsDialog(blob, name + '.csv');
	}
}

window.ClearHeightmap = function()
{
	ClearHeightmapData();
}

function ClearGCodeMarkers()
{
	var lineCount = editor.session.getLength();
	while (lineCount > 0 && editor.session.getLine(lineCount - 1).length == 0)
		lineCount--;

	var gcode = "";
	for (var lineIdx = 0; lineIdx < lineCount; lineIdx++)
	{
		var currentLine = editor.session.getLine(lineIdx);
		if (currentLine == HEIGHTMAP_GCODE_HEADER1 ||currentLine == HEIGHTMAP_GCODE_HEADER2 || currentLine.endsWith(HEIGHTMAP_GCODE_END_MARKER))
			continue;

		if (currentLine.startsWith(HEIGHTMAP_GCODE_START_MARKER))
			currentLine = currentLine.slice(HEIGHTMAP_GCODE_START_MARKER.length);

		gcode += currentLine + "\n";
	}

	return gcode;
}

window.RevertGCode = function()
{
	const gcode = ClearGCodeMarkers();
	editor.session.setValue("");
	editor.session.setValue(gcode);
	parseGcodeInWebWorker(gcode);
}

function ParseGCode()
{
	var moveType = 1; // 0 or 1 (start with 1 for safety)
	var arcPlane = undefined; // 17, 18 or 19
	var units = undefined; // 20 or 21
	var absolute = undefined; // 90 or 91
	var lastX = undefined;
	var lastY = undefined;
	var lastZ = undefined;
	var previousPos = undefined;
	var unitChangeLine = undefined;

	var lineCount = editor.session.getLength();
	while (lineCount > 0 && editor.session.getLine(lineCount - 1).length == 0)
		lineCount--;

	var lineInfos = Array(lineCount);

	for (var lineIdx = 0; lineIdx < lineCount; lineIdx++)
	{
		var currentLine = editor.session.getLine(lineIdx);
		var lineInfo = {text: currentLine};
		lineInfos[lineIdx] = lineInfo;
		currentLine = currentLine.split(/[;(]/); // Remove everything after ; or ( = comment
		var line = currentLine[0];
		if (line.length == 0) continue;
		line = line.toUpperCase();

		const Xindex = line.indexOf("X");
		const Yindex = line.indexOf("Y");
		const Zindex = line.indexOf("Z");
		const Findex = line.indexOf("F");

		var isMove = Xindex >=0 || Yindex >=0 || Zindex >=0;

		// find G codes
		var gline = line;
		while (true)
		{
			var pos = gline.indexOf('G');
			if (pos == -1) break;
			gline = gline.slice(pos + 1);
			var g = parseInt(gline);
			if (g == 0) moveType = 0;
			if (g == 1 || g == 2 || g == 3) moveType = g;
			if (g == 90 || g == 91) absolute = g;
			if (g == 20 || g == 21)
			{
				if (units == undefined)
					units = g;
				else
					unitChangeLine = lineIdx; // record the second change to the units, complain if there is a move command later
			}
			if (g == 17 || g == 18 || g == 19) arcPlane = g;
			if (g == 28 || g == 30) isMove = false; // these commands contain coordinates but are not relevant moves

			if (g == 90 && parseFloat(gline) == 90.1)
			{
				ShowHeightmapError("The heightmapper does not support absolute IJK values " + (lineIdx+1) + ".");
				return;
			}
		}

		var Zlen = 0;
		if (isMove)
		{
			if (units == undefined)
			{
				ShowHeightmapError("The heightmapper can't determine the units for line " + (lineIdx+1) + ". No G20 or G21 were found in the preceeding lines.");
				return;
			}
			if (unitChangeLine != undefined)
			{
				ShowHeightmapError("The heightmapper doesn't support changing units in the middle of the G-code. Line " + (unitChangeLine+1) + ".");
				return;
			}
			if (absolute == undefined || (absolute == 91 && ((Xindex >= 0 && lastX == undefined) || (Yindex >= 0 && lastY == undefined) || (Zindex >= 0 && lastZ == undefined))))
			{
				ShowHeightmapError("The heightmapper can't determine the absolute coordinates for line " + (lineIdx+1) + ". No absolute move was found in the preceeding lines.");
				return;
			}
			if ((moveType == 2 || moveType == 3) && arcPlane == undefined)
			{
				ShowHeightmapError("The heightmapper can't determine the arc orientation for line " + (lineIdx+1) + ". No G17, G18 or G19 were found in the preceeding lines.");
				return;
			}

			if (Xindex >= 0)
			{
				const x = parseFloat(line.slice(Xindex + 1));
				if (absolute == 90)
					lastX = x;
				else
					lastX += x;
			}
			if (Yindex >= 0)
			{
				const y = parseFloat(line.slice(Yindex + 1));
				if (absolute == 90)
					lastY = y;
				else
					lastY += y;
			}

			if (Zindex >= 0)
			{
				const z = parseFloat(line.slice(Zindex + 1));
				if (absolute == 90)
					lastZ = z;
				else
					lastZ += z;
			}

			if (lastX != undefined && lastY != undefined && lastZ != undefined)
			{
				if (moveType == 2 || moveType == 3)
				{
					if (previousPos == undefined)
					{
						ShowHeightmapError("The heightmapper can't determine the arc start position for line " + (lineIdx+1) + ".");
						return;
					}
					const Rindex = line.indexOf("R");

					if (Rindex >= 0)
					{
						lineInfo.arc = {plane: arcPlane, r: parseFloat(line.slice(Rindex + 1))};
					}
					else
					{
						const Iindex = line.indexOf("I");
						const Jindex = line.indexOf("J");
						const Kindex = line.indexOf("K");
						if (arcPlane == 17)
						{
							if (Iindex == -1 || Jindex == -1)
							{
								ShowHeightmapError("The heightmapper requires XY arcs to have explicit I and J or R parameters. Line " + (lineIdx+1) + ".");
								return;
							}
							lineInfo.arc = {plane: arcPlane, i: parseFloat(line.slice(Iindex + 1)), j: parseFloat(line.slice(Jindex + 1))};
						}
						if (arcPlane == 18)
						{
							if (Iindex == -1 || Kindex == -1)
							{
								ShowHeightmapError("The heightmapper requires XZ arcs to have explicit I and K or R parameters. Line " + (lineIdx+1) + ".");
								return;
							}
							lineInfo.arc = {plane: arcPlane, i: parseFloat(line.slice(Iindex + 1)), k: parseFloat(line.slice(Kindex + 1))};
						}
						if (arcPlane == 19)
						{
							if (Jindex == -1 || Kindex == -1)
							{
								ShowHeightmapError("The heightmapper requires YZ arcs to have explicit J and K or R parameters. Line " + (lineIdx+1) + ".");
								return;
							}
							lineInfo.arc = {plane: arcPlane, j: parseFloat(line.slice(Jindex + 1)), k: parseFloat(line.slice(Kindex + 1))};
						}
					}
				}
				lineInfo.isMove = true;
				lineInfo.moveType = moveType;
				if (previousPos)
					lineInfo.start = {x: previousPos.x, y: previousPos.y, z: previousPos.z};
				lineInfo.end = {x: lastX, y: lastY, z: lastZ};
				previousPos = {x: lastX, y: lastY, z: lastZ};
			}

			if (Findex >= 0)
			{
				var Flen = 0;
				for (var i = Findex + 1; i < line.length; i++, Flen++)
				{
					const c = line[i];
					if (c != '.' && (c < '0' || c > '9'))
						break;
				}
				lineInfo.Frange = {start: Findex, end: Findex + Flen + 1};
			}
		}
	}

	return {lineInfos: lineInfos, units: units};
}

function ComputeHeightmapNewZ(x, y, z, units)
{
	var scale = units == 20 ? 25.4 : 1;
	
	return z + ComputeHeightmapZ(x * scale, y * scale) / scale;
}

function SubdivideSamples(samples, first, last, zThreshold)
{
	// assumptions:
	//   * samples[first] and samples[last] have z0=0
	var maxdz = zThreshold;
	var maxi = undefined;
	for (var i = first + 1; i < last; i++)
	{
		const dz = Math.abs(samples[i].zt - samples[i].z);
		if (dz > maxdz)
		{
			maxdz = dz;
			maxi = i;
		}
	}

	if (maxi == undefined)
		return; // all less than zThreshold

	var stepz = (samples[maxi].zt - samples[maxi].z) / (maxi - first);
	for (var i = first + 1; i < maxi; i++)
		samples[i].z += stepz * (i - first);

	stepz = (samples[maxi].zt - samples[maxi].z) / (last - maxi);
	for (var i = last - 1; i > maxi; i--)
		samples[i].z += stepz * (last - i);

	samples[maxi].z = samples[maxi].zt;
	samples[maxi].used = true;

	SubdivideSamples(samples, first, maxi, zThreshold);
	SubdivideSamples(samples, maxi, last, zThreshold);
}

function GenerateLineSegments(x1, y1, z1, x2, y2, z2, minSegmentLength, zThreshold, units)
{
	const z1h = ComputeHeightmapNewZ(x1, y1, z1, units);
	const z2h = ComputeHeightmapNewZ(x2, y2, z2, units);
	const dx = x2 - x1;
	const dy = y2 - y1;
	const length = Math.sqrt(dx*dx + dy*dy);
	const count = Math.max(Math.ceil(length / minSegmentLength), 1);

	var gcode = "";

	if (count == 1)
	{
		// special case if splitting is not required
		var space = "";
		if (x2 != x1)
		{
			gcode += "X" + parseFloat(x2.toFixed(3));
			space = " ";
		}
		if (y2 != y1)
		{
			gcode += space + "Y" + parseFloat(y2.toFixed(3));
			space = " ";
		}
		if (z2h != z1h)
		{
			gcode += space + "Z" + parseFloat(z2h.toFixed(3));
		}

		gcode += HEIGHTMAP_GCODE_END_MARKER + "\n";
		return gcode;
	}

	const dz = z2 - z1;
	const dzh = z2h - z1h;
	var samples = new Array(count + 1);
	for (var i = 0; i <= count; i++)
	{
		const t = i / count;
		const x = x1 + dx * t;
		const y = y1 + dy * t;
		const z = z1h + dzh * t; // interpolated adjusted Z
		const zt = ComputeHeightmapNewZ(x, y, z1 + dz * t, units); // target Z
		samples[i] = {x: x, y: y, z: z, zt: zt, used: false};
	}

	samples[count].used = true;

	if (count > 1)
		SubdivideSamples(samples, 0, count, zThreshold);

	var lastx = x1, lasty = y1, lastz = samples[0].z;
	for (var i = 1; i <= count; i++)
	{
		var sample = samples[i];
		if (!sample.used) continue;

		var space = "";
		if (sample.x != lastx)
		{
			gcode += "X" + parseFloat(sample.x.toFixed(3));
			space = " ";
			lastx = sample.x;
		}
		if (sample.y != lasty)
		{
			gcode += space + "Y" + parseFloat(sample.y.toFixed(3));
			space = " ";
			lasty = sample.y;
		}
		if (sample.z != lastz)
		{
			gcode += space + "Z" + parseFloat(sample.z.toFixed(3));
			lastz = sample.z;
		}

		gcode += HEIGHTMAP_GCODE_END_MARKER + "\n";
	}

	return gcode;
}

function DecodeArc(x1, y1, x2, y2, moveType, r, i, j, units)
{
	var arc = {};
	var delta = {x: x2 - x1, y: y2 - y1};
	if (r != undefined)
	{
		const halfSq = (delta.x*delta.x + delta.y*delta.y) / 4;
		arc.radius = r;
		const distSq = r * r - halfSq;
		if (distSq < 0)
		{
			arc.center = {x: (x1 + x2) / 2, y: (y1 + y2) / 2}; // invalid radius, try best guess
		}
		else
		{
			var scale = Math.sqrt(distSq / halfSq);
			if ((moveType == 3 ? arc.radius : -arc.radius) < 0) scale = -scale;
			arc.center = {x: (x1 + x2 - delta.y*scale) / 2, y: (y1 + y2 + delta.x*scale) / 2};
		}
	}
	else
	{
		arc.center = {x: x1 + i, y: y1 + j};
		arc.radius = Math.sqrt(i*i + j*j);
	}

	arc.angle1 = Math.atan2(y1 - arc.center.y, x1 - arc.center.x);
	arc.angle2 = Math.atan2(y2 - arc.center.y, x2 - arc.center.x);
	var distMM = Math.sqrt(delta.x*delta.x + delta.y*delta.y);
	if (units == 20) distMM *= 25.4;
	if (distMM < 0.01)
	{
		// the two points are very close, draw a full circle
		if (moveType == 2)
			arc.angle2 = arc.angle1 - 2*Math.PI;
		if (moveType == 3)
			arc.angle2 = arc.angle1 + 2*Math.PI;
	}
	else
	{
		// make sure angles are ordered
		if (moveType == 2 && arc.angle1 < arc.angle2)
			arc.angle1 += 2*Math.PI;
		if (moveType == 3 && arc.angle2 < arc.angle1)
			arc.angle2 += 2*Math.PI;
	}

	return arc;
}

window.ApplyHeightmap = function()
{
	var editorDirty = false;
	if (editor.session.getLine(0) == HEIGHTMAP_GCODE_HEADER1)
	{
		const gcode = ClearGCodeMarkers();
		editor.session.setValue("");
		editor.session.setValue(gcode);
		editorDirty = true;
	}

	// Parse existing G-code
	var parseResult = ParseGCode();
	if (parseResult == undefined)
	{
		if (editorDirty)
		{
			parseGcodeInWebWorker(gcode);
		}
		return;
	}

	const lineInfos = parseResult.lineInfos;
	const units = parseResult.units;

	// Generate new G-code
	var gcode = HEIGHTMAP_GCODE_HEADER1 + "\n" + HEIGHTMAP_GCODE_HEADER2 + "\n";
	var moveType = undefined;
	var minSegmentLength = g_HeghtmapSettings.minSegmentLength;
	var zThreshold = g_HeghtmapSettings.zThreshold;
	var arcThreshold = g_HeghtmapSettings.arcThreshold;
	if (units == 20)
	{
		minSegmentLength /= 25.4;
		zThreshold /= 25.4;
		arcThreshold /= 25.4;
	}

	for (var infoIdx = 0; infoIdx < lineInfos.length; infoIdx++)
	{
		var lineInfo = lineInfos[infoIdx];
		if (!lineInfo.isMove || (lineInfo.moveType == 0 && !g_HeghtmapSettings.modifyRapids))
		{
			moveType = undefined;
			gcode += lineInfo.text + "\n";
			continue;
		}

		gcode += HEIGHTMAP_GCODE_START_MARKER + lineInfo.text + "\n";
		if (lineInfo.Frange != undefined)
		{
			gcode += lineInfo.text.slice(lineInfo.Frange.start, lineInfo.Frange.end) + HEIGHTMAP_GCODE_END_MARKER + "\n";
		}

		if (lineInfo.start == undefined)
		{
			// unknown start: just tweak Z (moveType must be 0 or 1)
			const z = ComputeHeightmapNewZ(lineInfo.end.x, lineInfo.end.y, lineInfo.end.z, units);
			gcode += "G" + lineInfo.moveType + " X" + parseFloat(lineInfo.end.x.toFixed(3)) +
				" Y" + parseFloat(lineInfo.end.y.toFixed(3)) +
				" Z" + parseFloat(z.toFixed(3)) + HEIGHTMAP_GCODE_END_MARKER + "\n";
			moveType = undefined;
			continue;
		}

		if (lineInfo.moveType == 0 || lineInfo.moveType == 1)
		{
			if (lineInfo.moveType != moveType)
			{
				moveType = lineInfo.moveType;
				gcode += "G" + moveType + " ";
			}

			// linear move: split into smaller segments if necessary
			gcode += GenerateLineSegments(
				lineInfo.start.x, lineInfo.start.y, lineInfo.start.z,
				lineInfo.end.x, lineInfo.end.y, lineInfo.end.z,
				minSegmentLength, zThreshold, units);
			continue;
		}

		if (lineInfo.moveType == 2 || lineInfo.moveType == 3)
		{
			// arc move: subdivide into straight segments, then treat as linear moves
			var arc;
			var az1, az2; // "Z" here means the third axis, perpendicular to the arc plane
			switch (lineInfo.arc.plane)
			{
				case 17: // XY
					arc = DecodeArc(lineInfo.start.x, lineInfo.start.y,
						lineInfo.end.x, lineInfo.end.y, lineInfo.moveType,
						lineInfo.arc.r, lineInfo.arc.i, lineInfo.arc.j, units);
					az1 = lineInfo.start.z;
					az2 = lineInfo.end.z;
					break;
				case 18: // ZX
					arc = DecodeArc(lineInfo.start.z, lineInfo.start.x,
						lineInfo.end.z, lineInfo.end.x, lineInfo.moveType,
						lineInfo.arc.r, lineInfo.arc.k, lineInfo.arc.i, units);
					az1 = lineInfo.start.y;
					az2 = lineInfo.end.y;
					break;
				case 19: // YZ
					arc = DecodeArc(lineInfo.start.y, lineInfo.start.z,
						lineInfo.end.y, lineInfo.end.z, lineInfo.moveType,
						lineInfo.arc.r, lineInfo.arc.j, lineInfo.arc.k, units);
					az1 = lineInfo.start.x;
					az2 = lineInfo.end.x;
					break;
			}

			// optimization: preserve small arcs in the XY plane
			if (lineInfo.arc.plane == 17 && arc.radius * Math.abs(arc.angle2-arc.angle1) < minSegmentLength)
			{
				const z = ComputeHeightmapNewZ(lineInfo.end.x, lineInfo.end.y, lineInfo.end.z, units);
				var line = "G" + lineInfo.moveType + " G17 X" + Number(lineInfo.end.x.toFixed(3)) +
					" Y" + Number(lineInfo.end.y.toFixed(3)) +
					" Z" + Number(z.toFixed(3));
				if (lineInfo.arc.r != undefined)
					line += " R" + Number(lineInfo.arc.r.toFixed(3));
				else
					line += " I" + Number(lineInfo.arc.i.toFixed(3)) + " J" + Number(lineInfo.arc.j.toFixed(3));
				gcode += line + HEIGHTMAP_GCODE_END_MARKER + "\n";
				moveType = undefined;
				continue;
			}

			var angleSteps = 1;
			if (arc.radius > arcThreshold)
			{
				var maxAngle = 2 * Math.acos(1 - arcThreshold / arc.radius);
				angleSteps = Math.max(Math.ceil(Math.abs(arc.angle2-arc.angle1) / maxAngle), 1);
			}

			// generate arc gcode
			if (moveType != 1)
			{
				moveType = 1;
				gcode += "G1 ";
			}

			var x = lineInfo.start.x;
			var y = lineInfo.start.y;
			var z = lineInfo.start.z;
			for (var i = 1; i <= angleSteps; i++)
			{
				const angle = (arc.angle1 * (angleSteps-i) + arc.angle2 * i) / angleSteps;
				const ax = arc.center.x + Math.cos(angle) * arc.radius;
				const ay = arc.center.y + Math.sin(angle) * arc.radius;
				const az = (az1 * (angleSteps-i) + az2 * i) / angleSteps;

				switch (lineInfo.arc.plane)
				{
					case 17: // XY
						gcode += GenerateLineSegments(x, y, z, ax, ay, az,
							minSegmentLength, zThreshold, units);
						x = ax; y = ay; z = az;
						break;

					case 18: // ZX
						gcode += GenerateLineSegments(x, y, z, ay, az, ax,
							minSegmentLength, zThreshold, units);
						x = ay; y = az; z = ax;
						break;

					case 19: // YZ
						gcode += GenerateLineSegments(x, y, z, az, ax, ay,
							minSegmentLength, zThreshold, units);
						x = az; y = ax; z = ay;
						break;
				}
			}
		}
	}

	editor.session.setValue("");
	editor.session.setValue(gcode);
	parseGcodeInWebWorker(gcode);
}

function EnableMenuItem(name, state)
{
	if (state)
		$(name).removeClass("disabled");
	else
		$(name).addClass("disabled");
}

function CheckMenuItem(name, state)
{
	if (state)
		$(name).addClass("checked");
	else
		$(name).removeClass("checked");
}

window.UpdateHeightmapMenu =function()
{
	EnableMenuItem('#editHeightmapSettings', laststatus.comms.connectionStatus != 3);
	EnableMenuItem('#generateHeightmap', laststatus.comms.runStatus == "Idle" && laststatus.comms.connectionStatus == 2);

	EnableMenuItem('#saveHeightmap', g_bHeightmapDataValid);
	EnableMenuItem('#clearHeightmap', g_bHeightmapDataValid);

	EnableMenuItem('#applyHeightmap', g_bHeightmapDataValid && laststatus.comms.connectionStatus != 3);
	EnableMenuItem('#showHeightmap', g_bHeightmapDataValid);

	if (typeof viewSettings == 'object')
		$('#heightmapShowToolpath').hide(); // no need for this menu item if the view settings are already supporting it
	else
	{
		EnableMenuItem('#heightmapShowToolpath', object);
		CheckMenuItem('#heightmapShowToolpath', object && object.visible);
	}

	EnableMenuItem('#revertGCode', editor.session.getLine(0) == HEIGHTMAP_GCODE_HEADER1 && laststatus.comms.connectionStatus != 3);
}

const heightmapBtnHtml1a = `<div class="pos-relative" style="display:inline-block; margin: 5px 5px 6px 9px;">
	<button id="heightmapBtn" onclick="UpdateHeightmapMenu()" class="button dark dropdown-toggle"><i class="fas fa-layer-group"></i> Heightmap</button>
	<ul class="ribbon-dropdown drop-up" id="heightmapMenu" data-role="dropdown" role="menu" style="margin-bottom:5px;">`;

const heightmapBtnHtml1b = `<div>
	<button id="heightmapBtn" onclick="UpdateHeightmapMenu()" style="margin-left:3px;" class="button dark dropdown-toggle"><i class="fas fa-layer-group"></i> Heightmap</button>
	<ul class="ribbon-dropdown drop-down" id="heightmapMenu" data-role="dropdown" role="menu">`;

const heightmapBtnHtml2 = `
		<style>#heightmapMenu > li {text-align: left;}</style>
		<li onclick="EditHeightmapSettings()" id="editHeightmapSettings"><a href="#">Heightmap Settings</a></li>
		<li class="divider"></li>
		<li onclick="GenerateHeightmap()" id="generateHeightmap"><a href="#">Generate Heightmap</a></li>
		<li class="btn-file" title="" id="loadHeightmapOld"><a href="#"><input class="btn-file" id="loadHeightmapFile" type="file" accept=".csv" />Load Heightmap</a></li>
		<li onclick="LoadHeightmapNew();" id="loadHeightmapNew"><a href="#">Load Heightmap</a></li>
		<li onclick="SaveHeightmap()" id="saveHeightmap"><a href="#">Save Heightmap</a></li>
		<li onclick="ClearHeightmap()" id="clearHeightmap"><a href="#">Clear Heightmap</a></li>
		<li class="divider"></li>
		<li onclick="ApplyHeightmap()" id="applyHeightmap"><a href="#">Apply Heightmap</a></li>
		<li onclick="RevertGCode()" id="revertGCode" onclick="RevertGCode()"><a href="#">Revert G-code changes</a></li>
		<li class="divider"></li>
		<li title="Show/hide the heightmap in the 3D view" onclick="ShowHeightmap()" id="showHeightmap"><a href="#">Show Heightmap</a></li>
		<li title="Show/hide the toolpath in the 3D view" onclick="if (object) object.visible = !object.visible" id="heightmapShowToolpath"><a href="#">Show Toolpath</a></li>
	</ul>
</div>
`;

$(document).ready(function()
{
	CleanupOldVersion();

	if ($('#renderToolbar').length == 0)
	{
		$('#resetViewBtn').after(heightmapBtnHtml1a + heightmapBtnHtml2);
	}
	else
	{
		$('#renderToolbar').append(heightmapBtnHtml1b + heightmapBtnHtml2);
	}

	if (typeof invokeOpenDialog == 'function')
	{
		$('#loadHeightmapOld').remove();
	}
	else
	{
		$('#loadHeightmapNew').remove();
		$('#loadHeightmapFile').on('change', LoadHeightmapOld);
	}

	var settings = JSON.parse(localStorage.getItem("HeightmapSettings"));
	if (settings)
	{
		for (var prop in settings)
		{
			if (prop in g_HeghtmapSettings && typeof(settings[prop]) == typeof(g_HeghtmapSettings[prop]))
			{
				g_HeghtmapSettings[prop] = settings[prop];
			}
		}
	}
});
