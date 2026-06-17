// BrainLevel - FULLY FIXED VERSION
// All bugs fixed: buttons, sound, leaderboard, save/load, audio context

// ========================
// LEVELS DATA
// ========================
const levelsData = {
  "worlds": [
    {
      "id": 1, "name": "The Beginning", "locked": false,
      "levels": [
        {"id": 1, "difficulty": "easy",   "moves": 15, "time": 60,  "target": 15, "grid": [[1,2,1,2],[2,1,2,1],[1,2,1,2],[2,1,2,1]]},
        {"id": 2, "difficulty": "easy",   "moves": 12, "time": 45,  "target": 20, "grid": [[3,3,4,4],[4,4,3,3],[3,3,4,4],[4,4,3,3]]},
        {"id": 3, "difficulty": "medium", "moves": 20, "time": 90,  "target": 30, "grid": [[1,2,3,4],[4,3,2,1],[1,2,3,4],[4,3,2,1]]},
        {"id": 4, "difficulty": "medium", "moves": 15, "time": 60,  "target": 25, "grid": [[5,1,5,1],[1,"L","L",5],[5,"L","L",1],[1,5,1,5]]},
        {"id": 5, "difficulty": "hard",   "moves": 10, "time": 30,  "target": 40, "grid": [["B",1,2,"B"],[3,4,5,1],[2,3,4,5],["B",1,2,"B"]]},
        {"id": 6, "difficulty": "hard",   "moves": 25, "time": 120, "target": 60, "grid": [["R","L","L","R"],["L",1,2,"L"],["L",3,4,"L"],["R","L","L","R"]]}
      ]
    }
  ]
};

// ========================
// GAME STATE
// ========================
const GameState = {
  currentLevel: 1,
  currentWorld: 1,
  score: 0,
  moves: 15,
  time: 60,
  target: 20,
  tilesCleared: 0,
  hintsLeft: 3,
  undosLeft: 3,
  coins: 0,
  completedLevels: {},
  levelStars: {},
  settings: { music: true, sound: true, vibration: true },
  grid: [],
  selectedTile: null,
  previousGrid: null,
  timer: null,
  isAnimating: false,
  isPaused: false
};

// ========================
// AUDIO (fixed - created after user gesture)
// ========================
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {}
  }
  return audioCtx;
}

function playSound(freq = 440, type = 'sine', duration = 0.1) {
  if (!GameState.settings.sound) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}

// ========================
// SAVE & LOAD
// ========================
function saveProgress() {
  try {
    localStorage.setItem('bl_coins', GameState.coins);
    localStorage.setItem('bl_completed', JSON.stringify(GameState.completedLevels));
    localStorage.setItem('bl_stars', JSON.stringify(GameState.levelStars));
    localStorage.setItem('bl_settings', JSON.stringify(GameState.settings));
  } catch(e) {}
}

function loadProgress() {
  try {
    const coins = localStorage.getItem('bl_coins');
    if (coins !== null) GameState.coins = parseInt(coins) || 0;

    const completed = localStorage.getItem('bl_completed');
    if (completed) GameState.completedLevels = JSON.parse(completed);

    const stars = localStorage.getItem('bl_stars');
    if (stars) GameState.levelStars = JSON.parse(stars);

    const settings = localStorage.getItem('bl_settings');
    if (settings) GameState.settings = Object.assign(GameState.settings, JSON.parse(settings));
  } catch(e) {
    GameState.coins = 0;
    GameState.completedLevels = {};
    GameState.levelStars = {};
  }
}

// ========================
// SCREEN MANAGEMENT
// ========================
function showScreen(screenId) {
  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => {
    s.style.display = 'none';
    s.classList.remove('active');
  });
  // Show target screen
  const target = document.getElementById(screenId);
  if (target) {
    target.style.display = 'flex';
    target.classList.add('active');
  }
  updateCoinDisplay();
}

// ========================
// COIN DISPLAY
// ========================
function updateCoinDisplay() {
  const text = '🪙 ' + GameState.coins;
  document.querySelectorAll('.coin-display, .shop-coins').forEach(el => {
    el.textContent = text;
  });
}

// ========================
// GAMEPLAY
// ========================
function startLevel(worldIdx, levelIdx) {
  playSound(600, 'square', 0.1);
  clearInterval(GameState.timer);

  const world = levelsData.worlds[worldIdx];
  const level = world.levels[levelIdx];

  GameState.currentLevel = level.id;
  GameState.currentWorld = worldIdx + 1;
  GameState.score = 0;
  GameState.moves = level.moves;
  GameState.time = level.time;
  GameState.target = level.target;
  GameState.tilesCleared = 0;
  GameState.grid = JSON.parse(JSON.stringify(level.grid));
  GameState.selectedTile = null;
  GameState.previousGrid = null;
  GameState.isPaused = false;
  GameState.isAnimating = false;

  // Hide pause overlay
  const po = document.getElementById('pause-overlay');
  if (po) po.style.display = 'none';

  showScreen('gameplay');
  updateHUD();
  renderGrid();
  startTimer();

  const nameEl = document.getElementById('gp-level-name');
  if (nameEl) nameEl.textContent = 'Level ' + level.id;
}

function updateHUD() {
  const scoreEl = document.getElementById('score-val');
  if (scoreEl) scoreEl.textContent = GameState.score;

  const movesEl = document.getElementById('moves-val');
  if (movesEl) movesEl.textContent = GameState.moves;

  const timeEl = document.getElementById('time-val');
  if (timeEl) timeEl.textContent = GameState.time;

  const targetEl = document.getElementById('target-text');
  if (targetEl) targetEl.textContent = GameState.tilesCleared + '/' + GameState.target + ' tiles';

  const hintEl = document.getElementById('hint-btn');
  if (hintEl) hintEl.textContent = '💡 Hint (' + GameState.hintsLeft + ')';

  const undoEl = document.getElementById('undo-btn');
  if (undoEl) undoEl.textContent = '↩ Undo (' + GameState.undosLeft + ')';

  const fill = document.getElementById('target-fill');
  if (fill) fill.style.width = Math.min((GameState.tilesCleared / GameState.target) * 100, 100) + '%';
}

function renderGrid() {
  const grid = document.getElementById('game-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = GameState.grid[r][c];
      const tile = document.createElement('div');
      tile.className = 'tile';

      if (val === 'L') {
        tile.classList.add('tile-locked');
        tile.textContent = '🔒';
      } else if (val === 'B') {
        tile.classList.add('tile-bomb');
        tile.textContent = '💣';
      } else if (val === 'R') {
        tile.classList.add('tile-rainbow');
        tile.textContent = '🌈';
      } else if (val !== 0) {
        tile.classList.add('tile-' + val);
      } else {
        tile.classList.add('tile-empty');
      }

      if (GameState.selectedTile &&
          GameState.selectedTile.row === r &&
          GameState.selectedTile.col === c) {
        tile.classList.add('selected');
      }

      // Use closure to capture r,c correctly
      (function(row, col) {
        tile.addEventListener('click', function() {
          playSound(300, 'sine', 0.05);
          handleTileClick(row, col);
        });
      })(r, c);

      grid.appendChild(tile);
    }
  }
}

function handleTileClick(r, c) {
  if (GameState.isAnimating || GameState.isPaused || GameState.moves <= 0) return;

  const val = GameState.grid[r][c];
  if (val === 'L') return; // Can't select locked tiles

  if (!GameState.selectedTile) {
    GameState.selectedTile = { row: r, col: c };
    renderGrid();
  } else {
    const s = GameState.selectedTile;
    // Check if same tile clicked - deselect
    if (s.row === r && s.col === c) {
      GameState.selectedTile = null;
      renderGrid();
      return;
    }
    // Check adjacency
    const isAdj = (Math.abs(s.row - r) === 1 && s.col === c) ||
                  (Math.abs(s.col - c) === 1 && s.row === r);
    if (isAdj) {
      GameState.previousGrid = JSON.parse(JSON.stringify(GameState.grid));
      GameState.moves--;
      updateHUD();
      swap(s.row, s.col, r, c);
    } else {
      // Select new tile instead
      GameState.selectedTile = { row: r, col: c };
      renderGrid();
      return;
    }
    GameState.selectedTile = null;
  }
}

function swap(r1, c1, r2, c2) {
  GameState.isAnimating = true;
  const temp = GameState.grid[r1][c1];
  GameState.grid[r1][c1] = GameState.grid[r2][c2];
  GameState.grid[r2][c2] = temp;
  renderGrid();
  setTimeout(checkMatches, 300);
}

function checkMatches() {
  const matched = findMatches();

  if (matched.length === 0) {
    GameState.isAnimating = false;
    if (GameState.tilesCleared >= GameState.target) {
      winLevel();
    } else if (GameState.moves <= 0) {
      loseLevel("OUT OF MOVES!");
    }
    return;
  }

  playSound(800, 'triangle', 0.2);

  // Mark matched tiles
  const toRemove = new Set();
  matched.forEach(group => {
    group.forEach(([r, c]) => {
      toRemove.add(r + ',' + c);
    });
    GameState.score += group.length * 10;
  });

  toRemove.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    const val = GameState.grid[r][c];
    if (val === 'L') {
      // Unlock locked tile
      GameState.grid[r][c] = ((r + c) % 5) + 1;
    } else if (val === 'B') {
      // Bomb: clear 3x3
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4) {
            if (GameState.grid[nr][nc] !== 'L' && GameState.grid[nr][nc] !== 0) {
              GameState.grid[nr][nc] = 0;
              GameState.tilesCleared++;
            }
          }
        }
      }
    } else if (val !== 0) {
      GameState.grid[r][c] = 0;
      GameState.tilesCleared++;
    }
  });

  updateHUD();
  renderGrid();
  setTimeout(dropAndFill, 300);
}

function findMatches() {
  const matched = [];
  const grid = GameState.grid;

  // Horizontal matches
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c <= 1; c++) {
      const v = grid[r][c];
      if (v && v !== 'L' && v !== 'B' && v !== 'R' && v !== 0 &&
          v === grid[r][c+1] && v === grid[r][c+2]) {
        matched.push([[r,c],[r,c+1],[r,c+2]]);
      }
    }
  }

  // Vertical matches
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r <= 1; r++) {
      const v = grid[r][c];
      if (v && v !== 'L' && v !== 'B' && v !== 'R' && v !== 0 &&
          v === grid[r+1][c] && v === grid[r+2][c]) {
        matched.push([[r,c],[r+1,c],[r+2,c]]);
      }
    }
  }

  // Rainbow matches any color
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === 'R') {
        // Rainbow adjacent to 2 same tiles
        const neighbors = [];
        if (r > 0 && grid[r-1][c] && typeof grid[r-1][c] === 'number') neighbors.push([r-1,c,grid[r-1][c]]);
        if (r < 3 && grid[r+1][c] && typeof grid[r+1][c] === 'number') neighbors.push([r+1,c,grid[r+1][c]]);
        if (c > 0 && grid[r][c-1] && typeof grid[r][c-1] === 'number') neighbors.push([r,c-1,grid[r][c-1]]);
        if (c < 3 && grid[r][c+1] && typeof grid[r][c+1] === 'number') neighbors.push([r,c+1,grid[r][c+1]]);
        // Count colors
        const colorMap = {};
        neighbors.forEach(([nr,nc,v]) => { colorMap[v] = (colorMap[v]||[]).concat([[nr,nc]]); });
        Object.entries(colorMap).forEach(([color, cells]) => {
          if (cells.length >= 2) {
            matched.push([[r,c]].concat(cells.slice(0,2)));
          }
        });
      }
    }
  }

  return matched;
}

function dropAndFill() {
  for (let c = 0; c < 4; c++) {
    let emptyRow = 3;
    for (let r = 3; r >= 0; r--) {
      if (GameState.grid[r][c] !== 0) {
        const val = GameState.grid[r][c];
        GameState.grid[r][c] = 0;
        GameState.grid[emptyRow][c] = val;
        emptyRow--;
      }
    }
    for (let r = emptyRow; r >= 0; r--) {
      GameState.grid[r][c] = Math.floor(Math.random() * 5) + 1;
    }
  }
  renderGrid();
  setTimeout(checkMatches, 400);
}

// ========================
// TIMER
// ========================
function startTimer() {
  clearInterval(GameState.timer);
  GameState.timer = setInterval(function() {
    if (GameState.isPaused) return;
    GameState.time--;
    updateHUD();
    if (GameState.time <= 0) {
      clearInterval(GameState.timer);
      loseLevel("OUT OF TIME!");
    }
  }, 1000);
}

// ========================
// WIN / LOSE
// ========================
function winLevel() {
  clearInterval(GameState.timer);
  playSound(1000, 'sine', 0.5);

  const stars = GameState.moves >= 10 ? 3 : GameState.moves >= 5 ? 2 : 1;
  const key = 'w' + GameState.currentWorld + '_l' + GameState.currentLevel;
  GameState.completedLevels[key] = true;
  GameState.levelStars[key] = Math.max(GameState.levelStars[key] || 0, stars);
  GameState.coins += stars * 10;
  saveProgress();

  const starEl = document.getElementById('win-stars');
  if (starEl) starEl.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);

  const scoreEl = document.getElementById('win-score');
  if (scoreEl) scoreEl.textContent = GameState.score + ' pts';

  const coinsEl = document.getElementById('win-coins');
  if (coinsEl) coinsEl.textContent = '+' + (stars * 10) + ' 🪙';

  showScreen('win');
}

function loseLevel(reason) {
  clearInterval(GameState.timer);
  playSound(200, 'sawtooth', 0.5);

  const reasonEl = document.getElementById('lose-reason');
  if (reasonEl) reasonEl.textContent = reason;

  const scoreEl = document.getElementById('lose-score');
  if (scoreEl) scoreEl.textContent = 'Score: ' + GameState.score;

  showScreen('lose');
}

// ========================
// LEVEL SELECT
// ========================
function renderLevelGrid() {
  const grid = document.getElementById('level-grid');
  if (!grid) return;
  grid.innerHTML = '';

  levelsData.worlds[0].levels.forEach(function(level, i) {
    const btn = document.createElement('button');
    btn.className = 'level-btn';

    const key = 'w1_l' + level.id;
    const isCompleted = GameState.completedLevels[key];
    const stars = GameState.levelStars[key] || 0;

    if (isCompleted) {
      btn.classList.add('completed');
    } else if (i === 0 || GameState.completedLevels['w1_l' + (i)]) {
      btn.classList.add('active-level');
    } else {
      btn.classList.add('locked-level');
    }

    // Difficulty badge
    const badge = document.createElement('span');
    badge.className = 'difficulty-badge ' + level.difficulty;
    badge.textContent = level.difficulty.charAt(0).toUpperCase();
    btn.appendChild(badge);

    const numDiv = document.createElement('div');
    numDiv.className = 'level-num';
    numDiv.textContent = level.id;
    btn.appendChild(numDiv);

    if (stars > 0) {
      const starsDiv = document.createElement('div');
      starsDiv.className = 'level-stars';
      starsDiv.textContent = '⭐'.repeat(stars);
      btn.appendChild(starsDiv);
    }

    btn.addEventListener('click', function() {
      playSound(440, 'sine', 0.05);
      startLevel(0, i);
    });

    grid.appendChild(btn);
  });

  // Update progress
  const totalStars = Object.values(GameState.levelStars).reduce(function(a, b) { return a + b; }, 0);
  const progressText = document.getElementById('ls-progress-text');
  if (progressText) progressText.textContent = '⭐ ' + totalStars + '/18 Stars';

  const progressFill = document.getElementById('ls-progress-fill');
  if (progressFill) progressFill.style.width = Math.min((totalStars / 18) * 100, 100) + '%';
}

// ========================
// SHOP
// ========================
window.buyItem = function(type, price, item) {
  playSound(440, 'sine', 0.05); // trigger audio context
  if (GameState.coins >= price) {
    GameState.coins -= price;
    if (item === 'hint') GameState.hintsLeft += 5;
    if (item === 'undo') GameState.undosLeft += 5;
    if (item === 'time') { GameState.time += 30; updateHUD(); }
    if (item === 'bomb') { /* future: add bomb to inventory */ }
    if (item === 'rainbow') { /* future: add rainbow to inventory */ }
    playSound(1200, 'sine', 0.2);
    saveProgress();
    updateHUD();
    updateCoinDisplay();
    alert('✅ Purchase Successful! Enjoy your power-up!');
  } else {
    alert('❌ Not enough coins! Play more levels to earn coins.');
  }
};

// ========================
// SETTINGS
// ========================
function setupSettings() {
  const toggles = document.querySelectorAll('#settings input[type="checkbox"]');
  const keys = ['music', 'sound', 'vibration', 'notifications'];
  toggles.forEach(function(t, i) {
    if (GameState.settings[keys[i]] !== undefined) {
      t.checked = GameState.settings[keys[i]];
    }
    t.addEventListener('change', function() {
      GameState.settings[keys[i]] = t.checked;
      saveProgress();
      if (GameState.settings.sound) playSound(500, 'sine', 0.1);
    });
  });
}

// ========================
// LEADERBOARD TABS
// ========================
function setupLeaderboardTabs() {
  const tabs = document.querySelectorAll('#leaderboard .shop-tab');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      tabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      playSound(400, 'sine', 0.05);
    });
  });
}

// ========================
// SHOP TABS
// ========================
function setupShopTabs() {
  const tabs = document.querySelectorAll('.shop-tabs .shop-tab');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      tabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      playSound(400, 'sine', 0.05);
    });
  });
}

// ========================
// MAIN INIT (on load)
// ========================
window.addEventListener('load', function() {
  // Load saved progress first
  loadProgress();
  setupSettings();
  setupLeaderboardTabs();
  setupShopTabs();

  // Splash screen loader
  const fill = document.getElementById('splash-loader-fill');
  let p = 0;
  const inv = setInterval(function() {
    p += 10;
    if (fill) fill.style.width = p + '%';
    if (p >= 100) {
      clearInterval(inv);
      showScreen('home');
    }
  }, 60);

  // ---- BUTTON BINDINGS ----
  function bindClick(id, fn) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', function() {
        playSound(440, 'sine', 0.05);
        fn();
      });
    }
  }

  // Home screen
  bindClick('play-btn', function() {
    showScreen('levelselect');
    renderLevelGrid();
  });
  bindClick('leaderboard-btn', function() { showScreen('leaderboard'); });
  bindClick('shop-btn', function() { showScreen('shop'); });
  bindClick('settings-btn', function() { showScreen('settings'); });

  // Gameplay controls
  bindClick('pause-btn', function() {
    GameState.isPaused = true;
    const po = document.getElementById('pause-overlay');
    if (po) po.style.display = 'flex';
  });

  bindClick('resume-btn', function() {
    GameState.isPaused = false;
    const po = document.getElementById('pause-overlay');
    if (po) po.style.display = 'none';
  });

  bindClick('hint-btn', function() {
    if (GameState.hintsLeft > 0) {
      GameState.hintsLeft--;
      updateHUD();
      // Highlight a useful tile
      const hints = findHint();
      if (hints) {
        highlightHint(hints);
        alert('💡 Hint: Try moving the highlighted tile!');
      } else {
        alert('💡 Hint: No immediate match found. Try swapping adjacent tiles!');
      }
    } else {
      alert('No hints left! Buy more in the Shop.');
    }
  });

  bindClick('undo-btn', function() {
    if (GameState.undosLeft > 0 && GameState.previousGrid) {
      GameState.grid = JSON.parse(JSON.stringify(GameState.previousGrid));
      GameState.previousGrid = null;
      GameState.moves++;
      GameState.undosLeft--;
      updateHUD();
      renderGrid();
      playSound(350, 'sine', 0.1);
    } else if (!GameState.previousGrid) {
      alert('Nothing to undo!');
    } else {
      alert('No undos left! Buy more in the Shop.');
    }
  });

  // Win screen
  bindClick('next-level-btn', function() {
    const nextIdx = GameState.currentLevel; // currentLevel is 1-based, so index = currentLevel
    if (nextIdx < levelsData.worlds[0].levels.length) {
      startLevel(0, nextIdx);
    } else {
      showScreen('levelselect');
      renderLevelGrid();
    }
  });

  bindClick('replay-btn', function() { startLevel(0, GameState.currentLevel - 1); });

  bindClick('win-home-btn', function() { showScreen('home'); });

  // Lose screen
  bindClick('retry-btn', function() { startLevel(0, GameState.currentLevel - 1); });
  bindClick('lose-home-btn', function() { showScreen('home'); });

  // Watch Ad button (in lose screen)
  const adBtn = document.querySelector('#lose .btn-golden');
  if (adBtn) {
    adBtn.addEventListener('click', function() {
      playSound(440, 'sine', 0.05);
      alert('📺 Thanks for watching! +5 Moves added.');
      GameState.moves += 5;
      updateHUD();
      showScreen('gameplay');
      if (!GameState.isPaused) startTimer();
    });
  }

  // All back buttons
  document.querySelectorAll('.back-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      playSound(400, 'sine', 0.05);
      clearInterval(GameState.timer);
      showScreen('home');
    });
  });

  // Reset progress button (settings)
  const resetBtn = document.querySelector('#settings .btn-red');
  if (resetBtn) {
    // Remove any existing onclick and replace with addEventListener
    resetBtn.removeAttribute('onclick');
    resetBtn.addEventListener('click', function() {
      if (confirm('Reset ALL progress? This cannot be undone!')) {
        localStorage.clear();
        GameState.coins = 0;
        GameState.completedLevels = {};
        GameState.levelStars = {};
        GameState.hintsLeft = 3;
        GameState.undosLeft = 3;
        updateCoinDisplay();
        alert('✅ Progress reset!');
      }
    });
  }

  // Initial coin display
  updateCoinDisplay();
});

// ========================
// HINT HELPER
// ========================
function findHint() {
  const grid = GameState.grid;
  // Try all possible swaps and see if any creates a match
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      // Try swap right
      if (c < 3) {
        const temp = grid[r][c]; grid[r][c] = grid[r][c+1]; grid[r][c+1] = temp;
        if (findMatches().length > 0) {
          const res = {r, c, r2: r, c2: c+1};
          grid[r][c+1] = grid[r][c]; grid[r][c] = temp;
          return res;
        }
        grid[r][c+1] = grid[r][c]; grid[r][c] = temp;
      }
      // Try swap down
      if (r < 3) {
        const temp = grid[r][c]; grid[r][c] = grid[r+1][c]; grid[r+1][c] = temp;
        if (findMatches().length > 0) {
          const res = {r, c, r2: r+1, c2: c};
          grid[r+1][c] = grid[r][c]; grid[r][c] = temp;
          return res;
        }
        grid[r+1][c] = grid[r][c]; grid[r][c] = temp;
      }
    }
  }
  return null;
}

function highlightHint(hint) {
  const tiles = document.querySelectorAll('.tile');
  const idx1 = hint.r * 4 + hint.c;
  const idx2 = hint.r2 * 4 + hint.c2;
  if (tiles[idx1]) tiles[idx1].classList.add('hint-glow');
  if (tiles[idx2]) tiles[idx2].classList.add('hint-glow');
  setTimeout(function() {
    if (tiles[idx1]) tiles[idx1].classList.remove('hint-glow');
    if (tiles[idx2]) tiles[idx2].classList.remove('hint-glow');
  }, 2000);
}
