import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.152.2/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let originDot, lineGroup, pathLine, wireframeMesh;
let mouseActive = false;
let pathPoints = [];
let time = 0;
let lastMousePos = { x: 0, y: 0 };
let currentMousePos = { x: 0, y: 0 };
let morphing = false;
let wireframePoints = [];

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('canvas'),
        alpha: true,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0a0a0a, 1);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 3.5;
    controls.maxDistance = 15;

    lineGroup = new THREE.Group();
    scene.add(lineGroup);

    const dotGeometry = new THREE.SphereGeometry(0.17, 32, 32);
    const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    originDot = new THREE.Mesh(dotGeometry, dotMaterial);
    scene.add(originDot);

    showPrompts();

    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onWindowResize);

    animate();
}

function showPrompts() {
    const prompt1 = document.getElementById('prompt1');
    const prompt2 = document.getElementById('prompt2');
    const prompt3 = document.getElementById('prompt3');

    setTimeout(() => { prompt1.style.opacity = 1; }, 1000);
    setTimeout(() => { prompt1.style.opacity = 0; }, 3500);
    setTimeout(() => { prompt2.style.opacity = 1; }, 4000);
    setTimeout(() => { prompt2.style.opacity = 0; }, 6500);
    setTimeout(() => { prompt3.style.opacity = 1; }, 7000);
    setTimeout(() => {
        prompt3.style.opacity = 0;
        mouseActive = true;
        document.body.style.cursor = 'none';
        document.getElementById('delta-display').style.display = 'block';
    }, 9500);
}

function onMouseMove(event) {
    if (!mouseActive || morphing) return;
    const x = (event.clientX / window.innerWidth) * 2 - 1;
    const y = -(event.clientY / window.innerHeight) * 2 + 1;
    currentMousePos = { x, y };

    if (Math.hypot(x - lastMousePos.x, y - lastMousePos.y) > 0.02) {
        let z = Math.sin(pathPoints.length / 2) * 0.18 + (Math.random() - 0.5) * 0.04;
        pathPoints.push(new THREE.Vector3(x * 4, y * 4, z));
        lastMousePos = { x, y };
        if (pathPoints.length === 16 && !morphing) {
            morphing = true;
            startWireframePolyhedron();
        }
    }
    updatePathLine();
    updateDeltaCMH();
}

function updatePathLine() {
    if (pathLine) lineGroup.remove(pathLine);

    let pts = pathPoints.slice();
    if (mouseActive && currentMousePos && !morphing) {
        pts.push(new THREE.Vector3(currentMousePos.x * 4, currentMousePos.y * 4, 0));
    }
    if (pts.length < 2 || morphing) return;

    const curve = new THREE.CatmullRomCurve3(pts);
    const points = curve.getPoints(Math.max(pts.length * 10, 50));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2 });
    pathLine = new THREE.Line(geometry, material);
    lineGroup.add(pathLine);
}

function startWireframePolyhedron() {
    wireframePoints = pathPoints.map(pt => pt.clone());
    let vertices = [];
    for (let v of wireframePoints) {
        let vcopy = v.clone();
        vcopy.x += (Math.random() - 0.5) * 0.3;
        vcopy.y += (Math.random() - 0.5) * 0.3;
        vcopy.z += (Math.random() - 0.5) * 0.5;
        vertices.push(vcopy);
    }
    let edges = [];
    for (let i = 0; i < vertices.length; i++) {
        let seen = [];
        while (seen.length < 3) {
            let j = Math.floor(Math.random() * vertices.length);
            if (j !== i && !seen.includes(j)) seen.push(j);
        }
        for (let j of seen) {
            edges.push(vertices[i]);
            edges.push(vertices[j]);
        }
    }
    const edgeGeom = new THREE.BufferGeometry().setFromPoints(edges);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xe8e8e8, linewidth: 1 });
    wireframeMesh = new THREE.LineSegments(edgeGeom, edgeMaterial);
    wireframeMesh.position.z = -0.5;
    scene.add(wireframeMesh);
}

function updateWireframeMorphing() {
    if (!wireframeMesh) return;
    let positions = wireframeMesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        let orig = wireframePoints[i % wireframePoints.length];
        positions.setXYZ(
            i,
            orig.x + Math.sin(performance.now() / 650 + i) * 0.09,
            orig.y + Math.cos(performance.now() / 570 - i) * 0.08,
            orig.z + Math.sin(performance.now() / 640 + i * 0.7) * 0.12
        );
    }
    positions.needsUpdate = true;
}

function updateDeltaCMH() {
    let v;
    if (wireframeMesh && wireframePoints.length > 2) {
        let sum = wireframePoints.reduce((acc, v) => {
            acc.x += v.x; acc.y += v.y; acc.z += v.z; return acc;
        }, { x: 0, y: 0, z: 0 });
        v = new THREE.Vector3(sum.x / wireframePoints.length, sum.y / wireframePoints.length, sum.z / wireframePoints.length);
    } else if (mouseActive && currentMousePos) {
        v = new THREE.Vector3(currentMousePos.x * 4, currentMousePos.y * 4, 0);
    } else if (pathPoints.length > 0) {
        v = pathPoints[pathPoints.length - 1];
    } else {
        document.getElementById('delta-value').textContent = '—';
        return;
    }
    const distance = v.length();
    document.getElementById('delta-value').textContent = (distance / 10).toFixed(3);
}

function animate() {
    requestAnimationFrame(animate);
    time += 0.01;
    if (originDot) {
        originDot.rotation.x = time * 0.3;
        originDot.rotation.y = time * 0.5;
    }
    if (wireframeMesh) updateWireframeMorphing();
    controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('DOMContentLoaded', init);
