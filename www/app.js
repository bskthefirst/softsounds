let audioCtx = null;
let sounds = {};
let playing = new Set();
let timerId = null;
let timerEnd = null;
let isPremium = false;
let fadeEnabled = true;

const FREE_SOUNDS = ['white','pink','rain','ocean','fan'];
const SOUND_DEFS = [
  {id:'white',name:'White Noise',icon:'\u{1F4FD}',free:true},
  {id:'pink',name:'Pink Noise',icon:'\u{1F308}',free:true},
  {id:'rain',name:'Rain',icon:'\u{1F327}',free:true},
  {id:'ocean',name:'Ocean',icon:'\u{1F30A}',free:true},
  {id:'fan',name:'Fan',icon:'\u{1FA9F}',free:true},
  {id:'brown',name:'Brown Noise',icon:'\u{1F34C}',free:false},
  {id:'thunder',name:'Thunder',icon:'\u{26C8}',free:false},
  {id:'wind',name:'Wind',icon:'\u{1F343}',free:false},
  {id:'fire',name:'Fireplace',icon:'\u{1F525}',free:false},
  {id:'crickets',name:'Crickets',icon:'\u{1F997}',free:false},
  {id:'drone',name:'Deep Drone',icon:'\u{1F3BB}',free:false},
  {id:'asmr',name:'Soft ASMR',icon:'\u{1F9E5}',free:false}
];

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function createBuffer(duration, fn) {
  const sr = audioCtx.sampleRate;
  const len = sr * duration;
  const buf = audioCtx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = fn(i, sr);
  return buf;
}

function makeWhite() {
  return createBuffer(2, () => Math.random() * 2 - 1);
}

function makePink() {
  // Voss-McCartney pinking
  const sr = audioCtx.sampleRate;
  const len = sr * 2;
  const buf = audioCtx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const rows = 16;
  const cols = Math.ceil(len / rows);
  let samples = [];
  for (let i = 0; i < rows; i++) samples.push(Math.random() * 2 - 1);
  let idx = 0;
  for (let c = 0; c < cols && idx < len; c++) {
    let sum = 0;
    for (let r = 0; r < rows; r++) sum += samples[r];
    out[idx++] = sum / rows;
    for (let r = 0; r < rows; r++) {
      if (c % (2 ** r) === 0) samples[r] = Math.random() * 2 - 1;
    }
  }
  return buf;
}

function makeBrown() {
  return createBuffer(2, (i, sr) => {
    let last = 0;
    if (i > 0) last = arguments.callee.last || 0;
    const white = Math.random() * 2 - 1;
    const val = (last + (0.02 * white)) / 1.02;
    arguments.callee.last = val;
    return val * 3.5;
  });
}

function makeRain() {
  return createBuffer(2, () => Math.random() * 2 - 1);
}

function makeOcean() {
  return createBuffer(2, () => Math.random() * 2 - 1);
}

function makeFan() {
  return createBuffer(2, () => Math.random() * 2 - 1);
}

function makeThunder() {
  return createBuffer(3, () => Math.random() * 2 - 1);
}

function makeWind() {
  return createBuffer(2, () => Math.random() * 2 - 1);
}

function makeFire() {
  return createBuffer(2, () => Math.random() * 2 - 1);
}

function makeCrickets() {
  return createBuffer(2, () => Math.random() * 2 - 1);
}

function makeDrone() {
  return createBuffer(2, () => 0);
}

function makeASMR() {
  return createBuffer(2, () => Math.random() * 2 - 1);
}

function buildNode(id) {
  const master = audioCtx.createGain();
  master.gain.value = 0;

  switch(id) {
    case 'white': {
      const src = audioCtx.createBufferSource();
      src.buffer = makeWhite();
      src.loop = true;
      src.connect(master);
      src.start();
      return {src, master, vol: 0.3};
    }
    case 'pink': {
      const src = audioCtx.createBufferSource();
      src.buffer = makePink();
      src.loop = true;
      src.connect(master);
      src.start();
      return {src, master, vol: 0.4};
    }
    case 'brown': {
      const src = audioCtx.createBufferSource();
      src.buffer = makeBrown();
      src.loop = true;
      src.connect(master);
      src.start();
      return {src, master, vol: 0.35};
    }
    case 'rain': {
      const src = audioCtx.createBufferSource();
      src.buffer = makeRain();
      src.loop = true;
      const filt = audioCtx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 800;
      src.connect(filt);
      filt.connect(master);
      src.start();
      return {src, master, vol: 0.35};
    }
    case 'ocean': {
      const src = audioCtx.createBufferSource();
      src.buffer = makeOcean();
      src.loop = true;
      const lfo = audioCtx.createOscillator();
      lfo.frequency.value = 0.2;
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 500;
      const filt = audioCtx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 600;
      lfo.connect(lfoGain);
      lfoGain.connect(filt.frequency);
      src.connect(filt);
      filt.connect(master);
      src.start();
      lfo.start();
      return {src, master, vol: 0.4, extra: [lfo, lfoGain]};
    }
    case 'fan': {
      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 200;
      const filt = audioCtx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 400;
      osc.connect(filt);
      filt.connect(master);
      osc.start();
      return {src: osc, master, vol: 0.15};
    }
    case 'thunder': {
      const src = audioCtx.createBufferSource();
      src.buffer = makeThunder();
      src.loop = true;
      const gate = audioCtx.createGain();
      gate.gain.value = 0;
      src.connect(gate);
      gate.connect(master);
      src.start();
      // periodic rumble bursts
      const rumble = () => {
        if (!playing.has('thunder')) return;
        const now = audioCtx.currentTime;
        gate.gain.setValueAtTime(0, now);
        gate.gain.linearRampToValueAtTime(1, now + 0.5);
        gate.gain.exponentialRampToValueAtTime(0.01, now + 3 + Math.random() * 4);
        setTimeout(rumble, 4000 + Math.random() * 6000);
      };
      setTimeout(rumble, 500);
      return {src, master, vol: 0.5, extra: [gate]};
    }
    case 'wind': {
      const src = audioCtx.createBufferSource();
      src.buffer = makeWind();
      src.loop = true;
      const filt = audioCtx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 400;
      filt.Q.value = 0.5;
      src.connect(filt);
      filt.connect(master);
      src.start();
      // moving filter
      const lfo = audioCtx.createOscillator();
      lfo.frequency.value = 0.15;
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 300;
      lfo.connect(lfoGain);
      lfoGain.connect(filt.frequency);
      lfo.start();
      return {src, master, vol: 0.3, extra: [lfo, lfoGain, filt]};
    }
    case 'fire': {
      const src = audioCtx.createBufferSource();
      src.buffer = makeFire();
      src.loop = true;
      const filt = audioCtx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 2000;
      src.connect(filt);
      filt.connect(master);
      src.start();
      // crackle
      const crackleGain = audioCtx.createGain();
      crackleGain.gain.value = 0;
      const crackle = audioCtx.createBufferSource();
      crackle.buffer = makeFire();
      crackle.loop = true;
      const hf = audioCtx.createBiquadFilter();
      hf.type = 'highpass';
      hf.frequency.value = 3000;
      crackle.connect(hf);
      hf.connect(crackleGain);
      crackleGain.connect(master);
      crackle.start();
      const snap = () => {
        if (!playing.has('fire')) return;
        const now = audioCtx.currentTime;
        crackleGain.gain.setValueAtTime(0, now);
        crackleGain.gain.linearRampToValueAtTime(0.3 + Math.random()*0.4, now + 0.02);
        crackleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        setTimeout(snap, 200 + Math.random() * 800);
      };
      setTimeout(snap, 300);
      return {src, master, vol: 0.25, extra: [crackle, crackleGain, hf]};
    }
    case 'crickets': {
      const osc1 = audioCtx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = 4200;
      const osc2 = audioCtx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 4500;
      const gain1 = audioCtx.createGain();
      gain1.gain.value = 0;
      const gain2 = audioCtx.createGain();
      gain2.gain.value = 0;
      osc1.connect(gain1);
      osc2.connect(gain2);
      gain1.connect(master);
      gain2.connect(master);
      osc1.start();
      osc2.start();
      const chirp = () => {
        if (!playing.has('crickets')) return;
        const now = audioCtx.currentTime;
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.08, now + 0.01);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        setTimeout(() => {
          if (!playing.has('crickets')) return;
          const n = audioCtx.currentTime;
          gain2.gain.setValueAtTime(0, n);
          gain2.gain.linearRampToValueAtTime(0.06, n + 0.01);
          gain2.gain.exponentialRampToValueAtTime(0.001, n + 0.05);
        }, 80 + Math.random()*60);
        setTimeout(chirp, 400 + Math.random()*600);
      };
      setTimeout(chirp, 200);
      return {src: osc1, master, vol: 0.4, extra: [osc2, gain1, gain2]};
    }
    case 'drone': {
      const osc1 = audioCtx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = 55;
      const osc2 = audioCtx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 57;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.2;
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(master);
      osc1.start();
      osc2.start();
      return {src: osc1, master, vol: 0.3, extra: [osc2, gain]};
    }
    case 'asmr': {
      const src = audioCtx.createBufferSource();
      src.buffer = makeASMR();
      src.loop = true;
      const filt = audioCtx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 3000;
      const pan = audioCtx.createStereoPanner();
      src.connect(filt);
      filt.connect(pan);
      pan.connect(master);
      src.start();
      const lfo = audioCtx.createOscillator();
      lfo.frequency.value = 0.1;
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 0.5;
      lfo.connect(lfoGain);
      lfoGain.connect(pan.pan);
      lfo.start();
      return {src, master, vol: 0.25, extra: [lfo, lfoGain, pan, filt]};
    }
  }
  return null;
}

function toggleSound(id) {
  initAudio();
  const def = SOUND_DEFS.find(s => s.id === id);
  if (!def.free && !isPremium) {
    showUpgrade();
    return;
  }

  if (playing.has(id)) {
    stopSound(id);
  } else {
    // Free mixing limit
    if (!isPremium && playing.size >= 1) {
      // Stop others in free version (only 1 at a time)
      [...playing].forEach(sid => stopSound(sid));
    }
    startSound(id);
  }
  renderGrid();
  updateNowPlaying();
}

function startSound(id) {
  const node = buildNode(id);
  if (!node) return;
  sounds[id] = node;
  node.master.connect(audioCtx.destination);
  const target = node.vol;
  node.master.gain.setValueAtTime(0, audioCtx.currentTime);
  if (fadeEnabled) {
    node.master.gain.linearRampToValueAtTime(target, audioCtx.currentTime + 0.8);
  } else {
    node.master.gain.setValueAtTime(target, audioCtx.currentTime);
  }
  playing.add(id);
}

function stopSound(id) {
  const node = sounds[id];
  if (!node) return;
  const now = audioCtx.currentTime;
  if (fadeEnabled) {
    node.master.gain.setValueAtTime(node.master.gain.value, now);
    node.master.gain.linearRampToValueAtTime(0, now + 0.5);
    setTimeout(() => destroyNode(node), 600);
  } else {
    destroyNode(node);
  }
  playing.delete(id);
  delete sounds[id];
}

function destroyNode(node) {
  try { node.src.stop(); } catch(e){}
  try { node.src.disconnect(); } catch(e){}
  try { node.master.disconnect(); } catch(e){}
  if (node.extra) {
    node.extra.forEach(n => {
      try { if(n.stop) n.stop(); } catch(e){}
      try { n.disconnect(); } catch(e){}
    });
  }
}

function stopAll() {
  [...playing].forEach(id => stopSound(id));
  renderGrid();
  updateNowPlaying();
  clearTimer();
}

function setVolume(id, val) {
  const node = sounds[id];
  if (!node) return;
  node.vol = parseFloat(val);
  node.master.gain.setValueAtTime(node.vol, audioCtx.currentTime);
}

function renderGrid() {
  const grid = document.getElementById('soundGrid');
  grid.innerHTML = SOUND_DEFS.map(def => {
    const isPlaying = playing.has(def.id);
    const locked = !def.free && !isPremium;
    const vol = sounds[def.id]?.vol ?? 0.3;
    return `
      <div class="sound-tile ${isPlaying ? 'playing' : ''} ${locked ? 'locked' : ''}" data-id="${def.id}" onclick="toggleSound('${def.id}')">
        <div class="sound-icon">${def.icon}</div>
        <div class="sound-name">${def.name}</div>
        <input type="range" class="sound-volume" min="0" max="1" step="0.01" value="${vol}"
          onclick="event.stopPropagation()" oninput="setVolume('${def.id}',this.value)">
      </div>
    `;
  }).join('');
}

function updateNowPlaying() {
  const label = document.getElementById('npLabel');
  const dots = document.getElementById('npDots');
  if (!playing.size) {
    label.textContent = 'Nothing playing';
    dots.innerHTML = '';
  } else {
    const names = [...playing].map(id => SOUND_DEFS.find(s => s.id === id).name);
    label.textContent = names.join(' + ');
    dots.innerHTML = '<div class="np-dot"></div><div class="np-dot"></div><div class="np-dot"></div>';
  }
}

// Timer
function openTimer() {
  if (!isPremium) {
    showUpgrade();
    return;
  }
  document.getElementById('timerModal').classList.add('open');
}

function startTimer(minutes) {
  clearTimer();
  timerEnd = Date.now() + minutes * 60000;
  document.getElementById('timerBar').classList.add('active');
  updateTimerDisplay();
  timerId = setInterval(() => {
    updateTimerDisplay();
    if (Date.now() >= timerEnd) {
      fadeOutAll();
      clearTimer();
    }
  }, 1000);
  document.getElementById('timerModal').classList.remove('open');
}

function clearTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
  timerEnd = null;
  document.getElementById('timerBar').classList.remove('active');
}

function updateTimerDisplay() {
  if (!timerEnd) return;
  const remaining = Math.max(0, timerEnd - Date.now());
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  document.getElementById('timerDisplay').textContent = `${mins}:${secs.toString().padStart(2,'0')}`;
  const total = timerEnd - (timerEnd - remaining - (Date.now() - (timerEnd - remaining))); // simpler
  const pct = remaining / (document._timerTotal || remaining);
  document.getElementById('timerProgress').style.width = pct * 100 + '%';
}

function fadeOutAll() {
  if (!fadeEnabled) {
    stopAll();
    return;
  }
  const now = audioCtx.currentTime;
  Object.values(sounds).forEach(node => {
    node.master.gain.setValueAtTime(node.master.gain.value, now);
    node.master.gain.linearRampToValueAtTime(0, now + 8);
  });
  setTimeout(() => stopAll(), 8500);
}

// Premium
function loadPremium() {
  try {
    isPremium = localStorage.getItem('softsounds_premium') === 'true';
  } catch(e) {}
  updatePremiumUI();
}

function updatePremiumUI() {
  const banner = document.getElementById('upgradeBanner');
  const badge = document.getElementById('premiumBadge');
  if (isPremium) {
    banner.classList.add('hidden');
    badge.textContent = 'Pro';
    badge.classList.add('pro');
  } else {
    banner.classList.remove('hidden');
    badge.textContent = 'Free';
    badge.classList.remove('pro');
  }
}

function showUpgrade() {
  // In real app this triggers StoreKit purchase
  // For demo, we'll simulate with confirm
  if (confirm('Upgrade to Soft Sounds Pro for $3.99?\n\nUnlock all 12 sounds, unlimited mixing, and custom sleep timer.')) {
    isPremium = true;
    localStorage.setItem('softsounds_premium', 'true');
    updatePremiumUI();
    renderGrid();
  }
}

function restorePurchases() {
  // In real app, call StoreKit restoreCompletedTransactions
  alert('In production, this restores your previous purchases from the App Store.');
}

// Settings
function loadSettings() {
  try {
    fadeEnabled = localStorage.getItem('softsounds_fade') !== 'false';
  } catch(e) {}
  document.getElementById('fadeToggle').checked = fadeEnabled;
}

// Event wiring
document.getElementById('stopAll').onclick = stopAll;
document.getElementById('upgradeBtn').onclick = showUpgrade;
document.getElementById('settingsBtn').onclick = () => document.getElementById('settingsModal').classList.add('open');
document.getElementById('closeSettings').onclick = () => document.getElementById('settingsModal').classList.remove('open');
document.getElementById('closeTimer').onclick = () => document.getElementById('timerModal').classList.remove('open');
document.getElementById('setTimerBtn').onclick = openTimer;
document.getElementById('startTimer').onclick = () => {
  const custom = parseInt(document.getElementById('customMin').value) || 30;
  startTimer(custom);
};
document.getElementById('cancelTimer').onclick = () => document.getElementById('timerModal').classList.remove('open');
document.getElementById('restoreBtn').onclick = restorePurchases;
document.getElementById('fadeToggle').onchange = (e) => {
  fadeEnabled = e.target.checked;
  localStorage.setItem('softsounds_fade', fadeEnabled);
};

document.querySelectorAll('.modal-backdrop').forEach(el => {
  el.onclick = () => el.closest('.modal').classList.remove('open');
});

// Init
loadPremium();
loadSettings();
renderGrid();
