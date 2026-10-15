/* Aenima spirit mini-games: expanded from the supplied game's selection, matching and memory logic. */
(() => {
  const spirits = ['void', 'aqua', 'ember', 'storm', 'lunar', 'verdant'];
  const labels = { void: 'Entidad del vacío', aqua: 'Aparición acuática', ember: 'Espectro de brasas', storm: 'Entidad de tormenta', lunar: 'Sombra lunar', verdant: 'Espíritu del bosque' };
  const shuffle = items => [...items].sort(() => Math.random() - .5);
  const spiritMarkup = type => `<span class="spirit spirit--${type}" aria-hidden="true"></span>`;

  let resonance = [], chosen = [], resonanceScore = 0, combo = 0;
  let memoryDeck = [], memoryOpen = [], memoryDone = new Set(), memoryLocked = false, memoryMoves = 0;

  function startResonance() {
    resonance = shuffle(spirits.flatMap(type => Array(5).fill(type)));
    chosen = [];
    resonanceScore = 0;
    combo = 0;
    renderResonance('Elige tres o más espíritus iguales para iniciar una resonancia.');
  }

  function renderResonance(message) {
    const board = document.querySelector('#spirit-board');
    const status = document.querySelector('#spirit-status');
    if (!board || !status) return;
    board.innerHTML = resonance.map((type, index) => `<button class="spirit-token ${chosen.includes(index) ? 'is-selected' : ''} ${type === null ? 'is-matched' : ''}" type="button" data-spirit-index="${index}" aria-label="${type ? labels[type] : 'Resonancia completada'}">${type ? spiritMarkup(type) : '✦'}</button>`).join('');
    status.textContent = message || `Energía: ${resonanceScore} · Combo: x${Math.max(1, combo)}.`;
    board.querySelectorAll('[data-spirit-index]').forEach(button => button.addEventListener('click', () => selectSpirit(Number(button.dataset.spiritIndex))));
  }

  function selectSpirit(index) {
    const type = resonance[index];
    if (!type || chosen.includes(index)) return;
    if (chosen.length && resonance[chosen[0]] !== type) {
      chosen = [index];
      return renderResonance('La resonancia cambió: continúa con espíritus del mismo tipo.');
    }
    chosen.push(index);
    if (chosen.length < 3) return renderResonance(`${chosen.length}/3 espíritus conectados. Completa el grupo para liberar energía.`);
    const power = chosen.length;
    chosen.forEach(item => { resonance[item] = null; });
    resonanceScore += power * 10;
    combo++;
    chosen = [];
    const remaining = resonance.filter(Boolean).length;
    if (!remaining) return renderResonance(`¡Portal completo! Energía final: ${resonanceScore}. Reinicia para una nueva constelación.`);
    window.setTimeout(() => {
      resonance = resonance.map(item => item || spirits[Math.floor(Math.random() * spirits.length)]);
      renderResonance(`¡Resonancia de ${power}! +${power * 10} energía · combo x${combo}.`);
    }, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 330);
    renderResonance(`¡Resonancia de ${power}! La energía está reordenando el umbral…`);
  }

  function startMemory() {
    const deckTypes = [...spirits, ...spirits.slice(0, 2)];
    memoryDeck = shuffle(deckTypes.flatMap(type => [type, type]));
    memoryOpen = [];
    memoryDone = new Set();
    memoryLocked = false;
    memoryMoves = 0;
    renderMemory('0 de 8 parejas encontradas · 0 intentos.');
  }

  function renderMemory(message) {
    const grid = document.querySelector('#memory-grid');
    const status = document.querySelector('#memory-status');
    if (!grid || !status) return;
    grid.innerHTML = memoryDeck.map((type, index) => {
      const open = memoryOpen.includes(index) || memoryDone.has(index);
      const done = memoryDone.has(index);
      return `<button class="memory-spirit ${open ? 'is-open' : ''} ${done ? 'is-done' : ''}" type="button" data-memory-index="${index}" aria-label="${open ? labels[type] : 'Portal oculto'}" aria-pressed="${open}">${open ? spiritMarkup(type) : '✦'}</button>`;
    }).join('');
    status.textContent = message;
    grid.querySelectorAll('[data-memory-index]').forEach(button => button.addEventListener('click', () => openMemory(Number(button.dataset.memoryIndex))));
  }

  function openMemory(index) {
    if (memoryLocked || memoryOpen.includes(index) || memoryDone.has(index)) return;
    memoryOpen.push(index);
    if (memoryOpen.length < 2) return renderMemory(`${memoryDone.size / 2} de 8 parejas · ${memoryMoves} intentos.`);
    memoryLocked = true;
    memoryMoves++;
    const [first, second] = memoryOpen;
    const match = memoryDeck[first] === memoryDeck[second];
    renderMemory(match ? 'Las energías coinciden…' : 'Los portales se cerrarán pronto…');
    window.setTimeout(() => {
      if (match) {
        memoryDone.add(first);
        memoryDone.add(second);
      }
      memoryOpen = [];
      memoryLocked = false;
      const pairs = memoryDone.size / 2;
      renderMemory(pairs === 8 ? `¡Umbral restaurado en ${memoryMoves} intentos!` : match ? `¡Pareja encontrada! ${pairs} de 8 · ${memoryMoves} intentos.` : `${pairs} de 8 parejas · ${memoryMoves} intentos.`);
    }, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 700);
  }

  document.querySelector('#spirit-reset')?.addEventListener('click', startResonance);
  document.querySelector('#memory-reset')?.addEventListener('click', startMemory);
  startResonance();
  startMemory();
})();
