const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const rooms = new Map();

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
  });
}

function token() {
  return crypto.randomBytes(16).toString('hex');
}

function roomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 5; i++) code += letters[Math.floor(Math.random() * letters.length)];
  } while (rooms.has(code));
  return code;
}

function cleanupRooms() {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > 1000 * 60 * 60 * 8) rooms.delete(code);
  }
}

setInterval(cleanupRooms, 1000 * 60 * 15);

const suits = [
  { key: 'spades', symbol: '♠', name: 'Spades', color: 'black' },
  { key: 'clubs', symbol: '♣', name: 'Clubs', color: 'black' },
  { key: 'diamonds', symbol: '♦', name: 'Diamonds', color: 'red' },
  { key: 'hearts', symbol: '♥', name: 'Hearts', color: 'red' }
];
const ranks = [
  { key: '6', label: '6', value: 6, name: 'Six' },
  { key: '7', label: '7', value: 7, name: 'Seven' },
  { key: '8', label: '8', value: 8, name: 'Eight' },
  { key: '9', label: '9', value: 9, name: 'Nine' },
  { key: '10', label: '10', value: 10, name: 'Ten' },
  { key: 'J', label: 'J', value: 11, name: 'Jack' },
  { key: 'Q', label: 'Q', value: 12, name: 'Queen' },
  { key: 'K', label: 'K', value: 13, name: 'King' },
  { key: 'A', label: 'A', value: 14, name: 'Ace' }
];

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createDurakDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        id: `${rank.key}-${suit.key}-${crypto.randomBytes(2).toString('hex')}`,
        rank: rank.key,
        rankLabel: rank.label,
        rankValue: rank.value,
        rankName: rank.name,
        suit: suit.key,
        suitName: suit.name,
        suitSymbol: suit.symbol,
        color: suit.color,
        fullName: `${rank.name} of ${suit.name}`
      });
    }
  }
  return shuffle(deck);
}

function sortCards(cards, trumpSuit) {
  return [...cards].sort((a, b) => {
    const aTrump = a.suit === trumpSuit ? 1 : 0;
    const bTrump = b.suit === trumpSuit ? 1 : 0;
    if (aTrump !== bTrump) return aTrump - bTrump;
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
    return a.rankValue - b.rankValue;
  });
}

function cardBeats(defense, attack, trumpSuit) {
  if (!defense || !attack) return false;
  if (defense.suit === attack.suit && defense.rankValue > attack.rankValue) return true;
  if (defense.suit === trumpSuit && attack.suit !== trumpSuit) return true;
  return false;
}

function createDurakState() {
  const deck = createDurakDeck();
  const trumpCard = deck[deck.length - 1];
  const trumpSuit = trumpCard.suit;
  const hands = [[], []];
  for (let i = 0; i < 6; i++) {
    hands[0].push(deck.shift());
    hands[1].push(deck.shift());
  }
  hands[0] = sortCards(hands[0], trumpSuit);
  hands[1] = sortCards(hands[1], trumpSuit);
  const attacker = chooseFirstDurakAttacker(hands, trumpSuit);
  return {
    kind: 'durak',
    deck,
    trumpCard,
    trumpSuit,
    hands,
    battlefield: [],
    discard: [],
    attacker,
    defender: attacker === 0 ? 1 : 0,
    phase: 'attack',
    round: 1,
    winner: null,
    message: attacker === 0 ? 'Your attack. Choose a card.' : 'Opponent starts the attack.',
    cheatLocked: [false, false]
  };
}

function chooseFirstDurakAttacker(hands, trumpSuit) {
  function low(hand) {
    const trumpCards = hand.filter((c) => c.suit === trumpSuit);
    if (!trumpCards.length) return null;
    return Math.min(...trumpCards.map((c) => c.rankValue));
  }
  const a = low(hands[0]);
  const b = low(hands[1]);
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return 0;
  return a <= b ? 0 : 1;
}

function durakRanksOnTable(state) {
  const set = new Set();
  for (const pair of state.battlefield) {
    set.add(pair.attack.rank);
    if (pair.defense) set.add(pair.defense.rank);
  }
  return set;
}

function durakAllDefended(state) {
  return state.battlefield.length > 0 && state.battlefield.every((pair) => pair.defense);
}

function durakFirstUndefended(state) {
  return state.battlefield.find((pair) => !pair.defense);
}

function canDurakAttackWith(state, card) {
  if (state.battlefield.length >= 6) return false;
  if (state.battlefield.length === 0) return true;
  return durakRanksOnTable(state).has(card.rank);
}

function fillDurakHand(state, index) {
  while (state.hands[index].length < 6 && state.deck.length > 0) {
    state.hands[index].push(state.deck.shift());
  }
  state.hands[index] = sortCards(state.hands[index], state.trumpSuit);
}

function checkDurakWinner(state) {
  if (state.deck.length > 0 || state.battlefield.length > 0) return;
  const a = state.hands[0].length;
  const b = state.hands[1].length;
  if (a === 0 && b === 0) state.winner = 'draw';
  else if (a === 0) state.winner = 0;
  else if (b === 0) state.winner = 1;
}

function finishDurakRound(state, beaten) {
  if (beaten) {
    state.discard.push(...state.battlefield.flatMap((p) => [p.attack, p.defense]).filter(Boolean));
    state.battlefield = [];
    const oldAttacker = state.attacker;
    const oldDefender = state.defender;
    fillDurakHand(state, oldAttacker);
    fillDurakHand(state, oldDefender);
    state.attacker = oldDefender;
    state.defender = oldAttacker;
    state.phase = 'attack';
    state.round += 1;
    state.message = 'Table beaten. Defender attacks next.';
  } else {
    const cards = state.battlefield.flatMap((p) => [p.attack, p.defense]).filter(Boolean);
    state.hands[state.defender].push(...cards);
    state.battlefield = [];
    fillDurakHand(state, state.attacker);
    fillDurakHand(state, state.defender);
    state.hands[state.defender] = sortCards(state.hands[state.defender], state.trumpSuit);
    state.phase = 'attack';
    state.round += 1;
    state.message = 'Defender took the cards. Attacker continues.';
  }
  checkDurakWinner(state);
}

function applyDurakAction(room, playerIndex, action) {
  const state = room.state;
  if (state.winner !== null) return { ok: false, message: 'Game is already over.' };

  if (action.type === 'cheatPeek') {
    if (state.cheatLocked[playerIndex]) return { ok: false, message: 'You were caught. Cheat Peek is locked.' };
    const opponent = playerIndex === 0 ? 1 : 0;
    const cards = state.hands[opponent].map((c) => ({ ...c }));
    const trapIndex = cards.length ? Math.floor(Math.random() * cards.length) : -1;
    return { ok: true, cheatView: { cards, trapIndex } };
  }

  if (action.type === 'cheatCaught') {
    state.cheatLocked[playerIndex] = true;
    state.message = `${room.players[playerIndex]?.name || 'Player'} was caught cheating.`;
    return { ok: true };
  }

  if (action.type === 'play') {
    const hand = state.hands[playerIndex];
    const cardIndex = Number(action.cardIndex);
    const card = hand[cardIndex];
    if (!card) return { ok: false, message: 'Card not found.' };

    if (playerIndex === state.attacker) {
      if (!canDurakAttackWith(state, card)) return { ok: false, message: 'You can only add a rank already on the table.' };
      hand.splice(cardIndex, 1);
      state.battlefield.push({ attack: card, defense: null });
      state.phase = 'defend';
      state.message = `${room.players[playerIndex].name} attacks with ${card.fullName}.`;
      return { ok: true };
    }

    if (playerIndex === state.defender) {
      const pair = durakFirstUndefended(state);
      if (!pair) return { ok: false, message: 'Nothing to defend.' };
      if (!cardBeats(card, pair.attack, state.trumpSuit)) return { ok: false, message: 'This card cannot beat the attack.' };
      hand.splice(cardIndex, 1);
      pair.defense = card;
      state.phase = durakAllDefended(state) ? 'attack' : 'defend';
      state.message = `${room.players[playerIndex].name} defends with ${card.fullName}.`;
      return { ok: true };
    }
  }

  if (action.type === 'take') {
    if (playerIndex !== state.defender || state.battlefield.length === 0) return { ok: false, message: 'You cannot take now.' };
    finishDurakRound(state, false);
    return { ok: true };
  }

  if (action.type === 'done') {
    if (playerIndex !== state.attacker || !durakAllDefended(state)) return { ok: false, message: 'You cannot finish now.' };
    finishDurakRound(state, true);
    return { ok: true };
  }

  return { ok: false, message: 'Unknown Durak action.' };
}

function durakBotAction(room) {
  const state = room.state;
  if (state.winner !== null) return false;
  const botIndex = room.players.findIndex((p) => p.isBot);
  if (botIndex === -1) return false;
  const hand = state.hands[botIndex];

  if (botIndex === state.defender && state.battlefield.some((p) => !p.defense)) {
    const pair = durakFirstUndefended(state);
    const options = hand.filter((card) => cardBeats(card, pair.attack, state.trumpSuit));
    if (!options.length) {
      finishDurakRound(state, false);
      return true;
    }
    const chosen = sortCards(options, state.trumpSuit)[0];
    const index = hand.findIndex((c) => c.id === chosen.id);
    applyDurakAction(room, botIndex, { type: 'play', cardIndex: index });
    return true;
  }

  if (botIndex === state.attacker) {
    const legal = hand.filter((card) => canDurakAttackWith(state, card));
    if (!legal.length) {
      if (durakAllDefended(state)) {
        finishDurakRound(state, true);
        return true;
      }
      return false;
    }
    if (state.battlefield.length > 0 && durakAllDefended(state) && Math.random() < 0.55) {
      finishDurakRound(state, true);
      return true;
    }
    const chosen = sortCards(legal, state.trumpSuit)[0];
    const index = hand.findIndex((c) => c.id === chosen.id);
    applyDurakAction(room, botIndex, { type: 'play', cardIndex: index });
    return true;
  }

  return false;
}

const chessPieces = {
  white: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
  black: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' }
};

function createChessState() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let c = 0; c < 8; c++) {
    board[0][c] = { color: 'black', type: back[c] };
    board[1][c] = { color: 'black', type: 'P' };
    board[6][c] = { color: 'white', type: 'P' };
    board[7][c] = { color: 'white', type: back[c] };
  }
  return { kind: 'chess', board, turn: 'white', winner: null, message: 'White moves first.' };
}

function inside(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function otherColor(color) { return color === 'white' ? 'black' : 'white'; }

function chessLegalMoves(state, color) {
  const moves = [];
  const b = state.board;
  const add = (from, to) => {
    if (!inside(to.r, to.c)) return;
    const target = b[to.r][to.c];
    if (!target || target.color !== color) moves.push({ from, to });
  };
  const slide = (from, dirs) => {
    for (const [dr, dc] of dirs) {
      let r = from.r + dr; let c = from.c + dc;
      while (inside(r, c)) {
        const target = b[r][c];
        if (!target) moves.push({ from, to: { r, c } });
        else {
          if (target.color !== color) moves.push({ from, to: { r, c } });
          break;
        }
        r += dr; c += dc;
      }
    }
  };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p || p.color !== color) continue;
      const from = { r, c };
      if (p.type === 'P') {
        const dir = color === 'white' ? -1 : 1;
        const start = color === 'white' ? 6 : 1;
        if (inside(r + dir, c) && !b[r + dir][c]) {
          moves.push({ from, to: { r: r + dir, c } });
          if (r === start && !b[r + dir * 2][c]) moves.push({ from, to: { r: r + dir * 2, c } });
        }
        for (const dc of [-1, 1]) {
          const tr = r + dir, tc = c + dc;
          if (inside(tr, tc) && b[tr][tc] && b[tr][tc].color !== color) moves.push({ from, to: { r: tr, c: tc } });
        }
      }
      if (p.type === 'N') {
        for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(from, { r: r + dr, c: c + dc });
      }
      if (p.type === 'B') slide(from, [[-1,-1],[-1,1],[1,-1],[1,1]]);
      if (p.type === 'R') slide(from, [[-1,0],[1,0],[0,-1],[0,1]]);
      if (p.type === 'Q') slide(from, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
      if (p.type === 'K') for (const dr of [-1,0,1]) for (const dc of [-1,0,1]) if (dr || dc) add(from, { r: r + dr, c: c + dc });
    }
  }
  return moves;
}

function sameMove(a, b) {
  return a.from.r === b.from.r && a.from.c === b.from.c && a.to.r === b.to.r && a.to.c === b.to.c;
}

function applyChessAction(room, playerIndex, action) {
  const state = room.state;
  if (state.winner !== null) return { ok: false, message: 'Game is over.' };
  const color = playerIndex === 0 ? 'white' : 'black';
  if (state.turn !== color) return { ok: false, message: 'Not your turn.' };
  if (action.type !== 'move') return { ok: false, message: 'Unknown chess action.' };
  const move = { from: action.from, to: action.to };
  const legal = chessLegalMoves(state, color).some((m) => sameMove(m, move));
  if (!legal) return { ok: false, message: 'Illegal chess move.' };
  const piece = state.board[move.from.r][move.from.c];
  const target = state.board[move.to.r][move.to.c];
  state.board[move.from.r][move.from.c] = null;
  state.board[move.to.r][move.to.c] = piece;
  if (piece.type === 'P' && (move.to.r === 0 || move.to.r === 7)) piece.type = 'Q';
  if (target?.type === 'K') {
    state.winner = color;
    state.message = `${color} captured the king.`;
  } else {
    state.turn = otherColor(color);
    state.message = `${state.turn} to move.`;
    if (chessLegalMoves(state, state.turn).length === 0) {
      state.winner = color;
      state.message = `${color} wins. Opponent has no legal moves.`;
    }
  }
  return { ok: true };
}

function chessBotAction(room) {
  const botIndex = room.players.findIndex((p) => p.isBot);
  if (botIndex === -1) return false;
  const color = botIndex === 0 ? 'white' : 'black';
  const state = room.state;
  if (state.winner !== null || state.turn !== color) return false;
  const moves = chessLegalMoves(state, color);
  if (!moves.length) return false;
  const captureMoves = moves.filter((m) => state.board[m.to.r][m.to.c]);
  const pool = captureMoves.length ? captureMoves : moves;
  const move = pool[Math.floor(Math.random() * pool.length)];
  applyChessAction(room, botIndex, { type: 'move', ...move });
  return true;
}

function createCheckersState() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) board[r][c] = { color: 'dark', king: false };
  for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) board[r][c] = { color: 'light', king: false };
  return { kind: 'checkers', board, turn: 'light', winner: null, message: 'Light pieces move first.' };
}

function checkersDirs(piece) {
  if (piece.king) return [[-1,-1],[-1,1],[1,-1],[1,1]];
  return piece.color === 'light' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
}

function checkersLegalMoves(state, color) {
  const moves = [];
  const captures = [];
  const b = state.board;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p || p.color !== color) continue;
      for (const [dr, dc] of checkersDirs(p)) {
        const r1 = r + dr, c1 = c + dc;
        const r2 = r + dr * 2, c2 = c + dc * 2;
        if (inside(r1, c1) && !b[r1][c1]) moves.push({ from: { r, c }, to: { r: r1, c: c1 }, capture: null });
        if (inside(r2, c2) && b[r1]?.[c1] && b[r1][c1].color !== color && !b[r2][c2]) {
          captures.push({ from: { r, c }, to: { r: r2, c: c2 }, capture: { r: r1, c: c1 } });
        }
      }
    }
  }
  return captures.length ? captures : moves;
}

function applyCheckersAction(room, playerIndex, action) {
  const state = room.state;
  if (state.winner !== null) return { ok: false, message: 'Game is over.' };
  const color = playerIndex === 0 ? 'light' : 'dark';
  if (state.turn !== color) return { ok: false, message: 'Not your turn.' };
  if (action.type !== 'move') return { ok: false, message: 'Unknown checkers action.' };
  const move = { from: action.from, to: action.to };
  const legal = checkersLegalMoves(state, color).find((m) => sameMove(m, move));
  if (!legal) return { ok: false, message: 'Illegal checkers move.' };
  const piece = state.board[move.from.r][move.from.c];
  state.board[move.from.r][move.from.c] = null;
  if (legal.capture) state.board[legal.capture.r][legal.capture.c] = null;
  state.board[move.to.r][move.to.c] = piece;
  if ((piece.color === 'light' && move.to.r === 0) || (piece.color === 'dark' && move.to.r === 7)) piece.king = true;
  const other = piece.color === 'light' ? 'dark' : 'light';
  const hasOtherPieces = state.board.flat().some((p) => p && p.color === other);
  if (!hasOtherPieces || checkersLegalMoves(state, other).length === 0) {
    state.winner = piece.color;
    state.message = `${piece.color} wins.`;
  } else {
    state.turn = other;
    state.message = `${other} to move.`;
  }
  return { ok: true };
}

function checkersBotAction(room) {
  const botIndex = room.players.findIndex((p) => p.isBot);
  if (botIndex === -1) return false;
  const color = botIndex === 0 ? 'light' : 'dark';
  const state = room.state;
  if (state.winner !== null || state.turn !== color) return false;
  const moves = checkersLegalMoves(state, color);
  if (!moves.length) return false;
  const captures = moves.filter((m) => m.capture);
  const pool = captures.length ? captures : moves;
  const move = pool[Math.floor(Math.random() * pool.length)];
  applyCheckersAction(room, botIndex, { type: 'move', from: move.from, to: move.to });
  return true;
}

function createStateForGame(game) {
  if (game === 'durak') return createDurakState();
  if (game === 'chess') return createChessState();
  if (game === 'checkers') return createCheckersState();
  return createDurakState();
}

function maybeBot(room) {
  if (!room || !room.players.some((p) => p.isBot) || !room.state) return;
  if (room.botTimer) return;
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    let moved = false;
    if (room.game === 'durak') moved = durakBotAction(room);
    if (room.game === 'chess') moved = chessBotAction(room);
    if (room.game === 'checkers') moved = checkersBotAction(room);
    if (moved) maybeBot(room);
  }, 650);
}

function roomPlayerIndex(room, playerToken) {
  return room.players.findIndex((p) => p.token === playerToken);
}

function publicState(room, playerIndex) {
  const base = {
    code: room.code,
    game: room.game,
    mode: room.mode,
    playerIndex,
    playerName: room.players[playerIndex]?.name || 'Player',
    opponentName: room.players[playerIndex === 0 ? 1 : 0]?.name || 'Waiting...',
    waiting: room.players.length < 2,
    createdAt: room.createdAt
  };
  if (!room.state) return base;
  const s = room.state;
  if (room.game === 'durak') {
    return {
      ...base,
      state: {
        kind: 'durak',
        yourHand: s.hands[playerIndex],
        opponentCount: s.hands[playerIndex === 0 ? 1 : 0].length,
        battlefield: s.battlefield,
        deckCount: s.deck.length,
        trumpCard: s.trumpCard,
        trumpSuit: s.trumpSuit,
        attacker: s.attacker,
        defender: s.defender,
        phase: s.phase,
        round: s.round,
        winner: s.winner,
        message: s.message,
        cheatLocked: s.cheatLocked[playerIndex]
      }
    };
  }
  if (room.game === 'chess') {
    return {
      ...base,
      state: { ...s, playerColor: playerIndex === 0 ? 'white' : 'black' }
    };
  }
  if (room.game === 'checkers') {
    return {
      ...base,
      state: { ...s, playerColor: playerIndex === 0 ? 'light' : 'dark' }
    };
  }
  return base;
}

function applyGameAction(room, playerIndex, action) {
  if (!room.state) return { ok: false, message: 'Room is waiting for another player.' };
  if (room.game === 'durak') return applyDurakAction(room, playerIndex, action);
  if (room.game === 'chess') return applyChessAction(room, playerIndex, action);
  if (room.game === 'checkers') return applyCheckersAction(room, playerIndex, action);
  return { ok: false, message: 'Unknown game.' };
}

function serveStatic(req, res) {
  let requestedPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  if (requestedPath === '/') requestedPath = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { ok: false });
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, html) => {
        if (err2) return sendJson(res, 404, { ok: false, message: 'Not found' });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/ping') return sendJson(res, 200, { ok: true });

  if (url.pathname === '/api/create' && req.method === 'POST') {
    const body = await readBody(req);
    const game = ['durak', 'chess', 'checkers'].includes(body.game) ? body.game : 'durak';
    const mode = body.mode === 'online' ? 'online' : 'bot';
    const code = roomCode();
    const playerToken = token();
    const room = {
      code,
      game,
      mode,
      players: [{ token: playerToken, name: String(body.name || 'Player 1').slice(0, 20), isBot: false }],
      state: null,
      createdAt: Date.now(),
      botTimer: null
    };
    if (mode === 'bot') {
      room.players.push({ token: 'BOT', name: 'Arcade Bot', isBot: true });
      room.state = createStateForGame(game);
    }
    rooms.set(code, room);
    maybeBot(room);
    return sendJson(res, 200, { ok: true, code, token: playerToken, playerIndex: 0, state: publicState(room, 0) });
  }

  if (url.pathname === '/api/join' && req.method === 'POST') {
    const body = await readBody(req);
    const code = String(body.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return sendJson(res, 404, { ok: false, message: 'Room not found.' });
    if (room.players.length >= 2) return sendJson(res, 400, { ok: false, message: 'Room is already full.' });
    const playerToken = token();
    room.players.push({ token: playerToken, name: String(body.name || 'Player 2').slice(0, 20), isBot: false });
    room.state = createStateForGame(room.game);
    return sendJson(res, 200, { ok: true, code, token: playerToken, playerIndex: 1, state: publicState(room, 1) });
  }

  if (url.pathname === '/api/state' && req.method === 'GET') {
    const code = String(url.searchParams.get('room') || '').trim().toUpperCase();
    const playerToken = String(url.searchParams.get('token') || '');
    const room = rooms.get(code);
    if (!room) return sendJson(res, 404, { ok: false, message: 'Room not found.' });
    const index = roomPlayerIndex(room, playerToken);
    if (index === -1) return sendJson(res, 403, { ok: false, message: 'Invalid player token.' });
    return sendJson(res, 200, { ok: true, state: publicState(room, index) });
  }

  if (url.pathname === '/api/action' && req.method === 'POST') {
    const body = await readBody(req);
    const code = String(body.room || '').trim().toUpperCase();
    const playerToken = String(body.token || '');
    const room = rooms.get(code);
    if (!room) return sendJson(res, 404, { ok: false, message: 'Room not found.' });
    const index = roomPlayerIndex(room, playerToken);
    if (index === -1) return sendJson(res, 403, { ok: false, message: 'Invalid player token.' });
    const result = applyGameAction(room, index, body.action || {});
    maybeBot(room);
    return sendJson(res, result.ok ? 200 : 400, { ...result, state: publicState(room, index) });
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Durak Arcade Online running on http://localhost:${PORT}`);
});
