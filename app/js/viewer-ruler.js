function drawRuler(xmin, xmax, ymin, ymax) {
  const length1 = 4;
  const length5 = 6;
  const length10 = 7;
  const unitsval = "";
  const fontsize = 4;
  const spacing = -10;

  // console.log(xmin, xmax, ymin, ymax)

  xmin = Math.ceil(xmin);
  xmax = Math.floor(xmax);
  ymin = Math.ceil(ymin);
  ymax = Math.floor(ymax);

  var ruler = new THREE.Group();

  var vertices = [];
  // x axis
  for (i = xmin; i <= xmax; i++) {
    var length = (i % 10 == 0) ? length10 : ((i % 5 == 0) ? length5 : length1);
    var geometry = new THREE.Geometry();
    vertices.push(i, -1, 0, i, -length, 0);

    if (i % 10 == 0) {
      var sprite = this.makeSprite("webgl", {
        x: i,
        y: spacing,
        z: 0,
        text: i + unitsval,
        color: Theme.X_RULER_NUMBER_COLOR,
        size: fontsize
      });
      ruler.add(sprite);
    }
  }

  // y axis
  for (i = ymin; i <= ymax; i++) {
    var length = (i % 10 == 0) ? length10 : ((i % 5 == 0) ? length5 : length1);
    var geometry = new THREE.Geometry();
    vertices.push(-1, i, 0, -length, i, 0);

    if (i % 10 == 0) {
      var sprite = this.makeSprite("webgl", {
        x: spacing,
        y: i,
        z: 0,
        text: i + unitsval,
        color: Theme.Y_RULER_NUMBER_COLOR,
        size: fontsize
      });
      ruler.add(sprite);
    }
  }

  var material = new THREE.LineBasicMaterial({
    color: Theme.RULER_COLOR,
    opacity: Theme.RULER_OPACITY
  });

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute( vertices, 3));
  var lines = new THREE.LineSegments(geometry, material);
  ruler.add(lines);

  ruler.name = "Rulers";

  return ruler;
}

function drawRulerInches(xmin, xmax, ymin, ymax) {
  const length1 = 4;
  const length4 = 6;
  const length16 = 7;
  const unitsval = "in";
  const fontsize = 4;
  const spacing = -10;

  // console.log(xmin, xmax, ymin, ymax)

  const scale = 25.4 / 16; // 1/16th of an inch
  xmin = Math.ceil(xmin / scale);
  xmax = Math.floor(xmax / scale);
  ymin = Math.ceil(ymin / scale);
  ymax = Math.floor(ymax / scale);

  var ruler = new THREE.Group();

  var vertices = [];
  // x axis
  for (i = xmin; i <= xmax; i++) {
    var length = (i % 16 == 0) ? length16 : ((i % 4 == 0) ? length4 : length1);
    var geometry = new THREE.Geometry();
    vertices.push(i * scale, -1, 0, i * scale, -length, 0);

    if (i % 16 == 0) {
      var sprite = this.makeSprite("webgl", {
        x: i * scale,
        y: spacing,
        z: 0,
        text: (i/16) + unitsval,
        color: Theme.X_RULER_NUMBER_COLOR,
        size: fontsize
      });
      ruler.add(sprite);
    }
  }

  // y axis
  for (i = ymin; i <= ymax; i++) {
    var length = (i % 16 == 0) ? length16 : ((i % 4 == 0) ? length4 : length1);
    var geometry = new THREE.Geometry();
    vertices.push(-1, i * scale, 0, -length, i * scale, 0);

    if (i % 16 == 0) {
      var sprite = this.makeSprite("webgl", {
        x: spacing,
        y: i * scale,
        z: 0,
        text: (i/16) + unitsval,
        color: Theme.Y_RULER_NUMBER_COLOR,
        size: fontsize
      });
      ruler.add(sprite);
    }
  }

  var material = new THREE.LineBasicMaterial({
    color: Theme.RULER_COLOR,
    opacity: Theme.RULER_OPACITY
  });

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute( vertices, 3));
  var lines = new THREE.LineSegments(geometry, material);
  ruler.add(lines);

 ruler.name = "Rulers";

  return ruler;
}
