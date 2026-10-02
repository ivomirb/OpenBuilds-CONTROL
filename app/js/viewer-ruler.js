function drawRuler(xmin, xmax, ymin, ymax, inches) {
  const unitsVal = inches ? '"' : '';
  const ticSpacing = inches ? 2.54 : 1;
  const unitScale = inches ? 0.1 : 1; // convert tic index to text

  const length1 = 4;
  const length5 = 6;
  const length10 = 7;
  const fontsize = 4;
  const ticOffset = -10;

  xmin = Math.ceil(xmin / ticSpacing);
  xmax = Math.floor(xmax / ticSpacing);
  ymin = Math.ceil(ymin / ticSpacing);
  ymax = Math.floor(ymax / ticSpacing);

  var ruler = new THREE.Group();

  var vertices = [];
  // x axis
  for (var i = xmin; i <= xmax; i++) {
    var length = (i % 10 == 0) ? length10 : ((i % 5 == 0) ? length5 : length1);
    var geometry = new THREE.Geometry();
    vertices.push(i * ticSpacing, -1, 0, i * ticSpacing, -length, 0);

    if (i % 10 == 0) {
      var sprite = makeSprite("webgl", {
        x: i * ticSpacing,
        y: ticOffset,
        z: 0,
        text: Math.round(i * unitScale) + unitsVal,
        color: Theme.X_RULER_NUMBER_COLOR,
        size: fontsize
      });
      ruler.add(sprite);
    }
  }

  // y axis
  for (var i = ymin; i <= ymax; i++) {
    var length = (i % 10 == 0) ? length10 : ((i % 5 == 0) ? length5 : length1);
    var geometry = new THREE.Geometry();
    vertices.push(-1, i * ticSpacing, 0, -length, i * ticSpacing, 0);

    if (i % 10 == 0) {
      var sprite = makeSprite("webgl", {
        x: ticOffset,
        y: i * ticSpacing,
        z: 0,
        text: Math.round(i * unitScale) + unitsVal,
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
/* inch version that uses 1/16 spacing instead of 1/10
function drawRulerInches(xmin, xmax, ymin, ymax) {
  const length1 = 4;
  const length4 = 6;
  const length16 = 7;
  const unitsVal = "in";
  const fontsize = 4;
  const ticSpacing = -10;

  // console.log(xmin, xmax, ymin, ymax)

  const unitScale = 25.4 / 16; // 1/16th of an inch
  xmin = Math.ceil(xmin / unitScale);
  xmax = Math.floor(xmax / unitScale);
  ymin = Math.ceil(ymin / unitScale);
  ymax = Math.floor(ymax / unitScale);

  var ruler = new THREE.Group();

  var vertices = [];
  // x axis
  for (var i = xmin; i <= xmax; i++) {
    var length = (i % 16 == 0) ? length16 : ((i % 4 == 0) ? length4 : length1);
    var geometry = new THREE.Geometry();
    vertices.push(i * unitScale, -1, 0, i * unitScale, -length, 0);

    if (i % 16 == 0) {
      var sprite = makeSprite("webgl", {
        x: i * unitScale,
        y: ticSpacing,
        z: 0,
        text: (i/16) + unitsVal,
        color: Theme.X_RULER_NUMBER_COLOR,
        size: fontsize
      });
      ruler.add(sprite);
    }
  }

  // y axis
  for (var i = ymin; i <= ymax; i++) {
    var length = (i % 16 == 0) ? length16 : ((i % 4 == 0) ? length4 : length1);
    var geometry = new THREE.Geometry();
    vertices.push(-1, i * unitScale, 0, -length, i * unitScale, 0);

    if (i % 16 == 0) {
      var sprite = makeSprite("webgl", {
        x: ticSpacing,
        y: i * unitScale,
        z: 0,
        text: (i/16) + unitsVal,
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
*/