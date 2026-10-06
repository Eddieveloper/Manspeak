/* ============================================================
   THE BLACK CLIPPER — full-hero canvas, model centred (as in the
   reference stage). Slow continuous spin + smooth mouse-follow.
   prefers-reduced-motion: renders still.
   ============================================================ */
import * as THREE from 'three';
import { buildClipperGeometry } from './geometry.js';

const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

function createMetalEnvironment(){
  const envCanvas = document.createElement('canvas');
  envCanvas.width = 512;
  envCanvas.height = 256;
  const ctx = envCanvas.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, 0, envCanvas.height);
  base.addColorStop(0, '#08090b');
  base.addColorStop(0.48, '#4b4e52');
  base.addColorStop(1, '#111214');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, envCanvas.width, envCanvas.height);
  [[0.18, 0.055, 0.88], [0.48, 0.12, 0.48], [0.82, 0.045, 0.78]].forEach(([x, width, opacity])=>{
    const highlight = ctx.createLinearGradient((x - width) * envCanvas.width, 0, (x + width) * envCanvas.width, 0);
    highlight.addColorStop(0, 'rgba(220,226,235,0)');
    highlight.addColorStop(0.5, 'rgba(220,226,235,' + opacity + ')');
    highlight.addColorStop(1, 'rgba(220,226,235,0)');
    ctx.fillStyle = highlight;
    ctx.fillRect((x - width) * envCanvas.width, 0, width * 2 * envCanvas.width, envCanvas.height);
  });
  const environment = new THREE.CanvasTexture(envCanvas);
  environment.mapping = THREE.EquirectangularReflectionMapping;
  environment.colorSpace = THREE.SRGBColorSpace;
  return environment;
}

export function mountClipper(canvas, stage){
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  const scene = new THREE.Scene();
  scene.environment = createMetalEnvironment();
  scene.add(new THREE.AmbientLight(0xd9dce2, 1.1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(-3, 4, 5);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, 1.4);
  rimLight.position.set(3, 1, -4);
  scene.add(rimLight);
  const pivot = new THREE.Group();     // fitting + scroll tilt
  const spinner = new THREE.Group();   // drag + idle drift
  pivot.add(spinner); scene.add(pivot);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x111317,
    metalness: 0.82,
    roughness: 0.28,
    envMapIntensity: 1.35,
    clearcoat: 0.65,
    clearcoatRoughness: 0.24
  });
  const mesh = new THREE.Mesh(buildClipperGeometry(), material);
  mesh.geometry.computeBoundingSphere();
  spinner.add(mesh);
  spinner.rotation.set(-0.25, 0.45, 0.15);

  let lastW = 0, lastH = 0, lastFinalMode = false;
  let baseScale = 1, scaleFactor = 1;
  const finalProgress = ()=> Math.max(0, Math.min(1, Number(stage.style.getPropertyValue('--final-progress')) || 0));

  function resize(){
    const w = Math.max(1, Math.round(stage.clientWidth));
    const h = Math.max(1, Math.round(stage.clientHeight));
    const finalMode = stage.classList.contains('final-mode');
    if (w === lastW && h === lastH && finalMode === lastFinalMode) return;
    lastW = w; lastH = h;
    lastFinalMode = finalMode;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);

    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    // reference sizing; centred horizontally, ~48.8% down (45% on phones)
    const visH = 2 * Math.tan(camera.fov * Math.PI / 360) * camera.position.z;
    const phone = w < 768 || w / h < 1;
    pivot.position.set(0, (0.5 - (phone ? 0.45 : 0.488)) * visH, 0);
    const px = Math.min(h * 0.5, w * (phone ? 0.56 : 0.29));
    baseScale = (px / h) * visH * 1.5;
    if (REDUCED) scaleFactor = finalMode ? 1.2 : 1;
    pivot.scale.setScalar(baseScale * scaleFactor);
    render();
  }

  function render(){
    renderer.render(scene, camera);
  }

  /* ---------------- mouse follow ---------------- */
  let mx = 0, my = 0;
  window.addEventListener('mousemove', (e)=>{
    mx = (e.clientX / window.innerWidth) * 2 - 1;
    my = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* ---------------- loop ---------------- */
  let running = false, raf = 0, lastT = 0;
  function tick(now){
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - lastT) / 1000, 0.1);
    lastT = now;
    const targetScale = 1 + 0.2 * finalProgress();
    scaleFactor = THREE.MathUtils.lerp(scaleFactor, targetScale, 3.2 * dt);
    pivot.scale.setScalar(baseScale * scaleFactor);
    spinner.rotation.y += 0.15 * dt;                                     // slow spin
    mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, mx * 0.24, 3.2 * dt);
    mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, my * 0.14, 3.2 * dt);
    render();
  }

  function start(){
    if (REDUCED){ render(); return; }   // still image
    if (running) return;
    running = true; lastT = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function stop(){ running = false; cancelAnimationFrame(raf); }

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  resize();
  return { start, stop, resize };
}
