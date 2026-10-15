/* Midnight Guardian — high fidelity sprite arena combat. */
(() => {
  const canvas = document.querySelector('#cat-game-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const $ = selector => document.querySelector(selector);
  const keys = new Set();
  const touchKeys = new Set();
  const random = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mixColor = (from, to, amount) => {
    const read = hex => hex.match(/\w\w/g).map(value => parseInt(value, 16));
    const [r1, g1, b1] = read(from);
    const [r2, g2, b2] = read(to);
    return `rgb(${Math.round(r1 + (r2 - r1) * amount)},${Math.round(g1 + (g2 - g1) * amount)},${Math.round(b1 + (b2 - b1) * amount)})`;
  };
  const TARGET_FPS = 60;
  const FRAME_MS = 1000 / TARGET_FPS;
  const ARENA = { halfWidth: 760, halfHeight: 580, playerX: 695, playerY: 515 };
  const PLAYER_LIMITS = { damage: 10000, health: 20000, parry: 3 };
  const MAX_STATS_COMBO = ['p', 'o', 'i'];
  const UPGRADE_DETAILS = {
    damage: { icon: '⚔', label: 'Mejorar daño' },
    health: { icon: '♥', label: 'Mejorar salud' },
    parry: { icon: '✦', label: 'Mejorar bloqueo perfecto' }
  };

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const catSheet = new Image();
  catSheet.decoding = 'async';
  const art = { creatures: false };

  const g = {
    started: false, over: false, paused: false, artReady: false,
    level: 1, souls: 0, soulLevel: 1, damage: 15, max: 100, hp: 100, parry: .3,
    upgradeCosts: { damage: 50, health: 50, parry: 50 },
    skin: '#151522', time: 0, last: 0, camera: { x: 0, y: 0 },
    cat: { x: 0, y: 0, fx: 0, fy: 1, hit: 0, moving: 0 },
    enemies: [], boss: null, bossFought: false, attack: null,
    shield: false, mouseShield: false, touchShield: false, shieldAge: 99, ready: false, maxStatsComboActive: false, pausedForOrientation: false
  };

  const say = text => { const message = $('#cat-message'); if (message) message.textContent = text; };
  const corruptionForLevel = () => clamp((g.level - 1) / 6, 0, 1);
  const visualCorruption = () => {
    const progression = corruptionForLevel();
    // Solo amplifica el impacto gráfico; no altera el ritmo ni el poder por nivel.
    return progression ? Math.pow(progression, .38) : 0;
  };
  const upgradeCost = type => g.upgradeCosts[type] ?? Infinity;
  const upgradeAtLimit = type => (type === 'damage' ? g.damage >= PLAYER_LIMITS.damage : type === 'health' ? g.max >= PLAYER_LIMITS.health : g.parry >= PLAYER_LIMITS.parry);
  const canUpgrade = type => !upgradeAtLimit(type) && g.souls >= upgradeCost(type);
  const refreshUpgradeState = () => { g.ready = Object.keys(g.upgradeCosts).some(canUpgrade); };
  const project = (x, y, z = 0) => ({
    x: 480 + ((x - g.camera.x) - (y - g.camera.y)) * 1.05,
    y: 207 + ((x - g.camera.x) + (y - g.camera.y)) * .52 - z
  });

  function markArtReady() {
    g.artReady = art.creatures;
    if (g.artReady) say('Arte de combate cargado. Inicia la aventura cuando estés listo.');
  }
  catSheet.addEventListener('load', () => { art.creatures = true; markArtReady(); });
  catSheet.addEventListener('error', () => say('No se pudo cargar el arte de criaturas. Recarga la página.'));
  // Arte maestro aprobado: se carga tal como fue entregado, sin filtros ni regeneración del archivo.
  catSheet.src = 'aenima-principal-cats.png';

  const groundDetails = Array.from({ length: 250 }, (_, index) => {
    const seed = Math.sin(index * 92.71) * 9999;
    const seed2 = Math.sin((index + 48) * 51.37) * 9999;
    return {
      x: (seed - Math.floor(seed)) * ARENA.halfWidth * 1.92 - ARENA.halfWidth * .96,
      y: (seed2 - Math.floor(seed2)) * ARENA.halfHeight * 1.92 - ARENA.halfHeight * .96,
      size: 4 + ((seed * 37) % 1 + 1) * 13,
      variation: ((seed * 13.17) % 1 + 1) % 1,
      dirt: index % 3 === 0
    };
  });

  function updateUi() {
    $('#cat-level').textContent = `NIVEL ${g.level} · CORRUPCIÓN ${Math.round(corruptionForLevel() * 100)}%`;
    $('#cat-health').textContent = `SALUD ${Math.ceil(Math.max(0, g.hp))}${g.shield ? ' · ESCUDO' : ''}`;
    $('#cat-enemies').textContent = `ENEMIGOS ${g.enemies.length + (g.boss ? 1 : 0)}`;
    const damageHud = $('#cat-damage-hud');
    if (damageHud) damageHud.textContent = `DAÑO ${g.damage}`;
    let souls = $('#cat-souls');
    if (!souls) {
      souls = document.createElement('span');
      souls.id = 'cat-souls';
      $('.cat-hud').append(souls);
    }
    souls.textContent = `CARGA ${g.souls}`;
    const progress = $('#cat-upgrade-progress');
    const allMaxed = Object.keys(g.upgradeCosts).every(upgradeAtLimit);
    if (progress) progress.textContent = allMaxed ? 'Todas las mejoras alcanzaron su límite.' : (g.ready ? 'Mejora disponible · cada atributo conserva su propio coste.' : `Carga de almas: ${g.souls} · revisa el coste de cada mejora.`);
    document.querySelectorAll('[data-cat-upgrade]').forEach(button => {
      const type = button.dataset.catUpgrade;
      const detail = UPGRADE_DETAILS[type];
      const atLimit = upgradeAtLimit(type);
      const cost = upgradeCost(type);
      button.disabled = !canUpgrade(type);
      button.textContent = atLimit ? `${detail.icon} ${detail.label} · máximo` : `${detail.icon} ${detail.label} · ${cost} almas`;
      button.setAttribute('aria-label', atLimit ? `${detail.label}: máximo alcanzado` : `${detail.label}: cuesta ${cost} almas`);
    });
  }

  function maxOutPlayerStats() {
    if (g.maxStatsComboActive) return;
    g.maxStatsComboActive = true;
    g.damage = PLAYER_LIMITS.damage;
    g.max = PLAYER_LIMITS.health;
    g.hp = g.max;
    g.parry = PLAYER_LIMITS.parry;
    refreshUpgradeState();
    updateUi();
    say('Una fuerza oculta recorre la arena.');
  }

  function makeEnemy(boss = false) {
    let x = 0, y = 0;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      x = random(-ARENA.halfWidth * .78, ARENA.halfWidth * .78);
      y = random(-ARENA.halfHeight * .76, ARENA.halfHeight * .76);
      if (Math.hypot(x - g.cat.x, y - g.cat.y) > 270) break;
    }
    const levelOffset = Math.max(0, g.level - 1);
    const baseHp = boss ? 282 : 48;
    const corruptionMultiplier = 1.5 ** levelOffset;
    const hp = Math.min(boss ? 3000 : 1000, Math.round(baseHp * corruptionMultiplier));
    return {
      x, y, hp, max: hp, boss, hit: 0, cool: random(.5, 1.1), atk: null, moving: 0, facing: 1,
      corruptionMultiplier, damageCap: boss ? 1200 : 500,
      speedScale: 1 + .045 * levelOffset, glitchSeed: random(0, 1000)
    };
  }

  function spawn() {
    g.hp = g.max;
    g.over = false;
    g.boss = null;
    g.bossFought = false;
    g.enemies = Array.from({ length: Math.min(3 + g.level, 8) }, () => makeEnemy());
    const corruption = Math.round(corruptionForLevel() * 100);
    say(corruption ? `La corrupción informática alcanza ${corruption}%: alimenta a los enemigos y multiplica su vida y daño x${(1.5 ** (g.level - 1)).toFixed(2)}.` : 'La pradera está viva y limpia. El minijefe llegará al final.');
    updateUi();
  }

  function earn(points) {
    const wasReady = g.ready;
    g.souls += points;
    refreshUpgradeState();
    if (!wasReady && g.ready) {
      const choices = Object.keys(g.upgradeCosts).filter(canUpgrade).map(type => UPGRADE_DETAILS[type].label.toLowerCase()).join(' o ');
      say(`Carga de almas suficiente: puedes ${choices}.`);
    }
    updateUi();
  }

  function move(dx, dy) {
    if (!g.started || g.over || g.paused) return;
    const length = Math.hypot(dx, dy) || 1;
    g.cat.fx = dx / length;
    g.cat.fy = dy / length;
    g.cat.x = clamp(g.cat.x + dx, -ARENA.playerX, ARENA.playerX);
    g.cat.y = clamp(g.cat.y + dy, -ARENA.playerY, ARENA.playerY);
    g.cat.moving = .16;
  }

  function slash() {
    if (!g.started || g.over || g.paused || g.attack || !g.artReady) return;
    g.attack = { t: .58, max: .58, done: false };
    say('El guardián levanta la espada.');
  }

  function shield(on) {
    if (on && !g.shield) { g.shield = true; g.shieldAge = 0; }
    else if (!on) g.shield = false;
  }

  function applyShieldInput() {
    shield(keys.has('shift') || g.mouseShield || g.touchShield);
  }

  function releaseTouchInputs() {
    touchKeys.clear();
    g.touchShield = false;
    document.querySelectorAll('[data-mobile-move], [data-mobile-action="block"]').forEach(button => button.classList.remove('is-held'));
    applyShieldInput();
  }

  function togglePause() {
    if (!g.started || g.over) return;
    g.paused = !g.paused;
    if (g.paused) releaseTouchInputs();
    say(g.paused ? 'Juego en pausa.' : 'Juego reanudado.');
  }

  function playerStep(dt) {
    if (!g.attack) return;
    g.attack.t -= dt;
    if (!g.attack.done && g.attack.t < .23) {
      g.attack.done = true;
      let hit = false;
      [...g.enemies, ...(g.boss ? [g.boss] : [])].forEach(enemy => {
        const dx = enemy.x - g.cat.x;
        const dy = enemy.y - g.cat.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance < 126 && dx / distance * g.cat.fx + dy / distance * g.cat.fy > .04) {
          enemy.hp -= g.damage;
          enemy.hit = .32;
          hit = true;
        }
      });
      say(hit ? '¡Espadazo conectado!' : 'El golpe no alcanzó a ningún rival.');
    }
    if (g.attack.t <= 0) g.attack = null;
  }

  function damage(amount, label) {
    const perfect = g.shield && g.shieldAge <= g.parry;
    if (perfect) { say('¡BLOQUEO PERFECTO! No recibiste daño.'); return; }
    const dealt = g.shield ? Math.ceil(amount * .2) : amount;
    g.hp -= dealt;
    g.cat.hit = .32;
    say(g.shield ? `Escudo: bloqueaste ${amount - dealt} de daño.` : `${label}: -${dealt} salud.`);
    if (g.hp <= 0) {
      g.hp = 0;
      g.over = true;
      keys.clear();
      g.mouseShield = false;
      releaseTouchInputs();
      say('GAME OVER · Pulsa ATACAR para reintentar.');
    }
  }

  function startAttack(enemy) {
    if (enemy.atk) return;
    const type = enemy.boss ? (Math.random() < .5 ? 'combo' : 'boss') : (Math.random() < .38 ? 'double' : 'simple');
    const rules = {
      simple: { t: .62, h: [{ at: .16, d: 10 }] },
      double: { t: 1.02, h: [{ at: .58, d: 10 }, { at: .16, d: 20 }] },
      boss: { t: .78, h: [{ at: .16, d: 30 }] },
      combo: { t: 1.55, h: [{ at: .73, d: 30 }, { at: .43, d: 35 }, { at: .13, d: 35 }] }
    }[type];
    const totalBaseDamage = rules.h.reduce((total, hit) => total + hit.d, 0);
    const totalDamage = Math.min(enemy.damageCap, Math.round(totalBaseDamage * enemy.corruptionMultiplier));
    let assignedDamage = 0;
    enemy.atk = {
      type, t: rules.t, max: rules.t,
      h: rules.h.map((hit, index) => {
        const damage = index === rules.h.length - 1
          ? totalDamage - assignedDamage
          : Math.round(totalDamage * hit.d / totalBaseDamage);
        assignedDamage += damage;
        return { ...hit, d: damage };
      })
    };
  }

  function enemyStep(enemy, dt) {
    enemy.hit = Math.max(0, enemy.hit - dt);
    enemy.moving = Math.max(0, enemy.moving - dt);
    enemy.cool -= dt;
    const dx = g.cat.x - enemy.x;
    const dy = g.cat.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    enemy.facing = dx < 0 ? -1 : 1;
    if (!enemy.atk) {
      enemy.x = clamp(enemy.x + dx / distance * (enemy.boss ? 40 : 29) * enemy.speedScale * dt, -ARENA.playerX, ARENA.playerX);
      enemy.y = clamp(enemy.y + dy / distance * (enemy.boss ? 40 : 29) * enemy.speedScale * dt, -ARENA.playerY, ARENA.playerY);
      enemy.moving = distance > 72 ? .16 : 0;
      if (distance < 76 && enemy.cool <= 0) {
        startAttack(enemy);
        enemy.cool = enemy.boss ? 1.7 : 1.28;
      }
      return;
    }
    enemy.atk.t -= dt;
    enemy.atk.h.filter(hit => !hit.done && enemy.atk.t <= hit.at).forEach(hit => {
      hit.done = true;
      if (Math.hypot(enemy.x - g.cat.x, enemy.y - g.cat.y) < 88) damage(hit.d, enemy.atk.type === 'combo' ? 'Combo del minijefe' : 'Ataque enemigo');
    });
    if (enemy.atk.t <= 0) enemy.atk = null;
  }

  function combat(dt) {
    [...g.enemies, ...(g.boss ? [g.boss] : [])].forEach(enemy => enemyStep(enemy, dt));
    const fallen = g.enemies.filter(enemy => enemy.hp <= 0);
    fallen.forEach(() => earn(20));
    g.enemies = g.enemies.filter(enemy => enemy.hp > 0);
    if (g.boss && g.boss.hp <= 0) { g.boss = null; earn(100); }
    if (!g.enemies.length && !g.boss) {
      if (!g.bossFought) {
        g.bossFought = true;
        g.boss = makeEnemy(true);
        g.hp = g.max;
        say('¡Minijefe! Salud restaurada por completo.');
      } else {
        g.level += 1;
        spawn();
      }
    }
  }

  function updateCamera(dt) {
    const edgeX = ARENA.halfWidth - 350;
    const edgeY = ARENA.halfHeight - 285;
    const targetX = clamp(g.cat.x, -edgeX, edgeX);
    const targetY = clamp(g.cat.y, -edgeY, edgeY);
    const ease = 1 - Math.exp(-4.7 * dt);
    g.camera.x += (targetX - g.camera.x) * ease;
    g.camera.y += (targetY - g.camera.y) * ease;
  }

  function terrain() {
    const corruption = visualCorruption();
    const topLeft = project(-ARENA.halfWidth, -ARENA.halfHeight);
    const topRight = project(ARENA.halfWidth, -ARENA.halfHeight);
    const bottomRight = project(ARENA.halfWidth, ARENA.halfHeight);
    const bottomLeft = project(-ARENA.halfWidth, ARENA.halfHeight);
    const turf = ctx.createLinearGradient(0, 70, 0, 590);
    turf.addColorStop(0, mixColor('#43bb50', '#101d2a', corruption));
    turf.addColorStop(.45, mixColor('#78d95f', '#181530', corruption));
    turf.addColorStop(.46, mixColor('#58c94c', '#2a1240', corruption));
    turf.addColorStop(1, mixColor('#2f9d46', '#120c28', corruption));
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.fillStyle = turf;
    ctx.fill();
    ctx.strokeStyle = mixColor('#c9ff9c', '#8854ff', corruption);
    ctx.globalAlpha = .45 + corruption * .25;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    groundDetails.forEach(detail => {
      const point = project(detail.x, detail.y);
      if (point.x < -40 || point.x > 1000 || point.y < 70 || point.y > 650) return;
      ctx.save();
      ctx.translate(point.x, point.y);
      const corrupted = detail.variation < corruption;
      if (corrupted) {
        const flicker = 1 + Math.sin(g.time * 6 + detail.variation * 18) * .22;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = detail.variation * 8 % 2 > 1 ? 'rgba(69,235,255,.66)' : 'rgba(236,60,255,.58)';
        ctx.fillRect(-detail.size * .7, -2, detail.size * 1.8 * flicker, 4);
        ctx.fillStyle = 'rgba(161,62,255,.25)';
        ctx.fillRect(-2, -detail.size * .6, 4, detail.size * 1.4);
      } else {
        ctx.scale(1, .42);
        ctx.fillStyle = detail.dirt ? 'rgba(29,132,57,.22)' : 'rgba(197,255,132,.24)';
        ctx.beginPath();
        ctx.ellipse(0, 0, detail.size, detail.size * .56, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(215,255,150,.42)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-detail.size * .22, 0);
        ctx.lineTo(0, -detail.size * .9);
        ctx.lineTo(detail.size * .25, 0);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  function drawSkyCorruption(corruption) {
    if (corruption <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = corruption * .52;
    const count = Math.ceil(corruption * 80);
    for (let index = 0; index < count; index += 1) {
      const phase = g.time * (index % 3 + 1) + index * 13.7;
      const x = (Math.sin(phase * .31) * .5 + .5) * 960;
      const y = 25 + ((index * 47) % 260) + Math.sin(phase) * 8;
      ctx.fillStyle = index % 2 ? '#31e8ff' : '#f047ff';
      ctx.fillRect(x, y, 20 + (index % 5) * 18, 2 + index % 4);
    }
    ctx.restore();
  }

  function drawCorruptionAnimation(corruption) {
    if (corruption <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const pulse = .62 + (Math.sin(g.time * 5.2) + 1) * .19;

    // Fragmentos de datos que recorren la pradera: la corrupción nunca queda estática.
    const faults = Math.ceil(2 + corruption * 7);
    for (let index = 0; index < faults; index += 1) {
      const seed = index * 17.23;
      const travel = (g.time * (.09 + (index % 3) * .018) + index * .173) % 1;
      const direction = index % 2 ? 1 : -1;
      const x = direction > 0 ? -120 + travel * 1200 : 1080 - travel * 1200;
      const y = 286 + (index * 57 % 238) + Math.sin(g.time * (2.8 + index % 3) + seed) * 11;
      const length = 28 + (index % 4) * 21 + corruption * 35;
      ctx.globalAlpha = (.18 + corruption * .42) * pulse;
      ctx.strokeStyle = index % 2 ? '#40ecff' : '#ee52ff';
      ctx.lineWidth = 1.2 + corruption * 1.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + direction * length * .34, y - 7);
      ctx.lineTo(x + direction * length * .68, y + 6);
      ctx.lineTo(x + direction * length, y - 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + direction * length * .46, y - 2, 5 + corruption * 8, 3);
    }

    // Ondas de falla que se expanden sobre el suelo, como una infección digital en movimiento.
    const waves = Math.ceil(1 + corruption * 3);
    ctx.setLineDash([7, 15]);
    for (let index = 0; index < waves; index += 1) {
      const spread = (g.time * .21 + index / waves) % 1;
      const radius = 76 + spread * 660;
      ctx.globalAlpha = (1 - spread) * (.08 + corruption * .24) * pulse;
      ctx.strokeStyle = index % 2 ? '#d955ff' : '#48eaff';
      ctx.lineWidth = 1 + corruption * 1.8;
      ctx.lineDashOffset = -g.time * (26 + index * 9);
      ctx.beginPath();
      ctx.ellipse(480, 540, radius, radius * .18, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawScreenCorruptionFrame(corruption) {
    if (corruption <= 0) return;
    const width = 960;
    const height = 600;
    const depth = 18 + corruption * 68;
    const pulse = .72 + Math.sin(g.time * 6.5) * .18;
    const edgeAlpha = .14 + corruption * .32;
    const colours = ['#38efff', '#e851ff', '#9b58ff', '#ffffff'];

    ctx.save();
    // La neblina se queda en los bordes: deja libre la zona de juego central.
    ctx.globalCompositeOperation = 'source-over';
    const top = ctx.createLinearGradient(0, 0, 0, depth);
    top.addColorStop(0, `rgba(25,4,50,${edgeAlpha})`);
    top.addColorStop(.38, `rgba(123,27,172,${edgeAlpha * .52})`);
    top.addColorStop(1, 'rgba(18,9,37,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, width, depth);
    const bottom = ctx.createLinearGradient(0, height, 0, height - depth);
    bottom.addColorStop(0, `rgba(29,5,54,${edgeAlpha * 1.12})`);
    bottom.addColorStop(.42, `rgba(33,15,80,${edgeAlpha * .45})`);
    bottom.addColorStop(1, 'rgba(18,9,37,0)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, height - depth, width, depth);
    const left = ctx.createLinearGradient(0, 0, depth, 0);
    left.addColorStop(0, `rgba(17,8,46,${edgeAlpha * 1.1})`);
    left.addColorStop(.45, `rgba(43,32,117,${edgeAlpha * .48})`);
    left.addColorStop(1, 'rgba(18,9,37,0)');
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, depth, height);
    const right = ctx.createLinearGradient(width, 0, width - depth, 0);
    right.addColorStop(0, `rgba(17,8,46,${edgeAlpha * 1.1})`);
    right.addColorStop(.45, `rgba(43,32,117,${edgeAlpha * .48})`);
    right.addColorStop(1, 'rgba(18,9,37,0)');
    ctx.fillStyle = right;
    ctx.fillRect(width - depth, 0, depth, height);

    // Segmentos disparejos: construyen un marco roto, nunca una línea continua.
    ctx.globalCompositeOperation = 'screen';
    const pieces = Math.ceil(10 + corruption * 44);
    for (let index = 0; index < pieces; index += 1) {
      const seed = index * 19.713;
      const edge = index % 4;
      const travel = (Math.sin(seed * 1.71) + 1) / 2;
      const flicker = .48 + (Math.sin(g.time * (2 + index % 4) + seed) + 1) * .26;
      const thickness = 1.5 + (index % 4) * 1.3 + corruption * 2.6;
      const span = 15 + (index % 6) * 13 + corruption * 30;
      const inset = 2 + ((Math.cos(g.time * 2 + seed) + 1) / 2) * depth * .36;
      ctx.globalAlpha = (.26 + corruption * .64) * flicker * pulse;
      ctx.fillStyle = colours[index % colours.length];
      if (edge === 0 || edge === 2) {
        const x = travel * (width + span) - span / 2;
        const y = edge === 0 ? inset : height - inset - thickness;
        ctx.fillRect(x, y, span, thickness);
        if (index % 3 === 0) ctx.fillRect(x + span * .42, y + (edge === 0 ? thickness : -thickness * 2), span * .2, thickness * 2);
      } else {
        const y = travel * (height + span) - span / 2;
        const x = edge === 1 ? width - inset - thickness : inset;
        ctx.fillRect(x, y, thickness, span);
        if (index % 3 === 0) ctx.fillRect(x + (edge === 1 ? -thickness * 2 : thickness), y + span * .42, thickness * 2, span * .2);
      }
    }

    // Grietas cortas y dentadas que avanzan un poco hacia el campo de batalla.
    const cracks = Math.ceil(3 + corruption * 17);
    ctx.lineCap = 'square';
    for (let index = 0; index < cracks; index += 1) {
      const seed = index * 31.37;
      const edge = index % 4;
      const travel = (Math.sin(seed * .67) + 1) / 2;
      const reach = 12 + corruption * (28 + (index % 5) * 12);
      const jag = 5 + (index % 3) * 5;
      ctx.globalAlpha = (.2 + corruption * .58) * (.76 + Math.sin(g.time * 4 + seed) * .24);
      ctx.strokeStyle = colours[(index + 1) % colours.length];
      ctx.lineWidth = 1 + corruption * 1.8;
      ctx.beginPath();
      if (edge === 0) {
        const x = travel * width;
        ctx.moveTo(x, 1);
        ctx.lineTo(x + jag, reach * .36);
        ctx.lineTo(x - jag * .65, reach * .68);
        ctx.lineTo(x + jag * .32, reach);
      } else if (edge === 1) {
        const y = travel * height;
        ctx.moveTo(width - 1, y);
        ctx.lineTo(width - reach * .36, y + jag);
        ctx.lineTo(width - reach * .68, y - jag * .65);
        ctx.lineTo(width - reach, y + jag * .32);
      } else if (edge === 2) {
        const x = travel * width;
        ctx.moveTo(x, height - 1);
        ctx.lineTo(x - jag, height - reach * .36);
        ctx.lineTo(x + jag * .65, height - reach * .68);
        ctx.lineTo(x - jag * .32, height - reach);
      } else {
        const y = travel * height;
        ctx.moveTo(1, y);
        ctx.lineTo(reach * .36, y - jag);
        ctx.lineTo(reach * .68, y + jag * .65);
        ctx.lineTo(reach, y - jag * .32);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function actionProgress(action) { return action ? 1 - action.t / action.max : 0; }
  function heroCell() {
    // El protagonista usa exclusivamente la primera fila del arte maestro aprobado.
    if (g.cat.hit > 0) return { row: 0, col: 0 };
    if (g.attack) {
      const progress = actionProgress(g.attack);
      if (progress < .18) return { row: 0, col: 2 };
      if (progress < .76) return { row: 0, col: 3 };
      return { row: 0, col: 0 };
    }
    if (g.cat.moving > .01) return { row: 0, col: Math.floor(g.time * 7) % 2 };
    return { row: 0, col: 0 };
  }
  function enemyCell(entity) {
    if (entity.atk) return { row: entity.boss ? 2 : 1, col: actionProgress(entity.atk) < .43 ? 2 : 3 };
    return { row: entity.boss ? 2 : 1, col: entity.moving > .01 ? Math.floor(g.time * 10) % 2 : Math.floor(g.time * 3.5) % 2 };
  }
  function skinFilter() {
    return ({ '#2b5faa': 'hue-rotate(130deg) saturate(1.25)', '#8c3b80': 'hue-rotate(305deg) saturate(1.25)', '#bd6d26': 'hue-rotate(28deg) saturate(1.2)' }[g.skin] || 'none');
  }

  function drawShadow(point, size, boss) {
    ctx.save();
    // Anclada a los pies del sprite para que no parezca que el personaje flota.
    ctx.translate(point.x, point.y + size * .035);
    ctx.scale(1, .31);
    ctx.fillStyle = boss ? 'rgba(14,5,25,.54)' : 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * .52, size * .27, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawTelegraph(entity, point, size) {
    if (!entity.atk) return;
    const progress = actionProgress(entity.atk);
    const angle = Math.atan2(g.cat.y - entity.y, g.cat.x - entity.x);
    ctx.save();
    ctx.translate(point.x, point.y + size * .09);
    ctx.rotate(angle);
    ctx.globalAlpha = .3 + progress * .45;
    ctx.fillStyle = entity.atk.type === 'combo' ? '#ff5d9b' : '#f0b868';
    const marks = entity.atk.type === 'combo' ? 3 : entity.atk.type === 'double' ? 2 : 1;
    for (let index = 0; index < marks; index += 1) {
      ctx.beginPath();
      ctx.moveTo(size * (.48 + index * .12), -5);
      ctx.lineTo(size * (.74 + index * .12), 0);
      ctx.lineTo(size * (.48 + index * .12), 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSprite(entity, isHero, point, size) {
    const sheet = catSheet;
    if (!g.artReady || !sheet.naturalWidth) return;
    const cellWidth = sheet.naturalWidth / 4;
    const cellHeight = sheet.naturalHeight / 3;
    const cell = isHero ? heroCell() : enemyCell(entity);
    const facing = isHero ? (g.cat.fx < 0 ? -1 : 1) : entity.facing;
    const action = isHero ? g.attack : entity.atk;
    const recoil = action ? Math.sin(actionProgress(action) * Math.PI) * .05 : 0;
    const corruption = visualCorruption();
    ctx.save();
    const digitalJitter = isHero ? 0 : Math.sin(g.time * 17 + entity.glitchSeed) * corruption * 5;
    ctx.translate(point.x + digitalJitter, point.y + recoil * size - size * .02);
    ctx.scale(facing, 1);
    if (isHero) ctx.filter = `${skinFilter()}${g.cat.hit > 0 ? ' brightness(1.8) contrast(1.2)' : ''}`;
    // El arte principal se conserva intacto; la corrupción se expresa alrededor del enemigo,
    // no recoloreando ni deformando la ilustración aprobada.
    else ctx.filter = 'none';
    ctx.drawImage(sheet, cell.col * cellWidth, cell.row * cellHeight, cellWidth, cellHeight, -size / 2, -size * .95, size, size);
    ctx.restore();
  }

  function drawBladeMotion(entity, isHero, point, size) {
    const action = isHero ? g.attack : entity.atk;
    if (!action) return;
    const progress = actionProgress(action);
    const isCombo = action.type === 'combo';
    const strikeWindow = isCombo ? progress > .34 : progress > .39;
    const angle = isHero ? Math.atan2(g.cat.fy, g.cat.fx) : Math.atan2(g.cat.y - entity.y, g.cat.x - entity.x);
    ctx.save();
    ctx.translate(point.x, point.y - size * .25);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = 'lighter';
    if (!strikeWindow) {
      ctx.strokeStyle = isCombo ? 'rgba(211,104,255,.72)' : 'rgba(232,215,255,.62)';
      ctx.lineWidth = Math.max(3, size * .045);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-size * .05, -size * .22);
      ctx.lineTo(size * .24, -size * .58);
      ctx.stroke();
    } else {
      const swings = isCombo ? 3 : action.type === 'double' ? 2 : 1;
      for (let index = 0; index < swings; index += 1) {
        const phase = isCombo ? progress * 3 - index : action.type === 'double' ? progress * 2 - index : progress;
        if (phase < 0 || phase > 1.25) continue;
        ctx.globalAlpha = clamp(1.15 - phase, 0, .78);
        ctx.strokeStyle = index % 2 ? '#ffffff' : (isHero ? '#dfbcff' : '#ff91db');
        ctx.lineWidth = Math.max(5, size * .085);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, size * (.55 + index * .1), -1.72 + index * .18, .78 + index * .18);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawShield(point, size) {
    if (!g.shield) return;
    const angle = Math.atan2(g.cat.fy, g.cat.fx);
    ctx.save();
    ctx.translate(point.x, point.y - size * .34);
    ctx.rotate(angle);
    ctx.fillStyle = g.shieldAge <= g.parry ? 'rgba(255,236,136,.3)' : 'rgba(117,205,255,.26)';
    ctx.strokeStyle = g.shieldAge <= g.parry ? '#fff2a4' : '#9ee7ff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(size * .13, -size * .43);
    ctx.quadraticCurveTo(size * .67, 0, size * .13, size * .43);
    ctx.quadraticCurveTo(size * .32, 0, size * .13, -size * .43);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawCorruptionAura(entity, point, size) {
    const corruption = visualCorruption();
    if (corruption <= 0) return;
    const count = Math.ceil(4 + corruption * 14 + (entity.boss ? 5 : 0));
    ctx.save();
    ctx.translate(point.x, point.y - size * .43);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = .46 + corruption * .46;
    for (let index = 0; index < count; index += 1) {
      const phase = g.time * (3 + index % 3) + entity.glitchSeed + index * 1.7;
      const x = Math.sin(phase) * size * (.23 + (index % 3) * .12);
      const y = Math.cos(phase * 1.3) * size * (.18 + (index % 2) * .15);
      ctx.fillStyle = index % 2 ? '#36f2ff' : '#f04dff';
      ctx.fillRect(x, y, 6 + corruption * 13, 2 + index % 4);
    }
    ctx.strokeStyle = `rgba(255,83,237,${.18 + corruption * .78})`;
    ctx.lineWidth = 2 + corruption * 3;
    ctx.beginPath();
    ctx.moveTo(-size * .18, -size * .2);
    ctx.lineTo(-size * .04, -size * .04);
    ctx.lineTo(size * .11, -size * .17);
    ctx.stroke();
    ctx.restore();
  }

  function drawHealthBar(entity, point, size) {
    const width = entity.boss ? 104 : 66;
    const ratio = Math.max(0, entity.hp / entity.max);
    const y = point.y - size * .95;
    const corruption = visualCorruption();
    ctx.fillStyle = 'rgba(3,5,12,.68)';
    ctx.fillRect(point.x - width / 2 - 2, y - 2, width + 4, 9);
    ctx.fillStyle = mixColor(entity.boss ? '#a6ec72' : '#72e27e', entity.boss ? '#ff62c7' : '#46eaff', corruption);
    ctx.fillRect(point.x - width / 2, y, width * ratio, 5);
  }

  function drawEntity(entity, isHero) {
    const point = project(entity.x, entity.y);
    const size = isHero ? 145 : entity.boss ? 210 : 132;
    drawShadow(point, size, entity.boss);
    if (!isHero) drawTelegraph(entity, point, size);
    drawSprite(entity, isHero, point, size);
    if (!isHero) drawCorruptionAura(entity, point, size);
    drawBladeMotion(entity, isHero, point, size);
    if (isHero) drawShield(point, size);
    else drawHealthBar(entity, point, size);
  }

  function overlay(title, subtitle) {
    ctx.fillStyle = 'rgba(4,5,10,.74)';
    ctx.fillRect(0, 0, 960, 600);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '800 54px Manrope,sans-serif';
    ctx.fillText(title, 480, 260);
    ctx.fillStyle = '#dcc9ff';
    ctx.font = '600 19px Manrope,sans-serif';
    ctx.fillText(subtitle, 480, 305);
  }

  function loop(time) {
    if (!g.last) g.last = time;
    const elapsed = time - g.last;
    if (elapsed < FRAME_MS) { requestAnimationFrame(loop); return; }
    const dt = Math.min(.05, elapsed / 1000);
    g.last = time - (elapsed % FRAME_MS);
    g.time += dt;
    if (g.started && !g.over && !g.paused && g.artReady) {
      const speed = 185 * dt;
      let dx = 0, dy = 0;
      if (keys.has('w') || touchKeys.has('w')) dy -= speed;
      if (keys.has('s') || touchKeys.has('s')) dy += speed;
      if (keys.has('a') || touchKeys.has('a')) dx -= speed;
      if (keys.has('d') || touchKeys.has('d')) dx += speed;
      if (dx || dy) move(dx, dy);
      applyShieldInput();
      if (g.shield) g.shieldAge += dt;
      g.cat.hit = Math.max(0, g.cat.hit - dt);
      g.cat.moving = Math.max(0, g.cat.moving - dt);
      playerStep(dt);
      combat(dt);
      updateCamera(dt);
      updateUi();
    }
    ctx.clearRect(0, 0, 960, 600);
    const corruption = visualCorruption();
    const sky = ctx.createLinearGradient(0, 0, 0, 600);
    sky.addColorStop(0, mixColor('#75d8f1', '#0d1228', corruption));
    sky.addColorStop(.63, mixColor('#bce79b', '#171333', corruption));
    sky.addColorStop(1, mixColor('#65bf58', '#30144b', corruption));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 600);
    drawSkyCorruption(corruption);
    terrain();
    drawCorruptionAnimation(corruption);
    if (g.artReady) [...g.enemies, ...(g.boss ? [g.boss] : []), g.cat]
      .sort((a, b) => a.x + a.y - (b.x + b.y))
      .forEach(entity => drawEntity(entity, entity === g.cat));
    drawScreenCorruptionFrame(corruption);
    if (!g.artReady) overlay('CARGANDO ARTE', 'Preparando los nuevos sprites de combate');
    else if (!g.started) overlay('GUARDIÁN DE MEDIANOCHE', 'Pulsa INICIAR AVENTURA para comenzar');
    else if (g.over) overlay('GAME OVER', 'Pulsa ATACAR para reintentar');
    else if (g.paused) overlay('PAUSA', 'Pulsa R o PAUSA para continuar');
    requestAnimationFrame(loop);
  }

  document.addEventListener('keydown', event => {
    if (g.started && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      togglePause();
    }
  });

  const attack = $('#cat-attack');
  const mobileControls = $('.mobile-game-controls');
  const gameShell = canvas.closest('.cat-game');
  const isTouchDevice = () => window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
  const start = document.createElement('button');
  start.id = 'cat-start';
  start.type = 'button';
  start.className = 'cat-action';
  start.textContent = 'Iniciar aventura';
  attack?.before(start);
  if (attack) attack.hidden = true;

  function updateMobileOrientation() {
    if (!isTouchDevice() || !g.started || !gameShell) return;
    const portrait = window.innerHeight > window.innerWidth;
    gameShell.classList.toggle('needs-landscape', portrait);
    if (portrait && !g.paused) {
      g.paused = true;
      g.pausedForOrientation = true;
      releaseTouchInputs();
      say('Gira el teléfono a horizontal para continuar.');
    } else if (!portrait && g.pausedForOrientation) {
      g.paused = false;
      g.pausedForOrientation = false;
      say('Orientación lista. La aventura continúa.');
    }
  }

  function enterMobileFullscreen() {
    if (!isTouchDevice() || !gameShell) return;
    const lockLandscape = () => screen.orientation?.lock?.('landscape').catch(() => {});
    if (document.fullscreenElement !== gameShell) {
      gameShell.requestFullscreen?.().then(lockLandscape).catch(() => updateMobileOrientation());
    } else lockLandscape();
    updateMobileOrientation();
  }

  function begin() {
    if (g.started) return;
    if (!g.artReady) { say('Los nuevos sprites todavía se están cargando.'); return; }
    g.started = true;
    spawn();
    const upgradePanel = $('#cat-upgrades');
    if (upgradePanel) upgradePanel.hidden = false;
    if (mobileControls) mobileControls.hidden = false;
    if (isTouchDevice()) enterMobileFullscreen();
    else if (innerWidth > 800) gameShell?.requestFullscreen?.().catch(() => {});
    if (attack) { attack.hidden = false; attack.textContent = 'Atacar · Clic izquierdo'; }
    start.hidden = true;
  }

  const upgrades = $('.cat-upgrades');
  if (upgrades && !upgrades.querySelector('[data-cat-upgrade="parry"]')) {
    const button = document.createElement('button');
    button.dataset.catUpgrade = 'parry';
    button.textContent = '✦ Mejorar bloqueo perfecto';
    upgrades.append(button);
  }

  start.onclick = begin;
  attack?.addEventListener('click', slash);
  canvas.addEventListener('mousedown', event => {
    if (g.over) { spawn(); return; }
    if (!g.started) { begin(); return; }
    if (event.button === 0) slash();
    if (event.button === 2) { g.mouseShield = true; applyShieldInput(); }
  });
  canvas.addEventListener('mouseup', event => {
    if (event.button === 2) { g.mouseShield = false; applyShieldInput(); }
  });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  const canUseTouchControls = () => g.started && !g.over && !g.paused;
  const bindHold = (button, onPress, onRelease) => {
    if (!button) return;
    const release = event => {
      event.preventDefault();
      onRelease();
    };
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      button.setPointerCapture?.(event.pointerId);
      onPress();
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  };
  document.querySelectorAll('[data-mobile-move]').forEach(button => {
    const direction = button.dataset.mobileMove;
    bindHold(button, () => {
      if (!canUseTouchControls()) return;
      touchKeys.add(direction);
      button.classList.add('is-held');
    }, () => {
      touchKeys.delete(direction);
      button.classList.remove('is-held');
    });
  });
  const mobileBlock = document.querySelector('[data-mobile-action="block"]');
  bindHold(mobileBlock, () => {
    if (!canUseTouchControls()) return;
    g.touchShield = true;
    mobileBlock.classList.add('is-held');
    applyShieldInput();
  }, () => {
    g.touchShield = false;
    mobileBlock?.classList.remove('is-held');
    applyShieldInput();
  });
  document.querySelector('[data-mobile-action="attack"]')?.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
    if (g.over) { spawn(); return; }
    if (!g.started) { begin(); return; }
    slash();
  });
  document.querySelector('[data-mobile-action="pause"]')?.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
    togglePause();
  });
  window.addEventListener('blur', releaseTouchInputs);
  window.addEventListener('resize', updateMobileOrientation);
  window.addEventListener('orientationchange', updateMobileOrientation);
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement !== gameShell) screen.orientation?.unlock?.();
    updateMobileOrientation();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseTouchInputs();
  });
  document.addEventListener('keydown', event => {
    if (!g.started) return;
    const key = event.key.toLowerCase();
    if (MAX_STATS_COMBO.includes(key)) {
      keys.add(key);
      if (MAX_STATS_COMBO.every(comboKey => keys.has(comboKey))) maxOutPlayerStats();
      return;
    }
    if ([' ', 'shift', 'w', 'a', 's', 'd'].includes(key)) {
      event.preventDefault();
      if (key === ' ') slash();
      else {
        keys.add(key);
        if (key === 'shift') applyShieldInput();
      }
    }
  });
  document.addEventListener('keyup', event => {
    const key = event.key.toLowerCase();
    keys.delete(key);
    if (MAX_STATS_COMBO.includes(key)) g.maxStatsComboActive = false;
    if (key === 'shift') applyShieldInput();
  });
  document.querySelectorAll('[data-cat-upgrade]').forEach(button => {
    button.onclick = () => {
      const type = button.dataset.catUpgrade;
      const cost = upgradeCost(type);
      if (!canUpgrade(type)) return;
      g.souls -= cost;
      if (type === 'damage') g.damage = Math.min(PLAYER_LIMITS.damage, g.damage * 2);
      else if (type === 'health') { g.max = Math.min(PLAYER_LIMITS.health, g.max * 2); g.hp = g.max; }
      else g.parry = Math.min(PLAYER_LIMITS.parry, g.parry + .1);
      // Solo cambia el precio del atributo elegido; los otros dos conservan su valor.
      g.upgradeCosts[type] += 50;
      g.soulLevel += 1;
      refreshUpgradeState();
      say(`${UPGRADE_DETAILS[type].label} aplicada por ${cost} almas. Próximo coste: ${upgradeCost(type)}. Carga restante: ${g.souls}.`);
      updateUi();
    };
  });
  document.querySelectorAll('[data-cat-skin]').forEach(button => {
    button.onclick = () => {
      g.skin = button.dataset.catSkin;
      document.querySelectorAll('.cat-skin').forEach(skin => skin.classList.toggle('active', skin === button));
    };
  });

  spawn();
  requestAnimationFrame(loop);
})();
