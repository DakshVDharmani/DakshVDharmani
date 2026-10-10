import * as THREE from '/node_modules/three/build/three.module.js';
import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

const canvas = document.querySelector('#view');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0d1117');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = false;

scene.add(new THREE.HemisphereLight(0xe8efff, 0x30333b, 2.0));
const key = new THREE.DirectionalLight(0xfff1dc, 3.0);
key.position.set(-4, 6, 8);
scene.add(key);
const fill = new THREE.DirectionalLight(0xc8ddff, 1.25);
fill.position.set(5, 1, 5);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffb66e, 2.1);
rim.position.set(1, 4, -5);
scene.add(rim);

const camera = new THREE.PerspectiveCamera(32, canvas.width / canvas.height, 0.01, 1000);
camera.position.set(0, 0, 8);

const flight = new THREE.Group();
scene.add(flight);
const loader = new GLTFLoader();
const gltf = await loader.loadAsync('/ironman.glb');
flight.add(gltf.scene);
flight.updateMatrixWorld(true);
const meshBounds = [];
flight.traverse((object) => {
  if (!object.isMesh) return;
  const box = new THREE.Box3().setFromObject(object);
  const meshSize = box.getSize(new THREE.Vector3());
  const meshCenter = box.getCenter(new THREE.Vector3());
  meshBounds.push({
    object,
    box,
    name: object.name,
    size: [meshSize.x, meshSize.y, meshSize.z],
    center: [meshCenter.x, meshCenter.y, meshCenter.z]
  });
});
// A pair of stray bind-pose meshes in this GLB sit tens of thousands of units
// below the character. Keep them untouched in the scene, but frame the central
// figure from the coherent cluster of actual character meshes.
const characterMeshes = meshBounds.filter(({ size: meshSize, center: meshCenter }) =>
  Math.max(...meshSize) < 1000 && Math.max(...meshCenter.map(Math.abs)) < 1000
);
if (!characterMeshes.length) throw new Error('Could not identify the character mesh bounds in ironman.glb.');
const bounds = new THREE.Box3();
for (const mesh of characterMeshes) bounds.union(mesh.box);
const size = bounds.getSize(new THREE.Vector3());
const center = bounds.getCenter(new THREE.Vector3());
gltf.scene.position.sub(center);
flight.updateMatrixWorld(true);

// Keep a uniform scale; framing follows the model's measured bounds.
const maxDimension = Math.max(size.x, size.y, size.z);
const fitHeight = Math.min(0.72 * (canvas.height / canvas.width), 0.68);
const distance = (maxDimension * 0.5) / (Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * fitHeight);
camera.position.set(0, 0, distance * 0.96);
camera.near = Math.max(0.001, distance / 1000);
camera.far = distance * 100;
camera.updateProjectionMatrix();

const baseRotation = flight.rotation.clone();
const loopDuration = 6;
window.modelInfo = {
  meshes: 0,
  materials: new Set(),
  textures: new Set(),
  animations: gltf.animations.length,
  bounds: { x: size.x, y: size.y, z: size.z },
  framedMeshCount: characterMeshes.length,
  largestMeshes: meshBounds
    .sort((a, b) => Math.max(...b.size) - Math.max(...a.size))
    .slice(0, 8)
    .map(({ name, size: meshSize, center: meshCenter }) => ({ name, size: meshSize, center: meshCenter })),
  hasSkin: false
};
flight.traverse((object) => {
  if (!object.isMesh) return;
  window.modelInfo.meshes++;
  if (object.isSkinnedMesh) window.modelInfo.hasSkin = true;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) {
    if (!material) continue;
    window.modelInfo.materials.add(material.name || '(unnamed)');
    for (const value of Object.values(material)) if (value?.isTexture) window.modelInfo.textures.add(value.name || '(embedded texture)');
  }
});
window.modelInfo.materials = [...window.modelInfo.materials];
window.modelInfo.textures = [...window.modelInfo.textures];

window.renderAtTime = (seconds) => {
  const t = ((seconds % loopDuration) + loopDuration) % loopDuration;
  const phase = (2 * Math.PI * t) / loopDuration;
  flight.position.y = maxDimension * 0.05 * Math.sin(phase);
  flight.rotation.set(
    baseRotation.x + THREE.MathUtils.degToRad(2) * Math.sin(phase),
    baseRotation.y + THREE.MathUtils.degToRad(10) * Math.sin(phase),
    baseRotation.z + THREE.MathUtils.degToRad(1.5) * Math.sin(phase * 2)
  );
  renderer.render(scene, camera);
};
window.renderAtTime(0);
window.ready = true;
