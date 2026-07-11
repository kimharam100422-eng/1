// ============================================================
// 무빙 도장 — Movement Dojo
// 카이팅 & 스킬샷 회피 연습 엔진
// ============================================================

const canvas = document.getElementById('arena');
const ctx = canvas.getContext('2d');

const els = {
  time: document.getElementById('stat-time'),
  hits: document.getElementById('stat-hits'),
  best: document.getElementById('stat-best'),
  menuBtn: document.getElementById('btn-menu'),
  modePanel: document.getElementById('mode-panel'),
  startBtn: document.getElementById('btn-start'),
  overlayStart: document.getElementById('overlay-start'),
  overlayResult: document.getElementById('overlay-result'),
  btnOverlayStart: document.getElementById('btn-overlay-start'),
  btnRetry: document.getElementById('btn-retry'),
  resultTime: document.getElementById('result-time'),
  resultHits: document.getElementById('result-hits'),
  touchMarker: document.getElementById('touch-marker'),
};

// ------------------------------------------------------------
// 상태
// ------------------------------------------------------------
const state = {
  mode: 'kiting',        // 'kiting' | 'dodge'
  difficulty: 'normal',  // 'easy' | 'normal' | 'hard'
  scheme: 'touch',       // 'touch' | 'keyboard'
  running: false,
  elapsed: 0,
  hits: 0,
  bestByMode: { kiting: 0, dodge: 0 },
};

const DIFF = {
  easy:   { enemySpeed: 1.6, spawnRate: 1600, projSpeed: 2.6, hitRadius: 16 },
  normal: { enemySpeed: 2.3, spawnRate: 1150, projSpeed: 3.6, hitRadius: 15 },
  hard:   { enemySpeed: 3.0, spawnRate: 800,  projSpeed: 4.8, hitRadius: 14 },
};

// player
const player = {
  x: 0, y: 0,
  targetX: 0, targetY: 0,
  radius: 14,
  speed: 4.4,
  moving: false,
  flashUntil: 0,
};

// entities
let enemies = [];     // kiting mode: chasers that must be kept at range
let projectiles = []; // dodge mode: skillshots
let particles = [];
let lastSpawn = 0;
let rafId = null;
let lastFrameTime = 0;

// keyboard state
const keys = { w:false, a:false, s:false, d:false };

// ------------------------------------------------------------
// 캔버스 리사이즈
// ------------------------------------------------------------
function resizeCanvas(){
  const wrap = canvas.parentElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (player.x === 0 && player.y === 0){
    player.x = w/2; player.y = h/2;
    player.targetX = w/2; player.targetY = h/2;
  }
}
window.addEventListener('resize', resizeCanvas);

// ------------------------------------------------------------
// UI: 메뉴 패널
// ------------------------------------------------------------
els.menuBtn.addEventListener('click', () => {
  els.modePanel.classList.toggle('open');
});

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    updateBestDisplay();
  });
});

document.querySelectorAll('#difficulty-control .seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#difficulty-control .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.difficulty = btn.dataset.diff;
  });
});

document.querySelectorAll('#control-scheme .seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#control-scheme .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.scheme = btn.dataset.scheme;
  });
});

els.startBtn.addEventListener('click', () => {
  els.modePanel.classList.remove('open');
  startGame();
});
els.btnOverlayStart.addEventListener('click', startGame);
els.btnRetry.addEventListener('click', startGame);

function updateBestDisplay(){
  els.best.textContent = state.bestByMode[state.mode].toFixed(1);
}

// ------------------------------------------------------------
// 입력: 터치 / 마우스 이동
// ------------------------------------------------------------
function setTargetFromClient(clientX, clientY){
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  player.targetX = Math.max(player.radius, Math.min(rect.width - player.radius, x));
  player.targetY = Math.max(player.radius, Math.min(rect.height - player.radius, y));
  player.moving = true;

  els.touchMarker.style.left = x + 'px';
  els.touchMarker.style.top = y + 'px';
  els.touchMarker.classList.remove('hidden');
  els.touchMarker.style.animation = 'none';
  void els.touchMarker.offsetWidth;
  els.touchMarker.style.animation = '';
}

const arenaWrap = document.querySelector('.arena-wrap');

arenaWrap.addEventListener('touchstart', (e) => {
  if (!state.running) return;
  const t = e.touches[0];
  setTargetFromClient(t.clientX, t.clientY);
}, { passive: true });

arenaWrap.addEventListener('touchmove', (e) => {
  if (!state.running) return;
  const t = e.touches[0];
  setTargetFromClient(t.clientX, t.clientY);
}, { passive: true });

arenaWrap.addEventListener('mousedown', (e) => {
  if (!state.running) return;
  setTargetFromClient(e.clientX, e.clientY);
});
arenaWrap.addEventListener('mousemove', (e) => {
  if (!state.running) return;
  if (e.buttons === 1){
    setTargetFromClient(e.clientX, e.clientY);
  }
});

// keyboard
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = false;
});

// ------------------------------------------------------------
// 게임 시작/종료
// ------------------------------------------------------------
function startGame(){
  els.overlayStart.classList.add('hidden');
  els.overlayResult.classList.add('hidden');
  els.touchMarker.classList.add('hidden');

  resizeCanvas();

  const rect = canvas.getBoundingClientRect();
  player.x = rect.width / 2;
  player.y = rect.height / 2;
  player.targetX = player.x;
  player.targetY = player.y;
  player.moving = false;
  player.flashUntil = 0;

  enemies = [];
  projectiles = [];
  particles = [];
  lastSpawn = performance.now();

  state.running = true;
  state.elapsed = 0;
  state.hits = 0;
  els.hits.textContent = '0';
  els.time.textContent = '00.0';
  updateBestDisplay();

  if (state.mode === 'kiting'){
    // 시작 시 챔피언 3마리 배치
    const d = DIFF[state.difficulty];
    for (let i=0;i<2;i++) spawnEnemy(rect.width, rect.height);
  }

  lastFrameTime = performance.now();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function endGame(){
  state.running = false;
  cancelAnimationFrame(rafId);

  const finalTime = state.elapsed;
  if (finalTime > state.bestByMode[state.mode]){
    state.bestByMode[state.mode] = finalTime;
  }

  els.resultTime.textContent = finalTime.toFixed(1);
  els.resultHits.textContent = String(state.hits);
  updateBestDisplay();

  document.getElementById('result-title').textContent =
    state.mode === 'kiting' ? '카이팅 훈련 종료' : '스킬샷 회피 종료';

  els.overlayResult.classList.remove('hidden');
}

// ------------------------------------------------------------
// 스폰: 카이팅 모드 (추적자)
// ------------------------------------------------------------
function spawnEnemy(w, h){
  const edge = Math.floor(Math.random()*4);
  let x, y;
  if (edge === 0){ x = Math.random()*w; y = -20; }
  else if (edge === 1){ x = w+20; y = Math.random()*h; }
  else if (edge === 2){ x = Math.random()*w; y = h+20; }
  else { x = -20; y = Math.random()*h; }
  enemies.push({ x, y, radius: 13 });
}

// ------------------------------------------------------------
// 스폰: 스킬샷 모드 (직선 투사체)
// ------------------------------------------------------------
function spawnProjectile(w, h){
  const d = DIFF[state.difficulty];
  const margin = 40;
  const edge = Math.floor(Math.random()*4);
  let x, y;
  if (edge === 0){ x = Math.random()*w; y = -margin; }
  else if (edge === 1){ x = w+margin; y = Math.random()*h; }
  else if (edge === 2){ x = Math.random()*w; y = h+margin; }
  else { x = -margin; y = Math.random()*h; }

  // 플레이어를 향하되 약간의 예측/오차를 둠 (완전 조준 스킬샷)
  const spread = (Math.random()-0.5) * 0.35;
  const baseAngle = Math.atan2(player.y - y, player.x - x);
  const angle = baseAngle + spread;

  projectiles.push({
    x, y,
    vx: Math.cos(angle) * d.projSpeed,
    vy: Math.sin(angle) * d.projSpeed,
    radius: 9,
    trail: [],
  });
}

// ------------------------------------------------------------
// 업데이트
// ------------------------------------------------------------
function updatePlayer(dt, w, h){
  if (state.scheme === 'keyboard'){
    let dx = 0, dy = 0;
    if (keys.w) dy -= 1;
    if (keys.s) dy += 1;
    if (keys.a) dx -= 1;
    if (keys.d) dx += 1;
    if (dx !== 0 || dy !== 0){
      const len = Math.hypot(dx, dy);
      player.x += (dx/len) * player.speed * dt;
      player.y += (dy/len) * player.speed * dt;
    }
  } else {
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 2){
      const step = Math.min(dist, player.speed * dt);
      player.x += (dx/dist) * step;
      player.y += (dy/dist) * step;
    }
  }
  player.x = Math.max(player.radius, Math.min(w - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(h - player.radius, player.y));
}

function updateKiting(dt, w, h, now){
  const d = DIFF[state.difficulty];

  if (now - lastSpawn > d.spawnRate * 2.2 && enemies.length < 6){
    spawnEnemy(w, h);
    lastSpawn = now;
  }

  enemies.forEach(en => {
    const dx = player.x - en.x;
    const dy = player.y - en.y;
    const dist = Math.hypot(dx, dy) || 1;
    en.x += (dx/dist) * d.enemySpeed * dt;
    en.y += (dy/dist) * d.enemySpeed * dt;

    if (dist < player.radius + en.radius - 2){
      registerHit();
      const ang = Math.atan2(en.y - player.y, en.x - player.x);
      en.x = player.x + Math.cos(ang) * 80;
      en.y = player.y + Math.sin(ang) * 80;
    }
  });
}

function updateDodge(dt, w, h, now){
  const d = DIFF[state.difficulty];

  if (now - lastSpawn > d.spawnRate){
    spawnProjectile(w, h);
    lastSpawn = now;
  }

  projectiles = projectiles.filter(p => {
    p.trail.push({x:p.x, y:p.y});
    if (p.trail.length > 6) p.trail.shift();

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const dist = Math.hypot(player.x - p.x, player.y - p.y);
    if (dist < player.radius + p.radius - 4){
      registerHit();
      spawnHitParticles(p.x, p.y);
      return false;
    }

    return p.x > -80 && p.x < w+80 && p.y > -80 && p.y < h+80;
  });
}

function registerHit(){
  state.hits += 1;
  els.hits.textContent = String(state.hits);
  player.flashUntil = performance.now() + 260;
  if (navigator.vibrate) navigator.vibrate(60);
}

function spawnHitParticles(x, y){
  for (let i=0;i<10;i++){
    const ang = Math.random()*Math.PI*2;
    const spd = 1 + Math.random()*2.5;
    particles.push({
      x, y,
      vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
      life: 26, maxLife: 26,
    });
  }
}

function updateParticles(dt){
  particles = particles.filter(p => {
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.life -= dt;
    return p.life > 0;
  });
}

// ------------------------------------------------------------
// 렌더
// ------------------------------------------------------------
function drawGrid(w, h){
  ctx.save();
  ctx.strokeStyle = 'rgba(200,170,110,0.05)';
  ctx.lineWidth = 1;
  const step = 40;
  for (let x=0;x<w;x+=step){
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
  }
  for (let y=0;y<h;y+=step){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(now){
  const flashing = now < player.flashUntil;
  ctx.save();

  // range indicator ring (kiting mode)
  if (state.mode === 'kiting'){
    ctx.beginPath();
    ctx.arc(player.x, player.y, 90, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(10,200,185,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2);
  ctx.fillStyle = flashing ? '#e0554f' : '#0ac8b9';
  ctx.shadowColor = flashing ? '#e0554f' : '#0ac8b9';
  ctx.shadowBlur = 14;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2);
  ctx.strokeStyle = '#f0e6d2';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();

  // target marker (touch scheme)
  if (state.scheme === 'touch' && player.moving){
    const dx = player.targetX - player.x, dy = player.targetY - player.y;
    if (Math.hypot(dx,dy) > 3){
      ctx.save();
      ctx.beginPath();
      ctx.arc(player.targetX, player.targetY, 5, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(10,200,185,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawEnemies(){
  enemies.forEach(en => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(en.x, en.y, en.radius, 0, Math.PI*2);
    ctx.fillStyle = '#8a2f2a';
    ctx.shadowColor = '#e0554f';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.strokeStyle = '#f0b0a8';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
  });
}

function drawProjectiles(){
  projectiles.forEach(p => {
    p.trail.forEach((t, i) => {
      const a = (i / p.trail.length) * 0.35;
      ctx.beginPath();
      ctx.arc(t.x, t.y, p.radius * (0.4 + i/p.trail.length*0.5), 0, Math.PI*2);
      ctx.fillStyle = `rgba(240,110,60,${a})`;
      ctx.fill();
    });

    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
    ctx.fillStyle = '#f0e6d2';
    ctx.shadowColor = '#ff7a3d';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.restore();
  });
}

function drawParticles(){
  particles.forEach(p => {
    const a = p.life / p.maxLife;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3*a, 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,150,90,${a})`;
    ctx.fill();
  });
}

// ------------------------------------------------------------
// 메인 루프
// ------------------------------------------------------------
function loop(now){
  if (!state.running) return;

  const dt = Math.min((now - lastFrameTime) / 16.67, 2.4);
  lastFrameTime = now;

  const rect = canvas.getBoundingClientRect();
  const w = rect.width, h = rect.height;

  updatePlayer(dt, w, h);

  if (state.mode === 'kiting'){
    updateKiting(dt, w, h, now);
  } else {
    updateDodge(dt, w, h, now);
  }
  updateParticles(dt);

  state.elapsed += dt * (16.67/1000);
  els.time.textContent = state.elapsed.toFixed(1);

  // render
  ctx.clearRect(0, 0, w, h);
  drawGrid(w, h);
  if (state.mode === 'kiting') drawEnemies();
  else drawProjectiles();
  drawParticles();
  drawPlayer(now);

  rafId = requestAnimationFrame(loop);
}

// ------------------------------------------------------------
// init
// ------------------------------------------------------------
resizeCanvas();
updateBestDisplay();
