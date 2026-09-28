import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';

// --- WEB AUDIO API ENGINE ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const actx = new AudioContext();

const playSound = (type) => {
  if (actx.state === 'suspended') actx.resume();
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.connect(gain);
  gain.connect(actx.destination);
  const now = actx.currentTime;
  
  if (type === 'shoot') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(10, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now); osc.stop(now + 0.1);
  } else if (type === 'hit') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.setValueAtTime(800, now + 0.05);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.15);
    osc.start(now); osc.stop(now + 0.15);
  } else if (type === 'miss') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.linearRampToValueAtTime(50, now + 0.3);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    osc.start(now); osc.stop(now + 0.3);
  } else if (type === 'round_start') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.setValueAtTime(400, now + 0.1);
    osc.frequency.setValueAtTime(500, now + 0.2);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
    osc.start(now); osc.stop(now + 0.4);
  } else if (type === 'laugh') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(150, now + 0.2);
    osc.frequency.setValueAtTime(280, now + 0.25);
    osc.frequency.linearRampToValueAtTime(130, now + 0.45);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.6);
    osc.start(now); osc.stop(now + 0.6);
  }
};

// --- SPRITES (Volcano / Lava World theme) ---
const CELL = 3;

// Magma Fire-Bat (acrobat replacement)
const ACROBAT_SWING = [
  "....DDDD....",
  "...DOOODD...",
  "..DOYYYYOD..",
  ".DO.YYYY.OD.",
  "DD..RRRR..DD",
  "D...ROOR...D",
  "....ROOR....",
  "....DDDD....",
  "...D....D...",
  "..D......D..",
  ".DD......DD."
];

// Lava Golem mascot
const VIGILANTE_STAND = [
  "....RRRRRR....",
  "...ROOOOOOOR..",
  "...ROYYYOOR...",
  "...ROOOOOR....",
  "..RRRRRRRRRR..",
  ".RROYYRRYYORR.",
  ".RRROYYYOORR..",
  "..RRROYYRRRR..",
  "...RRR..RRR...",
  "...RR....RR..."
];

// Lava Fireball (drone replacement)
const DRONE_SPRITE = [
  "..OOO.OOO..",
  ".OYYYYYYYYO.",
  "OYYRRRRRRYYO",
  ".OYYYYYYYYO.",
  "..OOO.OOO.."
];

const PALETTES = {
  // Fire-Bat: D=dark-crimson body, O=orange wing, Y=yellow core, R=red accent
  acrobat: { D: '#c0392b', O: '#e67e22', Y: '#ffd32a', R: '#ff3838' },
  // Lava Golem: R=red rock, O=orange glow, Y=yellow core
  vigilante: { R: '#c0392b', O: '#e67e22', Y: '#ffd32a' },
  // Lava Fireball: O=orange shell, Y=yellow core, R=red hot centre
  drone: { O: '#e67e22', Y: '#ffd32a', R: '#ff3838' }
};

const drawGrid = (ctx, x, y, grid, palette, flip=false, scale=1) => {
  const H = grid.length, W = grid[0].length;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.translate(-(W*CELL*scale)/2, -(H*CELL*scale)/2); 
  for (let r=0; r<H; r++) {
    for (let c=0; c<W; c++) {
      const ch = grid[r][c];
      if (ch !== '.') {
        ctx.fillStyle = palette[ch];
        ctx.fillRect(c*CELL*scale, r*CELL*scale, CELL*scale, CELL*scale);
      }
    }
  }
  ctx.restore();
};

const MISS_TAUNTS = [
  "THE LAVA BATS ARE LAUGHING AT YOU!",
  "YOU MISSED A GIANT FIREBALL. REALLY?",
  "THE VOLCANO IS NOT IMPRESSED.",
  "WAS THAT AIMED AT THE MAGMA RIVER?",
  "IS YOUR CURSOR ON FIRE? CAUSE YOUR AIM ISN'T!",
  "OPEN YOUR EYES, THE LAVA IS RIGHT THERE!",
  "EVEN THE GOLEM COULD HIT THAT!",
  "MY MOLTEN GRANDMA AIMS BETTER!",
  "ARE YOU SHOOTING WITH OVEN MITTS ON?",
  "WAKE UP, THE VOLCANO IS ERUPTING!",
  "I'VE SEEN BETTER AIM FROM A LAVA ROCK.",
  "YOU'RE SHOOTING ASHES!",
  "PACIFIST RUN IN A VOLCANO ZONE?",
  "YOU CALL THAT A SHOT? THE MAGMA IS ASHAMED!"
];

const GAME_OVER_TAUNTS = [
  "THE LAVA BATS HAVE CLAIMED THE VOLCANO. NICE WORK.",
  "WITH GREAT HEAT COMES TERRIBLE AIM.",
  "THE REAL PUNISHMENT IS WATCHING THE MAGMA RISE.",
  "LAVA BATS: 1, YOU: 0.",
  "DON'T QUIT YOUR DAY JOB. VOLCANOES NEED BETTER DEFENDERS.",
  "THE VOLCANO IS DOOMED THANKS TO YOU.",
  "BACK TO THE COOLING CHAMBERS FOR YOU.",
  "MAYBE TRY PUTTING OUT CAMPFIRES INSTEAD?",
  "EVEN THE LAVA GOLEM IS DISAPPOINTED.",
  "YOU LET THEM ESCAPE! NOW THE WHOLE ISLAND IS ON FIRE!"
];

// --- GAME LOGIC ENGINE ---
class GameEngine {
  constructor(canvas, updateReactState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.updateReactState = updateReactState;
    
    // Internal logical resolution (16:9)
    this.W = 800; this.H = 450;
    this.canvas.width = this.W; this.canvas.height = this.H;
    
    this.state = 'MENU'; 
    this.mode = 1; // 1=EASY, 2=MEDIUM, 3=HARD
    
    this.score = 0;
    this.hiScore = parseInt(localStorage.getItem('retroweb_hi')) || 0;
    this.round = 1;
    this.ammo = 5;
    this.maxAmmo = 5;
    
    this.targets = [];
    this.particles = [];
    this.floatingTexts = []; 
    this.history = new Array(10).fill('empty');
    this.targetsSpawned = 0;
    this.shotsFired = 0;
    this.currentCombo = 0; 
    this.gameOverTaunt = "";
    
    this.mascot = { active: false, y: this.H, type: 'laugh', timer: 0 };
    
    this.lastTime = performance.now();
    this.reqId = requestAnimationFrame((t) => this.loop(t));
  }

  startGame(mode) {
    this.mode = mode;
    this.score = 0;
    this.round = 1;
    this.currentCombo = 0;
    this.gameOverTaunt = "";
    
    // Determine Max Ammo based on Difficulty Level
    if (this.mode === 1) this.maxAmmo = 5; // Easy
    else if (this.mode === 2) this.maxAmmo = 4; // Medium
    else this.maxAmmo = 3; // Hard
    
    this.startRound();
  }

  startRound() {
    this.history = new Array(10).fill('empty');
    this.targetsSpawned = 0;
    this.targets = [];
    this.particles = [];
    this.floatingTexts = [];
    this.state = 'ROUND_START';
    this.syncState();
    playSound('round_start');
    
    setTimeout(() => {
      if (this.state === 'ROUND_START') {
        this.state = 'PLAYING';
        this.spawnWave();
      }
    }, 1500);
  }

  spawnWave() {
    this.ammo = this.maxAmmo;
    this.targets = [];
    
    // Targets per wave based on Difficulty Level
    let count = 1;
    if (this.mode === 2) count = 2; // Medium: 2 acrobats
    if (this.mode === 3) count = 2; // Hard: acrobat + drone mix
    
    for (let i=0; i<count; i++) {
      if (this.mode === 3 && i === 1) {
        this.targets.push(this.createDrone());
      } else {
        this.targets.push(this.createAcrobat());
      }
    }
    this.targetsSpawned += count;
    this.syncState();
  }

  // --- ENTITY CREATION ---
  createAcrobat() {
    // Huge difficulty tweaks here based on level
    let speedMult = 0.5 + (this.round * 0.05); // EASY base speed
    if (this.mode === 2) speedMult = 0.8 + (this.round * 0.05); // MEDIUM
    if (this.mode === 3) speedMult = 1.2 + (this.round * 0.1); // HARD
    
    const dir = Math.random() > 0.5 ? 1 : -1;
    const startY = 150 + Math.random() * 100; 
    
    return {
      type: 'acrobat',
      x: dir === 1 ? -80 : this.W + 80,
      y: startY,
      baseY: startY,
      vx: (140 + Math.random() * 40) * speedMult * dir, 
      amplitude: 140 + Math.random() * 50, // Massive swing down to bottom third of screen
      phase: Math.random() * Math.PI,
      phaseSpeed: (2.0 + Math.random()) * speedMult,
      dead: false,
      escaped: false,
      escapeTimer: 0,
      speedGlitched: false,
      freezeTimer: 0,
      freezeCount: 0,
      hasDodged: false,
      // More forgiving screen time on easy
      maxTime: this.mode === 1 ? 5.0 : Math.max(1.5, 4.0 - (this.round * 0.2)) 
    };
  }

  createDrone() {
    let speedMult = 1.0 + (this.round * 0.1);
    const dir = Math.random() > 0.5 ? 1 : -1;
    return {
      type: 'drone',
      x: dir === 1 ? -40 : this.W + 40,
      y: this.H * 0.5 + (Math.random() * 120 - 60), 
      vx: (160 + Math.random() * 60) * speedMult * dir,
      vy: (-20 - Math.random() * 30) * speedMult,
      scale: 2.5,
      dead: false,
      escaped: false,
      escapeTimer: 0,
      speedGlitched: false,
      freezeTimer: 0,
      freezeCount: 0,
      hasDodged: false,
      maxTime: Math.max(1.5, 3.5 - (this.round * 0.15))
    };
  }

  // --- INPUT ---
  shoot(x, y) {
    if (this.state !== 'PLAYING') return;
    if (this.ammo <= 0) return;
    
    this.ammo--;
    this.shotsFired++;
    playSound('shoot');
    
    const flashEl = document.getElementById('screen-flash');
    if (flashEl) {
      flashEl.style.opacity = '0.4';
      setTimeout(() => flashEl.style.opacity = '0', 50);
    }

    let hitAnything = false;

    // Difficulty based hit boxes
    let radiusMult = 1.0;
    if (this.mode === 1) radiusMult = 1.5; // Huge hit boxes for Easy
    if (this.mode === 3) radiusMult = 0.8; // Small hit boxes for Hard

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (t.dead || t.escaped) continue;
      
      const baseRadius = t.type === 'drone' ? 24 * t.scale : 32; 
      const radius = baseRadius * radiusMult;
      const dist = Math.hypot(t.x - x, t.y - y);
      
      if (dist < radius) {
        t.dead = true;
        hitAnything = true;
        this.currentCombo++;
        playSound('hit');
        
        const basePts = (t.type === 'drone' ? 1000 : 500) + (this.round * 100);
        const comboMult = this.currentCombo > 1 ? this.currentCombo : 1;
        const totalPts = basePts * comboMult;
        
        this.score += totalPts;
        if (this.score > this.hiScore) {
          this.hiScore = this.score;
          localStorage.setItem('retroweb_hi', this.hiScore);
        }
        
        this.floatingTexts.push({ x: t.x, y: t.y - 30, text: `+${totalPts}`, color: '#f1c40f', life: 1.2, isTaunt: false });
        if (this.currentCombo > 1) {
            this.floatingTexts.push({ x: t.x, y: t.y - 50, text: `${this.currentCombo}X COMBO!`, color: '#e23636', life: 1.5, isTaunt: false });
        }

        this.spawnExplosion(t.x, t.y, t.type === 'drone' ? '#ff3333' : '#e23636');
        
        const idx = this.targetsSpawned - this.targets.length + i;
        if (idx < 10) this.history[idx] = 'hit';
        break; 
      }
    }

    if (!hitAnything) {
        playSound('miss');
        this.currentCombo = 0; 
        
        // Clear previous taunts to prevent unreadable overlaps
        this.floatingTexts = this.floatingTexts.filter(ft => !ft.isTaunt);
        const taunt = MISS_TAUNTS[Math.floor(Math.random() * MISS_TAUNTS.length)];
        
        // Spawn taunt in the upper center of the screen
        this.floatingTexts.push({
          x: this.W / 2, y: this.H / 3, text: taunt, color: '#ff6b6b', life: 2.5, isTaunt: true
        });
    }
    
    this.checkWaveEnd();
    this.syncState();
  }

  checkWaveEnd() {
    const allDead = this.targets.every(t => t.dead);
    const allEscaped = this.targets.every(t => t.escaped || t.dead);

    // Bug #4 Fixed: advance wave when all targets are dead, all have escaped,
    // or ammo is empty and all have escaped/died.
    if (allDead || allEscaped || (this.ammo === 0 && allEscaped)) {
      setTimeout(() => this.endWave(), 600);
    }
  }

  endWave() {
    if (this.state !== 'PLAYING') return;
    
    let caughtCount = this.targets.filter(t => t.dead).length;
    
    if (this.targets.length > 0 && this.targets.some(t => t.escaped && !t.dead)) {
       this.currentCombo = 0; 
       this.targets.forEach((t, i) => {
         if (t.escaped && !t.dead) {
           const idx = this.targetsSpawned - this.targets.length + i;
           if (idx < 10) this.history[idx] = 'miss';
         }
       });
    }

    this.state = 'END_ANIM';
    this.mascot.active = true;
    this.mascot.y = this.H;
    this.mascot.timer = 0;
    
    if (caughtCount > 0) {
      this.mascot.type = 'stand';
    } else {
      this.mascot.type = 'laugh';
      playSound('laugh');
    }
    this.syncState();
  }

  spawnExplosion(x, y, color) {
    for(let i=0; i<30; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random()-0.5)*350,
        vy: (Math.random()-0.5)*350,
        life: 1.0,
        color: Math.random()>0.5 ? color : '#ffffff'
      });
    }
  }

  // --- LOOP & RENDERING ---
  loop(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    
    this.update(dt);
    this.draw();
    
    this.reqId = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    if (this.state === 'PLAYING') {
      let activeCount = 0;
      
      this.targets.forEach(t => {
        if (t.dead) {
          t.y += 500 * dt;
          return;
        }
        if (t.escaped) return;

        t.escapeTimer += dt;
        if (t.escapeTimer > t.maxTime || t.x < -150 || t.x > this.W + 150 || t.y < -150) {
          t.escaped = true;
          this.checkWaveEnd();
        } else if (t.type === 'acrobat') {
          // D08 — evasive dodge: sudden vertical plunge/rise + horizontal turn
          if (!t.hasDodged && t.escapeTimer > 1.2 && Math.random() < 0.03) {
            t.vy = (Math.random() > 0.5 ? -1 : 1) * 120;
            t.vx *= -0.8;
            t.hasDodged = true;
          }
          // Continuous sine-wave swinging motion (Bug #2 & #3 fixed: no multipliers, no freeze)
          t.x += t.vx * dt;
          t.phase += t.phaseSpeed * dt;
          t.y = t.baseY + Math.sin(t.phase) * t.amplitude;
          // Apply residual dodge vertical nudge (decays quickly)
          if (t.vy) {
            t.baseY += t.vy * dt;
            t.vy *= Math.max(0, 1 - 4 * dt); // dampen over ~0.25 s
            if (Math.abs(t.vy) < 1) t.vy = 0;
          }
        } else if (t.type === 'drone') {
          // D08 — evasive dodge: sudden vertical plunge/rise + horizontal turn
          if (!t.hasDodged && t.escapeTimer > 1.2 && Math.random() < 0.03) {
            t.vy = (Math.random() > 0.5 ? -1 : 1) * 120;
            t.vx *= -0.8;
            t.hasDodged = true;
          }
          // Constant velocity, no freeze (Bug #2 & #3 fixed)
          t.x += t.vx * dt;
          t.y += t.vy * dt;
          t.scale = Math.max(0.5, t.scale - 0.5 * dt);
        }
        activeCount++;
      });
      
      if (this.ammo === 0 && activeCount > 0) {
        this.targets.forEach(t => { if (!t.dead) t.escapeTimer += dt * 5; });
      }
    }

    if (this.state === 'END_ANIM') {
      this.mascot.timer += dt;
      if (this.mascot.timer < 0.5) this.mascot.y -= 150 * dt; 
      else if (this.mascot.timer > 2.0) this.mascot.y += 150 * dt; 
      
      if (this.mascot.timer > 2.5) {
        this.mascot.active = false;
        if (this.targetsSpawned >= 10) this.checkRoundClear();
        else { this.state = 'PLAYING'; this.spawnWave(); }
      }
    }

    this.particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 1.5;
    });
    this.particles = this.particles.filter(p => p.life > 0);

    this.floatingTexts.forEach(ft => {
      ft.y -= (ft.isTaunt ? 5 : 45) * dt;
      ft.life -= dt;
    });
    this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
  }

  checkRoundClear() {
    const hits = this.history.filter(h => h === 'hit').length;
    // Progression requirements scaled by difficulty
    let required = 5 + Math.floor(this.round / 2);
    if (this.mode === 1) required -= 1; // Easier to pass on easy mode
    required = Math.min(required, 10);
    
    if (hits >= required) {
      this.round++;
      this.startRound();
    } else {
      this.state = 'GAME_OVER';
      this.gameOverTaunt = GAME_OVER_TAUNTS[Math.floor(Math.random() * GAME_OVER_TAUNTS.length)];
      this.syncState();
    }
  }

  draw() {
    const ctx = this.ctx;
    const now = performance.now() / 1000; // seconds, for animation

    // --- SKY: dark crimson/orange smoky gradient ---
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.H);
    skyGrad.addColorStop(0,   '#1a0000');
    skyGrad.addColorStop(0.4, '#3d0a00');
    skyGrad.addColorStop(0.75,'#7a1e00');
    skyGrad.addColorStop(1,   '#b03000');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.W, this.H);

    // --- VOLCANIC ASH / EMBER PARTICLES (deterministic flicker) ---
    for (let i = 0; i < 60; i++) {
      const ex = ((Math.sin(i * 491 + now * (0.3 + i * 0.01)) * 0.5 + 0.5)) * this.W;
      const ey = ((Math.cos(i * 317 + now * (0.2 + i * 0.008)) * 0.5 + 0.5)) * this.H * 0.7;
      const er = 1 + Math.abs(Math.sin(i * 77 + now * 2)) * 2;
      const alpha = 0.4 + Math.abs(Math.sin(i * 53 + now * 3)) * 0.6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = i % 3 === 0 ? '#ffd32a' : i % 3 === 1 ? '#e67e22' : '#ff3838';
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // --- DISTANT DARK MOUNTAINS ---
    ctx.fillStyle = '#1f0500';
    // Far mountains (lighter silhouette)
    ctx.beginPath();
    ctx.moveTo(0, this.H * 0.72);
    ctx.lineTo(60,  this.H * 0.45);
    ctx.lineTo(130, this.H * 0.60);
    ctx.lineTo(210, this.H * 0.38);
    ctx.lineTo(310, this.H * 0.55);
    ctx.lineTo(430, this.H * 0.42);
    ctx.lineTo(530, this.H * 0.58);
    ctx.lineTo(640, this.H * 0.40);
    ctx.lineTo(730, this.H * 0.54);
    ctx.lineTo(this.W, this.H * 0.46);
    ctx.lineTo(this.W, this.H);
    ctx.lineTo(0, this.H);
    ctx.closePath();
    ctx.fill();

    // Near mountains (darker)
    ctx.fillStyle = '#120200';
    ctx.beginPath();
    ctx.moveTo(0, this.H * 0.82);
    ctx.lineTo(80,  this.H * 0.62);
    ctx.lineTo(160, this.H * 0.72);
    ctx.lineTo(260, this.H * 0.52);
    ctx.lineTo(380, this.H * 0.68);
    ctx.lineTo(500, this.H * 0.50);
    ctx.lineTo(600, this.H * 0.65);
    ctx.lineTo(700, this.H * 0.55);
    ctx.lineTo(this.W, this.H * 0.62);
    ctx.lineTo(this.W, this.H);
    ctx.lineTo(0, this.H);
    ctx.closePath();
    ctx.fill();

    // --- CENTRAL VOLCANO ---
    const vx = this.W / 2, vBase = this.H * 0.78, vTop = this.H * 0.28;
    ctx.fillStyle = '#1a0300';
    ctx.beginPath();
    ctx.moveTo(vx - 220, vBase);
    ctx.lineTo(vx - 55,  vTop + 10);
    ctx.lineTo(vx,       vTop);
    ctx.lineTo(vx + 55,  vTop + 10);
    ctx.lineTo(vx + 220, vBase);
    ctx.closePath();
    ctx.fill();

    // Crater rim glow
    const craterGrad = ctx.createRadialGradient(vx, vTop, 4, vx, vTop, 55);
    craterGrad.addColorStop(0,   '#ffd32a');
    craterGrad.addColorStop(0.4, '#e67e22');
    craterGrad.addColorStop(1,   'rgba(192,57,43,0)');
    ctx.fillStyle = craterGrad;
    ctx.beginPath();
    ctx.ellipse(vx, vTop + 5, 55, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Animated lava spill down volcano face
    const spillOffset = (now * 30) % 40;
    const spillGrad = ctx.createLinearGradient(vx, vTop, vx, vBase);
    spillGrad.addColorStop(0,   '#ffd32a');
    spillGrad.addColorStop(0.3, '#e67e22');
    spillGrad.addColorStop(1,   '#7a1e00');
    ctx.strokeStyle = spillGrad;
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.75;
    // Left spill
    ctx.beginPath();
    ctx.moveTo(vx - 10, vTop + 12);
    for (let sy = vTop + 12; sy < vBase; sy += 8) {
      ctx.lineTo(vx - 10 - (sy - vTop) * 0.22 + Math.sin((sy + spillOffset) * 0.25) * 5, sy);
    }
    ctx.stroke();
    // Right spill
    ctx.beginPath();
    ctx.moveTo(vx + 10, vTop + 12);
    for (let sy = vTop + 12; sy < vBase; sy += 8) {
      ctx.lineTo(vx + 10 + (sy - vTop) * 0.22 + Math.sin((sy + spillOffset) * 0.22) * 5, sy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Smoke puffs from crater
    for (let s = 0; s < 5; s++) {
      const smokeT = ((now * 0.5 + s * 0.2) % 1.0);
      const smokeX = vx + Math.sin(s * 1.7 + now) * 18;
      const smokeY = vTop - smokeT * 90;
      const smokeR = 8 + smokeT * 28;
      ctx.globalAlpha = (1 - smokeT) * 0.35;
      ctx.fillStyle = '#3d1a00';
      ctx.beginPath();
      ctx.arc(smokeX, smokeY, smokeR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // --- TARGETS ---
    this.targets.forEach(t => {
      if (t.escaped && !t.dead) return;
      if (t.type === 'acrobat') {
        // Glowing lava tether instead of white rope
        const tether = ctx.createLinearGradient(t.x, -200, t.x, t.y);
        tether.addColorStop(0, 'rgba(255,211,42,0)');
        tether.addColorStop(1, 'rgba(230,126,34,0.8)');
        ctx.strokeStyle = tether;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(t.x + (t.vx * 0.3), -200);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
        if (!t.dead) drawGrid(ctx, t.x, t.y, ACROBAT_SWING, PALETTES.acrobat, t.vx > 0, 1.8);
      } else if (t.type === 'drone') {
        // Glow halo around fireball
        if (!t.dead) {
          const glow = ctx.createRadialGradient(t.x, t.y, 2, t.x, t.y, 28 * t.scale);
          glow.addColorStop(0,   'rgba(255,211,42,0.55)');
          glow.addColorStop(0.5, 'rgba(230,126,34,0.25)');
          glow.addColorStop(1,   'rgba(192,57,43,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(t.x, t.y, 28 * t.scale, 0, Math.PI * 2);
          ctx.fill();
          drawGrid(ctx, t.x, t.y, DRONE_SPRITE, PALETTES.drone, false, t.scale);
        }
      }
    });

    // --- EXPLOSION PARTICLES ---
    this.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillRect(p.x, p.y, 5, 5);
    });
    ctx.globalAlpha = 1.0;

    // --- MAGMA RIVER (foreground floor) ---
    const floorY = this.H - 70;
    // Dark basalt base
    ctx.fillStyle = '#120200';
    ctx.fillRect(0, floorY, this.W, 70);

    // Animated flowing magma river
    const magmaOffset = (now * 50) % this.W;
    const magmaGrad = ctx.createLinearGradient(0, floorY, 0, this.H);
    magmaGrad.addColorStop(0,   '#ffd32a');
    magmaGrad.addColorStop(0.3, '#e67e22');
    magmaGrad.addColorStop(0.7, '#c0392b');
    magmaGrad.addColorStop(1,   '#7a1e00');
    ctx.fillStyle = magmaGrad;
    ctx.beginPath();
    ctx.moveTo(0, floorY + 18);
    for (let mx = 0; mx <= this.W; mx += 20) {
      const wave = Math.sin((mx + magmaOffset) * 0.05) * 7;
      ctx.lineTo(mx, floorY + 18 + wave);
    }
    ctx.lineTo(this.W, this.H);
    ctx.lineTo(0, this.H);
    ctx.closePath();
    ctx.fill();

    // Dark lava rock outcrops on foreground
    const rocks = [
      {x: 20,  w: 80,  h: 55}, {x: 130, w: 100, h: 70},
      {x: 260, w: 90,  h: 50}, {x: 390, w: 120, h: 65},
      {x: 540, w: 85,  h: 52}, {x: 665, w: 95,  h: 60}
    ];
    rocks.forEach(b => {
      ctx.fillStyle = '#1a0300';
      ctx.fillRect(b.x, this.H - b.h, b.w, b.h);
      // Glowing lava cracks
      ctx.fillStyle = '#e67e22';
      for (let cy = this.H - b.h + 10; cy < this.H - 15; cy += 14) {
        for (let cx = b.x + 10; cx < b.x + b.w - 10; cx += 16) {
          if ((cx * cy) % 5 > 2) {
            ctx.globalAlpha = 0.6 + Math.sin(now * 3 + cx * 0.1) * 0.3;
            ctx.fillRect(cx, cy, 3, 6);
          }
        }
      }
      ctx.globalAlpha = 1.0;
    });

    // --- LAVA GOLEM MASCOT ---
    if (this.mascot.active) {
      const mY = Math.max(this.mascot.y, this.H - 120);
      drawGrid(ctx, this.W / 2, mY, VIGILANTE_STAND, PALETTES.vigilante, false, 2.5);
      if (this.mascot.type === 'laugh') {
        const bob = Math.sin(this.mascot.timer * 20) * 5;
        drawGrid(ctx, this.W / 2, mY + bob, VIGILANTE_STAND, PALETTES.vigilante, false, 2.5);
      }
    }

    // --- FLOATING TEXTS (Scores & Taunts) ---
    ctx.textAlign = 'center';
    this.floatingTexts.forEach(ft => {
      ctx.font = ft.isTaunt ? 'bold 18px "Press Start 2P", monospace, sans-serif' : '14px "Press Start 2P", monospace, sans-serif';
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.life * 1.5));

      const textWidth = ctx.measureText(ft.text).width;
      let drawX = Math.max(textWidth / 2 + 20, Math.min(this.W - textWidth / 2 - 20, ft.x));

      if (ft.isTaunt) {
        ctx.fillStyle = 'rgba(26,3,0,0.92)';
        ctx.fillRect(drawX - textWidth/2 - 20, ft.y - 24, textWidth + 40, 36);
        ctx.strokeStyle = '#e67e22';
        ctx.lineWidth = 2;
        ctx.strokeRect(drawX - textWidth/2 - 20, ft.y - 24, textWidth + 40, 36);
      }

      ctx.fillStyle = ft.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, drawX, ft.y);
      ctx.fillText(ft.text, drawX, ft.y);
    });
    ctx.globalAlpha = 1.0;
  }

  syncState() {
    if (this.updateReactState) {
      this.updateReactState({
        state: this.state,
        score: this.score,
        hiScore: this.hiScore,
        round: this.round,
        ammo: this.ammo,
        maxAmmo: this.maxAmmo,
        history: [...this.history],
        mode: this.mode,
        gameOverTaunt: this.gameOverTaunt
      });
    }
  }

  destroy() {
    cancelAnimationFrame(this.reqId);
  }
}

// --- REACT APP COMPONENT ---
const App = () => {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  
  const [gameState, setGameState] = useState({
    state: 'MENU',
    score: 0,
    hiScore: parseInt(localStorage.getItem('retroweb_hi')) || 0,
    round: 1,
    ammo: 5,
    maxAmmo: 5,
    history: new Array(10).fill('empty'),
    mode: 1,
    gameOverTaunt: ""
  });

  const initEngine = useCallback(() => {
    if (engineRef.current) engineRef.current.destroy();
    engineRef.current = new GameEngine(canvasRef.current, setGameState);
    setGameState(prev => ({...prev, hiScore: engineRef.current.hiScore}));
  }, []);

  useEffect(() => {
    initEngine();
    return () => { if (engineRef.current) engineRef.current.destroy(); };
  }, [initEngine]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const eng = engineRef.current;
      if (!eng) return;
      
      switch(e.key.toLowerCase()) {
        case '1': if(eng.state === 'MENU') eng.startGame(1); break;
        case '2': if(eng.state === 'MENU') eng.startGame(2); break;
        case '3': if(eng.state === 'MENU') eng.startGame(3); break;
        case 'r': eng.startGame(eng.mode); break;
        case 'escape': 
          eng.state = 'MENU';
          eng.syncState();
          break;
        case ' ': 
          if (eng.state === 'PLAYING') eng.shoot(400, 225); // Shoot center
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCanvasClick = (e) => {
    const eng = engineRef.current;
    if (!eng || eng.state !== 'PLAYING') return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    eng.shoot(x, y);
  };

  const modeNames = { 1: "LEVEL 1: EASY", 2: "LEVEL 2: MEDIUM", 3: "LEVEL 3: VERY HARD" };

  return (
    <div className="game-area">
      <canvas ref={canvasRef} onClick={handleCanvasClick} />
      <div className="crt-overlay"></div>
      <div id="screen-flash" className="flash"></div>

      {/* Top HUD Controls overlay over canvas directly */}
      {(gameState.state !== 'MENU') && (
        <div className="hud-top">
           <div></div>
           <div>
              <button className="btn" onClick={() => engineRef.current && engineRef.current.startGame(engineRef.current.mode)}>RESTART (R)</button>
              <button className="btn" onClick={() => {if(engineRef.current) {engineRef.current.state = 'MENU'; engineRef.current.syncState();}}}>MENU (ESC)</button>
           </div>
        </div>
      )}

      {gameState.state === 'MENU' && (
        <div className="overlay-screen">
          <h2 className="title">VOLCANO RUNNER</h2>
          <p className="subtitle">🌋 LAVA INVASION · Aim with mouse/finger · Click/Space to shoot</p>
          <div className="menu-opts">
            <div className="menu-opt" onClick={() => engineRef.current.startGame(1)}>🔥 LEVEL 1: EASY (Press 1)</div>
            <div className="menu-opt" onClick={() => engineRef.current.startGame(2)}>🌋 LEVEL 2: MEDIUM (Press 2)</div>
            <div className="menu-opt" onClick={() => engineRef.current.startGame(3)}>💀 LEVEL 3: VERY HARD (Press 3)</div>
          </div>
        </div>
      )}

      {gameState.state === 'ROUND_START' && (
        <div className="overlay-screen" style={{background: 'rgba(5,3,10,0.6)'}}>
          <h2 className="title" style={{fontSize: '3vmin'}}>WAVE {gameState.round}</h2>
        </div>
      )}

      {gameState.state === 'GAME_OVER' && (
        <div className="overlay-screen">
          <h2 className="title" style={{color: 'var(--neon-red)'}}>GAME OVER</h2>
          <p style={{fontSize: '1.5vmin', marginBottom: '16px'}}>SCORE: {gameState.score}</p>
          <p style={{fontSize: '1.5vmin', color: '#f39c12', marginBottom: '32px', maxWidth: '80%', lineHeight: '1.6'}}>
            "{gameState.gameOverTaunt}"
          </p>
          <div className="menu-opt" onClick={() => engineRef.current.startGame(gameState.mode)}>TRY AGAIN (R)</div>
          <div className="menu-opt" style={{marginTop: '10px'}} onClick={() => {engineRef.current.state = 'MENU'; engineRef.current.syncState();}}>MENU (ESC)</div>
        </div>
      )}

      {(gameState.state !== 'MENU') && (
        <div className="hud-bottom">
          <div className="hud-left">
            <div><span className="text-highlight">WAVE {gameState.round}</span></div>
            <div style={{color: '#8ab4f8'}}>{modeNames[gameState.mode]}</div>
          </div>
          
          <div className="hud-center">
            {gameState.history.map((res, i) => (
              <div key={i} className={`hit-box ${res === 'hit' ? 'hit' : res === 'miss' ? 'miss' : ''}`} />
            ))}
          </div>

          <div className="hud-right" style={{textAlign: 'right'}}>
            <div>SCORE <span className="text-highlight">{gameState.score.toString().padStart(6, '0')}</span></div>
            <div>HI <span className="text-highlight">{gameState.hiScore.toString().padStart(6, '0')}</span></div>
          </div>

          <div className="ammo-container">
            {Array.from({length: gameState.maxAmmo}).map((_, i) => (
              <div key={i} className={`bullet-icon ${i >= gameState.ammo ? 'spent' : ''}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
