const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

const rooms = new Map();
const socketRoom = new Map();
const PLAYER_ONE = 'p1';
const PLAYER_TWO = 'p2';

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function otherPlayer(player) {
  return player === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
}

function publicRoom(room, player) {
  const base = {
    code: room.code,
    game: room.game,
    mode: room.mode,
    player,
    playerCount: Object.values(room.players).filter(Boolean).length,
    ready: room.mode === 'bot' || Object.values(room.players).filter(Boolean).length >= 2,
    message: room.message || ''
  };

  if (room.game === 'durak') return { ...base, state: publicDurak(room, player) };
  if (room.game === 'chess') return { ...base, state: publicChess(room, player) };
  if (room.game === 'checkers') return { ...base, state: publicCheckers(room, player) };
  return base;
}

function emitRoom(room) {
  for (const [player, socketId] of Object.entries(room.players)) {
    if (socketId) io.to(socketId).emit('roomState', publicRoom(room, player));
  }
}

function emitError(socket, text) {
  socket.emit('errorMessage', text);
}

function createRoom(socket, { game, mode }) {
  if (!['durak', 'chess', 'checkers'].includes(game)) {
    emitError(socket, 'Unknown game.');
    return;
  }

  const code = makeCode();
  const room = {
    code,
    game,
    mode: mode === 'friend' ? 'friend' : 'bot',
    players: { [PLAYER_ONE]: socket.id, [PLAYER_TWO]: mode === 'friend' ? null : 'BOT' },
    message: ''
  };

  if (game === 'durak') room.durak = initDurak();
  if (game === 'chess') room.chess = initChess();
  if (game === 'checkers') room.checkers = initCheckers();

  rooms.set(code, room);
  socket.join(code);
  socketRoom.set(socket.id, { code, player: PLAYER_ONE });
  socket.emit('roomCreated', { code });
  emitRoom(room);

  if (room.mode === 'bot' && game === 'chess' && room.chess.turn === PLAYER_TWO) scheduleBot(room);
  if (room.mode === 'bot' && game === 'checkers' && room.checkers.turn === PLAYER_TWO) scheduleBot(room);
  if (room.mode === 'bot' && game === 'durak' && room.durak.attacker === PLAYER_TWO) scheduleBot(room);
}

function joinRoom(socket, { code }) {
  const room = rooms.get(String(code || '').trim().toUpperCase());
  if (!room) {
    emitError(socket, 'Room not found.');
    return;
  }

  if (room.mode !== 'friend') {
    emitError(socket, 'This room is for bot mode. Create a friend room instead.');
    return;
  }

  if (room.players[PLAYER_TWO] && room.players[PLAYER_TWO] !== socket.id) {
    emitError(socket, 'Room is already full.');
    return;
  }

  room.players[PLAYER_TWO] = socket.id;
  socket.join(room.code);
  socketRoom.set(socket.id, { code: room.code, player: PLAYER_TWO });
  room.message = 'Second player joined.';
  emitRoom(room);
}

function restartRoom(socket) {
  const joined = socketRoom.get(socket.id);
  if (!joined) { emitError(socket, 'You are not in a room.'); return; }
  const room = rooms.get(joined.code);
  if (!room) { emitError(socket, 'Room disappeared.'); return; }

  if (room.game === 'durak') room.durak = initDurak();
  if (room.game === 'chess') room.chess = initChess();
  if (room.game === 'checkers') room.checkers = initCheckers();

  room.message = 'Game restarted.';
  emitRoom(room);

  if (room.mode === 'bot' && room.game === 'chess' && room.chess.turn === PLAYER_TWO) scheduleBot(room);
  if (room.mode === 'bot' && room.game === 'checkers' && room.checkers.turn === PLAYER_TWO) scheduleBot(room);
  if (room.mode === 'bot' && room.game === 'durak' && room.durak.attacker === PLAYER_TWO) scheduleBot(room);
}

function leaveSocket(socket) {
  const joined = socketRoom.get(socket.id);
  if (!joined) return;

  const room = rooms.get(joined.code);
  if (!room) return;

  if (room.players[PLAYER_ONE] === socket.id) room.players[PLAYER_ONE] = null;
  if (room.players[PLAYER_TWO] === socket.id) room.players[PLAYER_TWO] = room.mode === 'bot' ? 'BOT' : null;
  socketRoom.delete(socket.id);

  if (!room.players[PLAYER_ONE] && (!room.players[PLAYER_TWO] || room.players[PLAYER_TWO] === 'BOT')) {
    rooms.delete(room.code);
  } else {
    room.message = 'Opponent disconnected.';
    emitRoom(room);
  }
}

/* DURAK */
const DURAK_SUITS = [
  { key: 'spades', symbol: '♠', color: 'black' },
  { key: 'clubs', symbol: '♣', color: 'black' },
  { key: 'diamonds', symbol: '♦', color: 'red' },
  { key: 'hearts', symbol: '♥', color: 'red' }
];
const DURAK_RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function initDurak() {
  let id = 0;
  const deck = shuffle(DURAK_SUITS.flatMap((suit) => DURAK_RANKS.map((rank, value) => ({
    id: `d${id++}`,
    suit: suit.key,
    symbol: suit.symbol,
    color: suit.color,
    rank,
    value
  }))));
  const trump = deck[deck.length - 1].suit;
  const hands = { [PLAYER_ONE]: [], [PLAYER_TWO]: [] };
  for (let i = 0; i < 6; i++) {
    hands[PLAYER_ONE].push(deck.shift());
    hands[PLAYER_TWO].push(deck.shift());
  }
  sortDurakHand(hands[PLAYER_ONE], trump);
  sortDurakHand(hands[PLAYER_TWO], trump);
  return {
    deck,
    trump,
    hands,
    table: [],
    discard: [],
    attacker: PLAYER_ONE,
    defender: PLAYER_TWO,
    status: 'Your attack. Play any card.',
    over: false,
    winner: null
  };
}

function sortDurakHand(hand, trump) {
  hand.sort((a, b) => {
    const at = a.suit === trump ? 1 : 0;
    const bt = b.suit === trump ? 1 : 0;
    if (at !== bt) return at - bt;
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
    return a.value - b.value;
  });
}

function publicDurak(room, player) {
  const d = room.durak;
  return {
    hand: d.hands[player],
    enemyCount: d.hands[otherPlayer(player)].length,
    deckCount: d.deck.length,
    trump: d.trump,
    trumpCard: d.deck[d.deck.length - 1] || null,
    table: d.table,
    attacker: d.attacker,
    defender: d.defender,
    yourTurn: !d.over && ((d.attacker === player) || (d.defender === player && d.table.some((p) => !p.defense))),
    status: d.status,
    over: d.over,
    winner: d.winner,
    role: d.attacker === player ? 'Attacker' : 'Defender'
  };
}

function durakRanksOnTable(d) {
  const ranks = [];
  d.table.forEach((pair) => {
    ranks.push(pair.attack.rank);
    if (pair.defense) ranks.push(pair.defense.rank);
  });
  return ranks;
}

function durakCanBeat(card, attack, trump) {
  if (card.suit === attack.suit && card.value > attack.value) return true;
  return card.suit === trump && attack.suit !== trump;
}

function findCard(hand, cardId) {
  const index = hand.findIndex((card) => card.id === cardId);
  if (index < 0) return null;
  return hand.splice(index, 1)[0];
}

function durakAction(room, player, action) {
  const d = room.durak;
  if (d.over) return;
  if (room.mode === 'friend' && Object.values(room.players).filter(Boolean).length < 2) {
    d.status = 'Waiting for your friend to join.';
    return;
  }

  if (action.type === 'attack') {
    if (player !== d.attacker) return;
    const hand = d.hands[player];
    const card = hand.find((c) => c.id === action.cardId);
    if (!card) return;
    const ranks = durakRanksOnTable(d);
    if (d.table.length >= 6) { d.status = 'Table is full. Press Beat / Done.'; return; }
    if (d.table.length > 0 && !ranks.includes(card.rank)) { d.status = 'Attack card rank must already be on table.'; return; }
    const removed = findCard(hand, action.cardId);
    d.table.push({ attack: removed, defense: null });
    d.status = `${player === PLAYER_ONE ? 'Player 1' : 'Player 2'} attacked with ${removed.rank}${removed.symbol}.`;
    if (room.mode === 'bot' && d.defender === PLAYER_TWO) scheduleBot(room);
  }

  if (action.type === 'defend') {
    if (player !== d.defender) return;
    const target = d.table.find((p) => !p.defense);
    if (!target) return;
    const hand = d.hands[player];
    const card = hand.find((c) => c.id === action.cardId);
    if (!card || !durakCanBeat(card, target.attack, d.trump)) { d.status = 'That card cannot defend.'; return; }
    target.defense = findCard(hand, action.cardId);
    d.status = 'Defense accepted. Attacker can add more or beat.';
    if (room.mode === 'bot' && d.attacker === PLAYER_TWO) scheduleBot(room);
  }

  if (action.type === 'take') {
    if (player !== d.defender) return;
    durakTake(d, player);
  }

  if (action.type === 'done') {
    if (player !== d.attacker) return;
    if (d.table.length === 0 || d.table.some((p) => !p.defense)) { d.status = 'All attack cards must be defended first.'; return; }
    durakBeat(d);
  }

  durakCheckOver(d);
  sortDurakHand(d.hands[PLAYER_ONE], d.trump);
  sortDurakHand(d.hands[PLAYER_TWO], d.trump);
}

function durakDrawToSix(d) {
  const first = d.attacker;
  const second = d.defender;
  [first, second].forEach((p) => {
    while (d.hands[p].length < 6 && d.deck.length) d.hands[p].push(d.deck.shift());
  });
}

function durakTake(d, player) {
  const cards = d.table.flatMap((p) => [p.attack, p.defense]).filter(Boolean);
  d.hands[player].push(...cards);
  d.table = [];
  d.status = `${player === PLAYER_ONE ? 'Player 1' : 'Player 2'} took the cards.`;
  durakDrawToSix(d);
}

function durakBeat(d) {
  d.discard.push(...d.table.flatMap((p) => [p.attack, p.defense]).filter(Boolean));
  d.table = [];
  const oldDefender = d.defender;
  d.attacker = oldDefender;
  d.defender = otherPlayer(d.attacker);
  d.status = 'Table beaten. Roles changed.';
  durakDrawToSix(d);
}

function durakCheckOver(d) {
  if (d.deck.length > 0 || d.table.length > 0) return;
  if (d.hands[PLAYER_ONE].length === 0 && d.hands[PLAYER_TWO].length === 0) { d.over = true; d.winner = 'draw'; return; }
  if (d.hands[PLAYER_ONE].length === 0) { d.over = true; d.winner = PLAYER_ONE; return; }
  if (d.hands[PLAYER_TWO].length === 0) { d.over = true; d.winner = PLAYER_TWO; }
}

function durakBot(room) {
  const d = room.durak;
  if (d.over) return;
  if (d.defender === PLAYER_TWO) {
    const target = d.table.find((p) => !p.defense);
    if (!target) return;
    const options = d.hands[PLAYER_TWO].filter((c) => durakCanBeat(c, target.attack, d.trump)).sort((a, b) => (a.suit === d.trump) - (b.suit === d.trump) || a.value - b.value);
    if (!options.length) durakTake(d, PLAYER_TWO);
    else target.defense = findCard(d.hands[PLAYER_TWO], options[0].id);
  } else if (d.attacker === PLAYER_TWO) {
    if (d.table.length === 0) {
      const card = [...d.hands[PLAYER_TWO]].sort((a, b) => (a.suit === d.trump) - (b.suit === d.trump) || a.value - b.value)[0];
      if (card) d.table.push({ attack: findCard(d.hands[PLAYER_TWO], card.id), defense: null });
    } else if (d.table.every((p) => p.defense)) {
      const ranks = durakRanksOnTable(d);
      const add = d.hands[PLAYER_TWO].filter((c) => ranks.includes(c.rank)).sort((a, b) => a.value - b.value)[0];
      if (add && d.table.length < 4) d.table.push({ attack: findCard(d.hands[PLAYER_TWO], add.id), defense: null });
      else durakBeat(d);
    }
  }
  durakCheckOver(d);
  sortDurakHand(d.hands[PLAYER_ONE], d.trump);
  sortDurakHand(d.hands[PLAYER_TWO], d.trump);
}

/* CHESS */
function initChess() {
  return { chess: new Chess(), turn: PLAYER_ONE, over: false, winner: null, status: 'White to move.' };
}

function publicChess(room, player) {
  const c = room.chess;
  return {
    fen: c.chess.fen(),
    board: c.chess.board(),
    turn: c.chess.turn() === 'w' ? PLAYER_ONE : PLAYER_TWO,
    yourColor: player === PLAYER_ONE ? 'white' : 'black',
    legal: c.chess.moves({ verbose: true }).map((m) => ({ from: m.from, to: m.to, san: m.san })),
    status: c.status,
    over: c.over,
    winner: c.winner
  };
}

function chessAction(room, player, action) {
  const c = room.chess;
  if (c.over) return;
  const turnPlayer = c.chess.turn() === 'w' ? PLAYER_ONE : PLAYER_TWO;
  if (player !== turnPlayer) { c.status = 'Not your turn.'; return; }
  const move = c.chess.move({ from: action.from, to: action.to, promotion: action.promotion || 'q' });
  if (!move) { c.status = 'Illegal chess move.'; return; }
  c.status = `${move.color === 'w' ? 'White' : 'Black'} played ${move.san}.`;
  chessCheckOver(c);
  if (!c.over && room.mode === 'bot') scheduleBot(room);
}

function chessCheckOver(c) {
  if (c.chess.isCheckmate()) {
    c.over = true;
    c.winner = c.chess.turn() === 'w' ? PLAYER_TWO : PLAYER_ONE;
    c.status = 'Checkmate.';
  } else if (c.chess.isDraw() || c.chess.isStalemate()) {
    c.over = true;
    c.winner = 'draw';
    c.status = 'Draw.';
  } else if (c.chess.isCheck()) {
    c.status += ' Check.';
  }
}

function chessBot(room) {
  const c = room.chess;
  if (c.over) return;
  if ((c.chess.turn() === 'b' ? PLAYER_TWO : PLAYER_ONE) !== PLAYER_TWO) return;
  const moves = c.chess.moves({ verbose: true });
  if (!moves.length) return;
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };
  const scored = moves.map((m) => {
    let score = Math.random();
    if (m.captured) score += values[m.captured] * 10;
    if (m.san.includes('+')) score += 4;
    if (m.san.includes('#')) score += 999;
    if (['e4','d4','e5','d5','c4','f4','c5','f5'].includes(m.to)) score += 1.2;
    return { move: m, score };
  }).sort((a, b) => b.score - a.score);
  const chosen = scored[0].move;
  c.chess.move({ from: chosen.from, to: chosen.to, promotion: chosen.promotion || 'q' });
  c.status = `Bot played ${chosen.san}.`;
  chessCheckOver(c);
}

/* CHECKERS */
function initCheckers() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  let id = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) board[r][c] = { id: `b${id++}`, owner: PLAYER_TWO, king: false };
  for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) board[r][c] = { id: `r${id++}`, owner: PLAYER_ONE, king: false };
  return { board, turn: PLAYER_ONE, over: false, winner: null, status: 'Red to move.' };
}

function publicCheckers(room, player) {
  const c = room.checkers;
  return { board: c.board, turn: c.turn, yourSide: player === PLAYER_ONE ? 'red' : 'black', status: c.status, over: c.over, winner: c.winner };
}

function inBoard(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

function checkersMoves(state, player) {
  const moves = [];
  const captures = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const piece = state.board[r][c];
    if (!piece || piece.owner !== player) continue;
    const dirs = piece.king ? [[1,1],[1,-1],[-1,1],[-1,-1]] : (player === PLAYER_ONE ? [[-1,1],[-1,-1]] : [[1,1],[1,-1]]);
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (inBoard(nr, nc) && !state.board[nr][nc]) moves.push({ from: { r, c }, to: { r: nr, c: nc } });
      const jr = r + dr * 2, jc = c + dc * 2;
      if (inBoard(jr, jc) && state.board[nr]?.[nc] && state.board[nr][nc].owner !== player && !state.board[jr][jc]) captures.push({ from: { r, c }, to: { r: jr, c: jc }, capture: { r: nr, c: nc } });
    }
  }
  return captures.length ? captures : moves;
}

function samePos(a, b) { return a && b && a.r === b.r && a.c === b.c; }

function checkersAction(room, player, action) {
  const c = room.checkers;
  if (c.over) return;
  if (c.turn !== player) { c.status = 'Not your turn.'; return; }
  const legal = checkersMoves(c, player);
  const move = legal.find((m) => samePos(m.from, action.from) && samePos(m.to, action.to));
  if (!move) { c.status = 'Illegal checkers move.'; return; }
  applyCheckersMove(c, move);
  checkersCheckOver(c);
  if (!c.over && room.mode === 'bot') scheduleBot(room);
}

function applyCheckersMove(c, move) {
  const piece = c.board[move.from.r][move.from.c];
  c.board[move.from.r][move.from.c] = null;
  c.board[move.to.r][move.to.c] = piece;
  if (move.capture) c.board[move.capture.r][move.capture.c] = null;
  if (piece.owner === PLAYER_ONE && move.to.r === 0) piece.king = true;
  if (piece.owner === PLAYER_TWO && move.to.r === 7) piece.king = true;
  c.turn = otherPlayer(c.turn);
  c.status = `${piece.owner === PLAYER_ONE ? 'Red' : 'Black'} moved.`;
}

function checkersCheckOver(c) {
  const p1 = c.board.flat().some((p) => p && p.owner === PLAYER_ONE);
  const p2 = c.board.flat().some((p) => p && p.owner === PLAYER_TWO);
  if (!p1) { c.over = true; c.winner = PLAYER_TWO; c.status = 'Black wins.'; return; }
  if (!p2) { c.over = true; c.winner = PLAYER_ONE; c.status = 'Red wins.'; return; }
  if (!checkersMoves(c, c.turn).length) { c.over = true; c.winner = otherPlayer(c.turn); c.status = 'No legal moves.'; }
}

function checkersBot(room) {
  const c = room.checkers;
  if (c.over || c.turn !== PLAYER_TWO) return;
  const legal = checkersMoves(c, PLAYER_TWO);
  if (!legal.length) return;
  const captures = legal.filter((m) => m.capture);
  const pool = captures.length ? captures : legal;
  applyCheckersMove(c, pool[Math.floor(Math.random() * pool.length)]);
  checkersCheckOver(c);
}

function scheduleBot(room) {
  if (room.mode !== 'bot') return;
  setTimeout(() => {
    if (!rooms.has(room.code)) return;
    if (room.game === 'durak') durakBot(room);
    if (room.game === 'chess') chessBot(room);
    if (room.game === 'checkers') checkersBot(room);
    emitRoom(room);
  }, 500 + Math.floor(Math.random() * 450));
}

io.on('connection', (socket) => {
  socket.emit('connected', { ok: true });

  socket.on('createRoom', (data) => createRoom(socket, data || {}));
  socket.on('joinRoom', (data) => joinRoom(socket, data || {}));
  socket.on('restartRoom', () => restartRoom(socket));

  socket.on('gameAction', (action) => {
    const joined = socketRoom.get(socket.id);
    if (!joined) { emitError(socket, 'You are not in a room.'); return; }
    const room = rooms.get(joined.code);
    if (!room) { emitError(socket, 'Room disappeared.'); return; }
    if (room.game === 'durak') durakAction(room, joined.player, action || {});
    if (room.game === 'chess') chessAction(room, joined.player, action || {});
    if (room.game === 'checkers') checkersAction(room, joined.player, action || {});
    emitRoom(room);
  });

  socket.on('disconnect', () => leaveSocket(socket));
});

server.listen(PORT, () => {
  console.log(`Arcade Duel running on http://localhost:${PORT}`);
});
