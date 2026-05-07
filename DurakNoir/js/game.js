(function () {
  const {
    createDeck,
    shuffle,
    sortCards,
    cardBeats,
    cardHTML
  } = window.DurakCards;

  const {
    $,
    showToast,
    showScreen,
    openDialog,
    closeDialog,
    openResult,
    playSound,
    addStat,
    renderStats
  } = window.DurakUI;

  const MAX_BATTLE_CARDS = 6;
  const START_HAND_SIZE = 6;

  let deck = [];
  let trumpSuit = null;
  let trumpCard = null;
  let discardPile = [];
  let battlefield = [];
  let playerHand = [];
  let enemyHand = [];
  let attacker = 'player';
  let defender = 'enemy';
  let round = 1;
  let locked = false;
  let gameOver = false;
  let logMessages = [];

  let gameMode = 'ai'; // ai | online
  let localSeat = 'player';
  let isHost = true;
  let peer = null;
  let conn = null;
  let roomId = null;

  let selectedCardId = null;

  let cheatAvailable = true;
  let cheatActive = false;
  let cheatCaught = false;
  let cheaterTrapId = null;
  let cheatTimer = null;

  function getHand(seat) {
    return seat === 'player' ? playerHand : enemyHand;
  }

  function setHand(seat, value) {
    if (seat === 'player') {
      playerHand = value;
    } else {
      enemyHand = value;
    }
  }

  function otherSeat(seat) {
    return seat === 'player' ? 'enemy' : 'player';
  }

  function isLocalTurn() {
    return attacker === localSeat || defender === localSeat;
  }

  function newGame(mode = 'ai') {
    gameMode = mode;
    localSeat = 'player';
    isHost = true;
    startFreshGame();
  }

  function startFreshGame() {
    const shuffled = shuffle(createDeck());
    trumpCard = shuffled[shuffled.length - 1];
    trumpSuit = trumpCard.suit;
    deck = shuffled;

    playerHand = [];
    enemyHand = [];
    battlefield = [];
    discardPile = [];
    selectedCardId = null;
    round = 1;
    locked = true;
    gameOver = false;
    logMessages = [];

    cheatAvailable = gameMode === 'ai';
    cheatActive = false;
    cheatCaught = false;
    cheaterTrapId = null;
    window.clearTimeout(cheatTimer);

    for (let i = 0; i < START_HAND_SIZE; i++) {
      playerHand.push(drawCard());
      enemyHand.push(drawCard());
    }

    chooseFirstAttacker();
    sortHands();

    if (gameMode === 'ai' && enemyHand.length > 0) {
      cheaterTrapId = enemyHand[Math.floor(Math.random() * enemyHand.length)].id;
    }

    addLog(`<strong>New game started.</strong> Trump suit is ${trumpCard.suitSymbol} ${trumpCard.suitName}.`);
    render();

    setStatus('Dealing cards', 'The cards are being dealt...');

    runDealAnimation(() => {
      locked = false;
      render();

      if (gameMode === 'online') {
        syncOnlineState();
        setStatusForCurrentState();
        return;
      }

      if (attacker === 'enemy') {
        setStatus('Enemy attack', 'The Dealer starts because he has the lowest trump.');
        enemyAttackFlow();
      } else {
        setStatus('Your attack', 'You start because you have the lowest trump. Choose a card to attack.');
      }
    });
  }

  function drawCard() {
    if (deck.length === 0) {
      return null;
    }

    return deck.shift();
  }

  function chooseFirstAttacker() {
    const playerLowest = lowestTrumpValue(playerHand);
    const enemyLowest = lowestTrumpValue(enemyHand);

    if (playerLowest === null && enemyLowest === null) {
      attacker = 'player';
    } else if (playerLowest === null) {
      attacker = 'enemy';
    } else if (enemyLowest === null) {
      attacker = 'player';
    } else {
      attacker = playerLowest <= enemyLowest ? 'player' : 'enemy';
    }

    defender = otherSeat(attacker);
  }

  function lowestTrumpValue(hand) {
    const trumps = hand.filter((card) => card.suit === trumpSuit);

    if (trumps.length === 0) {
      return null;
    }

    return Math.min(...trumps.map((card) => card.rankValue));
  }

  function sortHands() {
    playerHand = sortCards(playerHand, trumpSuit);
    enemyHand = sortCards(enemyHand, trumpSuit);
  }

  function render() {
    renderRoles();
    renderDeck();
    renderEnemyPreview();
    renderBattlefield();
    renderPlayerHand();
    renderActionButtons();
    renderLog();
    renderCheatButton();
    if (renderStats) renderStats();
  }

  function renderRoles() {
    const playerRole = $('playerRole');
    const opponentRole = $('opponentRole');
    const roundInfo = $('roundInfo');
    const enemyCount = $('enemyCount');
    const trumpInfo = $('trumpInfo');
    const opponentName = gameMode === 'online' ? 'Friend' : 'The Dealer';

    const myRole = attacker === localSeat ? 'You are attacking' : 'You are defending';
    const opponentRoleText = attacker === otherSeat(localSeat) ? 'Attacker' : 'Defender';

    if (playerRole) playerRole.textContent = myRole;
    if (opponentRole) opponentRole.textContent = opponentRoleText;
    if (roundInfo) roundInfo.textContent = gameMode === 'online' ? `Friend Mode · Round ${round}` : `Round ${round}`;
    if (enemyCount) enemyCount.textContent = getHand(otherSeat(localSeat)).length;
    if (trumpInfo) trumpInfo.textContent = `${trumpCard?.suitSymbol || ''} ${trumpCard?.suitName || ''}`;
    const opponentTitle = document.querySelector('.opponent-panel h2');
    if (opponentTitle) opponentTitle.textContent = opponentName;
  }

  function renderDeck() {
    const deckCount = $('deckCount');
    const trumpBox = $('trumpCard');

    if (deckCount) deckCount.textContent = deck.length;
    if (trumpBox && trumpCard) trumpBox.innerHTML = cardHTML(trumpCard, { trump: true });
  }

  function renderEnemyPreview() {
    const preview = $('enemyHandPreview');

    if (!preview) {
      return;
    }

    const opponentHand = getHand(otherSeat(localSeat));

    if (gameMode === 'ai' && cheatActive && opponentHand.length > 0) {
      preview.innerHTML = opponentHand.map((card, index) => `
        <div class="cheat-preview-card" data-card-id="${card.id}" style="--i:${index}">
          ${cardHTML(card, { mini: true })}
        </div>
      `).join('');

      preview.querySelectorAll('.cheat-preview-card').forEach((cardEl) => {
        cardEl.addEventListener('click', () => handleCheatCardClick(cardEl.dataset.cardId));
      });
      return;
    }

    const amount = Math.min(opponentHand.length, 8);
    const cards = [];

    for (let i = 0; i < amount; i++) {
      const rot = -16 + i * 5;
      cards.push(`<div class="enemy-mini-back" style="--rot:${rot}deg; --i:${i}"></div>`);
    }

    preview.innerHTML = cards.join('');
  }

  function renderBattlefield() {
    const table = $('battlefield');

    if (!table) {
      return;
    }

    const slots = [];

    for (let i = 0; i < MAX_BATTLE_CARDS; i++) {
      const pair = battlefield[i];

      if (!pair) {
        slots.push('<div class="battle-slot empty">✦</div>');
        continue;
      }

      const attack = cardHTML(pair.attack, { table: true });
      const defense = pair.defense
        ? cardHTML(pair.defense, { table: true, defense: true })
        : '<div class="card-placeholder">defense</div>';

      slots.push(`
        <div class="battle-slot" data-pair-index="${i}">
          ${attack}
          ${defense}
        </div>
      `);
    }

    table.innerHTML = slots.join('');
    table.querySelectorAll('.playing-card').forEach((cardEl, index) => {
      cardEl.style.setProperty('--i', index);
    });
  }

  function renderPlayerHand() {
    const handBox = $('playerHand');
    const selectedInfo = $('selectedInfo');

    if (!handBox) {
      return;
    }

    const myHand = getHand(localSeat);

    handBox.innerHTML = myHand.map((card, index) => {
      const selected = card.id === selectedCardId;
      const disabled = locked || gameOver || !canUseSeatCard(card, localSeat);

      return `<div style="--i:${index}">${cardHTML(card, { selected, disabled })}</div>`;
    }).join('');

    handBox.querySelectorAll('.playing-card').forEach((cardEl) => {
      cardEl.addEventListener('click', () => {
        const cardId = cardEl.dataset.cardId;
        selectCard(cardId);
      });
    });

    const selectedCard = myHand.find((card) => card.id === selectedCardId);
    if (selectedInfo) {
      selectedInfo.textContent = selectedCard ? `${selectedCard.fullName} selected` : 'No card selected';
    }
  }

  function renderActionButtons() {
    const beatBtn = $('beatBtn');
    const takeBtn = $('takeBtn');
    const passBtn = $('passBtn');

    const myDefenderTurn = defender === localSeat;
    const myAttackerTurn = attacker === localSeat;

    if (beatBtn) {
      beatBtn.disabled = locked || gameOver || !(myDefenderTurn && battlefield.length > 0 && allDefended());
    }

    if (takeBtn) {
      takeBtn.disabled = locked || gameOver || !(myDefenderTurn && battlefield.length > 0);
    }

    if (passBtn) {
      passBtn.disabled = locked || gameOver || !(myAttackerTurn && battlefield.length > 0 && allDefended());
    }
  }

  function renderLog() {
    const log = $('gameLog');

    if (!log) {
      return;
    }

    log.innerHTML = logMessages.map((message) => `<div class="log-entry">${message}</div>`).join('');
  }

  function renderCheatButton() {
    const cheatBtn = $('cheatBtn');
    if (!cheatBtn) return;

    if (gameMode !== 'ai') {
      cheatBtn.textContent = 'Cheat disabled online';
      cheatBtn.disabled = true;
      return;
    }

    if (cheatCaught || !cheatAvailable) {
      cheatBtn.textContent = 'Cheat locked';
      cheatBtn.disabled = true;
      return;
    }

    cheatBtn.textContent = cheatActive ? 'Cheat active' : 'Cheat Peek';
    cheatBtn.disabled = locked || gameOver || enemyHand.length === 0;
  }

  function canUseSeatCard(card, seat) {
    if (attacker === seat) {
      return canAttackWith(card);
    }

    if (defender === seat) {
      const target = firstUndefendedPair();
      return Boolean(target && cardBeats(card, target.attack, trumpSuit));
    }

    return false;
  }

  function selectCard(cardId) {
    if (locked || gameOver) {
      showToast('Wait. The table is moving.');
      return;
    }

    const myHand = getHand(localSeat);
    const card = myHand.find((item) => item.id === cardId);

    if (!card) {
      return;
    }

    if (!canUseSeatCard(card, localSeat)) {
      if (attacker === localSeat) {
        showToast('You can attack only with a rank already on the table.');
      } else {
        showToast('This card cannot beat the attack card.');
      }
      return;
    }

    selectedCardId = cardId;
    playSound('select');
    render();

    sendOrApplyAction({ kind: 'play-card', cardId });
  }

  function sendOrApplyAction(action) {
    if (gameMode === 'online' && !isHost) {
      sendToHost({ type: 'action', action });
      return;
    }

    applyAction(localSeat, action);
    syncOnlineState();
  }

  function applyRemoteAction(action, seat) {
    applyAction(seat, action);
    syncOnlineState();
  }

  function applyAction(seat, action) {
    if (locked || gameOver) return;

    if (action.kind === 'play-card') {
      playCardForSeat(seat, action.cardId);
    }

    if (action.kind === 'take') {
      takeForSeat(seat);
    }

    if (action.kind === 'beat') {
      beatForSeat(seat);
    }

    if (action.kind === 'pass') {
      passForSeat(seat);
    }
  }

  function playCardForSeat(seat, cardId) {
    if (attacker === seat) {
      attackWithCard(seat, cardId);
    } else if (defender === seat) {
      defendWithCard(seat, cardId);
    }
  }

  function attackWithCard(seat, cardId) {
    const hand = getHand(seat);
    const card = removeCard(hand, cardId);
    setHand(seat, hand);

    if (!card) return;

    battlefield.push({ attack: card, defense: null });
    selectedCardId = null;
    addLog(`${seatLabel(seat)} attack${seat === 'player' ? '' : 's'} with <strong>${card.fullName}</strong>.`);
    animateTable();
    playSound('swoosh');
    render();

    if (getHand(defender).length === 0 && deck.length === 0) {
      finishRoundAfterBeat();
      return;
    }

    if (gameMode === 'ai' && defender === 'enemy') {
      locked = true;
      setStatus('Enemy defense', 'The Dealer is choosing a defense card.');
      window.setTimeout(() => {
        enemyDefend();
        locked = false;
        render();
      }, 720);
    } else {
      setStatusForCurrentState();
    }
  }

  function defendWithCard(seat, cardId) {
    const target = firstUndefendedPair();

    if (!target) {
      showToast('There is nothing to defend.');
      return;
    }

    const hand = getHand(seat);
    const card = hand.find((item) => item.id === cardId);

    if (!card || !cardBeats(card, target.attack, trumpSuit)) {
      showToast('This card cannot defend.');
      return;
    }

    target.defense = removeCard(hand, cardId);
    setHand(seat, hand);
    selectedCardId = null;
    addLog(`${seatLabel(seat)} defend${seat === 'player' ? '' : 's'} with <strong>${target.defense.fullName}</strong>.`);
    animateTable();
    playSound('swoosh');
    render();

    if (getHand(seat).length === 0 && deck.length === 0) {
      finishRoundAfterBeat();
      return;
    }

    if (gameMode === 'ai' && attacker === 'enemy') {
      locked = true;
      setStatus('Enemy thinking', 'The Dealer is deciding whether to add another attack.');
      window.setTimeout(() => {
        enemyAddOrStop();
        locked = false;
        render();
      }, 760);
    } else {
      setStatusForCurrentState();
    }
  }

  function enemyDefend() {
    const target = firstUndefendedPair();

    if (!target) {
      setStatus('Your attack', 'All cards are defended. Add more or press Pass / Done.');
      return;
    }

    const defense = chooseSmartDefense(enemyHand, target.attack);

    if (!defense) {
      addLog('<strong>The Dealer cannot defend.</strong> He takes the table.');
      setStatus('Enemy takes', 'The Dealer takes all cards. You continue attacking next round.');
      takeTable('enemy');
      animateTable();
      endRound();
      return;
    }

    target.defense = removeCard(enemyHand, defense.id);
    addLog(`The Dealer defends with <strong>${target.defense.fullName}</strong>.`);
    animateTable();
    playSound('swoosh');

    if (enemyHand.length === 0 && deck.length === 0) {
      finishRoundAfterBeat();
      return;
    }

    if (canSeatAddAttack('player')) {
      setStatus('Your attack', 'The card is beaten. Add another card or press Pass / Done.');
    } else {
      setStatus('Table beaten', 'No more legal attack cards. Press Pass / Done.');
    }
  }

  function enemyAttackFlow() {
    if (gameOver) {
      return;
    }

    locked = true;
    render();

    window.setTimeout(() => {
      const card = chooseEnemyAttackCard();

      if (!card) {
        finishRoundAfterBeat();
        locked = false;
        render();
        return;
      }

      battlefield.push({ attack: removeCard(enemyHand, card.id), defense: null });
      addLog(`The Dealer attacks with <strong>${card.fullName}</strong>.`);
      setStatus('Your defense', 'Choose a card that beats the attack. If you cannot, press Take.');
      animateTable();
      playSound('swoosh');
      locked = false;
      render();
    }, 760);
  }

  function enemyAddOrStop() {
    if (!allDefended()) {
      setStatus('Your defense', 'Defend the attack or take the cards.');
      return;
    }

    const legalAdds = enemyHand.filter((card) => canAttackWith(card));
    const maxAttacksAllowed = Math.min(MAX_BATTLE_CARDS, playerHand.length + battlefield.length);
    const underPressure = playerHand.length > 2;
    const earlyRound = battlefield.length < Math.min(3, maxAttacksAllowed);

    if (legalAdds.length === 0 || battlefield.length >= maxAttacksAllowed) {
      setStatus('You defended', 'The Dealer has no legal card to add. Press Beat.');
      return;
    }

    const shouldAdd = underPressure && earlyRound && (legalAdds.length > 1 || playerHand.length >= 4);

    if (!shouldAdd && Math.random() < 0.65) {
      setStatus('You defended', 'All attacks are beaten. Press Beat to clear the table.');
      return;
    }

    const card = chooseBestAttackFrom(legalAdds);

    if (!card) {
      setStatus('You defended', 'The Dealer has no legal card to add. Press Beat.');
      return;
    }

    battlefield.push({ attack: removeCard(enemyHand, card.id), defense: null });
    addLog(`The Dealer adds <strong>${card.fullName}</strong>.`);
    setStatus('Your defense', 'The Dealer added another card. Defend or take.');
    animateTable();
    playSound('swoosh');
  }

  function takeForSeat(seat) {
    if (defender !== seat || battlefield.length === 0 || locked || gameOver) return;

    addLog(`<strong>${seatLabel(seat)} take${seat === 'player' ? '' : 's'} the table.</strong>`);
    takeTable(seat);
    setStatusForCurrentState();
    animateTable();
    playSound('swoosh');
    endRound();
  }

  function beatForSeat(seat) {
    if (defender !== seat || !allDefended() || battlefield.length === 0 || locked || gameOver) return;
    finishRoundAfterBeat();
  }

  function passForSeat(seat) {
    if (attacker !== seat || !allDefended() || battlefield.length === 0 || locked || gameOver) return;
    finishRoundAfterBeat();
  }

  function finishRoundAfterBeat() {
    discardPile.push(...battlefield.flatMap((pair) => [pair.attack, pair.defense]).filter(Boolean));
    battlefield = [];

    const oldDefender = defender;
    attacker = oldDefender;
    defender = otherSeat(attacker);

    addLog('<strong>Table beaten.</strong> Cards move to the discard pile.');
    setStatusForCurrentState();
    animateTable();
    playSound('success');
    endRound();
  }

  function endRound() {
    fillHands();
    sortHands();
    selectedCardId = null;
    round += 1;
    render();

    if (checkGameOver()) {
      syncOnlineState();
      return;
    }

    syncOnlineState();

    if (gameMode === 'ai' && attacker === 'enemy') {
      enemyAttackFlow();
    } else {
      setStatusForCurrentState();
    }
  }

  function fillHands() {
    const attackerHand = getHand(attacker);
    const defenderHand = getHand(defender);

    fillToSix(attackerHand);
    fillToSix(defenderHand);

    setHand(attacker, attackerHand);
    setHand(defender, defenderHand);

    addLog(`Cards drawn. Deck has <strong>${deck.length}</strong> cards left.`);
  }

  function fillToSix(hand) {
    while (hand.length < START_HAND_SIZE && deck.length > 0) {
      const card = drawCard();

      if (card) {
        hand.push(card);
      }
    }
  }

  function takeTable(who) {
    const cards = battlefield.flatMap((pair) => [pair.attack, pair.defense]).filter(Boolean);
    const hand = getHand(who);
    hand.push(...cards);
    setHand(who, hand);

    attacker = otherSeat(who);
    defender = who;
    battlefield = [];
  }


  function openResultForCurrentState(updateStats = false) {
    if (playerHand.length === 0 && enemyHand.length === 0) {
      openResult('Draw', 'Both players escaped the table at the same time.', 'No Durak');
      if (updateStats && gameMode === 'ai') addStat('draw');
      playSound('draw');
      return;
    }

    if (playerHand.length === 0) {
      const playerLocal = localSeat === 'player';
      openResult(playerLocal ? 'Victory' : 'Defeat', playerLocal ? 'You got rid of all your cards.' : 'Your friend escaped first.', playerLocal ? 'You escaped' : 'Durak');
      if (updateStats && gameMode === 'ai') addStat('player');
      playSound(playerLocal ? 'success' : 'defeat');
      return;
    }

    if (enemyHand.length === 0) {
      const enemyLocal = localSeat === 'enemy';
      openResult(enemyLocal ? 'Victory' : 'Defeat', enemyLocal ? 'You got rid of all your cards.' : 'The opponent escaped first.', enemyLocal ? 'You escaped' : 'Durak');
      if (updateStats && gameMode === 'ai') addStat('enemy');
      playSound(enemyLocal ? 'success' : 'defeat');
    }
  }

  function checkGameOver() {
    if (deck.length > 0 || battlefield.length > 0) {
      return false;
    }

    if (playerHand.length === 0 || enemyHand.length === 0) {
      openResultForCurrentState(true);
      gameOver = true;
      render();
      return true;
    }

    return false;
  }

  function canAttackWith(card) {
    if (battlefield.length >= MAX_BATTLE_CARDS) {
      return false;
    }

    if (battlefield.length === 0) {
      return true;
    }

    const ranks = battleRanks();
    return ranks.includes(card.rank);
  }

  function canSeatAddAttack(seat) {
    return getHand(seat).some((card) => canAttackWith(card));
  }

  function battleRanks() {
    const ranks = [];

    battlefield.forEach((pair) => {
      ranks.push(pair.attack.rank);
      if (pair.defense) ranks.push(pair.defense.rank);
    });

    return ranks;
  }

  function firstUndefendedPair() {
    return battlefield.find((pair) => !pair.defense);
  }

  function allDefended() {
    return battlefield.length > 0 && battlefield.every((pair) => pair.defense);
  }

  function chooseSmartDefense(hand, attackCard) {
    const options = hand.filter((card) => cardBeats(card, attackCard, trumpSuit));

    if (options.length === 0) {
      return null;
    }

    const scored = [...options].sort((a, b) => {
      const aTrump = a.suit === trumpSuit ? 1 : 0;
      const bTrump = b.suit === trumpSuit ? 1 : 0;
      const aSameSuit = a.suit === attackCard.suit ? 0 : 1;
      const bSameSuit = b.suit === attackCard.suit ? 0 : 1;

      if (attackCard.suit !== trumpSuit && aSameSuit !== bSameSuit) {
        return aSameSuit - bSameSuit;
      }

      if (aTrump !== bTrump) {
        return aTrump - bTrump;
      }

      return a.rankValue - b.rankValue;
    });

    return scored[0];
  }

  function chooseBestAttackFrom(cards) {
    if (!cards.length) {
      return null;
    }

    const ranked = [...cards].sort((a, b) => {
      const aTrump = a.suit === trumpSuit ? 1 : 0;
      const bTrump = b.suit === trumpSuit ? 1 : 0;

      if (aTrump !== bTrump) {
        return aTrump - bTrump;
      }

      if (a.rankValue !== b.rankValue) {
        return a.rankValue - b.rankValue;
      }

      return a.suit.localeCompare(b.suit);
    });

    return ranked[0];
  }

  function chooseEnemyAttackCard() {
    const possible = enemyHand.filter((card) => {
      if (battlefield.length === 0) {
        return true;
      }

      return battleRanks().includes(card.rank);
    });

    return chooseBestAttackFrom(possible);
  }

  function removeCard(hand, cardId) {
    const index = hand.findIndex((card) => card.id === cardId);

    if (index === -1) {
      return null;
    }

    return hand.splice(index, 1)[0];
  }

  function seatLabel(seat) {
    if (gameMode === 'online') {
      return seat === localSeat ? 'You' : 'Friend';
    }

    return seat === 'player' ? 'You' : 'The Dealer';
  }

  function setStatus(title, text) {
    const statusTitle = $('statusTitle');
    const statusText = $('statusText');

    if (statusTitle) statusTitle.textContent = title;
    if (statusText) statusText.textContent = text;
  }

  function setStatusForCurrentState() {
    if (gameOver) return;

    const opponentName = gameMode === 'online' ? 'Friend' : 'The Dealer';

    if (battlefield.length === 0) {
      if (attacker === localSeat) {
        setStatus('Your attack', 'Choose a card to attack.');
      } else {
        setStatus(`${opponentName} attack`, 'Wait for the opponent to attack.');
      }
      return;
    }

    if (!allDefended()) {
      if (defender === localSeat) {
        setStatus('Your defense', 'Choose a card that beats the attack. If you cannot, press Take.');
      } else {
        setStatus(`${opponentName} defense`, 'Wait for the opponent to defend.');
      }
      return;
    }

    if (attacker === localSeat) {
      setStatus('Your attack', 'All cards are defended. Add another card or press Pass / Done.');
    } else if (defender === localSeat) {
      setStatus('You defended', 'All attacks are beaten. Press Beat to clear the table.');
    } else {
      setStatus('Waiting', 'Wait for the opponent.');
    }
  }

  function addLog(message) {
    logMessages.unshift(message);
    logMessages = logMessages.slice(0, 40);
    renderLog();
  }

  function animateTable() {
    const table = $('battlefield');
    const panel = document.querySelector('.table-panel');

    if (table) {
      table.classList.remove('attack-shake');
      void table.offsetWidth;
      table.classList.add('attack-shake');
    }

    if (panel) {
      panel.classList.remove('flash');
      void panel.offsetWidth;
      panel.classList.add('flash');
    }
  }

  function toggleCheat() {
    if (gameMode !== 'ai') {
      showToast('Cheat is disabled in friend mode.');
      return;
    }

    if (cheatCaught || !cheatAvailable) {
      showToast('You already got caught. Cheat is locked.');
      return;
    }

    if (locked || gameOver) {
      showToast('Not now.');
      return;
    }

    cheatActive = true;
    addLog('<strong>You try to cheat.</strong> Enemy cards are visible for a moment.');
    playSound('select');
    render();

    window.clearTimeout(cheatTimer);
    cheatTimer = window.setTimeout(() => {
      cheatActive = false;
      render();
    }, 6000);
  }

  function handleCheatCardClick(cardId) {
    if (!cheatActive || cheatCaught) return;

    const card = enemyHand.find((item) => item.id === cardId);
    if (!card) return;

    if (cardId === cheaterTrapId) {
      cheatCaught = true;
      cheatAvailable = false;
      cheatActive = false;
      locked = true;
      addLog('<strong>The Dealer caught you cheating.</strong> Cheat is permanently locked.');
      showCheatCaughtAnimation();
      playSound('defeat');
      render();

      window.setTimeout(() => {
        locked = false;
        render();
        setStatusForCurrentState();
      }, 1500);
      return;
    }

    showToast(`Safe peek: ${card.fullName}`);
    playSound('select');
  }

  function showCheatCaughtAnimation() {
    const layer = $('cheatCaughtLayer');
    if (!layer) return;

    layer.classList.add('show');
    window.setTimeout(() => {
      layer.classList.remove('show');
    }, 1450);
  }

  function runDealAnimation(callback) {
    const layer = $('dealLayer');
    const deckEl = $('deckStack');
    const playerHandEl = $('playerHand');
    const enemyHandEl = $('enemyHandPreview');

    if (!layer || !deckEl || !playerHandEl || !enemyHandEl) {
      if (typeof callback === 'function') callback();
      return;
    }

    layer.innerHTML = '';
    layer.classList.add('active');

    const deckRect = deckEl.getBoundingClientRect();
    const playerRect = playerHandEl.getBoundingClientRect();
    const enemyRect = enemyHandEl.getBoundingClientRect();
    const startX = deckRect.left + deckRect.width / 2 - 40;
    const startY = deckRect.top + deckRect.height / 2 - 56;

    const totalCards = START_HAND_SIZE * 2;
    let completed = 0;

    function makeTargetRect(baseRect, index, isPlayer) {
      const spread = isPlayer ? 46 : 24;
      const x = baseRect.left + baseRect.width / 2 - 40 + (index - (START_HAND_SIZE - 1) / 2) * spread;
      const y = baseRect.top + (isPlayer ? 16 : 20);
      return { x, y };
    }

    function createFlyingCard(target, index) {
      const card = document.createElement('div');
      card.className = 'deal-card';
      card.style.left = `${startX}px`;
      card.style.top = `${startY}px`;
      card.style.setProperty('--start-x', `${startX}px`);
      card.style.setProperty('--start-y', `${startY}px`);
      card.style.setProperty('--target-x', `${target.x}px`);
      card.style.setProperty('--target-y', `${target.y}px`);
      card.style.animationDelay = `${index * 72}ms`;
      layer.appendChild(card);

      window.setTimeout(() => playSound('deal'), index * 72);

      card.addEventListener('animationend', () => {
        card.remove();
        completed += 1;

        if (completed === totalCards) {
          layer.classList.remove('active');
          if (typeof callback === 'function') callback();
        }
      });
    }

    for (let i = 0; i < START_HAND_SIZE; i++) {
      createFlyingCard(makeTargetRect(enemyRect, i, false), i);
      createFlyingCard(makeTargetRect(playerRect, i, true), i + START_HAND_SIZE);
    }
  }

  function exportState() {
    return {
      deck,
      trumpSuit,
      trumpCard,
      discardPile,
      battlefield,
      playerHand,
      enemyHand,
      attacker,
      defender,
      round,
      locked: false,
      gameOver,
      logMessages
    };
  }

  function importState(state) {
    const wasGameOver = gameOver;

    deck = state.deck || [];
    trumpSuit = state.trumpSuit;
    trumpCard = state.trumpCard;
    discardPile = state.discardPile || [];
    battlefield = state.battlefield || [];
    playerHand = state.playerHand || [];
    enemyHand = state.enemyHand || [];
    attacker = state.attacker || 'player';
    defender = state.defender || 'enemy';
    round = state.round || 1;
    locked = Boolean(state.locked);
    gameOver = Boolean(state.gameOver);
    logMessages = state.logMessages || [];
    selectedCardId = null;
    cheatActive = false;
    render();

    if (gameOver && !wasGameOver) {
      openResultForCurrentState(false);
      return;
    }

    setStatusForCurrentState();
  }

  function syncOnlineState() {
    if (gameMode === 'online' && isHost && conn && conn.open) {
      conn.send({ type: 'state', state: exportState() });
    }
  }

  function sendToHost(payload) {
    if (conn && conn.open) {
      conn.send(payload);
    } else {
      showToast('Connection is not ready.');
    }
  }

  function createRoomId() {
    return `durak-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-4)}`;
  }

  function openOnlineMenu() {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      const joinInput = $('joinRoomInput');
      if (joinInput) joinInput.value = room;
    }
    openDialog('onlineDialog');
  }

  function setOnlineStatus(text) {
    const status = $('onlineStatus');
    if (status) status.textContent = text;
  }

  function setInviteLink(room) {
    const box = $('inviteBox');
    const input = $('inviteLinkInput');
    const url = new URL(window.location.href);
    url.searchParams.set('room', room);

    if (input) input.value = url.toString();
    if (box) box.classList.add('show');
  }

  function hostOnlineGame() {
    if (!window.Peer) {
      setOnlineStatus('PeerJS did not load. Check internet connection.');
      return;
    }

    cleanupPeer();

    roomId = createRoomId();
    isHost = true;
    localSeat = 'player';
    gameMode = 'online';
    peer = new Peer(roomId);

    setOnlineStatus('Creating room...');

    peer.on('open', () => {
      setOnlineStatus(`Room created: ${roomId}. Send the invite link to your friend.`);
      setInviteLink(roomId);
    });

    peer.on('connection', (connection) => {
      conn = connection;
      setupConnection();
      setOnlineStatus('Friend connected. Starting game...');
      closeDialog('onlineDialog');
      showScreen('gameScreen');
      startFreshGame();
    });

    peer.on('error', (error) => {
      setOnlineStatus(`Connection error: ${error.type || error.message}`);
    });
  }

  function joinOnlineGame(roomFromLink) {
    if (!window.Peer) {
      setOnlineStatus('PeerJS did not load. Check internet connection.');
      return;
    }

    const input = $('joinRoomInput');
    const targetRoom = roomFromLink || (input ? input.value.trim() : '');

    if (!targetRoom) {
      setOnlineStatus('Paste a room code first.');
      return;
    }

    cleanupPeer();

    isHost = false;
    localSeat = 'enemy';
    gameMode = 'online';
    roomId = targetRoom;
    peer = new Peer();

    setOnlineStatus('Connecting...');

    peer.on('open', () => {
      conn = peer.connect(targetRoom, { reliable: true });
      setupConnection();
    });

    peer.on('error', (error) => {
      setOnlineStatus(`Connection error: ${error.type || error.message}`);
    });
  }

  function setupConnection() {
    if (!conn) return;

    conn.on('open', () => {
      setOnlineStatus(isHost ? 'Friend connected.' : 'Connected. Waiting for host to start.');
      if (!isHost) {
        closeDialog('onlineDialog');
        showScreen('gameScreen');
      }
    });

    conn.on('data', (message) => {
      if (!message || typeof message !== 'object') return;

      if (message.type === 'state') {
        importState(message.state);
      }

      if (message.type === 'action' && isHost) {
        applyRemoteAction(message.action, 'enemy');
      }
    });

    conn.on('close', () => {
      showToast('Friend disconnected.');
      setOnlineStatus('Friend disconnected.');
    });
  }

  function cleanupPeer() {
    if (conn) {
      try { conn.close(); } catch (error) {}
      conn = null;
    }

    if (peer) {
      try { peer.destroy(); } catch (error) {}
      peer = null;
    }
  }

  function setupGameButtons() {
    const startGameBtn = $('startGameBtn');
    const friendGameBtn = $('friendGameBtn');
    const hostGameBtn = $('hostGameBtn');
    const joinGameBtn = $('joinGameBtn');
    const closeOnlineBtn = $('closeOnlineBtn');
    const copyInviteBtn = $('copyInviteBtn');
    const newGameBtn = $('newGameBtn');
    const playAgainBtn = $('playAgainBtn');
    const beatBtn = $('beatBtn');
    const takeBtn = $('takeBtn');
    const passBtn = $('passBtn');
    const cheatBtn = $('cheatBtn');

    if (startGameBtn) {
      startGameBtn.addEventListener('click', () => {
        playSound('click');
        showScreen('gameScreen');
        newGame('ai');
      });
    }

    if (friendGameBtn) {
      friendGameBtn.addEventListener('click', () => {
        playSound('click');
        openOnlineMenu();
      });
    }

    if (hostGameBtn) {
      hostGameBtn.addEventListener('click', hostOnlineGame);
    }

    if (joinGameBtn) {
      joinGameBtn.addEventListener('click', () => joinOnlineGame());
    }

    if (closeOnlineBtn) {
      closeOnlineBtn.addEventListener('click', () => closeDialog('onlineDialog'));
    }

    if (copyInviteBtn) {
      copyInviteBtn.addEventListener('click', async () => {
        const input = $('inviteLinkInput');
        if (!input) return;
        try {
          await navigator.clipboard.writeText(input.value);
          showToast('Invite link copied.');
        } catch (error) {
          input.select();
          document.execCommand('copy');
          showToast('Invite link copied.');
        }
      });
    }

    if (newGameBtn) {
      newGameBtn.addEventListener('click', () => {
        if (gameMode === 'online' && !isHost) {
          showToast('Only the host can restart online game.');
          return;
        }
        startFreshGame();
      });
    }

    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', () => {
        closeDialog('resultDialog');
        showScreen('gameScreen');
        if (gameMode === 'online' && !isHost) {
          showToast('Waiting for host to restart.');
          return;
        }
        startFreshGame();
      });
    }

    if (beatBtn) {
      beatBtn.addEventListener('click', () => sendOrApplyAction({ kind: 'beat' }));
    }

    if (takeBtn) {
      takeBtn.addEventListener('click', () => sendOrApplyAction({ kind: 'take' }));
    }

    if (passBtn) {
      passBtn.addEventListener('click', () => sendOrApplyAction({ kind: 'pass' }));
    }

    if (cheatBtn) {
      cheatBtn.addEventListener('click', toggleCheat);
    }

    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      window.setTimeout(() => {
        openOnlineMenu();
        const input = $('joinRoomInput');
        if (input) input.value = room;
      }, 500);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    setupGameButtons();
  });
}());