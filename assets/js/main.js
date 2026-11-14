/* Lagnaþjónustan prototype (fork of the Raftákn/Rein engine): motion and interaction from the Rio Property spec (§4, §5), as rebuilt for Trésmiðjan Rein.
   One mobile boundary everywhere: <=767px. Reduced motion: everything at its end state. */
(() => {
  const html = document.documentElement;
  const body = document.body;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOB = innerWidth <= 767;
  const TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  if (RM) html.classList.add('no-anim');

  gsap.registerPlugin(ScrollTrigger, SplitText, Flip, CustomEase);
  gsap.defaults({ ease: 'power1.out', duration: 0.5 });
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------- §4.1 Lenis + mouse drag-scroll ---------- */
  let lenis = null;
  if (!RM) {
    lenis = new Lenis({ wheelMultiplier: 0.75, duration: 1.25 });
    window.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const stopScroll = () => lenis && lenis.stop();
  const startScroll = () => lenis && lenis.start();
  const scrollToY = (y, opts = {}) => (lenis ? lenis.scrollTo(y, opts) : scrollTo({ top: typeof y === 'number' ? y : y.getBoundingClientRect().top + scrollY + (opts.offset || 0) }));

  if (lenis && !TOUCH) {
    let d = null;
    addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.pointerType !== 'mouse') return;
      if (e.target.closest('input, textarea, select, label, [data-slider], [data-select], [data-finder], .menu, .list_names')) return;
      d = { y: e.clientY, ly: e.clientY, start: lenis.scroll, moved: false, v: 0, t: performance.now() };
    });
    addEventListener('pointermove', (e) => {
      if (!d) return;
      const dy = e.clientY - d.y;
      if (!d.moved) { if (Math.abs(dy) < 6) return; d.moved = true; body.style.userSelect = 'none'; lenis.stop(); }
      const now = performance.now(); const dt = Math.max(now - d.t, 1);
      d.v = 0.92 * d.v + 0.08 * ((e.clientY - d.ly) / dt); d.t = now; d.ly = e.clientY;
      lenis.scrollTo(d.start - 1.25 * dy, { immediate: true, force: true });
    });
    const up = () => {
      if (!d) return;
      const was = d; d = null;
      if (!was.moved) return;
      body.style.userSelect = '';
      lenis.start();
      addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); }, { capture: true, once: true });
      if (Math.abs(was.v) > 0.4) lenis.scrollTo(lenis.scroll - 6 * was.v * 60, { duration: 1.2, easing: (t) => 1 - Math.pow(1 - t, 3) });
    };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }

  /* ---------- §4.3 page transitions ---------- */
  const navH = () => ($('[data-nav-bar]')?.offsetHeight || 108);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    const href = a.getAttribute('href');
    if (!href || /^(mailto:|tel:)/.test(href) || a.target === '_blank' || a.hasAttribute('data-transition-prevent')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname) {
      e.preventDefault();
      if (body.classList.contains('is-menu-open')) closeMenu();
      if (a.matches('[data-to-top]')) return scrollToY(0, { duration: 1.5 });
      if (url.hash) handleSameHash(url.hash.slice(1), a);
      else scrollToY(0, { duration: 1.5 });
      return;
    }
    e.preventDefault();
    body.classList.add('is-transitioning');
    gsap.delayedCall(RM ? 0.2 : 1, () => { location.href = a.href; });
  });
  addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });

  /* ---------- §4.5–4.6 nav: theme under the bar, hide on scroll down ---------- */
  const bar = $('[data-nav-bar]');
  const themed = $$('[data-theme-section]');
  const updateNav = () => {
    if (body.classList.contains('is-menu-open')) return;
    const y = navH() / 2;
    for (let i = themed.length - 1; i >= 0; i--) {
      const r = themed[i].getBoundingClientRect();
      if (r.top <= y && r.bottom > y) {
        body.dataset.themeNav = themed[i].dataset.themeSection;
        // transparent only at the very top: once scrolled, a bar over the hero text gets a solid ground
        const bg = themed[i].dataset.bgSection;
        body.dataset.bgNav = bg === 'transparent' && scrollY > 40 ? 'dark' : bg;
        return;
      }
    }
  };
  updateNav();
  const hideTl = RM ? null : gsap.from(bar, { yPercent: -100, duration: 0.5, ease: 'power1.out', paused: true }).progress(1);
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      updateNav();
      if (!hideTl || body.classList.contains('is-menu-open')) return;
      if (self.direction === 1 && self.scroll() > navH()) hideTl.reverse(); else hideTl.play();
    },
  });

  /* ---------- §4.7 menu ---------- */
  const burger = $('[data-burger]');
  const menu = $('[data-menu]');
  const main = $('#main');
  let menuTimer;
  function openMenu(e) {
    clearTimeout(menuTimer);
    menu.hidden = false;
    menu.offsetHeight; // commit the closed state before the transition
    menu.dataset.status = 'open';
    body.classList.add('is-menu-open');
    body.dataset.themeNav = 'dark'; body.dataset.bgNav = 'transparent';
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Loka valmynd');
    main.inert = true; $('footer').inert = true;
    hideTl && hideTl.play();
    stopScroll();
    const viaKey = e && e.detail === 0;
    (viaKey ? $('.menu_link', menu) : menu).focus({ preventScroll: true });
  }
  function closeMenu(returnFocus) {
    menu.dataset.status = 'closed';
    body.classList.remove('is-menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Valmynd');
    main.inert = false; $('footer').inert = false;
    startScroll(); updateNav();
    menuTimer = setTimeout(() => { if (menu.dataset.status === 'closed') menu.hidden = true; }, RM ? 0 : 1100);
    if (returnFocus) burger.focus({ preventScroll: true });
  }
  burger.addEventListener('click', (e) => (body.classList.contains('is-menu-open') ? closeMenu(e.detail === 0) : openMenu(e)));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && body.classList.contains('is-menu-open')) closeMenu(true);
  });

  /* ---------- reveals (§4.4 load, §4.15 scroll) ---------- */
  const canSplit = !MOB && !RM;
  const st = (el) => ({ trigger: el, start: 'top bottom', end: 'top 90%', toggleActions: 'none play none reset' });
  function scrollReveals() {
    if (RM) return;
    $$('[data-anim]').forEach((el) => {
      const k = el.dataset.anim;
      if (k === 'words' || k === 'lines' || k === 'chars') {
        if (!canSplit) return;
        const cfg = k === 'chars' ? { type: 'words, chars', mask: 'chars' } : k === 'words' ? { type: 'words, lines', mask: 'lines' } : { type: 'lines', mask: 'lines' };
        SplitText.create(el, {
          ...cfg, autoSplit: true, aria: 'auto', linesClass: 'line',
          onSplit(self) {
            $$('.line-mask, [class*="-mask"]', el).forEach((m) => { m.style.paddingBlock = '.5rem'; m.style.marginBlock = '-.5rem'; });
            if (k === 'words') return gsap.from(self.words, { yPercent: 115, duration: 2, ease: 'expo.out', stagger: 0.05, scrollTrigger: st(el) });
            if (k === 'lines') return gsap.from(self.lines, { yPercent: 125, duration: 2, ease: 'expo.out', stagger: 0.1, delay: 0.125, scrollTrigger: st(el) });
            return gsap.from(self.chars, { xPercent: 100, duration: 1.5, ease: 'expo.out', stagger: 0.125, scrollTrigger: st(el) });
          },
        });
      } else if (k === 'fade') gsap.from(el, { opacity: 0, duration: 1.66, ease: 'power1.out', scrollTrigger: st(el) });
      else if (k === 'children-fade') gsap.from(el.children, { opacity: 0, yPercent: 15, duration: 1.66, ease: 'power3.out', stagger: 0.125, scrollTrigger: st(el) });
      else if (k === 'mask-diagonal') gsap.fromTo(el, { clipPath: 'polygon(-1% -1%, 0% 0%, 0% 0%)' }, { clipPath: 'polygon(-1% -1%, 250% 0%, 0% 250%)', duration: 3.5, ease: 'power1.inOut', scrollTrigger: st(el) });
    });
    // 1px rules draw in together per group, stagger .1
    const groups = new Map();
    $$('[data-anim="scaleX"]').forEach((r) => { const g = r.closest('.laws_grid, .acc_list'); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(r); });
    groups.forEach((rules, g) => gsap.from(rules, { scaleX: 0, duration: 2, ease: 'power1.inOut', stagger: 0.1, scrollTrigger: st(g) }));
  }

  function loadReveals() {
    if (!canSplit) return;
    $$('[data-load]').forEach((el) => {
      const k = el.dataset.load; const delay = 0.5 + (+el.dataset.delay || 0);
      if (k === 'scale') return gsap.from(el, { scale: 1.25, duration: 3, ease: 'power3.out' });
      if (k === 'chars') {
        const s = SplitText.create(el, { type: 'words, chars', mask: 'chars', aria: 'none' });
        return gsap.from(s.chars, { xPercent: 100, duration: 1.5, ease: 'expo.out', stagger: 0.125, delay });
      }
      if (k === 'words') {
        const s = SplitText.create(el, { type: 'words, lines', mask: 'lines', aria: 'auto' });
        return gsap.from(s.words, { yPercent: 125, duration: 1.5, ease: 'expo.out', stagger: 0.05, delay });
      }
      if (k === 'lines') {
        const s = SplitText.create(el, { type: 'lines', mask: 'lines', aria: 'none' });
        return gsap.from(s.lines, { xPercent: 100, scale: 0.5, duration: 1.75, ease: 'expo.out', stagger: 0.125, delay });
      }
    });
  }

  /* ---------- §4.2 loader (home) ---------- */
  function loader() {
    const hero = $('.hero.is-home');
    if (!hero) return null;
    const curtain = $('[data-curtain]');
    const words = $$('[data-hero-word]');
    const paras = $$('[data-hero-para]');
    if (RM) { gsap.set([words, paras], { visibility: 'visible' }); $('[data-loader]')?.remove(); curtain?.remove(); return null; }
    let first = true;
    try { first = !sessionStorage.getItem('lagnir-loader'); sessionStorage.setItem('lagnir-loader', '1'); } catch (e) { /* private mode */ }
    if (MOB) first = false;
    const ld = $('[data-loader]');
    if (!first && ld) ld.remove();
    CustomEase.create('fakeLoad', 'M0,0 C0.06,0.04 0.25,0.3 0.38,0.36 0.46,0.39 0.56,0.38 0.67,0.38 0.72,0.38 0.74,0.51 0.76,0.51 0.8,0.51 0.85,0.51 0.9,0.52 0.95,0.53 0.97,0.8 1,1');
    stopScroll();
    const tl = gsap.timeline({ delay: 0.5 });
    let I = 0;
    if (first && ld) {
      const logo = $('.wordmark', ld); const letters = $$('.tile_l', ld);
      const track = $('.loader_track', ld); const fill = $('.loader_fill', ld);
      tl.fromTo(logo, { x: 0, scale: 2 }, { x: '6vw', scale: 1, duration: 2.5, ease: 'expo.out' }, 0)
        .fromTo(letters, { xPercent: 125, x: 0 }, { xPercent: 0, x: 0, duration: 1.5, ease: 'expo.out', stagger: 0.1 }, 0)
        .to(logo, { x: 0, duration: 2, ease: 'expo.inOut' }, 1)
        .fromTo(track, { scaleX: 0 }, { scaleX: 1, duration: 2, ease: 'expo.inOut' }, 1)
        .fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: 2.5, ease: 'fakeLoad' }, 2)
        .to(logo, { xPercent: -300, duration: 2.5, ease: 'expo.in' }, 3.75)
        .to(track, { xPercent: -300, duration: 2.5, ease: 'expo.in' }, 3.75)
        .to(letters, { xPercent: -125, duration: 1.5, ease: 'expo.in', stagger: 0.05 }, 3.75)
        .to(track, { scaleX: 0, duration: 1.5, ease: 'expo.in' }, 4)
        .add(() => ld.remove(), 6.3);
      I = 5.25;
    }
    tl.fromTo($$('.nav .tile_l'), { xPercent: 125, x: 0 }, { xPercent: 0, x: 0, duration: 1.5, ease: 'expo.out', stagger: 0.05 }, I)
      .fromTo('[data-nav-bg]', { yPercent: -100 }, { yPercent: 0, duration: 1.5, ease: 'expo.out' }, I)
      .fromTo(burger, { clipPath: 'polygon(0 0,100% 0,100% 0,0 0)' }, { clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)', duration: 1.5, ease: 'expo.out' }, I);
    gsap.set([words, paras], { visibility: 'visible' });
    if (canSplit) {
      words.forEach((w, i) => {
        const s = SplitText.create(w, { type: 'words, chars', mask: 'chars', aria: 'none' });
        tl.fromTo(s.chars, { xPercent: 100 }, { xPercent: 0, duration: 1.5, ease: 'expo.out', stagger: 0.125 }, I + i * 0.1);
      });
      const lines = paras.flatMap((p) => SplitText.create(p, { type: 'lines', mask: 'lines', aria: 'none' }).lines);
      tl.fromTo(lines, { xPercent: 100, scale: 0.5 }, { xPercent: 0, scale: 1, duration: 1.75, ease: 'expo.out', stagger: 0.125 }, I + 1.175);
    }
    tl.fromTo(curtain, { clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)' }, { clipPath: 'polygon(0 0,0 0,0 100%,0 100%)', duration: 1.75, ease: 'expo.inOut' }, I + 0.425)
      .add(() => { curtain.remove(); startScroll(); }, I + 0.425 + 1.75);
    return tl;
  }

  /* ---------- §4.9 hero word split (scrub .5) ---------- */
  function heroSplit() {
    if (RM) return;
    $$('[data-hero]').forEach((hero) => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom center', scrub: 0.5 } });
      $$('[data-split-x]', hero).forEach((el) => tl.to(el, { xPercent: +el.dataset.splitX, ease: 'power1.out' }, 0));
      const ov = $('[data-hero-overlay]', hero);
      if (ov) tl.to(ov, { opacity: 0, ease: 'power2.inOut' }, 0);
    });
    const push = $('.hero_push');
    if (push) new IntersectionObserver(([en]) => push.classList.toggle('is-paused', !en.isIntersecting)).observe(push.closest('[data-hero]'));
    const stage = $('[data-hero-stage]');
    if (stage) gsap.matchMedia().add('(min-width: 768px)', () => {
      gsap.fromTo(stage, { yPercent: 0 }, { yPercent: 50, ease: 'none', scrollTrigger: { trigger: stage.parentElement, start: 'clamp(bottom bottom)', end: 'clamp(bottom top)', scrub: true } });
    });
  }

  /* ---------- §4.10 parallax ---------- */
  function parallax() {
    if (RM) return;
    const mm = gsap.matchMedia();
    $$('[data-parallax]').forEach((el) => {
      const [axis, vals] = el.dataset.parallax.split(':');
      const [a, b] = vals.split(',').map(Number);
      const prop = axis === 'x' ? 'xPercent' : 'yPercent';
      const off = el.dataset.off;
      const q = off === 'm' ? '(min-width: 768px)' : off === 't' ? '(min-width: 992px)' : 'all';
      const [start, end] = (el.dataset.parallaxRange || 'clamp(top bottom),clamp(bottom top)').split(',');
      mm.add(q, () => {
        gsap.fromTo(el, { [prop]: a }, { [prop]: b, ease: 'none', scrollTrigger: { trigger: el.closest('section, .flip_group') || el.parentElement, start, end, scrub: el.dataset.scrub ? +el.dataset.scrub : true } });
      });
    });
  }

  /* ---------- §4.11 marquee ---------- */
  function marquee() {
    const m = $('[data-marquee]');
    if (!m || RM) return;
    const track = $('[data-marquee-track]', m);
    const cols = $$('.marquee_collection', m);
    let p = 50; let ts = -1; let target = -1;
    const dur = () => { const w = cols[0].offsetWidth; const k = innerWidth < 479 ? 0.25 : innerWidth < 991 ? 0.5 : 1; return 30 * (w / innerWidth) * k; };
    let D = dur(); addEventListener('resize', () => { D = dur(); });
    const setX = gsap.quickSetter(cols, 'xPercent');
    let visible = false;
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(m);
    let held = false;
    m.addEventListener('pointerenter', () => { held = FINE; }); m.addEventListener('pointerleave', () => { held = false; });
    gsap.ticker.add((t, dt) => {
      if (!visible || held) return;
      ts += (target - ts) * 0.08;
      p = (((p + (ts * 100 * dt) / 1000 / D) % 100) + 100) % 100;
      setX(-p);
    });
    ScrollTrigger.create({ trigger: m, start: 'top bottom', end: 'bottom top', onUpdate: (s) => { target = s.direction === 1 ? -1 : 1; m.dataset.marqueeStatus = target === -1 ? 'normal' : 'inverted'; } });
    gsap.fromTo(track, { x: '-5vw' }, { x: '5vw', ease: 'none', scrollTrigger: { trigger: m, start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* ---------- §4.12 featured slider ---------- */
  function slider() {
    const wrap = $('[data-slider]');
    if (!wrap || wrap.hasAttribute('data-island-slider')) return; // home: 21st.dev Snap Carousel island
    const track = $('[data-slider-track]', wrap);
    const items = $$('.slider_item', track);
    let cur = 0, target = 0, max = 0, sw = 0, ww = 0, lefts = [], visible = false, settled = false;
    const measure = () => { sw = items[0].offsetWidth; ww = wrap.offsetWidth; lefts = items.map((it) => it.offsetLeft); settled = false; const vis = Math.max(1, Math.round(wrap.offsetWidth / sw)); max = Math.max(0, (items.length - vis) * sw); target = Math.min(target, max); };
    measure(); addEventListener('resize', measure);
    const snap = (bias = 0) => { let i = Math.round(target / sw) + bias; i = Math.max(0, Math.min(i, Math.round(max / sw))); target = i * sw; };
    let drag = null; let suppress = false;
    wrap.addEventListener('pointerdown', (e) => { if (e.button) return; drag = { x: e.clientX, y: e.clientY, t0: target, time: performance.now(), on: false }; });
    addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.on) { if (Math.abs(dx) < 5) return; if (Math.abs(e.clientY - drag.y) > Math.abs(dx)) { drag = null; return; } drag.on = true; }
      target = Math.max(-sw * 0.25, Math.min(max + sw * 0.25, drag.t0 - dx));
    });
    const end = (e) => {
      if (!drag) return;
      const dx = (e.clientX ?? drag.x) - drag.x; const quick = performance.now() - drag.time < 250;
      if (drag.on) {
        suppress = true;
        if (quick && Math.abs(dx) > 30) { const i = Math.round(drag.t0 / sw) + (dx < 0 ? 1 : -1); target = Math.max(0, Math.min(max, i * sw)); }
        else snap();
      }
      drag = null;
    };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    wrap.addEventListener('click', (e) => { if (suppress) { e.preventDefault(); e.stopPropagation(); suppress = false; } }, true);
    let wheelT;
    wrap.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault(); target = Math.max(0, Math.min(max, target + e.deltaX));
      clearTimeout(wheelT); wheelT = setTimeout(() => snap(), 140);
    }, { passive: false });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { target += sw; snap(); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { target -= sw; snap(); e.preventDefault(); }
    });
    wrap.addEventListener('focusin', (e) => { const it = e.target.closest('.slider_item'); if (it) { target = Math.min(max, it.offsetLeft); snap(); } });
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; settled = false; }, { rootMargin: '50px' }).observe(wrap);
    const imgs = items.map((it) => $('[data-p]', it)); const cards = items.map((it) => $('.card', it));
    gsap.ticker.add((t, dt) => {
      if (!visible) return;
      if (cur === target && settled && !drag) return;
      const k = 1 - Math.pow(1 - 0.3, dt / 16.67);
      cur += (target - cur) * k;
      if (Math.abs(target - cur) < 0.05) cur = target;
      settled = cur === target;
      track.style.transform = `translate3d(${-cur}px,0,0)`;
      if (RM) return;
      const c = ww / 2;
      items.forEach((it, i) => {
        const center = lefts[i] - cur + sw / 2;
        const s = Math.max(-1, Math.min(1, (center - c) / (ww / 2)));
        if (imgs[i]) imgs[i].style.transform = `translateX(${-10 * s}%)`;
        cards[i].style.transform = `translateY(${20 * Math.abs(s) - 10}%)`;
      });
    });
  }

  /* ---------- §4.13 personas stagger (>=992) ---------- */
  function personas() {
    const grid = $('[data-personas]');
    if (!grid || RM) return;
    gsap.matchMedia().add('(min-width: 992px)', () => {
      $$('.persona', grid).forEach((c, i) => {
        gsap.fromTo(c, { yPercent: 10 * (i + 1) }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: grid, start: 'top 66%', end: 'center center', scrub: true } });
        gsap.fromTo(c, { yPercent: 0 }, { yPercent: -10 * (i + 1), ease: 'none', immediateRender: false, scrollTrigger: { trigger: grid, start: 'center center', end: 'bottom top', scrub: true } });
      });
    });
  }

  /* ---------- §4.14 scrub-scale ---------- */
  function scrubScale() {
    if (RM) return;
    $$('[data-scrub-scale]').forEach((el) => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom bottom', scrub: true } });
      tl.from(el, { scale: 1.25, duration: 1, ease: 'power1.out' });
      const inner = $('[data-scrub-scale-inner]', el);
      if (inner) tl.from(inner, { scale: 0.8, duration: 1.25, ease: 'power1.out' }, 0);
    });
  }

  /* ---------- §4.16 team Flip ---------- */
  function teamFlip() {
    const group = $('[data-flip-group]');
    if (!group || RM) return;
    const el = $('[data-flip-el]', group); const from = $('[data-flip-from]', group); const to = $('[data-flip-to]', group);
    // rebuilt on every resize: a recorded Flip goes stale when the layout changes under it
    let tl = null; let t;
    const reset = () => { if (tl) { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); tl = null; } gsap.set(el, { clearProps: 'all' }); from.appendChild(el); };
    const build = () => {
      reset();
      if (innerWidth <= 767) return;
      const state = Flip.getState(el);
      to.appendChild(el);
      tl = gsap.timeline({ scrollTrigger: { trigger: group, start: 'clamp(top 20%)', end: 'clamp(bottom bottom)', scrub: 0.5 } });
      tl.add(Flip.from(state, { absolute: true, ease: 'power1.inOut' }));
    };
    build();
    let lastW = innerWidth;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (innerWidth === lastW) return; lastW = innerWidth; build(); ScrollTrigger.refresh(); }, 200); });
  }

  /* ---------- §4.17 footer parallax ---------- */
  function footer() {
    if (RM) return;
    const f = $('footer');
    const tl = gsap.timeline({ scrollTrigger: { trigger: f, start: 'clamp(top bottom)', end: 'clamp(top top)', scrub: true } });
    tl.from('[data-footer-inner]', { yPercent: -25, ease: 'none' }, 0).fromTo('[data-footer-veil]', { opacity: 1 }, { opacity: 0, ease: 'none' }, 0);
  }

  /* ---------- §4.18–4.20 work group: gallery/list, previews, tracking ---------- */
  function work() {
    const w = $('[data-work]');
    if (!w) return;
    const inner = $('[data-work-inner]', w); const gal = $('[data-work-gallery]', w); const list = $('[data-work-list]', w);
    const btns = $$('[data-view]', w);
    let state = 'gallery'; let tl;
    const setBtns = (v) => btns.forEach((b) => { const on = b.dataset.view === v; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on); });
    btns.forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.view;
      if (v === state) return;
      if (tl) tl.progress(1).kill();
      state = v; w.dataset.workState = v; setBtns(v);
      const out = v === 'list' ? gal : list; const inn = v === 'list' ? list : gal;
      const dir = v === 'list' ? 1 : -1;
      if (RM) { out.hidden = true; inn.hidden = false; ScrollTrigger.refresh(); return; }
      inner.style.height = inner.offsetHeight + 'px';
      stopScroll();
      inn.hidden = false;
      const top = inner.getBoundingClientRect().top;
      const oy = Math.max(0, innerHeight / 2 - top);
      gsap.set([out, inn], { transformOrigin: `50% ${oy}px` });
      gsap.set(inn, { position: 'absolute', left: 0, top: 0, right: 0, xPercent: 50 * dir, scale: 0.25, opacity: 0 });
      const imgs = v === 'gallery' ? $$('.card_media', gal) : [];
      gsap.set(imgs, { clipPath: 'polygon(0 100%,100% 100%,100% 100%,0 100%)' });
      tl = gsap.timeline({
        onComplete: () => {
          out.hidden = true;
          gsap.set(out, { clearProps: 'all' });
          gsap.set(inn, { clearProps: 'position,left,top,right,transform,opacity,transformOrigin' });
          inner.style.height = '';
          ScrollTrigger.refresh(); startScroll();
          if (imgs.length) gsap.to(imgs, { clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)', duration: 1, ease: 'expo.out', stagger: 0.1, clearProps: 'clipPath' });
        },
      });
      tl.to(out, { xPercent: -50 * dir, scale: 0.25, opacity: 0, duration: 1, ease: 'expo.inOut' })
        .to(inn, { xPercent: 0, scale: 1, opacity: 1, duration: 1, ease: 'expo.inOut' }, '<');
    }));

    // list: scroll-spy over the 55svh anchors + hover previews
    const rows = $$('[data-row]', list); const cards = $$('[data-preview]', list);
    const ul = $('.list_ul', list); const stack = $('.list_stack', list); const names = $('.list_names', list);
    const setCurrent = (id) => {
      rows.forEach((r) => r.classList.toggle('is-current', r.dataset.row === id));
      cards.forEach((c) => c.classList.toggle('is-current', c.dataset.preview === id));
      const r = rows.find((x) => x.dataset.row === id);
      if (r && names) names.scrollTo({ top: r.offsetTop - names.clientHeight / 2 + r.offsetHeight / 2, behavior: RM ? 'auto' : 'smooth' });
    };
    const io = new IntersectionObserver((ens) => ens.forEach((en) => { if (en.isIntersecting) setCurrent(en.target.dataset.anchor); }), { rootMargin: '-50% 0px -50% 0px' });
    $$('[data-anchor]', list).forEach((a) => io.observe(a));
    let leaveT;
    rows.forEach((r) => {
      r.addEventListener('mouseenter', () => {
        clearTimeout(leaveT);
        rows.forEach((x) => x.classList.toggle('is-hover', x === r));
        cards.forEach((c) => c.classList.toggle('is-hover', c.dataset.preview === r.dataset.row));
        ul.classList.add('is-hovering'); stack.classList.add('is-hovering');
      });
      r.addEventListener('mouseleave', () => {
        leaveT = setTimeout(() => {
          rows.forEach((x) => x.classList.remove('is-hover')); cards.forEach((c) => c.classList.remove('is-hover'));
          ul.classList.remove('is-hovering'); stack.classList.remove('is-hovering');
        }, 150);
      });
    });

    // Raftákn: sector filter (?flokkur=<id>), applied to the gallery, the list rows, previews and anchors
    const fbtns = $$('[data-filter]', w); const status = $('[data-filter-status]', w);
    const applyFilter = (id, animate) => {
      fbtns.forEach((b) => { const on = b.dataset.filter === id; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on); });
      let n = 0; const shown = [];
      $$('[data-cats]', w).forEach((el) => {
        const show = !id || el.dataset.cats.split(' ').includes(id);
        el.hidden = !show;
        if (show && el.classList.contains('gallery_item')) { n++; shown.push(el); }
      });
      const label = fbtns.find((b) => b.dataset.filter === id)?.firstChild.textContent.trim();
      if (status) status.textContent = id ? `${n} verkefni í flokknum ${label}` : '';
      const firstRow = rows.find((r) => !r.closest('[data-cats]').hidden); if (firstRow) setCurrent(firstRow.dataset.row);
      try { const u = new URL(location.href); if (id) u.searchParams.set('flokkur', id); else u.searchParams.delete('flokkur'); history.replaceState(history.state, '', u); } catch (e) { /* ignore */ }
      ScrollTrigger.refresh();
      if (animate && !RM && state === 'gallery') gsap.fromTo(shown.slice(0, 12).map((el) => $('.card_media', el)), { clipPath: 'polygon(0 100%,100% 100%,100% 100%,0 100%)' }, { clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)', duration: 0.9, ease: 'expo.out', stagger: 0.05, clearProps: 'clipPath' });
    };
    fbtns.forEach((b) => b.addEventListener('click', () => applyFilter(b.dataset.filter, true)));
    const want0 = new URLSearchParams(location.search).get('flokkur');
    if (want0 && fbtns.some((b) => b.dataset.filter === want0)) applyFilter(want0, false);

    ScrollTrigger.create({ trigger: w, start: () => `top+=${innerHeight} top`, end: 'bottom bottom', toggleClass: { targets: w, className: 'is-deep' } });

    // §4.20 arriving from another page (or a #hash): highlight the card and bring it into view
    let want = location.hash.slice(1);
    try { const t = JSON.parse(sessionStorage.getItem('lagnir-track') || 'null'); if (t && t.origin !== location.pathname) want = t.id; sessionStorage.removeItem('lagnir-track'); } catch (e) { /* ignore */ }
    const item = want && document.getElementById(want);
    if (item && gal.contains(item)) {
      $('.card', item).classList.add('is-highlighted');
      gsap.delayedCall(RM ? 0 : 2, () => scrollToY(item, { offset: -250, duration: 2, lock: true }));
    }
  }
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-track-id]');
    if (!c) return;
    $$('.is-highlighted').forEach((x) => x.classList.remove('is-highlighted'));
    c.classList.add('is-highlighted'); c.setAttribute('aria-current', 'true');
    try { sessionStorage.setItem('lagnir-track', JSON.stringify({ id: c.dataset.trackId, origin: location.pathname })); } catch (err) { /* ignore */ }
  }, true);

  // same-page #links: list rows scroll to their anchor, fleet cards fill in the hire request
  function handleSameHash(id, a) {
    const listRow = a.closest('[data-row]');
    if (listRow) { const an = $(`[data-anchor="${id}"]`); if (an) scrollToY(an.getBoundingClientRect().top + scrollY - innerHeight / 2 + an.offsetHeight / 2, { duration: 1.2 }); return; }
    if (location.pathname.includes('/taekjafloti/') && a.closest('.card')) return requestMachine(id);
    const el = document.getElementById(id);
    if (el) scrollToY(el, { offset: -navH(), duration: 1.2 });
  }
  function requestMachine(id) {
    const form = $('.contact [data-form]');
    if (!form) return;
    const card = $(`#${CSS.escape(id)} .card_name`) || $(`[data-preview="${id}"] .card_name`);
    const fleetName = $(`[data-track-id="${id}"]`)?.getAttribute('aria-label')?.split(',')[0];
    setSelect(form, 'Tæki til leigu');
    $$('input[name="taeki"]', form).forEach((cb) => { if (cb.value === fleetName) cb.checked = true; });
    goToForm(form, 'fra');
    void card;
  }

  // Hand-off to the request form. Phones: scroll to the fields themselves (they sit under the heading) and do not
  // pop the keyboard. Desktop: show the whole block and focus the next field.
  function goToForm(form, field) {
    if (TOUCH && innerWidth <= 991) { scrollToY($('.form_fields', form) || form, { offset: -90, duration: 1.2 }); return; }
    scrollToY(form.closest('section') || form, { offset: -40, duration: 1.4 });
    setTimeout(() => $(`input[name="${field}"]`, form)?.focus({ preventScroll: true }), RM ? 0 : 1450);
  }

  /* ---------- §5.3 accordion ---------- */
  function accordion() {
    const list = $('[data-accordion]');
    if (!list) return;
    $$('.acc_toggle', list).forEach((b) => b.addEventListener('click', () => {
      const li = b.closest('.acc_item'); const open = !li.classList.contains('is-open');
      $$('.acc_item', list).forEach((x) => { x.classList.remove('is-open'); $('.acc_toggle', x).setAttribute('aria-expanded', 'false'); });
      if (open) { li.classList.add('is-open'); b.setAttribute('aria-expanded', 'true'); }
      setTimeout(() => ScrollTrigger.refresh(), 800);
    }));
  }

  /* ---------- verkbeiðni form: prefill from the chips (?verk= / ?lysing=), checks, local "nothing sent" state ---------- */
  function setSelect() { /* no listbox on this site */ }
  function forms() {
    const qs = new URLSearchParams(location.search);
    const want = qs.get('verk'); const lys = qs.get('lysing');
    $$('[data-form]').forEach((form, idx) => {
      if (idx === 0 || form.closest('.is-request')) {
        if (want) $$(`[data-verk="${CSS.escape(want)}"]`, form).forEach((cb) => { cb.checked = true; });
        if (lys) { const t = $('textarea[name="lysing"]', form); if (t && !t.value) t.value = lys; }
      }
      const err = $('[data-form-error]', form);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(form); const problems = [];
        const nafn = $('input[name="nafn"]', form); const email = $('input[name="netfang"]', form); const simi = $('input[name="simi"]', form);
        [nafn, email, simi].forEach((i) => i.removeAttribute('aria-invalid'));
        if (!String(f.get('nafn')).trim()) { problems.push('Skrifaðu fullt nafn.'); nafn.setAttribute('aria-invalid', 'true'); }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(f.get('netfang')).trim())) { problems.push('Netfangið vantar eða er ekki rétt skrifað.'); email.setAttribute('aria-invalid', 'true'); }
        if (String(f.get('simi')).replace(/\D/g, '').length < 7) { problems.push('Símanúmerið vantar.'); simi.setAttribute('aria-invalid', 'true'); }
        const kt = String(f.get('kennitala') || '').replace(/\D/g, '');
        if (kt && kt.length !== 10) problems.push('Kennitala er 10 tölustafir.');
        if (problems.length) { err.textContent = problems.join(' '); err.hidden = false; $('[aria-invalid="true"]', form)?.focus(); return; }
        err.hidden = true;
        const parts = [];
        const verk = f.getAll('verk'); if (verk.length) parts.push(verk.join(', '));
        const addr = [f.get('heimilisfang'), f.get('postnumer')].map((x) => String(x || '').trim()).filter(Boolean).join(', ');
        if (addr) parts.push(addr);
        parts.push(String(f.get('nafn')).trim());
        $('[data-form-sum]', form).textContent = parts.join(' / ');
        const fields = $('.form_fields', form); const done = $('[data-form-done]', form);
        const swap = () => { fields.hidden = true; done.hidden = false; done.focus({ preventScroll: true }); ScrollTrigger.refresh(); };
        if (RM) return swap();
        gsap.to(fields, { opacity: 0, y: -12, duration: 0.35, ease: 'power2.in', onComplete: () => { swap(); gsap.from(done, { opacity: 0, y: 16, duration: 0.6, ease: 'expo.out' }); } });
      });
    });
  }

  /* ---------- home hero (Caeli: lines part, the object settles, a card frames it with SÍÐAN / 1995) ---------- */
  function lhero() {
    const h = $('[data-lhero]'); if (!h) return;
    const lines = $$('[data-lh-line]', h); const obj = $('[data-lh-obj-in]', h); const fades = $$('[data-lh-fade], [data-lh-foot]', h);
    const card = $('[data-lh-card]', h); const cw = $$('[data-lh-cw]', h);
    if (RM) return;
    // arrival
    const tl = gsap.timeline({ delay: 0.15 });
    if (!MOB) {
      lines.forEach((l, i) => { const s = SplitText.create(l, { type: 'chars', mask: 'chars', aria: 'none' }); (s.masks || []).forEach((m) => { m.style.paddingTop = '.32em'; m.style.marginTop = '-.32em'; }); tl.fromTo(s.chars, { yPercent: 105 }, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.035 }, i * 0.12); });
    } else tl.fromTo(lines, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.1 }, 0);
    tl.fromTo(obj, { yPercent: 18, scale: 1.08, opacity: 0 }, { yPercent: 0, scale: 1, opacity: 1, duration: 1.6, ease: 'expo.out' }, 0.35)
      .fromTo(fades, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }, 0.6);
    gsap.set([lines, obj, fades], { visibility: 'visible' });
    // scroll (desktop only: phones keep a normal first screen)
    gsap.matchMedia().add('(min-width: 768px)', () => {
      gsap.set(card, { visibility: 'visible' });
      const st = gsap.timeline({ scrollTrigger: { trigger: h, start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
      st.to(lines[0], { yPercent: -160, opacity: 0, ease: 'power2.in', duration: 0.35 }, 0)
        .to(lines[1], { yPercent: 160, opacity: 0, ease: 'power2.in', duration: 0.35 }, 0)
        .to(fades, { opacity: 0, y: -10, duration: 0.2 }, 0)
        .to(obj, { scale: 0.68, ease: 'power2.inOut', duration: 0.5 }, 0.05)
        .fromTo(card, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, ease: 'power2.out', duration: 0.35 }, 0.34)
        .fromTo(cw, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, ease: 'expo.out', duration: 0.35, stagger: 0.06 }, 0.44)
        .to({}, { duration: 0.25 });
      return () => gsap.set(card, { clearProps: 'all' });
    });
  }

  /* ---------- price receipt: paper slides out of a slot, leaders draw, stamp drops; VAT toggle rolls the numbers ---------- */
  function receipts() {
    $$('[data-receipt]').forEach((r) => {
      const paper = $('[data-receipt-paper]', r);
      if (!RM) {
        const tl = gsap.timeline({ scrollTrigger: { trigger: r, start: 'top 80%', toggleActions: 'play none none none' } });
        tl.from(paper, { clipPath: 'inset(0 0 100% 0)', y: -24, duration: 1.1, ease: 'expo.out' })
          .from($$('[data-dots]', r), { scaleX: 0, duration: 0.6, ease: 'power2.out', stagger: 0.06 }, 0.35)
          .from($$('.receipt_row', r), { opacity: 0, x: -8, duration: 0.5, stagger: 0.06 }, 0.3)
          .from($('[data-stamp]', r), { scale: 1.5, rotate: -20, opacity: 0, duration: 0.6, ease: 'back.out(2)' }, 0.75);
      }
      const btns = $$('[data-vat]', r); const note = $('[data-vat-note]', r);
      btns.forEach((b) => b.addEventListener('click', () => {
        const on = b.dataset.vat === '1';
        btns.forEach((x) => { const a = x === b; x.classList.toggle('is-active', a); x.setAttribute('aria-pressed', a); });
        note.textContent = on ? 'Einingarverð með 24% virðisaukaskatti.' : 'Einingarverð án virðisaukaskatts.';
        $$('[data-price]', r).forEach((el, i) => {
          const n = Math.round(+el.dataset.price * (on ? 1.24 : 1)); const txt = n.toLocaleString('de-DE');
          const cur = $('.roll_v', el);
          if (RM) { cur.textContent = txt; return; }
          const nx = document.createElement('span'); nx.className = 'roll_v'; nx.textContent = txt; nx.style.cssText = 'position:absolute;top:0;right:0;white-space:nowrap'; el.style.position = 'relative'; el.appendChild(nx);
          gsap.fromTo(nx, { yPercent: on ? 100 : -100 }, { yPercent: 0, duration: 0.45, ease: 'power3.out', delay: i * 0.03 });
          gsap.to(cur, { yPercent: on ? -100 : 100, duration: 0.45, ease: 'power3.out', delay: i * 0.03, onComplete: () => { cur.remove(); nx.style.cssText = ''; } });
        });
      }));
    });
  }

  /* ---------- estimate calculator (verðskrá) ---------- */
  function calc() {
    const c = $('[data-calc]'); if (!c) return;
    const P = { dag: 12500, yfir: 21250, lagm: 25000, utk: 85000, inn: 4597, km: 187 };
    const ins = Object.fromEntries($$('[data-calc-in]', c).map((i) => [i.dataset.calcIn, i]));
    const outN = $('[data-calc-out="net"]', c); const outG = $('[data-calc-out="gross"]', c); const minNote = $('[data-calc-min]', c);
    const shown = { n: 0, g: 0 };
    const fmt = (n) => Math.round(n).toLocaleString('de-DE') + ' kr.';
    const update = () => {
      const val = (k) => Math.max(0, parseFloat(String(ins[k].value).replace(',', '.')) || 0);
      const hours = val('dag') + val('yfir');
      let labour = val('dag') * P.dag + val('yfir') * P.yfir;
      const useMin = hours > 0 && hours < 2 && labour < P.lagm;
      if (useMin) labour = P.lagm;
      const net = labour + (ins.utk.checked ? P.utk : 0) + val('inn') * P.inn + val('km') * P.km;
      minNote.hidden = !useMin;
      const to = { n: net, g: net * 1.24 };
      if (RM) { outN.textContent = fmt(to.n); outG.textContent = fmt(to.g); return; }
      gsap.to(shown, { n: to.n, g: to.g, duration: 0.5, ease: 'power2.out', overwrite: true, onUpdate: () => { outN.textContent = fmt(shown.n); outG.textContent = fmt(shown.g); } });
    };
    $$('[data-step]', c).forEach((b) => b.addEventListener('click', () => {
      const i = b.parentElement.querySelector('input'); const st = +b.dataset.step;
      i.value = Math.max(0, Math.round(((parseFloat(i.value) || 0) + st) * 10) / 10); update();
    }));
    Object.values(ins).forEach((i) => i.addEventListener('input', update));
    ins.utk.addEventListener('change', update);
    update();
  }

  /* ---------- visit steps: the rail fills with scroll, numbers turn navy ---------- */
  function stepsRail() {
    $$('[data-steps]').forEach((list) => {
      const fill = $('[data-steps-fill]', list); const items = $$('[data-step]', list);
      if (RM) { items.forEach((x) => x.classList.add('is-on')); return; }
      const mob = innerWidth <= 767;
      gsap.fromTo(fill, mob ? { scaleY: 0 } : { scaleX: 0 }, { [mob ? 'scaleY' : 'scaleX']: 1, ease: 'none', scrollTrigger: { trigger: list, start: 'top 75%', end: 'bottom 55%', scrub: 0.4,
        onUpdate: (s) => items.forEach((x, i) => x.classList.toggle('is-on', s.progress >= (i + 0.35) / items.length)) } });
    });
  }

  /* ---------- inner page object: settles in like the home hero ---------- */
  function objIn() {
    if (RM) return;
    $$('[data-obj-in]').forEach((o) => gsap.from(o, { y: 40, scale: 1.06, opacity: 0, duration: 1.6, ease: 'expo.out', delay: 0.45 }));
  }

  /* ---------- home laws: mobile load more ---------- */
  function lawsMore() {
    const b = $('[data-more]'); if (!b) return;
    b.addEventListener('click', () => { $$('.laws_mobile .is-more').forEach((x) => { x.hidden = false; }); b.hidden = true; setTimeout(() => ScrollTrigger.refresh(), 500); });
  }

  /* ---------- §4.19 404 char repel ---------- */
  function repel() {
    const t = $('[data-repel-title]'); if (!t) return;
    const s = SplitText.create(t, { type: 'words, chars', aria: 'auto' });
    if (!RM) gsap.from(s.chars, { xPercent: 100, opacity: 0, duration: 1.5, ease: 'expo.out', stagger: 0.0625, delay: 0.75 });
    if (RM || TOUCH) return;
    const rem = parseFloat(getComputedStyle(html).fontSize);
    const els = [...s.chars.map((c) => ({ el: c, f: 1.5 })), ...$$('footer .tile_l').map((c) => ({ el: c, f: 0.75 }))]
      .map((o) => ({ ...o, qx: gsap.quickTo(o.el, 'x', { duration: 0.3, ease: 'power2.out' }), qy: gsap.quickTo(o.el, 'y', { duration: 0.3, ease: 'power2.out' }), on: false }));
    addEventListener('pointermove', (e) => {
      els.forEach((o) => {
        const r = o.el.getBoundingClientRect(); const cx = r.left + r.width / 2 - gsap.getProperty(o.el, 'x'); const cy = r.top + r.height / 2 - gsap.getProperty(o.el, 'y');
        const dx = cx - e.clientX; const dy = cy - e.clientY; const d = Math.hypot(dx, dy); const R = 10 * rem * o.f;
        if (d < R) { const k = Math.pow(1 - d / R, 2) * 5 * rem * o.f; const a = Math.atan2(dy, dx); o.qx(Math.cos(a) * k); o.qy(Math.sin(a) * k); o.on = true; }
        else if (o.on) { o.on = false; gsap.to(o.el, { x: 0, y: 0, duration: 0.8, ease: 'back.out(2.5)', overwrite: true }); }
      });
    });
    document.addEventListener('pointerleave', () => els.forEach((o) => gsap.to(o.el, { x: 0, y: 0, duration: 0.8, ease: 'back.out(2.5)', overwrite: true })));
  }


  /* ---------- landing finder: the pickers are 21st.dev components (island/main.jsx); this hands their values to the form ---------- */
  function finder() {
    const f = $('[data-finder]'); const form = $('#form-home');
    if (!f || !form) return;
    // the 21st.dev panels grow downward: if one would run past the screen, bring it into view
    f.addEventListener('click', (e) => {
      if (!e.target.closest('[data-island] button')) return;
      setTimeout(() => {
        const p = f.querySelector('[role="dialog"], [role="listbox"]'); if (!p) return;
        const r = p.getBoundingClientRect(); const over = r.bottom - innerHeight + 24;
        if (over > 0) scrollToY(scrollY + over, { duration: 0.7 });
      }, 480);
    });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const machine = $('[data-finder-machine]', f).value; const fra = $('[data-finder-from]', f).value; const til = $('[data-finder-to]', f).value;
      if (!fra) { $('[data-island="dates"] button[aria-haspopup="dialog"]', f)?.click(); return; }
      setSelect(form, 'Tæki til leigu');
      $$('input[name="taeki"]', form).forEach((b) => { if (b.value === machine) b.checked = true; });
      $('input[name="fra"]', form).value = fra; $('input[name="til"]', form).value = til;
      goToForm(form, 'nafn');
    });
  }

  /* ---------- boot ---------- */
  accordion(); forms(); lawsMore(); work(); finder(); receipts(); calc();
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  fonts.then(() => {
    if (!RM) gsap.from(['.nav_logo', '.nav_links li', '.nav_actions > *'], { y: -14, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.05, delay: 0.15, clearProps: 'transform,opacity' });
    const ld = loader();
    setTimeout(() => {
      body.classList.add('is-loaded'); html.classList.add('is-ready');
      if (!ld) loadReveals();
    }, 250);
    lhero(); objIn(); stepsRail(); scrollReveals(); heroSplit(); parallax(); marquee(); slider(); personas(); scrubScale(); teamFlip(); footer(); repel();
    ScrollTrigger.refresh();
  });
  addEventListener('load', () => ScrollTrigger.refresh());
})();
