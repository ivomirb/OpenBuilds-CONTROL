self.addEventListener('message', function(e) {
  // console.log("New message received by worker", e.data.data.length)
  importScripts("/lib/threejs/three.min.js");
  var data = e.data;
  var result = createObjectFromGCode(e.data.data)
  result = result;
  // console.log(result)
  self.postMessage(JSON.stringify(result));
}, false);

// This is a simplified and updated version of http://gcode.joewalnes.com/
// Updated with code from http://chilipeppr.com/tinyg's 3D viewer to support more CNC type Gcode
// Simplified by Andrew Hodel in 2015
// Updated by PvdW in 2016 for S-Value lasers
// Updates by PvdW in 2017 - new arc code from http://chilipeppr.com
// Updates by PvdW in 2017 - AUTODETECT MAX S VALUE
// Updated by PvdW in 2017 - Parse GCODE to find starting temperatures (preheat machine)
// Updated by PvdW in 2018 - Webworker Version
// Updated by PvdW in 2019 - Improve Performance
// Updated by PvdW in 2021 - New Sim Data, Smaller footprint, more efficient "lines" userData
// Updated by Ivo in 2026 - Fixed arc maths

var lastLine = {
  x: 0,
  y: 0,
  z: 0,
  e: 0,
  f: 0,
  t: false,
  feedrate: null,
  extruding: false,
  tool: false
};

GCodeParser = function(handlers, modecmdhandlers) {
    this.handlers = handlers || {};
    this.modecmdhandlers = modecmdhandlers || {};

    this.lastArgs = {
      cmd: null
    };
    this.lastFeedrate = null;
    this.isUnitsMm = true;

    this.parseLine = function(text, info) {
      // console.log("LINE: " + text)
      var origtext = text;
      // remove line numbers if exist
      if (text.match(/^N/i)) {
        // yes, there's a line num
        text = text.replace(/^N\d+\s*/ig, "");
      }

      // collapse leading zero g cmds to no leading zero
      text = text.replace(/G00/i, 'G0');
      text = text.replace(/G0(\d)/i, 'G$1');
      // add spaces before g cmds and xyzabcijkf params
      text = text.replace(/([gmtxyzabcijkfst])/ig, " $1");
      // remove spaces after xyzabcijkf params because a number should be directly after them
      text = text.replace(/([xyzabcijkfst])\s+/ig, "$1");
      // remove front and trailing space
      text = text.trim();

      // see if comment
      var isComment = false;
      if (text.match(/^(;|\(|<)/)) {
        text = origtext;
        isComment = true;
      } else {
        // make sure to remove inline comments
        text = text.replace(/\(.*?\)/g, "");
      }
      //console.log("gcode txt:", text);

      if (text && !isComment) {
        text = text.replace(/(;|\().*$/, ""); // ; or () trailing  // strip off end of line comment
        var tokens = [];
        // Execute any non-motion commands on the line immediately
        // Add other commands to the tokens list for later handling
        // Segments are not created for non-motion commands;
        // the segment for this line is created later
        text.split(/\s+/).forEach(function(token) {
          var modehandler = modecmdhandlers[token.toUpperCase()];
          if (modehandler) {
            modehandler();
          } else {
            tokens.push(token);
          }
        });

        if (tokens.length) {
          var cmd = tokens[0];
          cmd = cmd.toUpperCase();
          // check if a g or m cmd was included in gcode line
          // you are allowed to just specify coords on a line
          // and it should be assumed that the last specified gcode
          // cmd is what's assumed
          isComment = false;
          if (!cmd.match(/^(G|M|T|S)/i)) {
            cmd = this.lastArgs.cmd;
            tokens.unshift(cmd); // put at spot 0 in array
          } else {
            // we have a normal cmd as opposed to just an xyz pos where
            // it assumes you should use the last cmd
            // however, need to remove inline comments (TODO. it seems parser works fine for now)
          }
          var args = {
            'cmd': cmd,
            'text': text,
            'origtext': origtext,
            'indx': info,
            'isComment': isComment,
            'feedrate': null
          };
          // console.log("args:", args);
          if (tokens.length > 1 && !isComment) {
            tokens.splice(1).forEach(function(token) {
              //console.log("token:", token);
              if (token && token.length > 0) {
                var key = token[0].toLowerCase();
                var value = parseFloat(token.substring(1));
                args[key] = value;
              } else {
                //console.log("couldn't parse token in foreach. weird:", token);
              }
            });
          }
          var handler = this.handlers[cmd] || this.handlers['default'];
          // don't save if saw a comment
          if (!args.isComment) {
            this.lastArgs = args;
            //console.log("just saved lastArgs for next use:", this.lastArgs);
          } else {
            //console.log("this was a comment, so didn't save lastArgs");
          }
          //console.log("calling handler: cmd:", cmd, "args:", args, "info:", info);
          if (handler) {
            // scan for feedrate
            if (args.text.match(/F([\d.]+)/i)) {
              // we have a new feedrate
              var feedrate = parseFloat(RegExp.$1);
              args.feedrate = feedrate;
              this.lastFeedrate = feedrate;
            } else {
              // use feedrate from prior lines
              args.feedrate = this.lastFeedrate;
            }

            if (args.text.match(/S([\d.]+)/i)) {
              // we have a new S-Value
              var svalue = parseFloat(RegExp.$1);
              args.svalue = svalue;
              this.lastsvalue = svalue;
            } else {
              // use feedrate from prior lines
              args.svalue = this.lastsvalue;
            }

            if (args.text.match(/T([\d.]+)/i)) {
              console.log("New Tool: ", args.text)
              // we have a new S-Value
              var tool = parseFloat(RegExp.$1);
              args.tool = tool;
              this.lasttool = tool;
            } else {
              // use tool from prior lines
              args.tool = this.lasttool;
            }
            //console.log("about to call handler. args:", args, "info:", info, "this:", this);
            return handler(args, info, this);
          } else {
            console.error("No handler for gcode command!!!");
          }

        }
      } else {
        // it was a comment or the line was empty
        // we still need to create a segment with xyz in p2
        // so that when we're being asked to /gotoline we have a position
        // for each gcode line, even comments. we just use the last real position
        // to give each gcode line (even a blank line) a spot to go to
        var args = {
          'cmd': 'empty or comment',
          'text': text,
          'origtext': origtext,
          'indx': info,
          'isComment': isComment
        };
        var handler = this.handlers['default'];
        return handler(args, info, this);
      }
    }

    this.parse = function(gcode) {
      // console.log(gcode)



      var lines = gcode.split(/\r{0,1}\n/);
      // var lines = gcode

      for (var i = 0; i < lines.length; i++) {

        if (i % 100 === 0) {
          var progress = ((i / lines.length) * 100).toFixed(0)
          self.postMessage({
            progress: progress,
          });
        }


        if (this.parseLine(lines[i], i) === false) {
          break;
        }
      }

    }
  },
  colorG0 = 0x00cc00, //bootstrap color
  colorG1 = 0xcc0000,
  colorG2 = 0x0000cc,
  createObjectFromGCode = function(gcode) {
    // console.log(gcode)

    // Reset Starting Point
    lastLine = {
      x: 0,
      y: 0,
      z: 0,
      e: 0,
      f: 0,
      s: 0,
      t: false,
      feedrate: null,
      extruding: false
    };


    setUnits = function(units) {
      if (units == "mm")
        this.isUnitsMm = true;
      else
        this.isUnitsMm = false;
      this.onUnitsChanged();
    }

    onUnitsChanged = function() {
      //console.log("onUnitsChanged");
      // we need to publish back the units
      var units = "mm";
      if (!this.isUnitsMm) units = "inch";
      // $('.com-chilipeppr-widget-3dviewer-units-indicator').text(units);
      // console.log("USING UNITS:" + units)

    }
    this.offsetG92 = {
      x: 0,
      y: 0,
      z: 0,
      e: 0
    };
    this.setUnits("mm");


    // we have been using an approach where we just append
    // each gcode move to one monolithic geometry. we
    // are moving away from that idea and instead making each
    // gcode move be it's own full-fledged line object with
    // its own userData info
    // G2/G3 moves are their own child of lots of lines so
    // that even the simulator can follow along better
    var linePoints = [];
    var totalDist = 0;
    this.arcPlane = "G17";

    this.drawArc = function(aX, aY, aZ, endaZ, aRadius, aStartAngle, aEndAngle, aClockwise, plane) {
      //console.log("drawArc:", aX, aY, aZ, aRadius, aStartAngle, aEndAngle, aClockwise);
      var ac = new THREE.ArcCurve(aX, aY, aRadius, aStartAngle, aEndAngle, aClockwise);
      //console.log("ac:", ac);
      var acmat = new THREE.LineBasicMaterial({
        color: colorG2,
        opacity: 0.5,
        transparent: true
      });
      var acgeo = new THREE.Geometry();
      var ctr = 0;
      var points = []
      ac.getPoints(20).forEach(function(v) {
        //console.log(v);
        var z = (((endaZ - aZ) / 20) * ctr) + aZ;
        switch (plane) {
          case "G18":
            acgeo.vertices.push(new THREE.Vector3(v.y, z, v.x));
            points.push({'x': v.y, 'y': z, 'z': v.x });
            break;
          case "G19":
            acgeo.vertices.push(new THREE.Vector3(v.z, v.x, v.y));
            points.push({'x': v.z, 'y': v.x, 'z': v.y });
            break;
          default:
            acgeo.vertices.push(new THREE.Vector3(v.x, v.y, z));
            points.push({'x': v.x, 'y': v.y, 'z': z });
        }
        ctr++;
      });
      var aco = new THREE.Line(acgeo, acmat);
      aco.userData.points = points;
      return aco;
    };

    this.drawArcFrom2PtsAndCenter = function(vp1, vp2, vpArc, args) {

      var p1deltaX = vp1.x - vpArc.x;
      var p1deltaY = vp1.y - vpArc.y;
      var p1deltaZ = vp1.z - vpArc.z;

      var p2deltaX = vp2.x - vpArc.x;
      var p2deltaY = vp2.y - vpArc.y;
      var p2deltaZ = vp2.z - vpArc.z;

      switch (this.arcPlane) {
        case "G18": { // ZX
          var radius = Math.sqrt(p1deltaX*p1deltaX + p1deltaZ*p1deltaZ);
          var radius2 = Math.sqrt(p2deltaX*p2deltaX + p2deltaZ*p2deltaZ);
          //console.log("radius:", radius);

          if (Math.abs(radius - radius2) > 0.01)
            console.log("Radiuses not equal. r1:", radius, ", r2:", radius2, " with args:", args, "difference:", Math.abs(radius - radius2));

          // Find start and end angles
          var anglepArcp1 = Math.atan2(p1deltaX, p1deltaZ);
          var anglepArcp2 = Math.atan2(p2deltaX, p2deltaZ);
          if (anglepArcp2 < anglepArcp1) anglepArcp2 += 2*Math.PI; // order counterclockwise
          if ((vp2.z-vp1.z)*(vp2.z-vp1.z) + (vp2.x-vp1.x)*(vp2.x-vp1.x) < 0.0001)
            anglepArcp2 = anglepArcp1 + 2 * Math.PI; // start and end points are close together, draw a full circle
          return this.drawArc(vpArc.z, vpArc.x, vp1.y, vp2.y, radius, anglepArcp1, anglepArcp2, args.clockwise !== false, "G18");
        }
        case "G19": { // YZ
          var radius = Math.sqrt(p1deltaY*p1deltaY + p1deltaZ*p1deltaZ);
          var radius2 = Math.sqrt(p2deltaY*p2deltaY + p2deltaZ*p2deltaZ);
          //console.log("radius:", radius);

          if (Math.abs(radius - radius2) > 0.01)
            console.log("Radiuses not equal. r1:", radius, ", r2:", radius2, " with args:", args, "difference:", Math.abs(radius - radius2));

          var anglepArcp1 = Math.atan2(p1deltaZ, p1deltaY);
          var anglepArcp2 = Math.atan2(p2deltaZ, p2deltaY);
          if (anglepArcp2 < anglepArcp1) anglepArcp2 += 2*Math.PI;
          if ((vp2.y-vp1.y)*(vp2.y-vp1.y) + (vp2.z-vp1.z)*(vp2.z-vp1.z) < 0.0001)
            anglepArcp2 = anglepArcp1 + 2 * Math.PI;
          return this.drawArc(vpArc.y, vpArc.z, vp1.x, vp2.x, radius, anglepArcp1, anglepArcp2, args.clockwise !== false, "G19");
        }
        default: { // XY
          var radius = Math.sqrt(p1deltaX*p1deltaX + p1deltaY*p1deltaY);
          var radius2 = Math.sqrt(p2deltaX*p2deltaX+p2deltaY*p2deltaY);
          //console.log("radius:", radius);

          if (Math.abs(radius - radius2) > 0.01)
            console.log("Radiuses not equal. r1:", radius, ", r2:", radius2, " with args:", args, "difference:", Math.abs(radius - radius2));

          var anglepArcp1 = Math.atan2(p1deltaY, p1deltaX);
          var anglepArcp2 = Math.atan2(p2deltaY, p2deltaX);
          if (anglepArcp2 < anglepArcp1) anglepArcp2 += 2*Math.PI;
          if ((vp2.x-vp1.x)*(vp2.x-vp1.x) + (vp2.y-vp1.y)*(vp2.y-vp1.y) < 0.0001)
            anglepArcp2 = anglepArcp1 + 2 * Math.PI;
          return this.drawArc(vpArc.x, vpArc.y, vp1.z, vp2.z, radius, anglepArcp1, anglepArcp2, args.clockwise !== false, "G17");
        }
      }
    };

    this.addSegment = function(p1, p2, args) {

      // console.log(p1, p2, args)

      if (p2.arc) {
        //console.log("");
        //console.log("drawing arc. p1:", p1, ", p2:", p2);

        var vp1 = new THREE.Vector3(p1.x, p1.y, p1.z);
        var vp2 = new THREE.Vector3(p2.x, p2.y, p2.z);
        var vpArc;

        // if this is an R arc gcode command, we're given the radius, so we
        // don't have to calculate it. however we need to determine center
        // of arc
        if (args.r != null) {
          //console.log("looks like we have an arc with R specified. args:", args);
          //console.log("anglepArcp1:", anglepArcp1, "anglepArcp2:", anglepArcp2);

          radius = parseFloat(args.r);

          // First, find the point halfway between your two points.  We'll call it p3
          var x3 = (p1.x + p2.x) / 2;
          var y3 = (p1.y + p2.y) / 2;
          var z3 = (p1.z + p2.z) / 2;

          // Second, find the vector from p1 to p3
          var deltaX = x3 - p1.x;
          var deltaY = y3 - p1.y;
          var deltaZ = z3 - p1.z;

          switch (this.arcPlane) {
            case "G18": { // ZX
              var halfSq = deltaZ*deltaZ + deltaX*deltaX; // squared half distsance
              var distSq = radius*radius - halfSq; // squared distsance from p3 to the center
              if (distSq < 0) {
                // the points are further apart than twice the radius, which is invalid. pick the mid point
                console.log("Radius is too small:", radius, "Should be at least:", Math.sqrt(halfSq));
                vpArc = new THREE.Vector3(x3, y3, z3);
              }
              else {
                var scale = Math.sqrt(distSq / halfSq); // ratio between the half vector length and the distance from p3 to the center
                if ((args.clockwise === false ? radius : -radius) < 0) scale = -scale; // flip the sign if necessary
                vpArc = new THREE.Vector3(x3 + deltaZ*scale, y3, z3 - deltaX*scale); // the Y is irrelevant, so just pick the middle y3
              }
              break;
            }
            case "G19": { // YZ
              var halfSq = deltaY*deltaY + deltaZ*deltaZ;
              var distSq = radius*radius - halfSq;
              if (distSq < 0) {
                console.log("Radius is too small:", radius, "Should be at least:", Math.sqrt(halfSq));
                vpArc = new THREE.Vector3(x3, y3, z3);
              }
              else {
                var scale = Math.sqrt(distSq / halfSq);
                if ((args.clockwise === false ? radius : -radius) < 0) scale = -scale;
                vpArc = new THREE.Vector3(x3, y3 - deltaZ*scale, z3 + deltaY*scale);
              }
              break;
            }
            default: { // XY
              var halfSq = deltaX*deltaX + deltaY*deltaY;
              var distSq = radius*radius - halfSq;
              if (distSq < 0) {
                console.log("Radius is too small:", radius, "Should be at least:", Math.sqrt(halfSq));
                vpArc = new THREE.Vector3(x3, y3, z3);
              }
              else {
                var scale = Math.sqrt(distSq / halfSq);
                if ((args.clockwise === false ? radius : -radius) < 0) scale = -scale;
                vpArc = new THREE.Vector3(x3 - deltaY*scale, y3 + deltaX*scale, z3);
              }
            }
          }

        } else {
          // this code deals with IJK gcode commands
          vpArc = new THREE.Vector3(p2.arci, p2.arcj, p2.arck);
          //console.log("vpArc:", vpArc);
        }

        var threeObjArc = this.drawArcFrom2PtsAndCenter(vp1, vp2, vpArc, args);

        // still push the normal p1/p2 point for debug
        p2.g2 = true;
        p2.threeObjArc = threeObjArc;
        // end of if p2.arc
        // console.log( p2.threeObjArc.userData.points)

        // console.log(JSON.stringify(threeObjArc.userData))

        var a = new THREE.Vector3(p1.x, p1.y, p1.z);
        var b = new THREE.Vector3(p2.x, p2.y, p2.z);

        if (dist > 0) {
          this.totalDist += dist;
        }

        // calc distance of one segment of the arc
        dist = a.distanceTo(b) / threeObjArc.userData.points.length;

        // time to execute this move
        // if this move is 10mm and we are moving at 100mm/min then
        // this move will take 10/100 = 0.1 minutes or 6 seconds



        for (i = 0; i < threeObjArc.userData.points.length; i++) {
          var timeMinutes = 0;
          if (dist > 0) {
            var fr;
            if (args.feedrate > 0) {
              fr = args.feedrate
            } else {
              fr = 1000;
            }
            timeMinutes = dist / fr;

            // adjust for acceleration, meaning estimate
            // this will run longer than estimated from the math
            // above because we don't start moving at full feedrate
            // obviously, we have to slowly accelerate in and out
            timeMinutes = timeMinutes * 1.32;
          }
          this.totalTime += timeMinutes;
          linePoints.push({
            src: 607,
            x: threeObjArc.userData.points[i].x,
            y: threeObjArc.userData.points[i].y,
            z: threeObjArc.userData.points[i].z,
            g: 2,
            timeMins: timeMinutes
          });
        }

      }


      // DISTANCE CALC
      // add distance so we can calc estimated time to run
      // see if arc
      var dist = 0;
      if (p2.arc) {
        // calc dist of all lines
        //console.log("this is an arc to calc dist for. p2.threeObjArc:", p2.threeObjArc, "p2:", p2);
        var arcGeo = p2.threeObjArc.geometry;
        //console.log("arcGeo:", arcGeo);

        var tad2 = 0;
        for (var arcLineCtr = 0; arcLineCtr < arcGeo.vertices.length - 1; arcLineCtr++) {
          tad2 += arcGeo.vertices[arcLineCtr].distanceTo(arcGeo.vertices[arcLineCtr + 1]);
        }
        //console.log("tad2:", tad2);


        // just do straight line calc
        var a = new THREE.Vector3(p1.x, p1.y, p1.z);
        var b = new THREE.Vector3(p2.x, p2.y, p2.z);
        var straightDist = a.distanceTo(b);

        //console.log("diff of straight line calc vs arc sum. straightDist:", straightDist);

        dist = tad2;

      } else {
        // just do straight line calc
        var a = new THREE.Vector3(p1.x, p1.y, p1.z);
        var b = new THREE.Vector3(p2.x, p2.y, p2.z);
        dist = a.distanceTo(b);
      }

      if (dist > 0) {
        this.totalDist += dist;
      }

      // time to execute this move
      // if this move is 10mm and we are moving at 100mm/min then
      // this move will take 10/100 = 0.1 minutes or 6 seconds
      var timeMinutes = 0;
      if (dist > 0) {
        var fr;
        if (args.feedrate > 0) {
          fr = args.feedrate
        } else {
          fr = 100;
        }
        timeMinutes = dist / fr;

        // adjust for acceleration, meaning estimate
        // this will run longer than estimated from the math
        // above because we don't start moving at full feedrate
        // obviously, we have to slowly accelerate in and out
        timeMinutes = timeMinutes * 1.32;
      }
      this.totalTime += timeMinutes;

      p2.feedrate = args.feedrate;
      p2.dist = dist;
      p2.distSum = this.totalDist;
      p2.timeMins = timeMinutes;
      p2.timeMinsSum = this.totalTime;

      //  console.log("calculating distance. dist:", dist, "totalDist:", this.totalDist, "feedrate:", args.feedrate, "timeMinsToExecute:", timeMinutes, "totalTime:", this.totalTime, "p1:", p1, "p2:", p2, "args:", args);

      if (!p2.arc) { // not an arc




        g = 0;
        if (p2.g0) {
          g = 0
        } else if (p2.g1) {
          g = 1
        } else if (p2.g2) {
          g = 2
        } else {
          g = -1
        }
        // console.log(timeMinutes);

        linePoints.push({
          timeMins: timeMinutes,
          src: 628,
          x: p2.x,
          y: p2.y,
          z: p2.z,
          g: g
        });
      }

    }

    this.totalDist = 0;
    this.totalTime = 0;

    var relative = false;

    this.delta = function(v1, v2) {
      return relative ? v2 : v2 - v1;
    }

    this.absolute = function(v1, v2) {
      return relative ? v1 + v2 : v2;
    }

    var ijkrelative = true; // For Mach3 Arc IJK Absolute mode
    this.ijkabsolute = function(v1, v2) {
      return ijkrelative ? v1 + v2 : v2;
    }

    this.addFakeSegment = function(args) {
      //line.args = args;
      var arg2 = {
        isFake: true,
        text: args.text,
        indx: args.indx
      };
      if (arg2.text.match(/^(;|\(|<)/)) arg2.isComment = true;
      if (lastLine.g0) {
        g = 0
      } else if (lastLine.g1) {
        g = 1
      } else if (lastLine.g2) {
        g = 2
      } else {
        g = -1
      }
      linePoints.push({
        src: 742,
        x: lastLine.x,
        y: lastLine.y,
        z: lastLine.z,
        g: g,
        fake: true
      });
    }

    var cofg = this;
    var parser = new this.GCodeParser({
        //set the g92 offsets for the parser - defaults to no offset
        /* When doing CNC, generally G0 just moves to a new location
        as fast as possible which means no milling or extruding is happening in G0.
        So, let's color it uniquely to indicate it's just a toolhead move. */
        G0: function(args, indx) {
          //G1.apply(this, args, line, 0x00ff00);
          //console.log("G0", args);
          var newLine = {
            x: args.x !== undefined ? cofg.absolute(lastLine.x, args.x) + cofg.offsetG92.x : lastLine.x,
            y: args.y !== undefined ? cofg.absolute(lastLine.y, args.y) + cofg.offsetG92.y : lastLine.y,
            z: args.z !== undefined ? cofg.absolute(lastLine.z, args.z) + cofg.offsetG92.z : lastLine.z,
            e: args.e !== undefined ? cofg.absolute(lastLine.e, args.e) + cofg.offsetG92.e : lastLine.e,
            f: args.f !== undefined ? cofg.absolute(lastLine.f, args.f) : lastLine.f,
            s: args.s !== undefined ? cofg.absolute(lastLine.s, args.s) : lastLine.s,
            t: args.t !== undefined ? cofg.absolute(lastLine.t, args.t) : lastLine.t,
          };
          newLine.g0 = true;
          cofg.addSegment(lastLine, newLine, args);
          //console.log("G0", lastLine, newLine, args, cofg.offsetG92);
          lastLine = newLine;
        },
        G1: function(args, indx) {
          // Example: G1 Z1.0 F3000
          //          G1 X99.9948 Y80.0611 Z15.0 F1500.0 E981.64869
          //          G1 E104.25841 F1800.0
          // Go in a straight line from the current (X, Y) point
          // to the point (90.6, 13.8), extruding material as the move
          // happens from the current extruded length to a length of
          // 22.4 mm.
          var newLine = {
            x: args.x !== undefined ? cofg.absolute(lastLine.x, args.x) + cofg.offsetG92.x : lastLine.x,
            y: args.y !== undefined ? cofg.absolute(lastLine.y, args.y) + cofg.offsetG92.y : lastLine.y,
            z: args.z !== undefined ? cofg.absolute(lastLine.z, args.z) + cofg.offsetG92.z : lastLine.z,
            e: args.e !== undefined ? cofg.absolute(lastLine.e, args.e) + cofg.offsetG92.e : lastLine.e,
            f: args.f !== undefined ? cofg.absolute(lastLine.f, args.f) : lastLine.f,
            s: args.s !== undefined ? cofg.absolute(lastLine.s, args.s) : lastLine.s,
            t: args.t !== undefined ? cofg.absolute(lastLine.t, args.t) : lastLine.t,
          };
          newLine.g1 = true;
          cofg.addSegment(lastLine, newLine, args);
          //console.log("G1", lastLine, newLine, args, cofg.offsetG92);
          lastLine = newLine;
        },
        G2: function(args, indx, gcp) {
          //console.log(args, indx, gcp)
          /* this is an arc move from lastLine's xy to the new xy. we'll
          show it as a light gray line, but we'll also sub-render the
          arc itself by figuring out the sub-segments . */
          var newLine = {
            x: args.x !== undefined ? cofg.absolute(lastLine.x, args.x) + cofg.offsetG92.x : lastLine.x,
            y: args.y !== undefined ? cofg.absolute(lastLine.y, args.y) + cofg.offsetG92.y : lastLine.y,
            z: args.z !== undefined ? cofg.absolute(lastLine.z, args.z) + cofg.offsetG92.z : lastLine.z,
            e: args.e !== undefined ? cofg.absolute(lastLine.e, args.e) + cofg.offsetG92.e : lastLine.e,
            f: args.f !== undefined ? cofg.absolute(lastLine.f, args.f) : lastLine.f,
            s: args.s !== undefined ? cofg.absolute(lastLine.s, args.s) : lastLine.s,
            t: args.t !== undefined ? cofg.absolute(lastLine.t, args.t) : lastLine.t,
            arci: args.i !== undefined ? cofg.ijkabsolute(lastLine.x, args.i) : lastLine.x,
            arcj: args.j !== undefined ? cofg.ijkabsolute(lastLine.y, args.j) : lastLine.y,
            arck: args.k !== undefined ? cofg.ijkabsolute(lastLine.z, args.k) : lastLine.z,
            arcr: args.r ? args.r : null,
          };

          //console.log("G2 newLine:", newLine);
          //newLine.g2 = true;
          newLine.arc = true;
          newLine.clockwise = true;
          if (args.clockwise === false) {
            newLine.clockwise = false
          } else {
            newLine.clockwise = true
          }
          cofg.addSegment(lastLine, newLine, args);
          //console.log("G2", lastLine, newLine, args, cofg.offsetG92);
          lastLine = newLine;
          //console.log("G2. args:", args);
        },
        G3: function(args, indx, gcp) {
          /* this is an arc move from lastLine's xy to the new xy. same
          as G2 but reverse*/
          args.arc = true;
          args.clockwise = false;
          gcp.handlers.G2(args, indx, gcp);
        },

        G73: function(args, indx, gcp) {
          // peck drilling. just treat as g1
          //newLine.g73 = true;
          console.log("G73 gcp:", gcp);
          gcp.handlers.G1(args);
        },

        G92: function(args) { // E0
          // G92: Set Position
          // Example: G92 E0
          // Allows programming of absolute zero point, by reseting the
          // current position to the values specified. This would set the
          // machine's X coordinate to 10, and the extrude coordinate to 90.
          // No physical motion will occur.

          // TODO: Only support E0
          var newLine = lastLine;

          cofg.offsetG92.x = (args.x !== undefined ? (args.x === 0 ? newLine.x : newLine.x - args.x) : 0);
          cofg.offsetG92.y = (args.y !== undefined ? (args.y === 0 ? newLine.y : newLine.y - args.y) : 0);
          cofg.offsetG92.z = (args.z !== undefined ? (args.z === 0 ? newLine.z : newLine.z - args.z) : 0);
          cofg.offsetG92.e = (args.e !== undefined ? (args.e === 0 ? newLine.e : newLine.e - args.e) : 0);

          //newLine.x = args.x !== undefined ? args.x + newLine.x : newLine.x;
          //newLine.y = args.y !== undefined ? args.y + newLine.y : newLine.y;
          //newLine.z = args.z !== undefined ? args.z + newLine.z : newLine.z;
          //newLine.e = args.e !== undefined ? args.e + newLine.e : newLine.e;

          //console.log("G92", lastLine, newLine, args, cofg.offsetG92);

          //lastLine = newLine;
          cofg.addFakeSegment(args);
        },
        M30: function(args) {
          cofg.addFakeSegment(args);
        },

        'default': function(args, info) {
          //if (!args.isComment)
          //console.log('Unknown command:', args.cmd, args, info);
          cofg.addFakeSegment(args);
        },
      },
      // Mode-setting non-motion commands, of which many may appear on one line
      // These take no arguments
      {
        G17: function() {
//          console.log("SETTING XY PLANE");
          cofg.arcPlane = "G17";
        },

        G18: function() {
//          console.log("SETTING XZ PLANE");
          cofg.arcPlane = "G18";
        },

        G19: function() {
//          console.log("SETTING YZ PLANE");
          cofg.arcPlane = "G19";
        },

        G20: function() {
          // G20: Set Units to Inches
          // We don't really have to do anything since 3d viewer is unit agnostic
          // However, we need to set a global property so the trinket decorations
          // like toolhead, axes, grid, and extent labels are scaled correctly
          // later on when they are drawn after the gcode is rendered
          cofg.setUnits("inch");
        },

        G21: function() {
          // G21: Set Units to Millimeters
          // Example: G21
          // Units from now on are in millimeters. (This is the RepRap default.)
          cofg.setUnits("mm");
        },

        // A bunch of no-op modes that do not affect the viewer
        G40: function() {}, // Tool radius compensation off
        G41: function() {}, // Tool radius compensation left
        G42: function() {}, // Tool radius compensation right
        G45: function() {}, // Axis offset single increase
        G46: function() {}, // Axis offset single decrease
        G47: function() {}, // Axis offset double increase
        G48: function() {}, // Axis offset double decrease
        G49: function() {}, // Tool length offset compensation cancle
        G54: function() {}, // Select work coordinate system 1
        G55: function() {}, // Select work coordinate system 2
        G56: function() {}, // Select work coordinate system 3
        G57: function() {}, // Select work coordinate system 4
        G58: function() {}, // Select work coordinate system 5
        G59: function() {}, // Select work coordinate system 6
        G61: function() {}, // Exact stop check mode
        G64: function() {}, // Cancel G61
        G69: function() {}, // Cancel G68

        G90: function() {
          // G90: Set to Absolute Positioning
          // Example: G90
          // All coordinates from now on are absolute relative to the
          // origin of the machine. (This is the RepRap default.)
          relative = false;
        },

        'G90.1': function() {
          // G90.1: Set to Arc Absolute IJK Positioning
          // Example: G90.1
          // From now on, arc centers are specified directly by
          // the IJK parameters, e.g. center_x = I_value
          // This is Mach3-specific
          ijkrelative = false;
        },

        G91: function() {
          // G91: Set to Relative Positioning
          // Example: G91
          // All coordinates from now on are relative to the last position.
          relative = true;
        },

        'G91.1': function() {
          // G91.1: Set to Arc Relative IJK Positioning
          // Example: G91.1
          // From now on, arc centers are relative to the starting
          // coordinate, e.g. center_x = this_x + I_value
          // This is the default, and the only possibility for most
          // controllers other than Mach3
          ijkrelative = true;
        },

        // No-op modal macros that do not affect the viewer
        M3: function() {}, // Spindle on
        M5: function() {}, // Spindle off
        M6: function(args) {}, // Pause for Toolchange
        M07: function() {}, // Coolant on (mist)
        M08: function() {}, // Coolant on (flood)
        M09: function() {}, // Coolant off
        M10: function() {}, // Pallet clamp on
        M11: function() {}, // Pallet clamp off
        M21: function() {}, // Mirror X axis
        M22: function() {}, // Mirror Y axis
        M23: function() {}, // Mirror off
        M24: function() {}, // Thread pullout gradual off
        M41: function() {}, // Select gear 1
        M42: function() {}, // Select gear 2
        M43: function() {}, // Select gear 3
        M44: function() {}, // Select gear 4
        M48: function() {}, // Allow feedrate override
        M49: function() {}, // Disallow feedrate override
        M52: function() {}, // Empty spindle
        M60: function() {}, // Automatic pallet change

        M82: function() {
          // M82: Set E codes absolute (default)
          // Descriped in Sprintrun source code.

          // No-op, so long as M83 is not supported.
        },

        M84: function() {
          // M84: Stop idle hold
          // Example: M84
          // Stop the idle hold on all axis and extruder. In some cases the
          // idle hold causes annoying noises, which can be stopped by
          // disabling the hold. Be aware that by disabling idle hold during
          // printing, you will get quality issues. This is recommended only
          // in between or after printjobs.
          // No-op
        },
      });
    // console.log("GCODE LENGTH " + gcode.length)

    parser.parse(gcode);
    var data = {
      linePoints: linePoints,
      //lines: lines,
      inch: false,
      totalDist: this.totalDist,
      totalTime: this.totalTime,
    }

    if (!isUnitsMm) {
      data.inch = true;
    } else {
      data.inch = false;
    }

    return data;
  } // end of createObjectFromGCode()