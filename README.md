# OpenBuilds CONTROL
OpenBuilds CONTROL - Grbl Host / Interface for all CNC style machines running Grbl

This is a fork by Ivo Beltchev with multiple improvements.

### Workflow

* New option to reload the last gcode file
* More reliable jogging features, better compatibilty with different firmware and homing settings
* Corrected the math and improved the safety of the "goto zero" buttons
* Doesn't reset the "recently homed" status for errors and alerts that don't invalidate the machine position

### User Interface

* **Windows only:** A setting to disable the autostart and the tray icon, making it behave like a regular Windows app
* Allow clearing the key assignment in the keyboard shortcut editor and the macro editor
* Fix for dragging sliders with the mouse (bug in the external Metro UI library)

### 3D View

* Updated the 3D view to properly handle arcs in the XZ and YZ planes
* Fixed the orbiting controls rotation axis
* Added playback controls to the simulation and fixed many bugs
* Fixed the wrong bounding box for the machine area
* Fixed the grid alignment and sizing
* Fixed GPU memory leaks

### Grbl Settings Editor

* The "Advanced" tab is selected by default because it is more useful for non-OpenBuilds customers
* Fixed the broken tooltips for the setting descriptions
* Fixed bugs in the backup feature that would corrupt certain settings, especially for GrblHAL
* Added more known GrblHAL settings and updated wrong descriptions
* Added support for a 4th axis in settings $3 and $23

### Surfacing Wizard

* Fix for a bug in the Surfacing Wizard, which was skipping the last row
* New option to extend the surfaced area by the tool radius

### Useful Macros

The Javascript macros and the open UI architecture of OpenBuilds make it easy to extend it with custom functionality.

Over the years I have created multiple useful macros.
You can find them in the [Useful Macros folder](UsefulMacros/UsefulMacros.md).

Most of them are compatible with the stock software.
The most notable examples are:

* Macro manager that lets you organize macros into groups
* Heightmap support, similar to the one in Candle
* Disable the Z jog buttons for large step sizes
* Remove the dropdown from the file open button


## Download the updated software

I plan to publish an installer for the updated version. Few caveats:

* It is only for Windows. I don't have the skills or the hardware to support other OSes
* The binaries are not signed. Signing certificates are very expensive
* The version is still 1.0.390 like the original software. You will need to manually uninstall the old build first

## Download the original software

#### Latest Version
Click to download latest version:  [![Latest Version](https://img.shields.io/github/package-json/v/openbuilds/openbuilds-control.svg)](https://github.com/OpenBuilds/OpenBuilds-CONTROL/releases/latest)

#### Older Versions
Click to see all past releases:  [![Downloads](https://img.shields.io/github/downloads/openbuilds/sw-machine-drivers/total.svg)](https://github.com/OpenBuilds/OpenBuilds-CONTROL/releases)

# Development:

### Build Status (Windows, Linux, Mac):
[![Build/release](https://github.com/OpenBuilds/OpenBuilds-CONTROL/actions/workflows/build.yml/badge.svg)](https://github.com/OpenBuilds/OpenBuilds-CONTROL/actions/workflows/build.yml)

![Screenshot](https://raw.githubusercontent.com/OpenBuilds/OpenBuilds-CONTROL/master/docs/control.PNG)
