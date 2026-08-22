# OpenBuilds CONTROL
OpenBuilds CONTROL - Grbl Host / Interface for all CNC style machines running Grbl

This is a fork by Ivo Beltchev. Notable changes:
* Remembers the last used COM port and auto-selects it on startup
* Added an option to reload the last gcode file
* Fix for dragging the slider with the mouse (bug in the external Metro UI library)
* Fix for a bug in the Surfacing Wizard, which was skipping the last row
* Added an option to the Surfacing Wizard to extend the area by the tool radius
* Doesn't reset the "recently homed" status for errors and alerts that don't invalidate the machine position
* Allow clearing the key assignment in the keyboard shortcut editor and the macro editor
* Added many useful macros in the [Useful Macros folder](UsefulMacros/UsefulMacros.md)

Additionally, the ivobe/custom branch has a few more changes that I use in my own build:
* Converted to a plain Windows app - no auto-start, no tray icon
* Reduced the millimeter precision in the DRO to 2 decimals and improved the rounding algorithm
* Made the "Advanced" tab in Grbl Settings selected by default

## Download

#### Latest Version
Click to download latest version:  [![Latest Version](https://img.shields.io/github/package-json/v/openbuilds/openbuilds-control.svg)](https://github.com/OpenBuilds/OpenBuilds-CONTROL/releases/latest)

#### Older Versions
Click to see all past releases:  [![Downloads](https://img.shields.io/github/downloads/openbuilds/sw-machine-drivers/total.svg)](https://github.com/OpenBuilds/OpenBuilds-CONTROL/releases)

# Development:

### Build Status (Windows, Linux, Mac):
[![Build/release](https://github.com/OpenBuilds/OpenBuilds-CONTROL/actions/workflows/build.yml/badge.svg)](https://github.com/OpenBuilds/OpenBuilds-CONTROL/actions/workflows/build.yml)

![Screenshot](https://raw.githubusercontent.com/OpenBuilds/OpenBuilds-CONTROL/master/docs/control.PNG)
