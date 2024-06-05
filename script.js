let scene, camera, renderer, points = [], pointMeshes = [], delaunay, voronoi, imageMesh = null, imageData = null;
let canvas = document.getElementById('canvas');
let imageWidth = canvas.width;
let imageHeight = canvas.height;
let originalImageDataUrl = null;

function init() {
    scene = new THREE.Scene();
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
    camera = new THREE.OrthographicCamera(imageWidth / -2, imageWidth / 2, imageHeight / 2, imageHeight / -2, 1, 1000);
    camera.position.z = 2;
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

document.getElementById('imageLoader').addEventListener('change', handleImage, false);
document.getElementById('jsonLoader').addEventListener('change', handleJSON, false);
canvas.addEventListener('click', onCanvasClick, false);
document.getElementById('convertVoronoiButton').addEventListener('click', convertToVoronoiImage, false);
document.getElementById('resetButton').addEventListener('click', resetImage, false);
document.getElementById('exportDelaunayButton').addEventListener('click', exportDelaunayImage, false);
document.getElementById('exportVoronoiButton').addEventListener('click', exportVoronoiImage, false);
document.getElementById('exportConvertedVoronoiButton').addEventListener('click', exportConvertedVoronoiImage, false);
document.getElementById('exportVRMLDelaunayButton').addEventListener('click', () => {
    const vrmlString = generateVRMLString('delaunay');
    downloadFile(vrmlString, 'delaunay_scene.wrl', 'model/vrml');
});
document.getElementById('exportVRMLVoronoiButton').addEventListener('click', () => {
    const vrmlString = generateVRMLString('voronoi');
    downloadFile(vrmlString, 'voronoi_scene.wrl', 'model/vrml');
});

function handleImage(e) {
    const reader = new FileReader();
    reader.onload = function(event) {
        originalImageDataUrl = event.target.result;
        const img = new Image();
        img.onload = function() {
            imageWidth = img.width;
            imageHeight = img.height;
            canvas.width = imageWidth;
            canvas.height = imageHeight;
            renderer.setSize(imageWidth, imageHeight);

            camera = new THREE.OrthographicCamera(imageWidth / -2, imageWidth / 2, imageHeight / 2, imageHeight / -2, 1, 1000);
            camera.position.z = 2;

            const texture = new THREE.Texture(img);
            texture.needsUpdate = true;
            const geometry = new THREE.PlaneGeometry(imageWidth, imageHeight);
            const material = new THREE.MeshBasicMaterial({ map: texture });
            if (imageMesh) scene.remove(imageMesh);
            imageMesh = new THREE.Mesh(geometry, material);
            imageMesh.position.set(0, 0, -1);
            scene.add(imageMesh);

            const ctx = document.createElement('canvas').getContext('2d');
            ctx.canvas.width = imageWidth;
            ctx.canvas.height = imageHeight;
            ctx.drawImage(img, 0, 0);
            imageData = ctx.getImageData(0, 0, imageWidth, imageHeight);
            const numPoints = parseInt(document.getElementById('numPoints').value, 10);
            points = generatePoints(imageData, numPoints);

            updateDelaunayVoronoi();
            createMeshes();
            updateSelectedPointsDisplay();
        };
        img.src = originalImageDataUrl;
    };
    reader.readAsDataURL(e.target.files[0]);
}

function handleJSON(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = function(event) {
        const jsonData = JSON.parse(event.target.result);
        points = jsonData.map(point => ({
            x: point.x,
            y: point.y,
            color: new THREE.Color(0xff0000) // Default color, can be changed as needed
        }));
        updateDelaunayVoronoi();
        createMeshes();
        updateSelectedPointsDisplay();
    };
    reader.readAsText(file);
}

function generatePoints(imageData, numPoints) {
    const points = [];
    const width = imageData.width;
    const height = imageData.height;
    const totalPixels = width * height;
    const selectedIndexes = new Set();
    
    while (selectedIndexes.size < numPoints) {
        const randomIndex = Math.floor(Math.random() * totalPixels);
        selectedIndexes.add(randomIndex);
    }

    selectedIndexes.forEach(index => {
        const x = index % width;
        const y = Math.floor(index / width);
        const pixelIndex = index * 4;
        const r = imageData.data[pixelIndex];
        const g = imageData.data[pixelIndex + 1];
        const b = imageData.data[pixelIndex + 2];
        const color = new THREE.Color(`rgb(${r},${g},${b})`);
        points.push({ x, y, color });
    });

    return points;
}

function createMeshes() {
    scene.clear();
    if (imageMesh) scene.add(imageMesh);

    pointMeshes = [];
    if (document.getElementById('pointsCheckbox').checked) {
        points.forEach(point => {
            const geometry = new THREE.CircleGeometry(2, 12);
            const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(point.x - imageWidth / 2, -point.y + imageHeight / 2, 0);
            scene.add(mesh);
            pointMeshes.push(mesh);
        });
    }

    if (document.getElementById('delaunayCheckbox').checked) {
        drawDelaunay();
    }
    if (document.getElementById('voronoiCheckbox').checked) {
        drawVoronoi();
    }
}

function updateDelaunayVoronoi() {
    if (points.length < 3) return;
    const delaunayPoints = points.map(p => [p.x, p.y]);
    delaunay = Delaunator.from(delaunayPoints);
    voronoi = d3.Delaunay.from(delaunayPoints).voronoi([0, 0, imageWidth, imageHeight]);
}

function drawDelaunay() {
    if (!delaunay) return;
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    for (let i = 0; i < delaunay.triangles.length; i += 3) {
        const p0 = points[delaunay.triangles[i]];
        const p1 = points[delaunay.triangles[i + 1]];
        const p2 = points[delaunay.triangles[i + 2]];
        vertices.push(p0.x - imageWidth / 2, -p0.y + imageHeight / 2, 0);
        vertices.push(p1.x - imageWidth / 2, -p1.y + imageHeight / 2, 0);
        vertices.push(p2.x - imageWidth / 2, -p2.y + imageHeight / 2, 0);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const mesh = new THREE.LineSegments(geometry, material);
    scene.add(mesh);
}

function drawVoronoi() {
    if (!voronoi) return;
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    for (let i = 0; i < points.length; i++) {
        const cell = voronoi.cellPolygon(i);
        if (cell) {
            for (let j = 0; j < cell.length; j++) {
                const p1 = cell[j];
                const p2 = cell[(j + 1) % cell.length];
                vertices.push(p1[0] - imageWidth / 2, -p1[1] + imageHeight / 2, 0);
                vertices.push(p2[0] - imageWidth / 2, -p2[1] + imageHeight / 2, 0);
            }
        }
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    const mesh = new THREE.LineSegments(geometry, material);
    scene.add(mesh);
}

function onCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const normalizedX = x / canvas.width * imageWidth;
    const normalizedY = y / canvas.height * imageHeight;

    points.push({ x: normalizedX, y: normalizedY, color: new THREE.Color(0xff0000) });
    updateDelaunayVoronoi();
    createMeshes();
    updateSelectedPointsDisplay();
}

function updateSelectedPointsDisplay() {
    const pointsList = document.getElementById('pointsList');
    pointsList.innerHTML = points.map(p => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join(', ');
}

function convertToVoronoiImage() {
    if (!voronoi) return;

    const ctx = document.createElement('canvas').getContext('2d');
    ctx.canvas.width = imageWidth;
    ctx.canvas.height = imageHeight;

    for (let i = 0; i < points.length; i++) {
        const cell = voronoi.cellPolygon(i);
        if (cell) {
            const avgColor = getAverageColor(cell);
            ctx.fillStyle = `rgb(${avgColor.r},${avgColor.g},${avgColor.b})`;
            ctx.beginPath();
            ctx.moveTo(cell[0][0], cell[0][1]);
            for (let j = 1; j < cell.length; j++) {
                ctx.lineTo(cell[j][0], cell[j][1]);
            }
            ctx.closePath();
            ctx.fill();
        }
    }

    const imgTexture = new THREE.Texture(ctx.canvas);
    imgTexture.needsUpdate = true;
    const imgMaterial = new THREE.MeshBasicMaterial({ map: imgTexture });
    const imgGeometry = new THREE.PlaneGeometry(imageWidth, imageHeight);
    const imgMesh = new THREE.Mesh(imgGeometry, imgMaterial);
    scene.clear();
    scene.add(imgMesh);
}

function resetImage() {
    if (!originalImageDataUrl) return;

    const img = new Image();
    img.onload = function() {
        const texture = new THREE.Texture(img);
        texture.needsUpdate = true;
        const geometry = new THREE.PlaneGeometry(imageWidth, imageHeight);
        const material = new THREE.MeshBasicMaterial({ map: texture });
        if (imageMesh) scene.remove(imageMesh);
        imageMesh = new THREE.Mesh(geometry, material);
        imageMesh.position.set(0, 0, -1);
        scene.add(imageMesh);

        const ctx = document.createElement('canvas').getContext('2d');
        ctx.canvas.width = imageWidth;
        ctx.canvas.height = imageHeight;
        ctx.drawImage(img, 0, 0);
        imageData = ctx.getImageData(0, 0, imageWidth, imageHeight);

        updateDelaunayVoronoi();
        createMeshes();
        updateSelectedPointsDisplay();
    };
    img.src = originalImageDataUrl;
}

function getAverageColor(cell) {
    if (!imageData) return { r: 128, g: 128, b: 128 };

    let r = 0, g = 0, b = 0, count = 0;

    cell.forEach(([x, y]) => {
        const px = Math.floor(x);
        const py = Math.floor(y);
        if (px >= 0 && px < imageWidth && py >= 0 && py < imageHeight) {
            const index = (py * imageWidth + px) * 4;
            r += imageData.data[index];
            g += imageData.data[index + 1];
            b += imageData.data[index + 2];
            count++;
        }
    });

    r = Math.floor(r / count);
    g = Math.floor(g / count);
    b = Math.floor(b / count);

    return { r, g, b };
}

function exportDelaunayImage() {
    const originalImageMesh = imageMesh;
    if (imageMesh) scene.remove(imageMesh);

    const showVoronoi = document.getElementById('voronoiCheckbox').checked;
    const showPoints = document.getElementById('pointsCheckbox').checked;
    document.getElementById('voronoiCheckbox').checked = false;
    document.getElementById('pointsCheckbox').checked = false;

    createMeshes();
    toggleElements(false);
    drawDelaunay();
    renderer.render(scene, camera);
    const dataURL = canvas.toDataURL('image/png');
    downloadImage(dataURL, 'delaunay.png');

    document.getElementById('voronoiCheckbox').checked = showVoronoi;
    document.getElementById('pointsCheckbox').checked = showPoints;
    createMeshes();

    if (originalImageMesh) scene.add(originalImageMesh);

    toggleElements(true);
}

function exportVoronoiImage() {
    const originalImageMesh = imageMesh;
    if (imageMesh) scene.remove(imageMesh);

    const showDelaunay = document.getElementById('delaunayCheckbox').checked;
    const showPoints = document.getElementById('pointsCheckbox').checked;
    document.getElementById('delaunayCheckbox').checked = false;
    document.getElementById('pointsCheckbox').checked = false;

    createMeshes();
    toggleElements(false);
    drawVoronoi();
    renderer.render(scene, camera);
    const dataURL = canvas.toDataURL('image/png');
    downloadImage(dataURL, 'voronoi.png');

    document.getElementById('delaunayCheckbox').checked = showDelaunay;
    document.getElementById('pointsCheckbox').checked = showPoints;
    createMeshes();

    if (originalImageMesh) scene.add(originalImageMesh);

    toggleElements(true);
}

function exportConvertedVoronoiImage() {
    toggleElements(false);
    convertToVoronoiImage();
    renderer.render(scene, camera);
    const dataURL = canvas.toDataURL('image/png');
    downloadImage(dataURL, 'converted_voronoi.png');
    toggleElements(true);
}

function generateVRMLString(type) {
    let output = '#VRML V2.0 utf8\n';
    output += 'Shape {\n';
    output += '  geometry IndexedFaceSet {\n';
    output += '    coord Coordinate {\n';
    output += '      point [\n';

    points.forEach((point, index) => {
        const avgColor = getAverageColor(voronoi.cellPolygon(index));
        const z = (avgColor.r + avgColor.g + avgColor.b) / 3; // Using the average color intensity for z
        output += `        ${point.x} ${-point.y} ${z},\n`;
    });

    output += '      ]\n';
    output += '    }\n';
    output += '    coordIndex [\n';

    if (type === 'delaunay' && delaunay) {
        for (let i = 0; i < delaunay.triangles.length; i += 3) {
            output += `      ${delaunay.triangles[i]}, ${delaunay.triangles[i + 1]}, ${delaunay.triangles[i + 2]}, -1,\n`;
        }
    } 
    output += '    ]\n';
    output += '  }\n';
    output += '}\n';

    return output;
}

function downloadFile(data, filename, mimeType) {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function toggleElements(show) {
    const elements = document.querySelectorAll('.controls, #selectedPoints');
    elements.forEach(el => {
        el.style.display = show ? 'flex' : 'none';
    });
}

document.getElementById('delaunayCheckbox').addEventListener('change', () => {
    createMeshes();
});

document.getElementById('voronoiCheckbox').addEventListener('change', () => {
    createMeshes();
});

document.getElementById('pointsCheckbox').addEventListener('change', () => {
    createMeshes();
});

function downloadImage(dataURL, filename) {
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

init();
animate();
