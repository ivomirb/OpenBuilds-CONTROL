# OpenBuilds CONTROL
OpenBuilds CONTROL - Grbl Host / Interface for all CNC style machines running Grbl

This is a fork by Ivo Beltchev with multiple improvements.

### Workflow

* New option to reload the last gcode file
* More reliable jogging features, better compatibilty with different firmware and homing settings
* Ability to view and set machine coordinates
* Stores a history of work origins and allows for rolling back to a previous one
* Corrected the math and improved the safety of the "goto zero" buttons
* The Pause and Stop buttons remain available until the very end of the job
* Doesn't reset the "recently homed" status for errors and alerts that don't invalidate the machine position
* A new setting to hide the 4th axis controls if the controller supports it but it is not used

### User Interface

* **Windows only:** A new setting to disable the autostart and the tray icon, making it behave like a regular Windows app
* Allow clearing the key assignment in the keyboard shortcut editor and the macro editor
* The dialogs for opening and saving files have independent default directories for gcode, macros and grbl settings
* The position of the main window is preserved between runs
* Fix for dragging sliders with the mouse (bug in the external Metro UI library)
* Improved readability for Light and Dark themes

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

Most of them are compatible with the original software.
The most notable examples are:

* Macro manager that lets you organize macros into groups
* Heightmap support, similar to the one in Candle (work in progress, not yet fully tested)
* Disable the Z jog buttons for large step sizes
* Remove the dropdown from the file open button
* Smart Home macro that prevents accidental homing and allows homing single axis if supported

## Download

At this time there is no binary build available for download.

You can get the original OpenBuilds software from here: https://github.com/OpenBuilds/OpenBuilds-CONTROL#download
