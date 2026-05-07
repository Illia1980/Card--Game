(function () {
  function $(id) {
    return document.getElementById(id);
  }

  const STORAGE_KEYS = {
    sound: 'durakNoirSoundEnabled',
    backStyle: 'durakNoirBackStyle',
    stats: 'durakNoirStats'
  };

  const defaultStats = {
    playerWins: 0,
    enemyWins: 0,
    draws: 0
  };

  let soundEnabled = localStorage.getItem(STORAGE_KEYS.sound) !== 'false';
  let audioContext = null;

  function getStats() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.stats) || 'null');
      return parsed ? { ...defaultStats, ...parsed } : { ...defaultStats };
    } catch (error) {
      return { ...defaultStats };
    }
  }

  function setStats(stats) {
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
    renderStats();
  }

  function addStat(result) {
    const stats = getStats();

    if (result === 'player') {
      stats.playerWins += 1;
    } else if (result === 'enemy') {
      stats.enemyWins += 1;
    } else if (result === 'draw') {
      stats.draws += 1;
    }

    setStats(stats);
  }

  function renderStats() {
    const stats = getStats();
    const map = {
      menuWins: stats.playerWins,
      menuLosses: stats.enemyWins,
      menuDraws: stats.draws,
      playerWins: stats.playerWins,
      enemyWins: stats.enemyWins,
      drawCount: stats.draws
    };

    Object.entries(map).forEach(([id, value]) => {
      const el = $(id);
      if (el) {
        el.textContent = value;
      }
    });
  }

  function ensureAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }

    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }

    return audioContext;
  }

  function playTone(frequency, duration, type = 'sine', volume = 0.03, delay = 0) {
    if (!soundEnabled) {
      return;
    }

    const ctx = ensureAudioContext();
    if (!ctx) {
      return;
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const startAt = ctx.currentTime + delay;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(volume, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  }

  function playSound(type) {
    const patterns = {
      click: () => playTone(540, 0.08, 'triangle', 0.02),
      select: () => {
        playTone(660, 0.08, 'triangle', 0.025);
        playTone(880, 0.12, 'triangle', 0.018, 0.04);
      },
      deal: () => playTone(780, 0.05, 'sine', 0.018),
      swoosh: () => playTone(300, 0.16, 'sawtooth', 0.015),
      success: () => {
        playTone(520, 0.12, 'triangle', 0.03);
        playTone(660, 0.14, 'triangle', 0.028, 0.08);
        playTone(880, 0.18, 'triangle', 0.025, 0.16);
      },
      defeat: () => {
        playTone(360, 0.14, 'sawtooth', 0.03);
        playTone(280, 0.16, 'sawtooth', 0.025, 0.09);
        playTone(200, 0.2, 'sawtooth', 0.02, 0.2);
      },
      draw: () => {
        playTone(430, 0.1, 'triangle', 0.022);
        playTone(500, 0.12, 'triangle', 0.018, 0.08);
      }
    };

    if (patterns[type]) {
      patterns[type]();
    }
  }

  function syncSoundButtons() {
    const label = `Sound: ${soundEnabled ? 'On' : 'Off'}`;
    const buttons = [$('soundToggleBtn'), $('gameSoundToggleBtn')];
    buttons.forEach((button) => {
      if (button) {
        button.textContent = label;
      }
    });
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem(STORAGE_KEYS.sound, String(soundEnabled));
    syncSoundButtons();
    if (soundEnabled) {
      playSound('click');
    }
  }

  function applyBackStyle(style) {
    const allowed = ['nebula', 'royal', 'crystal'];
    const value = allowed.includes(style) ? style : 'nebula';
    document.body.setAttribute('data-back-style', value);
    localStorage.setItem(STORAGE_KEYS.backStyle, value);

    document.querySelectorAll('.back-style-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.backStyle === value);
    });
  }

  function loadPreferences() {
    const savedBackStyle = localStorage.getItem(STORAGE_KEYS.backStyle) || 'nebula';
    applyBackStyle(savedBackStyle);
    syncSoundButtons();
    renderStats();
  }

  function showToast(message) {
    const toast = $('toast');

    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.classList.add('show');

    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.classList.remove('show');
    }, 1800);
  }

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach((screen) => {
      screen.classList.remove('screen-active');
    });

    const target = $(screenId);

    if (target) {
      target.classList.add('screen-active');
    }
  }

  function openDialog(dialogId) {
    const dialog = $(dialogId);

    if (!dialog) {
      return;
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', 'open');
    }
  }

  function closeDialog(dialogId) {
    const dialog = $(dialogId);

    if (!dialog) {
      return;
    }

    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function openResult(title, text, kicker = 'Game Over') {
    const titleEl = $('resultTitle');
    const textEl = $('resultText');
    const kickerEl = $('resultKicker');

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    if (kickerEl) kickerEl.textContent = kicker;

    openDialog('resultDialog');
  }

  function setupUI() {
    document.querySelectorAll('[data-open-rules]').forEach((button) => {
      button.addEventListener('click', () => {
        playSound('click');
        openDialog('rulesDialog');
      });
    });

    document.querySelectorAll('.back-style-btn').forEach((button) => {
      button.addEventListener('click', () => {
        playSound('select');
        applyBackStyle(button.dataset.backStyle);
      });
    });

    [$('soundToggleBtn'), $('gameSoundToggleBtn')].forEach((button) => {
      if (button) {
        button.addEventListener('click', toggleSound);
      }
    });

    const closeRulesBtn = $('closeRulesBtn');
    if (closeRulesBtn) {
      closeRulesBtn.addEventListener('click', () => {
        playSound('click');
        closeDialog('rulesDialog');
      });
    }

    const backMenuBtn = $('backMenuBtn');
    if (backMenuBtn) {
      backMenuBtn.addEventListener('click', () => {
        playSound('click');
        showScreen('menuScreen');
      });
    }

    const resultMenuBtn = $('resultMenuBtn');
    if (resultMenuBtn) {
      resultMenuBtn.addEventListener('click', () => {
        playSound('click');
        closeDialog('resultDialog');
        showScreen('menuScreen');
      });
    }

    document.addEventListener('click', (event) => {
      if (event.target.closest('.gold-btn, .soft-btn, .danger-btn, .back-style-btn')) {
        ensureAudioContext();
      }
    });
  }

  window.DurakUI = {
    $,
    showToast,
    showScreen,
    openDialog,
    closeDialog,
    openResult,
    playSound,
    getStats,
    setStats,
    addStat,
    renderStats,
    applyBackStyle,
    isSoundEnabled: () => soundEnabled
  };

  window.addEventListener('DOMContentLoaded', () => {
    loadPreferences();
    setupUI();
  });
}());
