const $ = (id) => document.getElementById(id);

let roomCode = null;
let playerToken = null;
let playerIndex = null;
let currentGame = null;
let currentState = null;
let selectedSquare = null;
let selectedMoves = [];
let pollTimer = null;
let soundOn = localStorage.getItem('arcadeSound') !== 'false';
let audioCtx = null;

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  $(id).classList.add('active');
}

function getName() {
  const input = $('playerName');
  const name = (input.value || localStorage.getItem('arcadeName') || 'Player').trim().slice(0, 20);
  localStorage.setItem('arcadeName', name);
  input.value = name;
  return name;
}

function setupName() {
  $('playerName').value = localStorage.getItem('arcadeName') || 'Player';
}

function sound(type = 'click') {
  if (!soundOn) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const patterns = {
    click: [520, 0.06, 'triangle', 0.02],
    card: [760, 0.06, 'sine', 0.018],
    win: [520, 0.12, 'triangle', 0.03, 680, 0.16, 'triangle', 0.025],
    lose: [310, 0.18, 'sawtooth', 0.025, 210, 0.22, 'sawtooth', 0.018]
  };
  const p = patterns[type] || patterns.click;
  for (let i = 0; i < p.length; i += 4) playTone(p[i], p[i + 1], p[i + 2], p[i + 3], i * 0.035);
}

function playTone(freq, duration, type, volume, delay = 0) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const start = audioCtx.currentTime + delay;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function syncSound() {
  $('soundBtn').textContent = `Sound: ${soundOn ? 'On' : 'Off'}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || 'Request failed');
  return data;
}

async function checkServer() {
  try {
    await api('/api/ping');
    $('serverWarning').classList.add('hidden');
    return true;
  } catch (error) {
    $('serverWarning').classList.remove('hidden');
    showToast('Server is not running. Use START_GAME.bat or npm start, then open http://localhost:3000');
    return false;
  }
}

async function createRoom(game, mode) {
  sound('click');
  if (!(await checkServer())) return;
  try {
    const data = await api('/api/create', {
      method: 'POST',
      body: JSON.stringify({ game, mode, name: getName() })
    });
    enterRoom(data.code, data.token, data.playerIndex, data.state);
  } catch (error) {
    showToast(error.message);
  }
}

async function joinRoom(codeValue) {
  if (!(await checkServer())) return;
  const code = (codeValue || $('joinCodeInput').value || '').trim().toUpperCase();
  if (!code) return showToast('Enter room code.');
  sound('click');
  try {
    const data = await api('/api/join', {
      method: 'POST',
      body: JSON.stringify({ code, name: getName() })
    });
    enterRoom(data.code, data.token, data.playerIndex, data.state);
  } catch (error) {
    showToast(error.message);
  }
}

function enterRoom(code, token, index, state) {
  roomCode = code;
  playerToken = token;
  playerIndex = index;
  localStorage.setItem('arcadeLastRoom', code);
  localStorage.setItem(`arcadeToken_${code}`, token);
  showScreen('gameScreen');
  renderState(state);
  startPolling();
}

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(fetchState, 900);
}

async function fetchState() {
  if (!roomCode || !playerToken) return;
  try {
    const data = await api(`/api/state?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(playerToken)}`);
    renderState(data.state);
  } catch (error) {
    showToast(error.message);
    clearInterval(pollTimer);
  }
}

async function sendAction(action) {
  if (!roomCode || !playerToken) return;
  try {
    const data = await api('/api/action', {
      method: 'POST',
      body: JSON.stringify({ room: roomCode, token: playerToken, action })
    });
    if (data.cheatView) renderCheatOverlay(data.cheatView);
    renderState(data.state);
    sound(action.type === 'move' || action.type === 'play' ? 'card' : 'click');
  } catch (error) {
    showToast(error.message);
  }
}

function inviteLink(code = roomCode) {
  return `${location.origin}${location.pathname}?room=${code}`;
}

async function copyInvite() {
  if (!roomCode) return;
  const link = inviteLink();
  try {
    await navigator.clipboard.writeText(link);
    showToast('Invite link copied.');
  } catch {
    showToast(link);
  }
}

function renderState(payload) {
  if (!payload) return;
  currentState = payload;
  currentGame = payload.game;
  $('gameTitle').textContent = titleForGame(payload.game);
  $('gameIcon').textContent = iconForGame(payload.game);
  $('roomSubtitle').textContent = payload.waiting ? 'Waiting for friend' : `${payload.playerName} vs ${payload.opponentName}`;
  $('roomCodeBadge').textContent = payload.code || '-----';
  $('inviteLinkText').textContent = inviteLink(payload.code);
  $('inviteBox').classList.toggle('hidden', payload.mode !== 'online');
  $('waitingBox').classList.toggle('hidden', !payload.waiting);

  if (payload.waiting) {
    $('statusTitle').textContent = 'Waiting for friend';
    $('statusText').textContent = 'Copy the invite link and send it to your friend.';
    $('gameMount').innerHTML = '';
    return;
  }

  if (payload.game === 'durak') renderDurak(payload);
  if (payload.game === 'chess') renderBoardGame(payload, 'chess');
  if (payload.game === 'checkers') renderBoardGame(payload, 'checkers');
}

function titleForGame(game) {
  return ({ durak: 'Durak Online', chess: 'Chess Online', checkers: 'Checkers Online' })[game] || 'Game';
}
function iconForGame(game) {
  return ({ durak: '♠', chess: '♔', checkers: '⛂' })[game] || '♠';
}

function cardHtml(card, opts = {}) {
  if (!card) return '';
  const classes = ['playing-card'];
  if (card.color === 'red') classes.push('red');
  if (opts.table) classes.push('table-card');
  if (opts.trump) classes.push('trump');
  if (opts.disabled) classes.push('disabled');
  return `<div class="${classes.join(' ')}" data-card-index="${opts.index ?? ''}" style="--i:${opts.index || 0}">
    <div class="card-corner"><span>${card.rankLabel}</span><span>${card.suitSymbol}</span></div>
    <div class="card-suit">${card.suitSymbol}</div>
    <div class="card-name">${card.rankName} of ${card.suitName}</div>
    <div class="card-corner bottom"><span>${card.rankLabel}</span><span>${card.suitSymbol}</span></div>
  </div>`;
}

function renderDurak(payload) {
  const s = payload.state;
  const role = playerIndex === s.attacker ? 'Attacker' : 'Defender';
  const yourTurn = !s.winner && (playerIndex === s.attacker || playerIndex === s.defender);
  const canTake = playerIndex === s.defender && s.battlefield.length > 0;
  const allDefended = s.battlefield.length > 0 && s.battlefield.every((p) => p.defense);
  const canDone = playerIndex === s.attacker && allDefended;
  $('statusTitle').textContent = s.winner !== null ? winnerText(s.winner, payload) : `${role} • Round ${s.round}`;
  $('statusText').textContent = s.message;

  const enemyBacks = Array.from({ length: Math.min(s.opponentCount, 8) }, (_, i) => `<div class="card-back" style="--rot:${-16 + i * 5}deg"></div>`).join('');
  const battle = Array.from({ length: 6 }, (_, i) => {
    const pair = s.battlefield[i];
    if (!pair) return '<div class="battle-slot empty">✦</div>';
    return `<div class="battle-slot">${cardHtml(pair.attack, { table: true })}${pair.defense ? cardHtml(pair.defense, { table: true }) : '<div class="placeholder">defense</div>'}</div>`;
  }).join('');
  const hand = s.yourHand.map((card, i) => cardHtml(card, { index: i, disabled: !yourTurn || s.winner !== null })).join('');

  $('gameMount').innerHTML = `<div class="durak-layout">
    <aside class="panel side-panel">
      <p class="panel-label">Opponent</p><h2>${payload.opponentName}</h2>
      <div class="counter"><div><strong>${s.opponentCount}</strong><span>cards left</span></div></div>
      <div class="enemy-backs">${enemyBacks}</div>
    </aside>
    <section class="panel durak-table">
      <div class="table-head">
        <div><p class="panel-label">Battle table</p><h2>${role}</h2><p>${s.message}</p></div>
        <div class="trump-box"><div class="deck-count">${s.deckCount}</div>${cardHtml(s.trumpCard, { trump: true })}</div>
      </div>
      <div class="battlefield">${battle}</div>
      <div class="durak-actions">
        <button id="durakDone" class="primary-btn" ${!canDone ? 'disabled' : ''}>Beat / Done</button>
        <button id="durakTake" class="danger-btn" ${!canTake ? 'disabled' : ''}>Take</button>
        <button id="cheatBtn" class="soft-btn" ${s.cheatLocked || s.winner !== null ? 'disabled' : ''}>${s.cheatLocked ? 'Cheat Locked' : 'Cheat Peek'}</button>
      </div>
    </section>
    <aside class="panel side-panel">
      <p class="panel-label">Trump</p><h2>${s.trumpCard.suitSymbol} ${s.trumpCard.suitName}</h2>
      <p style="color:var(--muted);line-height:1.6;margin-top:10px">Your role: <b>${role}</b>. Click a card to attack or defend.</p>
    </aside>
  </div>
  <section class="panel side-panel" style="margin-top:18px"><p class="panel-label">Your hand</p><div class="hand">${hand}</div></section>`;

  document.querySelectorAll('.hand .playing-card').forEach((el) => {
    el.addEventListener('click', () => {
      if (el.classList.contains('disabled')) return;
      sendAction({ type: 'play', cardIndex: Number(el.dataset.cardIndex) });
    });
  });
  $('durakDone')?.addEventListener('click', () => sendAction({ type: 'done' }));
  $('durakTake')?.addEventListener('click', () => sendAction({ type: 'take' }));
  $('cheatBtn')?.addEventListener('click', () => sendAction({ type: 'cheatPeek' }));
}

function winnerText(winner, payload) {
  if (winner === 'draw') return 'Draw';
  return winner === playerIndex ? 'You won' : 'You lost';
}

function renderCheatOverlay(view) {
  const overlay = $('cheatOverlay');
  const cards = view.cards.map((card, i) => `<div class="cheat-card" data-trap="${i === view.trapIndex}">${cardHtml(card, { index: i })}</div>`).join('');
  overlay.innerHTML = `<div class="cheat-panel"><h2>Cheat Peek</h2><p>You can see the opponent's cards for a moment. But one card is a trap. If you click it, you get caught and cheating is disabled.</p><div class="cheat-cards">${cards}</div><div style="margin-top:20px;text-align:center"><button id="closeCheat" class="soft-btn">Close</button></div></div>`;
  overlay.classList.remove('hidden');
  overlay.querySelectorAll('.cheat-card').forEach((el) => {
    el.addEventListener('click', async () => {
      if (el.dataset.trap === 'true') {
        el.classList.add('caught');
        sound('lose');
        await sendAction({ type: 'cheatCaught' });
        showToast('Caught cheating. Cheat Peek is locked.');
        setTimeout(() => overlay.classList.add('hidden'), 900);
      } else {
        sound('click');
        showToast('Safe card. You were not caught.');
      }
    });
  });
  $('closeCheat').addEventListener('click', () => overlay.classList.add('hidden'));
}

function renderBoardGame(payload, game) {
  const s = payload.state;
  const isChess = game === 'chess';
  const color = s.playerColor;
  const myTurn = s.turn === color && !s.winner;
  $('statusTitle').textContent = s.winner ? (s.winner === color ? 'You won' : 'You lost') : myTurn ? 'Your turn' : 'Opponent turn';
  $('statusText').textContent = s.message;
  const boardHtml = s.board.map((row, r) => row.map((piece, c) => squareHtml(piece, r, c, isChess)).join('')).join('');
  $('gameMount').innerHTML = `<div class="board-wrap"><section class="panel board-panel"><div id="board" class="board">${boardHtml}</div></section><aside class="panel info-panel"><p class="panel-label">You play as</p><h3>${color}</h3><p>${isChess ? 'Move your pieces. Pawns promote to queens. Capturing the king wins this arcade chess game.' : 'Move diagonally. Captures are forced. Pieces become kings on the last row.'}</p></aside></div>`;
  selectedSquare = null;
  selectedMoves = [];
  document.querySelectorAll('.square').forEach((sq) => sq.addEventListener('click', () => handleSquareClick(Number(sq.dataset.r), Number(sq.dataset.c), isChess)));
}

function squareHtml(piece, r, c, isChess) {
  const light = (r + c) % 2 === 0;
  let content = '';
  if (piece) {
    if (isChess) content = `<span class="piece">${chessSymbol(piece)}</span>`;
    else content = `<span class="checkers-piece ${piece.color} ${piece.king ? 'king' : ''}"></span>`;
  }
  return `<div class="square ${light ? 'light' : 'dark'}" data-r="${r}" data-c="${c}">${content}</div>`;
}

function chessSymbol(piece) {
  const symbols = { white: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' }, black: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' } };
  return symbols[piece.color][piece.type];
}

function handleSquareClick(r, c, isChess) {
  const s = currentState.state;
  const color = s.playerColor;
  if (s.winner || s.turn !== color) return showToast('Not your turn.');
  const piece = s.board[r][c];
  if (!selectedSquare) {
    if (!piece || piece.color !== color) return;
    selectedSquare = { r, c };
    markSelected(r, c);
    return;
  }
  const from = selectedSquare;
  selectedSquare = null;
  sendAction({ type: 'move', from, to: { r, c } });
}

function markSelected(r, c) {
  document.querySelectorAll('.square').forEach((el) => el.classList.remove('selected'));
  document.querySelector(`.square[data-r="${r}"][data-c="${c}"]`)?.classList.add('selected');
}

function setup() {
  setupName();
  syncSound();
  checkServer();
  document.querySelectorAll('[data-create]').forEach((btn) => btn.addEventListener('click', () => createRoom(btn.dataset.create, btn.dataset.mode)));
  $('joinRoomBtn').addEventListener('click', () => joinRoom());
  $('copyLinkBtn').addEventListener('click', copyInvite);
  $('copyLinkBtn2').addEventListener('click', copyInvite);
  $('leaveBtn').addEventListener('click', () => { clearInterval(pollTimer); showScreen('lobby'); });
  $('rulesBtn').addEventListener('click', () => $('rulesDialog').showModal());
  $('closeRulesBtn').addEventListener('click', () => $('rulesDialog').close());
  $('soundBtn').addEventListener('click', () => { soundOn = !soundOn; localStorage.setItem('arcadeSound', String(soundOn)); syncSound(); sound('click'); });
  const url = new URL(location.href);
  const code = url.searchParams.get('room');
  if (code) {
    $('joinCodeInput').value = code.toUpperCase();
    showToast('Room code detected. Enter your name and press Join Room.');
  }
}

function syncSound() {
  $('soundBtn').textContent = `Sound: ${soundOn ? 'On' : 'Off'}`;
}

window.addEventListener('DOMContentLoaded', setup);
