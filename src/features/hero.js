/* ============================================================
   HERO — layout maths, the motion controller and the clipper loader.

   sizeHero()      writes CSS custom properties on #showcase: ring scale
                   and carousel extent.
   setHomeActive() the router tells us whether the home view is showing.
   Motion (ring + clipper) runs only when: home view AND hero on screen
   AND tab visible. Everything stops otherwise, to save battery.
   ============================================================ */
import { startRing, stopRing } from './ring.js';

const state = { home: true, inView: true, finalVisible: false, pageVisible: !document.hidden };
let clipper = null;   // { start, stop, resize } once the 3D chunk has loaded
let restoreFinalPortal = null;
let activateFinalIntro = null;

function sync(){
  const on = state.home && (state.inView || state.finalVisible) && state.pageVisible;
  if (on) startRing(); else stopRing();
  if (clipper){ if (on) clipper.start(); else clipper.stop(); }
}
export function setHomeActive(on){
  state.home = on;
  if (!on && restoreFinalPortal) restoreFinalPortal();
  if (on && activateFinalIntro) activateFinalIntro();
  sync();
}

export function initHeroMotion(){
  const carouselSignature = document.getElementById('carouselSignature');
  if (carouselSignature){
    const signatureSheet = document.getElementById('sheet');
    const syncSignature = ()=>{
      const bounds = carouselSignature.getBoundingClientRect();
      const sheetTop = signatureSheet ? signatureSheet.getBoundingClientRect().top : Infinity;
      const inViewport = bounds.bottom > 0 && bounds.top < window.innerHeight;
      const uncovered = sheetTop > bounds.top + bounds.height * 0.5;
      carouselSignature.classList.toggle('is-visible', inViewport && uncovered);
    };
    window.addEventListener('scroll', syncSignature, { passive: true });
    window.addEventListener('resize', syncSignature);
    syncSignature();
  }
  // the hero is pinned, so it is "in view" until the sheet has covered it
  const sheet = document.getElementById('sheet');
  if (sheet && 'IntersectionObserver' in window){
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none';
    sheet.prepend(probe);   // sheet's top edge
    new IntersectionObserver(([en])=>{
      state.inView = en.isIntersecting || en.boundingClientRect.top > 0;
      sync();
    }, { threshold: 0 }).observe(probe);
  }
  const final = document.querySelector('.final');
  const finalMount = document.getElementById('finalClipperMount');
  const clipperStage = document.getElementById('clipperStage');
  if (final && finalMount && clipperStage){
    const finalIsIntro = final.classList.contains('final-intro');
    let sequenceIndex = 0;
    const makeAnimatedWords = text =>{
      const fragment = document.createDocumentFragment();
      const words = text.trim().split(/\s+/);
      words.forEach(word=>{
        const wordElement = document.createElement('span');
        wordElement.className = 'final-word';
        wordElement.setAttribute('aria-hidden', 'true');
        Array.from(word).forEach(character=>{
          const letter = document.createElement('span');
          letter.className = 'final-letter';
          letter.style.setProperty('--letter-index', sequenceIndex++);
          letter.textContent = character;
          wordElement.appendChild(letter);
        });
        fragment.appendChild(wordElement);
      });
      return fragment;
    };
    const finalTitle = final.querySelector('#finalTitle');
    let finalTitleAnimated = false;
    if (finalTitle){
      const titleText = finalTitle.textContent.trim();
      finalTitle.setAttribute('aria-label', titleText);
      finalTitle.replaceChildren(makeAnimatedWords(titleText));
    }
    const finalDetails = final.querySelector('.final-wrap > p');
    if (finalDetails){
      const label = finalDetails.textContent.trim();
      finalDetails.setAttribute('aria-label', label);
      Array.from(finalDetails.childNodes).forEach(node=>{
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()){
          const words = makeAnimatedWords(node.textContent);
          node.replaceWith(words);
        } else if (node.nodeType === Node.ELEMENT_NODE && node.id === 'nextSlot'){
          node.classList.add('final-letter-group');
          node.style.setProperty('--letter-index', sequenceIndex++);
          node.setAttribute('aria-hidden', 'true');
        }
      });
    }
    const bookLabel = final.querySelector('.final-book > span');
    if (bookLabel){
      const text = bookLabel.textContent.trim();
      bookLabel.setAttribute('aria-hidden', 'true');
      bookLabel.parentElement.setAttribute('aria-label', text);
      bookLabel.replaceChildren(makeAnimatedWords(text));
    }
    const textLink = final.querySelector('.final-wrap .ghost');
    if (textLink){
      const text = textLink.textContent.trim();
      textLink.setAttribute('aria-label', text);
      const chatIcon = textLink.querySelector('svg');
      if (chatIcon){
        chatIcon.classList.add('final-flow-up');
        chatIcon.style.setProperty('--shape-index', sequenceIndex++);
      }
      textLink.childNodes.forEach(node=>{
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()){
          const words = makeAnimatedWords(node.textContent);
          node.replaceWith(words);
        }
      });
    }
    final.querySelectorAll('.final-book,.final-wrap .ghost').forEach(shape=>{
      shape.classList.add('final-flow-up');
      shape.style.setProperty('--shape-index', sequenceIndex++);
    });
    final.classList.add('final-sequence-ready');
    const clipperHome = document.createComment('3D clipper home');
    clipperStage.before(clipperHome);
    let finalSpacer = null;
    let finalFrame = 0;
    let lastScrollY = window.scrollY;
    const leaveFinal = ()=>{
      if (finalSpacer){
        finalSpacer.before(final);
        finalSpacer.remove();
        finalSpacer = null;
      }
      final.classList.remove('is-portal');
      final.style.removeProperty('--final-progress');
      final.style.removeProperty('--final-rise');
      final.style.removeProperty('--final-reveal');
      final.style.removeProperty('pointer-events');
      state.finalVisible = false;
      if (clipperStage.parentNode === finalMount){
        clipperStage.classList.remove('final-mode');
        clipperStage.style.removeProperty('--final-progress');
        clipperStage.style.removeProperty('translate');
        clipperHome.parentNode.insertBefore(clipperStage, clipperHome);
        if (clipper) clipper.resize();
      }
    };
    restoreFinalPortal = leaveFinal;
    if (finalIsIntro){
      activateFinalIntro = ()=>{
        finalMount.appendChild(clipperStage);
        clipperStage.classList.add('final-mode');
        clipperStage.style.setProperty('--final-progress', '1');
        final.style.setProperty('--final-reveal', 'circle(150vmax at 50% 50%)');
        if (clipper) clipper.resize();
      };
      activateFinalIntro();
      if (!finalTitleAnimated){
        finalTitleAnimated = true;
        requestAnimationFrame(()=> final.classList.add('final-sequence-visible'));
      }
    }
    const updateFinal = ()=>{
      finalFrame = 0;
      const scrollY = window.scrollY;
      const scrollingDown = scrollY > lastScrollY;
      lastScrollY = scrollY;
      if (!state.home){ leaveFinal(); sync(); return; }
      if (finalIsIntro){ return; }
      if (!finalSpacer && final.parentNode !== document.body){
        const bounds = final.getBoundingClientRect();
        if (bounds.top > window.innerHeight || bounds.bottom <= 0){ state.finalVisible = false; return; }
        finalSpacer = document.createElement('div');
        finalSpacer.className = 'final-spacer';
        finalSpacer.style.height = Math.max(final.offsetHeight + window.innerHeight * 1.25, window.innerHeight * 2.25) + 'px';
        final.before(finalSpacer);
        document.body.appendChild(final);
        final.classList.add('is-portal');
      }
      const bounds = finalSpacer ? finalSpacer.getBoundingClientRect() : final.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      if (finalSpacer && (bounds.top > viewportHeight || bounds.bottom < 0)){
        leaveFinal();
        sync();
        return;
      }
      const clamp01 = value => Math.max(0, Math.min(1, value));
      const progress = finalSpacer
        ? clamp01((viewportHeight - bounds.top) / viewportHeight)
        : 0;
      if (!finalTitleAnimated && scrollingDown && progress >= 0.14){
        finalTitleAnimated = true;
        final.classList.add('final-sequence-visible');
      }
      state.finalVisible = progress > 0;
      final.style.setProperty('--final-progress', progress.toFixed(3));
      final.style.setProperty('--final-rise', ((1 - progress) * 34).toFixed(1) + 'px');
      final.style.setProperty('--final-reveal', 'circle(' + (progress * 150).toFixed(1) + 'vmax at 50% 50%)');
      final.style.pointerEvents = progress > 0.96 ? 'auto' : 'none';
      if (finalSpacer){
        if (clipperStage.parentNode !== finalMount){
          clipperStage.style.translate = 'none';
          finalMount.appendChild(clipperStage);
          clipperStage.classList.add('final-mode');
          if (clipper) clipper.resize();
        }
        clipperStage.style.setProperty('--final-progress', progress.toFixed(3));
      }
      sync();
    };
    const scheduleFinalUpdate = ()=>{
      if (!finalFrame) finalFrame = requestAnimationFrame(updateFinal);
    };
    window.addEventListener('scroll', scheduleFinalUpdate, { passive: true });
    window.addEventListener('resize', scheduleFinalUpdate);
    updateFinal();
  }
  document.addEventListener('visibilitychange', ()=>{ state.pageVisible = !document.hidden; sync(); });
}

/* ---------------- layout ---------------- */
export function sizeHero(){
  const showcase = document.getElementById('showcase');
  if (!showcase) return;
  const vw = window.innerWidth;
  const phone = vw <= 700;
  let k, ringY, extent, mv, showMt;
  if (phone){
    k = Math.max(0.62, Math.min(vw/560, 0.8));
    ringY = -470*k;
    extent = 250*k;
    mv = 300;
    showMt = -34*k;
  } else {
    k = Math.max(Math.min(vw/1172, 1.32), Math.min(vw/1560, 1.0));
    ringY = -470*k;
    extent = 222*k;
    mv = Math.max(230, 196*k);
    showMt = -34*k;
  }
  const set = (n, v)=> showcase.style.setProperty(n, v);
  set('--k', k.toFixed(3));
  set('--ring-y', ringY.toFixed(1) + 'px');
  set('--show-h', (mv + extent + 40) + 'px');
  set('--show-mt', showMt.toFixed(1) + 'px');

  if (clipper) clipper.resize();
}

/* ---------------- the glass clipper (three.js, loaded lazily) ---------------- */
function webglAvailable(){
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch(e){ return false; }
}

export function loadClipper(){
  const stage = document.getElementById('clipperStage');
  const canvas = document.getElementById('clipper');
  if (!stage || !canvas) return;
  if (!webglAvailable()){ stage.hidden = true; return; }
  const go = ()=> import('./clipper/scene.js')
    .then(m=>{
      clipper = m.mountClipper(canvas, stage);
      stage.classList.add('ready');
      sync();
    })
    .catch(err=>{ console.warn('MansPeak: 3D clipper unavailable.', err); stage.hidden = true; });
  // three.js is ~150 KB gzipped: fetch it after the page is interactive
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1500 });
  else setTimeout(go, 600);
}

let rTimer = 0;
export function initHeroResize(){
  const onResize = ()=>{ cancelAnimationFrame(rTimer); rTimer = requestAnimationFrame(sizeHero); };
  window.addEventListener('resize', onResize);
  if (window.visualViewport) visualViewport.addEventListener('resize', onResize);
}
