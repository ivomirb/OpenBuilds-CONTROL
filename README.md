# OpenBuilds CONTROL
OpenBuilds CONTROL - Grbl Host / Interface for all CNC style machines running Grbl

This is a fork by Ivo Beltchev with multiple improvements.

### Workflow

* Ability to view and set machine coordinates
* Stores a history of work origins and allows for rolling back to a previous one
* Corrected the math and improved the safety of the "goto zero" buttons
* More reliable and safe jogging features, more compatible with a variety of homing settings
* The Pause and Stop buttons remain available until the very end of the job
* While the job is paused, the Tool Off button can stop the spindle. It will resume automatically
* A new setting to insert a delay for a few seconds after the spindle starts up
* Doesn't reset the "recently homed" status for errors and alerts that don't invalidate the machine position
* A new setting to hide the 4th axis controls if the controller supports it but it is not used
* The "Recover from line" feature is more reliable
* The homing button prevents accidental homing, and has a menu for homing a single axis if the hardware supports it

### User Interface

* Removed the dropdown menu from the file open button to save a click
* New button to reload the current G-code file or load from a list of recent files
* A new setting to disable the autostart and the tray icon, making it behave like a regular desktop app
* Allow clearing the key assignment in the keyboard shortcut editor and the macro editor
* The dialogs for opening and saving files have independent default directories for G-code, macros and grbl settings
* The position of the main window is preserved between runs
* Fix for dragging sliders with the mouse
* Improved readability for Light and Dark themes

### 3D View

* Updated the 3D view to properly handle arcs in the XZ and YZ planes
* Fixed the orbiting controls rotation axis
* Added playback controls to the simulation and fixed many bugs
* Fixed the wrong bounding box for the machine area
* Fixed the grid alignment and sizing
* Optimized memory usage to allow for previewing larger files
* Fixed GPU memory leaks

### Grbl Settings Editor

* The "Advanced" tab is selected by default because it is more useful for non-OpenBuilds customers
* Added a new option to view only the modified settings, and buttons to revert each change
* Fixed a bug where using the search filter loses all unsaved changes
* Fixed the broken tooltips for the setting descriptions
* Fixed bugs in the backup feature that would corrupt certain settings, especially for GrblHAL
* Added more known GrblHAL settings and updated wrong descriptions
* Added support for a 4th axis in settings $3 and $23

### Surfacing Wizard

* Fix for a bug in the Surfacing Wizard, which was skipping the last row
* New option to extend the surfaced area by the tool radius

### Macro Management

* Added ability to organize macros into groups
* Added menu command to back up all macros to a single file
* Added menu command to create a new macro from existing G-code or JavaScript file
* Added ability to automatically reload JavaScript macros from external files in development mode
* Enabled security isolation measures to prevent scripts from accessing the operating system

### Heightmap Tool

The heightmap tool works similarly to the one in Candle.
It probes the height at points on a grid and modifes the G-code to follow the surface.
The heightmap can be saved to a CSV file to be edited by hand.

### Useful Macros

The Javascript macros and the open UI architecture of OpenBuilds make it easy to extend it with custom functionality.

Over the years I have created multiple useful macros.
You can find them in the [Useful Macros folder](UsefulMacros/UsefulMacros.md).

Some are standalone versions of the new features, which can be added to the original software if you don't want to upgrade

* Macro manager: Allows organizing macros into groups, export and import all macros into a single file
* Heightmap: Probes the height at points on a grid and modifes the G-code to follow the surface
* Smart Home: Prevents accidental homing and allows homing single axis if supported
* Open File: Removes the dropdown from the file open button

Others are new features that can be added to either this version or the original software

* Disable Z: Disables the Z jog buttons for large step sizes (a safety feature)
* Measure Z: Measures the height of a surface without changing the work zero
* Find Hole Center: Fast and precise method for finding the center of a circular or rectangular hole

## Download

At this time there is no binary build available for download.

You can get the original OpenBuilds software from here: https://github.com/OpenBuilds/OpenBuilds-CONTROL#download
