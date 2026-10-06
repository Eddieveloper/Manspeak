/* ============================================================
   THE RING — 37 cards on a cylinder, the creatives below cycled.
   Card creatives map to portraits from CUTS, so the ring showcases
   the actual haircuts we sell. Driven by its own rAF loop, which
   hero.js starts and stops with the hero's visibility.
   ============================================================ */
import { peso } from '../config.js';
import { CUTS } from '../data/cuts.js';
import { portrait } from '../lib/portrait.js';

export const SHOTS = CUTS.map((_, cut)=>({ cut }));
function creative(shot){
  const cut = CUTS[shot.cut];
  const image = portrait(cut, 'front');
  return '<div class="cv-ph"><img alt="" src="' + image + '"><span class="cv-scrim"></span></div>' +
         '<div class="cv-photo-label"><span>' + cut.name + '</span><b>' + peso() + '</b></div>';
}

const RING = { R:891, N:37, step:360/37, cull:54, fadeStart:40, speed:1.9, phase:-2, last:0, rafId:0, running:false, cards:[] };
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function buildRing(){
  const ring = document.getElementById('ring');
  if (!ring) return;
  ring.innerHTML = '';
  RING.cards.length = 0;
  for (let i=0;i<RING.N;i++){
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = creative(SHOTS[i % SHOTS.length]) + '<div class="edge"></div>';
    const img = card.querySelector('img');
    if (img){
      img.addEventListener('load', ()=> card.classList.add('photo-ready'), { once:true });
      img.addEventListener('error', ()=> card.classList.add('broken'), { once:true });
      if (img.complete && img.naturalWidth) card.classList.add('photo-ready');
    }
    ring.appendChild(card);
    RING.cards.push(card);
  }
}

/* ---- which creative faces the camera; the mini-booker features its cut ---- */
const frontListeners = new Set();
let lastFrontCut = -1;
export function onFrontChange(fn){ frontListeners.add(fn); }
function frontIndex(){
  let best = 0, bestA = 999;
  for (let i=0;i<RING.N;i++){
    const a = ((i*RING.step + RING.phase) % 360 + 540) % 360 - 180;
    if (Math.abs(a) < bestA){ bestA = Math.abs(a); best = i; }
  }
  return best;
}
/** The CUTS index currently nearest the camera. */
export function frontCut(){ return SHOTS[frontIndex() % SHOTS.length].cut; }

export function placeCards(){
  const cards = RING.cards;
  for (let i=0;i<cards.length;i++){
    const a = ((i*RING.step + RING.phase) % 360 + 540) % 360 - 180;
    const el = cards[i];
    const absA = Math.abs(a);
    const r = a*Math.PI/180, c = Math.cos(r);
    el.style.transform = 'translate3d(' + (RING.R*Math.sin(r)).toFixed(2) + 'px,0,' + (RING.R*(1-c)).toFixed(2) + 'px) rotateY(' + (-a).toFixed(3) + 'deg)';
    el.style.filter = 'brightness(' + (0.84 + 0.5*(1/c - 1)).toFixed(3) + ')';
    el.style.zIndex = Math.round(1000 - Math.abs(a));
    if (absA > RING.cull){
      el.style.visibility='hidden';
      el.style.opacity='0';
      continue;
    }
    el.style.visibility='visible';
    el.style.opacity = Math.min(1, (RING.cull - absA) / (RING.cull - RING.fadeStart)).toFixed(3);
  }
  const cut = frontCut();
  if (cut !== lastFrontCut){
    lastFrontCut = cut;
    frontListeners.forEach(fn=> fn(cut));
  }
}

function tick(t){
  const dt = Math.min((t - RING.last)/1000, 0.1);
  RING.last = t;
  RING.phase -= RING.speed * dt;
  placeCards();
  if (RING.running) RING.rafId = requestAnimationFrame(tick);
}
export function startRing(){
  if (RING.running || reduceMotion) return;
  RING.running = true; RING.last = performance.now();
  RING.rafId = requestAnimationFrame(tick);
}
export function stopRing(){ RING.running = false; cancelAnimationFrame(RING.rafId); }
