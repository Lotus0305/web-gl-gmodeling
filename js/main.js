// Elements
const inputElement = document.getElementById("imageInput");
const originalCanvasElement = document.getElementById("originalCanvas");
const overlayCanvasElement = document.getElementById("overlayCanvas");
const voronoiColorCanvasElement = document.getElementById("voronoiColorCanvas");
const numPointsElement = document.getElementById("numPoints");
const showDelaunayCheckboxElement = document.getElementById("showDelaunay");
const showVoronoiCheckboxElement = document.getElementById("showVoronoi");
const pointsInputElement = document.getElementById("pointsInput");
const updatePointsButtonElement = document.getElementById("updatePointsButton");

// Contexts
const originalContext = originalCanvasElement.getContext("2d", {
  willReadFrequently: true,
});
const overlayContext = overlayCanvasElement.getContext("2d", {
  willReadFrequently: true,
});
const voronoiColorContext = voronoiColorCanvasElement.getContext("2d", {
  willReadFrequently: true,
});

// Image and Points
let img = new Image(); // This holds the image once loaded
let points = []; // Global array to store point coordinates

// Event Listeners
inputElement.addEventListener("change", function (event) {
  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    img.onload = function () {
      resizeCanvas(img.width, img.height);
      drawImageToCanvas(img);
      generatePoints();
      updatePointsInput();
      draw();
    };
    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
});

numPointsElement.addEventListener("change", function () {
  generatePoints();
  updatePointsInput();
  draw();
});

showDelaunayCheckboxElement.addEventListener("change", draw);
showVoronoiCheckboxElement.addEventListener("change", draw);

overlayCanvasElement.addEventListener("click", function (event) {
  const rect = overlayCanvasElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  points.push([x, y]);
  updatePointsInput();
  draw();
});

updatePointsButtonElement.addEventListener("click", function () {
  updatePointsFromInput();
  draw();
});

// Functions
function resizeCanvas(width, height) {
  originalCanvasElement.width =
    overlayCanvasElement.width =
    voronoiColorCanvasElement.width =
      width;
  originalCanvasElement.height =
    overlayCanvasElement.height =
    voronoiColorCanvasElement.height =
      height;
}

function drawImageToCanvas(image) {
  originalContext.drawImage(image, 0, 0);
  overlayContext.drawImage(image, 0, 0);
  voronoiColorContext.drawImage(image, 0, 0);
}

function generatePoints() {
  points = []; // Clear the existing points
  const targetPointCount = parseInt(numPointsElement.value);
  for (let i = 0; i < targetPointCount; i++) {
    const x = Math.floor(Math.random() * overlayCanvasElement.width);
    const y = Math.floor(Math.random() * overlayCanvasElement.height);
    points.push([x, y]);
  }
}

function draw() {
  overlayContext.clearRect(
    0,
    0,
    overlayCanvasElement.width,
    overlayCanvasElement.height
  );
  overlayContext.drawImage(img, 0, 0);
  voronoiColorContext.clearRect(
    0,
    0,
    voronoiColorCanvasElement.width,
    voronoiColorCanvasElement.height
  );
  voronoiColorContext.drawImage(img, 0, 0);

  const delaunay = d3.Delaunay.from(points);
  const voronoi = delaunay.voronoi([
    0,
    0,
    overlayCanvasElement.width,
    overlayCanvasElement.height,
  ]);
  const cells = voronoi.cellPolygons();

  if (showVoronoiCheckboxElement.checked) {
    overlayContext.beginPath();
    voronoi.render(overlayContext);
    overlayContext.strokeStyle = "blue";
    overlayContext.stroke();
  }

  if (showDelaunayCheckboxElement.checked) {
    overlayContext.beginPath();
    delaunay.render(overlayContext);
    overlayContext.strokeStyle = "red";
    overlayContext.stroke();
  }

  for (let cell of cells) {
    const cellPoints = Array.from(cell);
    const color = getAverageColor(
      cellPoints,
      originalContext.getImageData(
        0,
        0,
        originalCanvasElement.width,
        originalCanvasElement.height
      )
    );
    voronoiColorContext.beginPath();
    cellPoints.forEach((point, index) => {
      if (index === 0) {
        voronoiColorContext.moveTo(point[0], point[1]);
      } else {
        voronoiColorContext.lineTo(point[0], point[1]);
      }
    });
    voronoiColorContext.closePath();
    voronoiColorContext.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
    voronoiColorContext.fill();
    voronoiColorContext.stroke();
  }
}

function getAverageColor(points, imageData) {
  let total = 0,
    r = 0,
    g = 0,
    b = 0;
  points.forEach((point) => {
    const x = Math.floor(point[0]);
    const y = Math.floor(point[1]);
    if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
      const offset = (y * imageData.width + x) * 4;
      r += imageData.data[offset];
      g += imageData.data[offset + 1];
      b += imageData.data[offset + 2];
      total++;
    }
  });
  return { r: r / total, g: g / total, b: b / total };
}

function updatePointsFromInput() {
  const input = pointsInputElement.value.trim();
  const pointStrings = input.split(';');
  points = pointStrings.map(pointStr => {
    const [x, y] = pointStr.split(',').map(Number);
    return [x, y];
  }).filter(point => !isNaN(point[0]) && !isNaN(point[1]));
  updatePointsInput(); // Ensure pointsInput is updated when points are updated from input
}

function updatePointsInput() {
  pointsInputElement.value = points.map(point => point.join(',')).join('; ');
}

// Adjusted button listeners and functions for exporting PNG images of diagrams
document
  .getElementById("exportDelaunayPNGButton")
  .addEventListener("click", function () {
    exportDelaunayPNG();
  });

document
  .getElementById("exportVoronoiPNGButton")
  .addEventListener("click", function () {
    exportVoronoiPNG();
  });

function exportDelaunayPNG() {
  const canvas = document.createElement("canvas");
  canvas.width = overlayCanvasElement.width;
  canvas.height = overlayCanvasElement.height;
  const context = canvas.getContext("2d");
  const delaunay = d3.Delaunay.from(points);
  delaunay.render(context);
  context.strokeStyle = "red";
  context.stroke();
  exportCanvasAsImage(canvas, "delaunay.png");
}

function exportVoronoiPNG() {
  const canvas = document.createElement("canvas");
  canvas.width = overlayCanvasElement.width;
  canvas.height = overlayCanvasElement.height;
  const context = canvas.getContext("2d");
  const delaunay = d3.Delaunay.from(points);
  const voronoi = delaunay.voronoi([
    0,
    0,
    overlayCanvasElement.width,
    overlayCanvasElement.height,
  ]);
  voronoi.render(context);
  context.strokeStyle = "blue";
  context.stroke();
  exportCanvasAsImage(canvas, "voronoi.png");
}

function exportCanvasAsImage(canvas, filename) {
  const imageURL = canvas.toDataURL("image/png");
  const downloadLink = document.createElement("a");
  downloadLink.href = imageURL;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

document
  .getElementById("exportDelaunayVRMLButton")
  .addEventListener("click", function () {
    exportDelaunayToVRML();
  });

document
  .getElementById("exportVoronoiVRMLButton")
  .addEventListener("click", function () {
    exportVoronoiToVRML();
  });

function exportDelaunayToVRML() {
  let vrmlContent = `#VRML V2.0 utf8\n`;
  const delaunay = d3.Delaunay.from(points);
  const triangles = delaunay.triangles;

  for (let i = 0; i < triangles.length; i += 3) {
    vrmlContent += `Shape {\n  geometry IndexedFaceSet {\n    coord Coordinate {\n      point [\n`;

    let coordIndex = "";
    for (let j = 0; j < 3; j++) {
      const point = points[triangles[i + j]];
      vrmlContent += `        ${point[0]} ${point[1]} 0,\n`;
      coordIndex += `${j}, `;
    }

    // Close the triangle by repeating the first index
    coordIndex += "-1";
    vrmlContent += `      ]\n    }\n    coordIndex [\n      ${coordIndex}\n    ]\n  }\n}\n`;
  }

  const blob = new Blob([vrmlContent], { type: "model/vrml" });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = "delaunay.wrl";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

function exportVoronoiToVRML() {
  let vrmlContent = `#VRML V2.0 utf8\n`;
  const delaunay = d3.Delaunay.from(points);
  const voronoi = delaunay.voronoi([
    0,
    0,
    overlayCanvasElement.width,
    overlayCanvasElement.height,
  ]);

  for (let cell of voronoi.cellPolygons()) {
    vrmlContent += `Shape {\n  geometry IndexedFaceSet {\n    coord Coordinate {\n      point [\n`;

    let coordIndex = "";
    cell.forEach((point, index) => {
      vrmlContent += `        ${point[0]} ${point[1]} 0,\n`;
      coordIndex += `${index}, `;
    });

    // Close the polygon by repeating the first index
    coordIndex += "-1";
    vrmlContent += `      ]\n    }\n    coordIndex [\n      ${coordIndex}\n    ]\n  }\n}\n`;
  }

  const blob = new Blob([vrmlContent], { type: "model/vrml" });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = "voronoi.wrl";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}
