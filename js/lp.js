// LPの動き：最初の画面の動画・場面の切り替え・3か所の動く図・スクロールで出る・数字の繰り上がり・画面下の帯・計測の土台
(() => {
  const dataLayer = (window.dataLayer = window.dataLayer || []);
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;

  // 行動ボタンの押下（GA4はdataLayerのイベントで受ける）
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-cta]');
    if (!a) return;
    dataLayer.push({ event: 'cta_click', cta: a.dataset.cta, kind: a.href.startsWith('tel:') ? 'tel' : 'line' });
  });

  // 最初の画面の動画：見えている間だけ流す（動きを減らす設定では止めた絵のまま）
  const v = document.querySelector('[data-movie] video');
  if (v && !still) {
    const tryPlay = () => v.play().catch(() => {});
    if (hasIO) {
      new IntersectionObserver((entries) => {
        entries[0].isIntersecting ? tryPlay() : v.pause();
      }, { threshold: 0.25 }).observe(v);
    } else {
      tryPlay();
    }
  }

  // 心の声：3つの場面を順に切り替える（画面に入っている間だけ。動きを減らす設定では自動で送らない）
  const scene = document.querySelector('[data-scene]');
  if (scene) {
    const imgs = [...scene.querySelectorAll('.scene__img')];
    const caps = [...scene.querySelector('[data-scene-caps]').content.querySelectorAll('span')].map((s) => s.textContent);
    const no = scene.querySelector('.scene__no');
    const txt = scene.querySelector('.scene__t');
    let i = 0;
    let timer = null;
    const show = (n) => {
      i = (n + imgs.length) % imgs.length;
      imgs.forEach((img, k) => img.classList.toggle('is-on', k === i));
      no.textContent = String(i + 1).padStart(2, '0');
      txt.textContent = caps[i];
    };
    const play = () => {
      if (still) return;
      clearInterval(timer);
      timer = setInterval(() => show(i + 1), 4200);
    };
    scene.querySelector('[data-scene-prev]').addEventListener('click', () => { show(i - 1); play(); });
    scene.querySelector('[data-scene-next]').addEventListener('click', () => { show(i + 1); play(); });
    scene.addEventListener('mouseenter', () => clearInterval(timer));
    scene.addEventListener('mouseleave', play);
    document.addEventListener('visibilitychange', () => (document.hidden ? clearInterval(timer) : play()));
    if (hasIO) {
      new IntersectionObserver((entries) => {
        entries[0].isIntersecting ? play() : clearInterval(timer);
      }, { threshold: 0.3 }).observe(scene);
    } else {
      play();
    }
  }

  // 3か所の動く図：3人が入口から入り、1人は社内に残り、2人は出口から出ていく。数字はその場で増える
  // 動きを減らす設定・古いブラウザでは、HTMLに書いた最後の状態（3人・2人・1人）のまま見せる
  const fm = document.querySelector('[data-flow]');
  if (fm && !still && hasIO && 'animate' in Element.prototype) {
    const ws = [...fm.querySelectorAll('.fm__w')];
    const cnt = { in: fm.querySelector('[data-c="in"]'), out: fm.querySelector('[data-c="out"]'), left: fm.querySelector('[data-c="left"]') };
    const DOOR_IN = 16.7, MID = 50, DOOR_OUT = 83.3;
    // 出発の遅れ(ms)・歩く長さ(ms)・残る場所（null は出ていく）
    const plan = [
      { delay: 0, dur: 2600, stay: 40 },
      { delay: 1100, dur: 5200, stay: null },
      { delay: 2200, dur: 5200, stay: null },
    ];
    let timers = [];
    let playing = false;
    let visible = false;
    let nIn = 0;
    let nOut = 0;
    const put = (key, val) => {
      const el = cnt[key];
      if (el.textContent === String(val)) return;
      el.textContent = val;
      el.classList.remove('is-bump');
      void el.offsetWidth;
      el.classList.add('is-bump');
    };
    const run = () => {
      playing = true;
      timers.forEach(clearTimeout);
      timers = [];
      nIn = 0;
      nOut = 0;
      ['in', 'out', 'left'].forEach((k) => { cnt[k].textContent = '0'; });
      fm.classList.add('is-playing');
      fm.classList.remove('is-done');
      ws.forEach((w, k) => {
        const p = plan[k];
        w.getAnimations().filter((a) => !(a instanceof CSSAnimation)).forEach((a) => a.cancel());
        w.style.opacity = '0';
        w.style.left = '-8%';
        const frames = p.stay !== null
          ? [{ left: '-8%', opacity: 0 }, { left: '0%', opacity: 1, offset: 0.1 }, { left: `${DOOR_IN}%`, opacity: 1, offset: 0.45 }, { left: `${p.stay}%`, opacity: 1 }]
          : [{ left: '-8%', opacity: 0 }, { left: '0%', opacity: 1, offset: 0.06 }, { left: `${DOOR_IN}%`, opacity: 1, offset: 0.25 },
             { left: `${MID}%`, opacity: 1, offset: 0.55 }, { left: `${DOOR_OUT}%`, opacity: 1, offset: 0.8 }, { left: '108%', opacity: 1 }];
        timers.push(setTimeout(() => {
          w.classList.add('is-walking');
          const a = w.animate(frames, { duration: p.dur, easing: 'linear', fill: 'forwards' });
          a.onfinish = () => w.classList.remove('is-walking');
        }, p.delay));
        // 入口を通ったら「入った人」、出口を通ったら「辞めた人」
        timers.push(setTimeout(() => { nIn += 1; put('in', nIn); put('left', nIn - nOut); }, p.delay + p.dur * (p.stay !== null ? 0.45 : 0.25)));
        if (p.stay === null) {
          timers.push(setTimeout(() => { nOut += 1; put('out', nOut); put('left', nIn - nOut); }, p.delay + p.dur * 0.8));
        }
      });
      const end = Math.max(...plan.map((p) => p.delay + p.dur)) + 300;
      timers.push(setTimeout(() => fm.classList.add('is-done'), end));
      timers.push(setTimeout(() => {
        playing = false;
        if (visible) run();
      }, end + 3800));
    };
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible && !playing) run();
    }, { threshold: 0.4 }).observe(fm);
  }

  if (!hasIO) {
    document.querySelectorAll('[data-rv]').forEach((el) => el.classList.add('is-in'));
    return;
  }

  // スクロールで出る（1回だけ）
  const rvObs = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      en.target.classList.add('is-in');
      rvObs.unobserve(en.target);
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('[data-rv]').forEach((el) => rvObs.observe(el));

  // 数字が0から繰り上がる
  const countObs = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      countObs.unobserve(en.target);
      const el = en.target;
      const to = Number(el.dataset.count);
      if (still) { el.textContent = to; continue; }
      const t0 = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - t0) / 1400);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach((el) => countObs.observe(el));

  // 区画が半分見えたら1回だけ記録（どこで離れているかを見る）
  const seen = new Set();
  const secObs = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const id = en.target.dataset.sec;
      if (en.isIntersecting && !seen.has(id)) {
        seen.add(id);
        dataLayer.push({ event: 'section_view', section: id });
      }
    }
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-sec]').forEach((s) => secObs.observe(s));

  // 画面下の帯：最初と最後の行動ボタンが見えている間だけ隠す（スマホの最初の画面でも押せるように）
  const dock = document.querySelector('.dock');
  const anchors = [document.querySelector('.cta .btn-line'), document.querySelector('.last .btn-line')].filter(Boolean);
  const visible = new Set();
  const dockObs = new IntersectionObserver((entries) => {
    for (const en of entries) en.isIntersecting ? visible.add(en.target) : visible.delete(en.target);
    if (dock) dock.hidden = visible.size > 0;
  });
  anchors.forEach((a) => dockObs.observe(a));
})();
