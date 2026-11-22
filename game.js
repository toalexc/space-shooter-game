'use strict';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d');
const arena = canvas.parentElement;
const overlay = document.querySelector('#overlay');
const start = document.querySelector('#start');
const title = document.querySelector('#title');
const subtitle = document.querySelector('#subtitle');
const description = document.querySelector('#description');
const announcement = document.querySelector('#announcement');
const scoreText = document.querySelector('#score');
const livesText = document.querySelector('#lives');
const levelText = document.querySelector('#level');
const controls = [...document.querySelectorAll('[data-control]')];
const keyboard = new Set();
const pointers = new Map();
const keys = { ArrowLeft: 'left', ArrowRight: 'right', Space: 'fire' };
const stars = Array.from({ length: 145 }, () => ({
  x: Math.random(), y: Math.random(), speed: 12 + Math.random() * 45,
  size: .55 + Math.random() * 1.35, opacity: .25 + Math.random() * .65,
}));

let width = 1;
let height = 1;
let background;
let running = false;
let score = 0;
let lives = 3;
let level = 1;
let spawnTimer = 0;
let fireTimer = 0;
let levelTimer = 0;
let time = 0;
const player = { x: 0, y: 0, immunity: 0 };
const enemies = [];
const lasers = [];
const particles = [];

function resize() {
  const nextWidth = Math.max(1, arena.clientWidth);
  const nextHeight = Math.max(1, arena.clientHeight);
  for (const item of [player, ...enemies, ...lasers, ...particles]) {
    item.x *= nextWidth / width;
    item.y *= nextHeight / height;
  }
  width = nextWidth;
  height = nextHeight;
  player.x = running ? Math.max(22, Math.min(width - 22, player.x)) : width / 2;
  player.y = height - 32;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  background = context.createRadialGradient(width * .52, height * .4, 0,
    width * .52, height * .4, Math.max(width, height) * .72);
  background.addColorStop(0, '#18284d');
  background.addColorStop(.57, '#0d142c');
  background.addColorStop(1, '#050817');
}

function held(action) {
  return keyboard.has(action) || [...pointers.values()].includes(action);
}

function syncControls() {
  for (const button of controls) {
    button.classList.toggle('is-held', running && held(button.dataset.control));
  }
}

function clearInput() {
  keyboard.clear();
  pointers.clear();
  syncControls();
}

for (const button of controls) {
  button.addEventListener('pointerdown', event => {
    if (!running || event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, button.dataset.control);
    syncControls();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, event => {
      pointers.delete(event.pointerId);
      syncControls();
    });
  }
  button.addEventListener('contextmenu', event => event.preventDefault());
}

window.addEventListener('keydown', event => {
  if (!running || !Object.hasOwn(keys, event.code)) return;
  event.preventDefault();
  keyboard.add(keys[event.code]);
  syncControls();
});
window.addEventListener('keyup', event => {
  keyboard.delete(keys[event.code]);
  syncControls();
});
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);

function updateHud() {
  scoreText.textContent = String(score).padStart(5, '0');
  livesText.textContent = lives;
  levelText.textContent = String(level).padStart(2, '0');
}

function newGame() {
  score = 0;
  lives = 3;
  level = 1;
  enemies.length = lasers.length = particles.length = 0;
  player.x = width / 2;
  player.immunity = 0;
  fireTimer = levelTimer = 0;
  spawnTimer = .45;
  announcement.textContent = '';
  clearInput();
  updateHud();
  running = true;
  overlay.hidden = true;
}

function gameOver() {
  running = false;
  clearInput();
  announcement.textContent = '';
  subtitle.textContent = '任務結束';
  title.textContent = 'Game Over';
  description.textContent = `最終分數 ${score} · 第 ${level} 關`;
  start.textContent = '再玩一次 →';
  overlay.hidden = false;
  start.focus();
}

start.addEventListener('click', newGame);

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 28 + Math.random() * 180;
    const life = .22 + Math.random() * .45;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life, duration: life, color, size: 1 + Math.random() * 2.6 });
  }
}

function update(dt) {
  player.x += (Number(held('right')) - Number(held('left'))) * 390 * dt;
  player.x = Math.max(22, Math.min(width - 22, player.x));
  player.immunity = Math.max(0, player.immunity - dt);
  fireTimer -= dt;
  if (held('fire') && fireTimer <= 0) {
    lasers.push({ x: player.x, y: player.y - 18 });
    fireTimer = .14;
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    enemies.push({ x: 24 + Math.random() * Math.max(0, width - 48), y: -22,
      speed: 76 + Math.min(230, (level - 1) * 24) + Math.random() * 36 });
    spawnTimer = Math.max(.24, 1.05 - (level - 1) * .095);
  }
  if (levelTimer > 0) {
    levelTimer -= dt;
    if (levelTimer <= 0) announcement.textContent = '';
  }

  for (let i = lasers.length - 1; i >= 0; i--) {
    const laser = lasers[i];
    const previousY = laser.y;
    laser.y -= 650 * dt;
    let hit = -1;
    for (let j = 0; j < enemies.length; j++) {
      const enemy = enemies[j];
      if (Math.abs(laser.x - enemy.x) < 18 && laser.y <= enemy.y + 11 &&
          previousY + 9 >= enemy.y - 11 && (hit < 0 || enemy.y > enemies[hit].y)) {
        hit = j;
      }
    }
    if (hit >= 0) {
      const [enemy] = enemies.splice(hit, 1);
      lasers.splice(i, 1);
      burst(enemy.x, enemy.y, '#ff5ba7', 17);
      score += 100;
      const nextLevel = 1 + Math.floor(score / 800);
      if (nextLevel > level) {
        level = nextLevel;
        announcement.textContent = `第 ${level} 關`;
        levelTimer = 1.5;
      }
      updateHud();
    } else if (laser.y < -12) {
      lasers.splice(i, 1);
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    enemy.y += enemy.speed * dt;
    if (enemy.y > height + 24) {
      enemies.splice(i, 1);
    } else if (Math.abs(enemy.x - player.x) < 27 && Math.abs(enemy.y - player.y) < 21) {
      enemies.splice(i, 1);
      burst(enemy.x, enemy.y, '#ff5ba7', 13);
      if (player.immunity === 0) {
        lives--;
        player.immunity = 1.2;
        burst(player.x, player.y, '#64f4ff', 22);
        updateHud();
        if (lives === 0) {
          gameOver();
          break;
        }
      }
    }
  }
}

function ship(x, y, enemy = false) {
  context.save();
  context.translate(x, y);
  if (enemy) context.rotate(Math.PI);
  const glow = enemy ? '#ff62a8' : '#64f4ff';
  if (!enemy) {
    context.fillStyle = '#308fff';
    context.shadowColor = '#308fff';
    context.shadowBlur = 13;
    context.beginPath();
    context.moveTo(-5, 8);
    context.lineTo(0, 22 + Math.sin(time * 44) * 4);
    context.lineTo(5, 8);
    context.fill();
  }
  context.shadowColor = glow;
  context.shadowBlur = 12;
  context.lineWidth = 1.65;
  context.strokeStyle = glow;
  context.fillStyle = enemy ? '#481e43' : '#163958';
  context.beginPath();
  context.moveTo(0, -17);
  context.lineTo(8, -3);
  context.lineTo(17, 6);
  context.lineTo(18, 12);
  context.lineTo(0, 8);
  context.lineTo(-18, 12);
  context.lineTo(-17, 6);
  context.lineTo(-8, -3);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = enemy ? '#ffd0e6' : '#e0fbff';
  context.beginPath();
  context.ellipse(0, -1, 3, 5, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function render(dt) {
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#b5d7ff';
  for (const star of stars) {
    star.y = (star.y + star.speed * dt / height) % 1;
    context.globalAlpha = star.opacity;
    context.fillRect(star.x * width, star.y * height, star.size, star.size);
  }
  context.globalAlpha = 1;
  for (const enemy of enemies) ship(enemy.x, enemy.y, true);
  if ((running || lives > 0) && (player.immunity <= 0 || Math.floor(player.immunity * 14) % 2 === 0)) {
    ship(player.x, player.y);
  }

  context.shadowBlur = 10;
  context.shadowColor = '#31dcff';
  context.fillStyle = '#b5f8ff';
  for (const laser of lasers) context.fillRect(laser.x - 1.5, laser.y, 3, 13);
  context.shadowBlur = 0;

  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.life -= dt;
    if (particle.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    context.globalAlpha = particle.life / particle.duration;
    context.fillStyle = particle.color;
    context.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  context.globalAlpha = 1;
}

let lastTime;
function frame(now) {
  const dt = lastTime === undefined ? 0 : Math.min(.033, (now - lastTime) / 1000);
  lastTime = now;
  time += dt;
  if (running) update(dt);
  render(dt);
  requestAnimationFrame(frame);
}

resize();
new ResizeObserver(resize).observe(arena);
requestAnimationFrame(frame);
