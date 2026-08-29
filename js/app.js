const cursor = document.getElementById('cursor');
const glow = document.getElementById('cursorGlow');
const settingsDefaults = { theme: 'dark', accent: 'cyan', cloak: 'helix', cursor: 'orb', starDensity: 260, gridScale: 48, stars: true, grid: true, motion: true };
let settings = { ...settingsDefaults };
try { settings = { ...settings, ...JSON.parse(localStorage.getItem('helixSettings') || '{}') }; } catch (_error) {}

function saveSettings() {
  localStorage.setItem('helixSettings', JSON.stringify(settings));
}

function applySettings() {
  document.documentElement.classList.toggle('light', settings.theme === 'light');
  document.documentElement.classList.toggle('midnight', settings.theme === 'midnight');
  document.documentElement.dataset.accent = settings.accent;
  document.documentElement.dataset.cursor = settings.cursor;
  document.documentElement.classList.toggle('no-grid', !settings.grid);
  document.documentElement.classList.toggle('no-stars', !settings.stars);
  document.documentElement.classList.toggle('no-motion', !settings.motion);
  document.documentElement.style.setProperty('--grid-size', `${settings.gridScale}px`);
  document.title = ({ helix: 'Helix', study: 'Study Notes', weather: 'Weather', blank: '' }[settings.cloak] || 'Helix') + (settings.cloak === 'helix' ? ' // ' + (document.body.dataset.page || 'Portal') : '');
  if (settings.cloak === 'blank') document.title = ' ';
  const output = document.querySelector('[data-output="starDensity"]');
  if (output) output.textContent = settings.starDensity;
  const gridOutput = document.querySelector('[data-output="gridScale"]');
  if (gridOutput) gridOutput.textContent = settings.gridScale;
  document.querySelectorAll('[data-setting]').forEach(control => {
    if (control.type === 'checkbox') control.checked = Boolean(settings[control.dataset.setting]);
    else control.value = settings[control.dataset.setting];
  });
}

function updateStars() {
  if (!canvas) return;
  stars = Array.from({ length: settings.stars ? Math.min(settings.starDensity, Math.floor(innerWidth / 2)) : 0 }, () => ({
    x: Math.random() * innerWidth, y: Math.random() * innerHeight, z: Math.random() * 2 + 0.2, s: Math.random() * 1.7 + 0.2
  }));
}

applySettings();
let mx = innerWidth / 2;
let my = innerHeight / 2;
let cx = mx;
let cy = my;

addEventListener('mousemove', (e) => {
  mx = e.clientX;
  my = e.clientY;
  if (cursor) cursor.style.left = mx + 'px';
  if (cursor) cursor.style.top = my + 'px';
});

function tick() {
  cx += (mx - cx) * 0.08;
  cy += (my - cy) * 0.08;
  if (glow) {
    glow.style.left = cx + 'px';
    glow.style.top = cy + 'px';
  }
  requestAnimationFrame(tick);
}

if (typeof requestAnimationFrame === 'function') {
  tick();
}

const canvas = document.getElementById('stars');
const ctx = canvas && canvas.getContext('2d');
let stars = [];

function resize() {
  if (!canvas) return;
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  updateStars();
}

resize();
addEventListener('resize', resize);

function starLoop() {
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.y += s.s * 0.08;
      if (s.y > innerHeight) s.y = 0;
      ctx.globalAlpha = 0.25 + s.s / 3;
      ctx.fillStyle = '#b9d8ff';
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
  }
  requestAnimationFrame(starLoop);
}

if (typeof requestAnimationFrame === 'function') {
  starLoop();
}

function toggleTheme() {
  settings.theme = settings.theme === 'light' ? 'dark' : 'light';
  saveSettings();
  applySettings();
}

document.querySelectorAll('[data-setting]').forEach(control => control.addEventListener('input', () => {
  settings[control.dataset.setting] = control.type === 'checkbox' ? control.checked : control.value;
  if (control.dataset.setting === 'starDensity' || control.dataset.setting === 'stars') {
    settings.starDensity = Number(settings.starDensity);
    updateStars();
  }
  if (control.dataset.setting === 'gridScale') settings.gridScale = Number(settings.gridScale);
  saveSettings();
  applySettings();
}));

document.querySelector('[data-reset-settings]')?.addEventListener('click', () => {
  settings = { ...settingsDefaults };
  saveSettings();
  applySettings();
  updateStars();
});

document.querySelectorAll('a[href]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (href && href.endsWith('.html') && !a.target) {
      e.preventDefault();
      document.body.classList.add('leaving');
      setTimeout(() => location.href = href, 180);
    }
  });
});

const counters = document.querySelectorAll('[data-target]');

counters.forEach((counter) => {
  const target = Number(counter.dataset.target || 0);
  const suffix = counter.dataset.suffix || '';
  let current = 0;

  const animate = () => {
    const step = target / 35;
    current += step;
    if (current >= target) {
      counter.textContent = target + suffix;
      return;
    }
    counter.textContent = Math.round(current) + suffix;
    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
});
