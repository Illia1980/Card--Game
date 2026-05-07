(function () {
  const SUITS = [
    { key: 'spades', symbol: '♠', name: 'Spades', color: 'black' },
    { key: 'clubs', symbol: '♣', name: 'Clubs', color: 'black' },
    { key: 'diamonds', symbol: '♦', name: 'Diamonds', color: 'red' },
    { key: 'hearts', symbol: '♥', name: 'Hearts', color: 'red' }
  ];

  const RANKS = [
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

  function createDeck() {
    const deck = [];

    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          id: `${rank.key}-${suit.key}`,
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

    return deck;
  }

  function shuffle(deck) {
    const copy = [...deck];

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }

  function sortCards(cards, trumpSuit) {
    return [...cards].sort((a, b) => {
      const aTrump = a.suit === trumpSuit ? 1 : 0;
      const bTrump = b.suit === trumpSuit ? 1 : 0;

      if (aTrump !== bTrump) {
        return aTrump - bTrump;
      }

      if (a.suit !== b.suit) {
        return a.suit.localeCompare(b.suit);
      }

      return a.rankValue - b.rankValue;
    });
  }

  function cardBeats(defense, attack, trumpSuit) {
    if (!defense || !attack) {
      return false;
    }

    if (defense.suit === attack.suit && defense.rankValue > attack.rankValue) {
      return true;
    }

    if (defense.suit === trumpSuit && attack.suit !== trumpSuit) {
      return true;
    }

    return false;
  }

  function cardHTML(card, options = {}) {
    const classes = ['playing-card'];

    if (card.color === 'red') {
      classes.push('red');
    }

    if (options.selected) {
      classes.push('selected');
    }

    if (options.disabled) {
      classes.push('disabled');
    }

    if (options.mini) {
      classes.push('mini');
    }

    if (options.table) {
      classes.push('table-card');
    }

    if (options.defense) {
      classes.push('defense-card');
    }

    if (options.trump) {
      classes.push('trump-small');
    }

    return `
      <div class="${classes.join(' ')}" data-card-id="${card.id}">
        <div class="card-corner">
          <span>${card.rankLabel}</span>
          <span>${card.suitSymbol}</span>
        </div>
        <div class="card-suit-big">${card.suitSymbol}</div>
        <div class="card-rank-name">${card.fullName}</div>
        <div class="card-corner bottom">
          <span>${card.rankLabel}</span>
          <span>${card.suitSymbol}</span>
        </div>
      </div>
    `;
  }

  window.DurakCards = {
    SUITS,
    RANKS,
    createDeck,
    shuffle,
    sortCards,
    cardBeats,
    cardHTML
  };
}());
