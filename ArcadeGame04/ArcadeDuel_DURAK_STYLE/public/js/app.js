const socket = io();

const $ = (id) => document.getElementById(id);
const lobby = $('lobby');
const gameScreen = $('gameScreen');
const gameBoard = $('gameBoard');
const controls = $('gameControls');
const toast = $('toast');

let currentRoom = null;
let selected = null;

const GAME_NAMES = { durak: 'Durak', chess: 'Chess', checkers: 'Checkers' };
const GAME_LOGOS = { durak: '♠', chess: '♞', checkers: '⛀' };

function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function showScreen(which) {
  lobby.classList.toggle('active', which === 'lobby');
  gameScreen.classList.toggle('active', which === 'game');
}

function inviteLink(code) {
  const url = new URL(window.location.href);
  url.searchParams.set('room', code);
  return url.toString();
}

function myName(player) {
  return player === 'p1' ? 'Player 1' : 'Player 2';
}

socket.on('connect', () => {
  $('serverStatus').textContent = 'Server online';
  $('serverStatus').className = 'server-pill ok';
  const roomCode = new URLSearchParams(window.location.search).get('room');
  if (roomCode) {
    $('joinCode').value = roomCode.toUpperCase();
    showToast('Invite code detected. Press Join.');
  }
});

socket.on('disconnect', () => {
  $('serverStatus').textContent = 'Server disconnected';
  $('serverStatus').className = 'server-pill bad';
});

socket.on('errorMessage', showToast);

socket.on('roomCreated', ({ code }) => {
  $('inviteBox').classList.remove('hidden');
  $('inviteText').textContent = inviteLink(code);
});

socket.on('roomState', (room) => {
  currentRoom = room;
  if (selected && selected.game !== room.game) selected = null;
  showScreen('game');
  renderRoom(room);
});

document.querySelectorAll('[data-create]').forEach((btn) => {
  btn.addEventListener('click', () => {
    selected = null;
    socket.emit('createRoom', { game: btn.dataset.create, mode: btn.dataset.mode });
  });
});

$('joinBtn').addEventListener('click', () => {
  const code = $('joinCode').value.trim().toUpperCase();
  if (!code) return showToast('Enter a room code first.');
  selected = null;
  socket.emit('joinRoom', { code });
});

$('leaveBtn').addEventListener('click', () => {
  currentRoom = null;
  selected = null;
  showScreen('lobby');
});

$('copyInviteBtn').addEventListener('click', async () => {
  if (!currentRoom) return;
  const text = inviteLink(currentRoom.code);
  try {
    await navigator.clipboard.writeText(text);
    showToast('Invite link copied.');
  } catch {
    showToast(text);
  }
});

function renderRoom(room) {
  $('gameTitle').textContent = GAME_NAMES[room.game];
  $('gameLogo').textContent = GAME_LOGOS[room.game];
  $('gameSub').textContent = room.mode === 'bot' ? 'Playing vs Bot' : 'Friend Room';
  $('roomCode').textContent = room.code;
  $('playerLabel').textContent = myName(room.player);
  $('playerCount').textContent = `${room.playerCount}/2`;
  $('statusTitle').textContent = room.state.status || 'Ready';
  $('statusText').textContent = room.ready ? friendlyStatus(room) : 'Waiting for your friend to join.';

  if (room.mode === 'friend') {
    $('inviteBox').classList.remove('hidden');
    $('inviteText').textContent = inviteLink(room.code);
  } else {
    $('inviteBox').classList.add('hidden');
  }

  if (room.game === 'durak') renderDurak(room);
  if (room.game === 'chess') renderChess(room);
  if (room.game === 'checkers') renderCheckers(room);
  renderTips(room.game);
}

function friendlyStatus(room) {
  if (room.state.over) {
    if (room.state.winner === 'draw') return 'Game ended in a draw.';
    if (room.state.winner === room.player) return 'You won.';
    return 'You lost.';
  }
  if (!room.ready) return 'Waiting for second player.';
  if (room.game === 'durak') return `You are ${room.state.role}.`;
  return room.state.turn === room.player ? 'Your move.' : 'Opponent move.';
}

function renderTips(game) {
  const map = {
    durak: [
      'Attack with any card if the table is empty.',
      'Add only ranks already on the table.',
      'Defend higher same suit or with trump.',
      'No defense? Press Take.'
    ],
    chess: [
      'Click your piece first.',
      'Blue glow = legal move.',
      'Pink ring = capture.',
      'Checkmate ends the game.'
    ],
    checkers: [
      'Click your checker first.',
      'Blue glow = legal move.',
      'Pink ring = capture.',
      'Reach the end to become king.'
    ]
  };
  $('tipsBox').innerHTML = map[game].map((tip, i) => `<div class="tip"><strong>${i + 1}</strong><span>${tip}</span></div>`).join('');
}

function endControlsHtml(room) {
  if (!room.state?.over) return '';
  return `
    <div class="end-actions">
      <button class="btn primary small" id="restartBtn">Restart</button>
      <button class="btn secondary small" id="menuBtn">Main menu</button>
    </div>
  `;
}

function bindEndControls() {
  const restartBtn = $('restartBtn');
  const menuBtn = $('menuBtn');
  if (restartBtn) restartBtn.onclick = () => socket.emit('restartRoom');
  if (menuBtn) menuBtn.onclick = () => {
    currentRoom = null;
    selected = null;
    showScreen('lobby');
  };
}

/* DURAK */
function renderDurak(room) {
  const s = room.state;
  const isAttacker = s.role === 'Attacker';
  const canAct = room.ready && !s.over && s.yourTurn;
  const trumpSymbol = suitSymbol(s.trump);
  const tableRanks = durakRanksOnTable(s.table);
  const enemyBacks = Math.min(s.enemyCount, 12);
  const allDefended = s.table.length > 0 && s.table.every((p) => p.defense);
  const phaseText = s.over ? 'Game over' : isAttacker ? 'Your attack phase' : 'Your defense phase';

  gameBoard.className = 'game-board durak-area durak-online-view';
  gameBoard.innerHTML = `
    <div class="durak-brand-strip">
      <div class="durak-badge-logo"><span>D</span></div>
      <div>
        <strong>Durak Card Table</strong>
        <small>${phaseText}</small>
      </div>
    </div>

    <div class="durak-shell">
      <div class="durak-top-row">
        <div class="opponent-zone">
          <span class="zone-label">Opponent</span>
          <div class="enemy-fan durak-online-fan">
            ${Array.from({ length: enemyBacks }, (_, i) => `<div class="card-back" style="--i:${i};--rot:${-22 + i * 4}deg"></div>`).join('')}
          </div>
          <strong>${s.enemyCount} cards</strong>
        </div>

        <div class="durak-meta compact-meta">
          <div><span>Deck</span><strong>${s.deckCount}</strong></div>
          <div><span>Trump</span><strong>${trumpSymbol}</strong></div>
          <div><span>Role</span><strong>${s.role}</strong></div>
        </div>
      </div>

      <div class="durak-table online-table">
        ${Array.from({ length: 6 }, (_, i) => durakPairHtml(s.table[i])).join('')}
      </div>

      <div class="hand-zone online-hand-zone">
        <div class="hand-title-row">
          <h3>Your cards</h3>
          <span>${canAct ? 'Choose a highlighted card' : s.over ? 'Game finished' : 'Wait for your turn'}</span>
        </div>
        <div class="card-hand online-card-hand">
          ${s.hand.map((card, index) => durakCardHtml(card, false, durakCardIsLegal(card, s, isAttacker, canAct, tableRanks), index)).join('')}
        </div>
      </div>
    </div>
  `;

  const doneDisabled = !(canAct && isAttacker && allDefended);
  const takeDisabled = !(canAct && !isAttacker && s.table.length > 0);

  controls.innerHTML = s.over ? endControlsHtml(room) : `
    <button class="btn secondary small" id="doneBtn" ${doneDisabled ? 'disabled' : ''}>Beat / Done</button>
    <button class="btn danger small" id="takeBtn" ${takeDisabled ? 'disabled' : ''}>Take</button>
  `;

  gameBoard.querySelectorAll('[data-card-id]').forEach((el) => {
    el.addEventListener('click', () => {
      if (el.classList.contains('disabled')) return showToast('This card is not playable now.');
      const type = isAttacker ? 'attack' : 'defend';
      socket.emit('gameAction', { type, cardId: el.dataset.cardId });
    });
  });

  if (s.over) {
    bindEndControls();
    return;
  }

  $('doneBtn').onclick = () => socket.emit('gameAction', { type: 'done' });
  $('takeBtn').onclick = () => socket.emit('gameAction', { type: 'take' });
}

function durakRanksOnTable(table) {
  const ranks = [];
  table.forEach((pair) => {
    if (pair?.attack) ranks.push(pair.attack.rank);
    if (pair?.defense) ranks.push(pair.defense.rank);
  });
  return ranks;
}

function durakCardIsLegal(card, s, isAttacker, canAct, tableRanks) {
  if (!canAct) return false;
  if (isAttacker) {
    if (s.table.length >= 6) return false;
    if (s.table.length === 0) return true;
    return tableRanks.includes(card.rank);
  }
  const target = s.table.find((p) => !p.defense);
  return Boolean(target && durakCanBeat(card, target.attack, s.trump));
}

function durakCanBeat(card, attack, trump) {
  if (card.suit === attack.suit && card.value > attack.value) return true;
  return card.suit === trump && attack.suit !== trump;
}

function durakPairHtml(pair) {
  if (!pair) {
    return `
      <div class="durak-pair empty-pair">
        <div class="card-placeholder">attack</div>
        <div class="card-placeholder">defense</div>
      </div>
    `;
  }
  return `
    <div class="durak-pair active-pair">
      ${durakCardHtml(pair.attack, true, true)}
      ${pair.defense ? durakCardHtml(pair.defense, true, true) : '<div class="card-placeholder defense-wait">defense</div>'}
    </div>
  `;
}

function durakCardHtml(card, small = false, legal = true, index = 0) {
  const cls = [
    'playing-card',
    'durak-card',
    card.color === 'red' ? 'red' : 'black',
    small ? 'small-card table-card' : 'hand-playing-card',
    legal ? 'legal-card' : 'disabled'
  ].filter(Boolean).join(' ');

  const suitName = {
    spades: 'spades', clubs: 'clubs', diamonds: 'diamonds', hearts: 'hearts'
  }[card.suit] || 'card';

  return `
    <button class="${cls}" data-card-id="${card.id}" style="--i:${index}">
      <span class="corner top-corner"><b>${card.rank}</b><em>${card.symbol}</em></span>
      <span class="card-center-symbol">${card.symbol}</span>
      <span class="corner bottom-corner"><b>${card.rank}</b><em>${card.symbol}</em></span>
      <span class="card-name">${card.rank} of ${suitName}</span>
    </button>
  `;
}

function suitSymbol(suit) {
  return { spades: '♠', clubs: '♣', diamonds: '♦', hearts: '♥' }[suit] || '?';
}

/* CHESS */
const chessPieces = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚'
};

function renderChess(room) {
  const s = room.state;
  const flipped = room.player === 'p2';
  const legalForSelected = selected?.game === 'chess'
    ? s.legal.filter((m) => m.from === selected.square)
    : [];

  gameBoard.className = 'game-board board-wrap';
  gameBoard.innerHTML = `
    <div class="board-label">${s.yourColor.toUpperCase()} • ${s.turn === room.player ? 'Your move' : 'Opponent move'}</div>
    <div class="board-frame">
      <div class="chess-board">
        ${renderBoardSquares({ board: s.board, flipped, type: 'chess', legalForSelected, player: room.player, turn: s.turn })}
      </div>
    </div>
  `;

  controls.innerHTML = s.over ? endControlsHtml(room) : `<button class="btn secondary small" id="clearSelect">Clear selection</button>`;
  gameBoard.querySelectorAll('[data-square]').forEach((el) => {
    el.addEventListener('click', () => chessClick(el.dataset.square));
  });
  if (s.over) {
    bindEndControls();
  } else {
    $('clearSelect').onclick = () => { selected = null; renderChess(room); };
  }
}

function renderBoardSquares({ board, flipped, type, legalForSelected, player, turn }) {
  const squares = [];
  for (let viewR = 0; viewR < 8; viewR++) {
    for (let viewC = 0; viewC < 8; viewC++) {
      const r = flipped ? 7 - viewR : viewR;
      const c = flipped ? 7 - viewC : viewC;
      const file = 'abcdefgh'[c];
      const rank = 8 - r;
      const sq = `${file}${rank}`;
      const piece = board[r][c];
      const selectedClass = selected?.game === 'chess' && selected.square === sq ? 'selected' : '';
      const legalMove = legalForSelected.find((m) => m.to === sq);
      const legalClass = legalMove ? (legalMove.captured ? 'capture' : 'legal') : '';
      const color = (r + c) % 2 === 0 ? 'light' : 'dark';
      const pieceHtml = piece ? `<span class="piece ${piece.color === 'w' ? 'white' : 'black'}">${chessPieces[piece.color + piece.type]}</span>` : '';
      squares.push(`<div class="square ${color} ${selectedClass} ${legalClass}" data-square="${sq}">${pieceHtml}<span class="coords">${sq}</span></div>`);
    }
  }
  return squares.join('');
}

function chessClick(square) {
  if (!currentRoom || currentRoom.game !== 'chess') return;
  const s = currentRoom.state;
  if (s.over) return;
  if (s.turn !== currentRoom.player) return showToast('Not your turn.');

  const piece = chessPieceAt(s.board, square);
  const myColor = currentRoom.player === 'p1' ? 'w' : 'b';
  const isMyPiece = piece && piece.color === myColor;

  if (!selected || selected.game !== 'chess') {
    if (!isMyPiece) return showToast('Choose one of your own pieces.');
    const legal = s.legal.filter((m) => m.from === square);
    if (!legal.length) return showToast('This piece has no legal moves.');
    selected = { game: 'chess', square };
    renderChess(currentRoom);
    return;
  }

  if (selected.square === square) {
    selected = null;
    renderChess(currentRoom);
    return;
  }

  const legalMove = s.legal.find((m) => m.from === selected.square && m.to === square);
  if (legalMove) {
    socket.emit('gameAction', { from: selected.square, to: square, promotion: 'q' });
    selected = null;
    return;
  }

  if (isMyPiece) {
    const legal = s.legal.filter((m) => m.from === square);
    selected = legal.length ? { game: 'chess', square } : null;
    renderChess(currentRoom);
    return;
  }

  selected = null;
  renderChess(currentRoom);
}

function chessPieceAt(board, square) {
  const file = square[0];
  const rank = Number(square[1]);
  const c = 'abcdefgh'.indexOf(file);
  const r = 8 - rank;
  return board[r]?.[c] || null;
}

/* CHECKERS */
function renderCheckers(room) {
  const s = room.state;
  const flipped = room.player === 'p2';
  const legalMoves = clientCheckersMoves(s.board, room.player);
  const selectedMoves = selected?.game === 'checkers'
    ? legalMoves.filter((m) => samePos(m.from, selected))
    : [];

  gameBoard.className = 'game-board board-wrap';
  gameBoard.innerHTML = `
    <div class="board-label">${s.yourSide.toUpperCase()} • ${s.turn === room.player ? 'Your move' : 'Opponent move'}</div>
    <div class="board-frame">
      <div class="checkers-board">
        ${renderCheckersSquares(s.board, flipped, selectedMoves)}
      </div>
    </div>
  `;

  controls.innerHTML = s.over ? endControlsHtml(room) : `<button class="btn secondary small" id="clearSelect">Clear selection</button>`;
  gameBoard.querySelectorAll('[data-r]').forEach((el) => {
    el.addEventListener('click', () => checkersClick(Number(el.dataset.r), Number(el.dataset.c)));
  });
  if (s.over) {
    bindEndControls();
  } else {
    $('clearSelect').onclick = () => { selected = null; renderCheckers(room); };
  }
}

function renderCheckersSquares(board, flipped, selectedMoves) {
  const squares = [];
  for (let viewR = 0; viewR < 8; viewR++) {
    for (let viewC = 0; viewC < 8; viewC++) {
      const r = flipped ? 7 - viewR : viewR;
      const c = flipped ? 7 - viewC : viewC;
      const piece = board[r][c];
      const selectedClass = selected?.game === 'checkers' && selected.r === r && selected.c === c ? 'selected' : '';
      const targetMove = selectedMoves.find((m) => m.to.r === r && m.to.c === c);
      const legalClass = targetMove ? (targetMove.capture ? 'capture' : 'legal') : '';
      const color = (r + c) % 2 === 0 ? 'light' : 'dark';
      const pieceHtml = piece ? `<span class="checker ${piece.owner === 'p1' ? 'red' : 'black'} ${piece.king ? 'king' : ''}"></span>` : '';
      squares.push(`<div class="square ${color} ${selectedClass} ${legalClass}" data-r="${r}" data-c="${c}">${pieceHtml}</div>`);
    }
  }
  return squares.join('');
}

function checkersClick(r, c) {
  if (!currentRoom || currentRoom.game !== 'checkers') return;
  const s = currentRoom.state;
  if (s.over) return;
  if (s.turn !== currentRoom.player) return showToast('Not your turn.');

  const piece = s.board[r][c];
  const legalMoves = clientCheckersMoves(s.board, currentRoom.player);

  if (!selected || selected.game !== 'checkers') {
    if (!piece || piece.owner !== currentRoom.player) return showToast('Choose one of your own checkers.');
    const moves = legalMoves.filter((m) => m.from.r === r && m.from.c === c);
    if (!moves.length) return showToast('This checker has no legal moves.');
    selected = { game: 'checkers', r, c };
    renderCheckers(currentRoom);
    return;
  }

  if (selected.r === r && selected.c === c) {
    selected = null;
    renderCheckers(currentRoom);
    return;
  }

  const move = legalMoves.find((m) => samePos(m.from, selected) && samePos(m.to, { r, c }));
  if (move) {
    socket.emit('gameAction', { from: { r: selected.r, c: selected.c }, to: { r, c } });
    selected = null;
    return;
  }

  if (piece && piece.owner === currentRoom.player) {
    const moves = legalMoves.filter((m) => m.from.r === r && m.from.c === c);
    selected = moves.length ? { game: 'checkers', r, c } : null;
    renderCheckers(currentRoom);
    return;
  }

  selected = null;
  renderCheckers(currentRoom);
}

function inBoard(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function samePos(a, b) {
  return a && b && a.r === b.r && a.c === b.c;
}

function clientCheckersMoves(board, player) {
  const moves = [];
  const captures = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.owner !== player) continue;

      const dirs = piece.king
        ? [[1,1],[1,-1],[-1,1],[-1,-1]]
        : (player === 'p1' ? [[-1,1],[-1,-1]] : [[1,1],[1,-1]]);

      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        const jr = r + dr * 2;
        const jc = c + dc * 2;

        if (inBoard(nr, nc) && !board[nr][nc]) {
          moves.push({ from: { r, c }, to: { r: nr, c: nc } });
        }

        if (inBoard(jr, jc) && board[nr]?.[nc] && board[nr][nc].owner !== player && !board[jr][jc]) {
          captures.push({ from: { r, c }, to: { r: jr, c: jc }, capture: { r: nr, c: nc } });
        }
      }
    }
  }

  return captures.length ? captures : moves;
}
