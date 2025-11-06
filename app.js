// app.js - Repaired and Refactored

// --- Modern, Consistent Imports ---
// Import EVERYTHING from the same, reliable CDN source.
// This ensures all components (THREE, OrbitControls, etc.) are compatible.
import * as THREE from 'https://cdn.skypack.dev/three@0.152.2';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.152.2/examples/jsm/controls/OrbitControls.js';

// --- Global Variables ---
let scene, camera, renderer, controls;
let originDot, lineGroup, pathLine;
let mouseActive = false;
let pathPoints = [];
let time = 0;
let lastMousePos = new THREE.Vector2();
let currentMousePos = new THREE.Vector2();

// --- New variables for a proper polyhedron and state management ---
let polyhedron;
let phase = 'prompting'; // 'prompting' -> 'drawing' -> 'morphing'

// --- Main Initialization Function ---
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
    renderer.setClearColor(0x050505, 1);

    // --- Initialize controls but disable them initially ---
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 20;
    controls.enabled = false; // Start with controls disabled

    lineGroup = new THREE.Group();
    scene.add(lineGroup);

    const dotGeometry = new THREE.SphereGeometry(0.1, 32, 32);
    const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    originDot = new THREE.Mesh(dotGeometry, dotMaterial);
    scene.add(originDot);

    showPrompts();

    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onWindowResize);

    animate();
}

// --- Narrative Prompt Sequence ---
function showPrompts() {
    const prompts = document.querySelectorAll('.prompt');
    let delay = 1000;
    prompts.forEach((prompt, index) => {
        setTimeout(() => { prompt.style.opacity = 1; }, delay);
        setTimeout(() => { prompt.style.opacity = 0; }, delay + 2500);
        delay += 3000;
    });

    setTimeout(() => {
        mouseActive = true;
        phase = 'drawing';
        document.getElementById('delta-display').style.display = 'block';
        document.getElementById('footer').style.opacity = 1; // Fade in the footer text
    }, delay);
}

// --- Mouse Interaction Logic ---
function onMouseMove(event) {
    if (phase !== 'drawing') return;

    currentMousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
    currentMousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (pathPoints.length === 0 || lastMousePos.distanceTo(currentMousePos) > 0.05) {
        const z = Math.sin(pathPoints.length * 0.5) * 0.5;
        pathPoints.push(new THREE.Vector3(currentMousePos.x * 3, currentMousePos.y * 3, z));
        lastMousePos.copy(currentMousePos);

        if (pathPoints.length > 15 && phase === 'drawing') {
            phase = 'morphing';
            createPolyhedronFromPath();
        }
    }
}

// --- More efficient line drawing ---
function updatePathLine() {
    if (phase !== 'drawing' || pathPoints.length < 2) {
        if (pathLine) pathLine.visible = false;
        return;
    }

    if (pathLine) lineGroup.remove(pathLine);

    const curve = new THREE.CatmullRomCurve3(pathPoints);
    const points = curve.getPoints(pathPoints.length * 5);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2 });
    pathLine = new THREE.Line(geometry, material);
    lineGroup.add(pathLine);
}

// --- A proper way to create a polyhedron ---
function createPolyhedronFromPath() {
    if (pathPoints.length < 4) return;

    if (pathLine) {
        lineGroup.remove(pathLine);
        pathLine.geometry.dispose();
        pathLine.material.dispose();
        pathLine = null;
    }

    // A Dodecahedron is a complex shape with 12 faces, a good representation of a multi-faceted boundary.
    const baseGeometry = new THREE.DodecahedronGeometry(2.5, 0);
    const edgesGeometry = new THREE.EdgesGeometry(baseGeometry);
    const material = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.75 });

    polyhedron = new THREE.LineSegments(edgesGeometry, material);
    scene.add(polyhedron);

    // Store original positions for morphing
    polyhedron.userData.originalPositions = baseGeometry.attributes.position.clone();

    // Enable camera controls now that the interactive object exists
    controls.enabled = true;
}

// --- Morph the polyhedron vertices for a dynamic effect ---
function updatePolyhedronMorph() {
    if (!polyhedron) return;

    const time = performance.now() * 0.0005;
    const positions = polyhedron.geometry.attributes.position;
    const originalPositions = polyhedron.userData.originalPositions;

    for (let i = 0; i < positions.count; i++) {
        const ox = originalPositions.getX(i);
        const oy = originalPositions.getY(i);
        const oz = originalPositions.getZ(i);

        const morphFactor = 0.5;
        const dx = Math.sin(time * 1.5 + oy) * morphFactor;
        const dy = Math.cos(time * 1.2 + oz) * morphFactor;
        const dz = Math.sin(time * 1.8 + ox) * morphFactor;

        positions.setXYZ(i, ox + dx, oy + dy, oz + dz);
    }
    positions.needsUpdate = true;
    polyhedron.rotation.y += 0.001;
}

// --- More robust ΔCMH calculation ---
function updateDeltaCMH() {
    let distance = 0;
    if (phase === 'drawing' && pathPoints.length > 0) {
        distance = pathPoints[pathPoints.length - 1].length();
    } else if (phase === 'morphing' && polyhedron) {
        const positions = polyhedron.geometry.attributes.position;
        let totalDist = 0;
        for (let i = 0; i < positions.count; i++) {
            totalDist += new THREE.Vector3().fromBufferAttribute(positions, i).length();
        }
        distance = totalDist / positions.count;
    } else {
        document.getElementById('delta-value').textContent = '—';
        return;
    }
    document.getElementById('delta-value').textContent = (distance / 5).toFixed(3);
}

// --- Main Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    time += 0.01;

    if (phase === 'drawing') {
        updatePathLine();
    } else if (phase === 'morphing') {
        updatePolyhedronMorph();
    }

    if (mouseActive) {
        updateDeltaCMH();
    }

    if (originDot) {
        originDot.rotation.y = time;
    }

    controls.update();
    renderer.render(scene, camera);
}

// --- Window Resize Handler ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Start the application ---
window.addEventListener('DOMContentLoaded', init);
