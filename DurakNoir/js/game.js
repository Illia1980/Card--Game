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
    openResult,
    closeDialog
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
  let selectedCardId = null;
  let attacker = 'player';
  let defender = 'enemy';
  let round = 1;
  let locked = false;
  let gameOver = false;

  function newGame() {
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
    locked = false;
    gameOver = false;

    for (let i = 0; i < START_HAND_SIZE; i++) {
      playerHand.push(drawCard());
      enemyHand.push(drawCard());
    }

    chooseFirstAttacker();
    sortHands();
    clearLog();
    addLog(`<strong>New game started.</strong> Trump suit is ${trumpCard.suitSymbol} ${trumpCard.suitName}.`);
    render();

    if (attacker === 'enemy') {
      setStatus('Enemy attack', 'The Dealer starts because he has the lowest trump.');
      enemyAttackFlow();
    } else {
      setStatus('Your attack', 'You start because you have the lowest trump. Choose a card to attack.');
    }
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

    defender = attacker === 'player' ? 'enemy' : 'player';
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
  }

  function renderRoles() {
    const playerRole = $('playerRole');
    const opponentRole = $('opponentRole');
    const roundInfo = $('roundInfo');
    const enemyCount = $('enemyCount');
    const trumpInfo = $('trumpInfo');

    if (playerRole) playerRole.textContent = attacker === 'player' ? 'You are attacking' : 'You are defending';
    if (opponentRole) opponentRole.textContent = attacker === 'enemy' ? 'Attacker' : 'Defender';
    if (roundInfo) roundInfo.textContent = `Round ${round}`;
    if (enemyCount) enemyCount.textContent = enemyHand.length;
    if (trumpInfo) trumpInfo.textContent = `${trumpCard.suitSymbol} ${trumpCard.suitName}`;
  }

  function renderDeck() {
    const deckCount = $('deckCount');
    const trumpBox = $('trumpCard');

    if (deckCount) deckCount.textContent = deck.length;
    if (trumpBox) trumpBox.innerHTML = cardHTML(trumpCard, { trump: true });
  }

  function renderEnemyPreview() {
    const preview = $('enemyHandPreview');

    if (!preview) {
      return;
    }

    const amount = Math.min(enemyHand.length, 8);
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

    handBox.innerHTML = playerHand.map((card, index) => {
      const selected = card.id === selectedCardId;
      const disabled = locked || gameOver || !canUsePlayerCard(card);

      return `<div style="--i:${index}">${cardHTML(card, { selected, disabled })}</div>`;
    }).join('');

    handBox.querySelectorAll('.playing-card').forEach((cardEl) => {
      cardEl.addEventListener('click', () => {
        const cardId = cardEl.dataset.cardId;
        selectCard(cardId);
      });
    });

    const selectedCard = playerHand.find((card) => card.id === selectedCardId);
    if (selectedInfo) {
      selectedInfo.textContent = selectedCard ? `${selectedCard.fullName} selected` : 'No card selected';
    }
  }

  function renderActionButtons() {
    const beatBtn = $('beatBtn');
    const takeBtn = $('takeBtn');
    const passBtn = $('passBtn');

    if (beatBtn) {
      beatBtn.disabled = locked || gameOver || !(defender === 'player' && battlefield.length > 0 && allDefended());
    }

    if (takeBtn) {
      takeBtn.disabled = locked || gameOver || !(defender === 'player' && battlefield.length > 0);
    }

    if (passBtn) {
      passBtn.disabled = locked || gameOver || !(attacker === 'player' && battlefield.length > 0 && allDefended());
    }
  }

  function canUsePlayerCard(card) {
    if (attacker === 'player') {
      return canAttackWith(card);
    }

    if (defender === 'player') {
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

    const card = playerHand.find((item) => item.id === cardId);

    if (!card) {
      return;
    }

    if (!canUsePlayerCard(card)) {
      if (attacker === 'player') {
        showToast('You can attack only with a rank already on the table.');
      } else {
        showToast('This card cannot beat the attack card.');
      }
      return;
    }

    selectedCardId = cardId;
    render();

    if (attacker === 'player') {
      playerAttack(cardId);
    } else if (defender === 'player') {
      playerDefend(cardId);
    }
  }

  function playerAttack(cardId) {
    const card = removeCard(playerHand, cardId);

    if (!card) {
      return;
    }

    battlefield.push({ attack: card, defense: null });
    selectedCardId = null;
    addLog(`You attack with <strong>${card.fullName}</strong>.`);
    animateTable();
    render();

    if (enemyHand.length === 0 && deck.length === 0) {
      finishRoundAfterBeat();
      return;
    }

    locked = true;
    setStatus('Enemy defense', 'The Dealer is choosing a defense card.');

    window.setTimeout(() => {
      enemyDefend();
      locked = false;
      render();
    }, 700);
  }

  function enemyDefend() {
    const target = firstUndefendedPair();

    if (!target) {
      setStatus('Your attack', 'All cards are defended. Add more or press Pass / Done.');
      return;
    }

    const defense = findLowestDefense(enemyHand, target.attack);

    if (!defense) {
      addLog('<strong>The Dealer cannot defend.</strong> He takes the table.');
      setStatus('Enemy takes', 'The Dealer takes all cards. You continue attacking next round.');
      takeTable('enemy');
      endRound('enemy-took');
      return;
    }

    target.defense = removeCard(enemyHand, defense.id);
    addLog(`The Dealer defends with <strong>${target.defense.fullName}</strong>.`);
    animateTable();

    if (enemyHand.length === 0 && deck.length === 0) {
      finishRoundAfterBeat();
      return;
    }

    if (canPlayerAddAttack()) {
      setStatus('Your attack', 'The card is beaten. Add another card or press Pass / Done.');
    } else {
      setStatus('Table beaten', 'No more legal attack cards. Press Pass / Done.');
    }
  }

  function playerDefend(cardId) {
    const target = firstUndefendedPair();

    if (!target) {
      showToast('There is nothing to defend.');
      return;
    }

    const card = playerHand.find((item) => item.id === cardId);

    if (!card || !cardBeats(card, target.attack, trumpSuit)) {
      showToast('This card cannot defend.');
      return;
    }

    target.defense = removeCard(playerHand, cardId);
    selectedCardId = null;
    addLog(`You defend with <strong>${target.defense.fullName}</strong>.`);
    animateTable();
    render();

    if (playerHand.length === 0 && deck.length === 0) {
      finishRoundAfterBeat();
      return;
    }

    locked = true;
    setStatus('Enemy thinking', 'The Dealer is deciding whether to add another attack.');

    window.setTimeout(() => {
      enemyAddOrStop();
      locked = false;
      render();
    }, 760);
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
      locked = false;
      render();
    }, 740);
  }

  function enemyAddOrStop() {
    if (!allDefended()) {
      setStatus('Your defense', 'Defend the attack or take the cards.');
      return;
    }

    const canAdd = battlefield.length < Math.min(MAX_BATTLE_CARDS, playerHand.length + battlefield.length)
      && playerHand.length > 0;

    if (!canAdd || Math.random() < 0.42) {
      setStatus('You defended', 'All attacks are beaten. Press Beat to clear the table.');
      return;
    }

    const card = chooseEnemyAttackCard();

    if (!card) {
      setStatus('You defended', 'The Dealer has no legal card to add. Press Beat.');
      return;
    }

    battlefield.push({ attack: removeCard(enemyHand, card.id), defense: null });
    addLog(`The Dealer adds <strong>${card.fullName}</strong>.`);
    setStatus('Your defense', 'The Dealer added another card. Defend or take.');
    animateTable();
  }

  function playerTake() {
    if (defender !== 'player' || battlefield.length === 0 || locked || gameOver) {
      return;
    }

    addLog('<strong>You take the table.</strong> The Dealer will attack again.');
    takeTable('player');
    setStatus('You took cards', 'The Dealer stays attacker for the next round.');
    animateTable();
    endRound('player-took');
  }

  function playerBeat() {
    if (defender !== 'player' || !allDefended() || battlefield.length === 0 || locked || gameOver) {
      return;
    }

    finishRoundAfterBeat();
  }

  function playerPass() {
    if (attacker !== 'player' || !allDefended() || battlefield.length === 0 || locked || gameOver) {
      return;
    }

    finishRoundAfterBeat();
  }

  function finishRoundAfterBeat() {
    discardPile.push(...battlefield.flatMap((pair) => [pair.attack, pair.defense]).filter(Boolean));
    battlefield = [];

    const oldDefender = defender;
    attacker = oldDefender;
    defender = attacker === 'player' ? 'enemy' : 'player';

    addLog('<strong>Table beaten.</strong> Cards move to the discard pile.');
    setStatus(
      attacker === 'player' ? 'Your attack' : 'Enemy attack',
      attacker === 'player'
        ? 'You defended successfully. Now you attack.'
        : 'The Dealer defended successfully. Now he attacks.'
    );
    animateTable();
    endRound('beat');
  }

  function endRound() {
    fillHands();
    sortHands();
    selectedCardId = null;
    round += 1;
    render();

    if (checkGameOver()) {
      return;
    }

    if (attacker === 'enemy') {
      enemyAttackFlow();
    } else {
      setStatus('Your attack', 'Choose a card to attack.');
    }
  }

  function fillHands() {
    const attackerHand = attacker === 'player' ? playerHand : enemyHand;
    const defenderHand = defender === 'player' ? playerHand : enemyHand;

    fillToSix(attackerHand);
    fillToSix(defenderHand);

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

    if (who === 'player') {
      playerHand.push(...cards);
      attacker = 'enemy';
      defender = 'player';
    } else {
      enemyHand.push(...cards);
      attacker = 'player';
      defender = 'enemy';
    }

    battlefield = [];
  }

  function checkGameOver() {
    if (deck.length > 0 || battlefield.length > 0) {
      return false;
    }

    if (playerHand.length === 0 && enemyHand.length === 0) {
      openResult('Draw', 'Both players escaped the table at the same time.', 'No Durak');
      gameOver = true;
      render();
      return true;
    }

    if (playerHand.length === 0) {
      openResult('Victory', 'You got rid of all your cards. The Dealer is the Durak.', 'You escaped');
      gameOver = true;
      render();
      return true;
    }

    if (enemyHand.length === 0) {
      openResult('Defeat', 'The Dealer escaped first. You are left with the cards.', 'Durak');
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

  function canPlayerAddAttack() {
    return playerHand.some((card) => canAttackWith(card));
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

  function findLowestDefense(hand, attackCard) {
    const options = hand.filter((card) => cardBeats(card, attackCard, trumpSuit));

    if (options.length === 0) {
      return null;
    }

    return sortCards(options, trumpSuit)[0];
  }

  function chooseEnemyAttackCard() {
    const possible = enemyHand.filter((card) => {
      if (battlefield.length === 0) {
        return true;
      }

      return battleRanks().includes(card.rank);
    });

    if (possible.length === 0) {
      return null;
    }

    return sortCards(possible, trumpSuit)[0];
  }

  function removeCard(hand, cardId) {
    const index = hand.findIndex((card) => card.id === cardId);

    if (index === -1) {
      return null;
    }

    return hand.splice(index, 1)[0];
  }

  function setStatus(title, text) {
    const statusTitle = $('statusTitle');
    const statusText = $('statusText');

    if (statusTitle) statusTitle.textContent = title;
    if (statusText) statusText.textContent = text;
  }

  function clearLog() {
    const log = $('gameLog');
    if (log) {
      log.innerHTML = '';
    }
  }

  function addLog(message) {
    const log = $('gameLog');

    if (!log) {
      return;
    }

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = message;
    log.prepend(entry);
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

  function setupGameButtons() {
    const startGameBtn = $('startGameBtn');
    const newGameBtn = $('newGameBtn');
    const playAgainBtn = $('playAgainBtn');
    const beatBtn = $('beatBtn');
    const takeBtn = $('takeBtn');
    const passBtn = $('passBtn');

    if (startGameBtn) {
      startGameBtn.addEventListener('click', () => {
        showScreen('gameScreen');
        newGame();
      });
    }

    if (newGameBtn) {
      newGameBtn.addEventListener('click', newGame);
    }

    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', () => {
        closeDialog('resultDialog');
        showScreen('gameScreen');
        newGame();
      });
    }

    if (beatBtn) {
      beatBtn.addEventListener('click', playerBeat);
    }

    if (takeBtn) {
      takeBtn.addEventListener('click', playerTake);
    }

    if (passBtn) {
      passBtn.addEventListener('click', playerPass);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    setupGameButtons();
  });
}());
