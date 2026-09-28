/*
 * evaluator.js — Texas Hold'em hand evaluation. Pure logic, no DOM.
 *
 * Cards are 2-character codes: rank + suit.
 *   Ranks: 2 3 4 5 6 7 8 9 T J Q K A   ("10" is also accepted and stored as "T")
 *   Suits: s h d c                      (♠ ♥ ♦ ♣ are also accepted)
 *   Examples: "As", "Td", "5h", "10c"
 *
 * Works in the browser (window.PokerEvaluator) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PokerEvaluator = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RANK_CHARS = '23456789TJQKA';
  const SUIT_CHARS = 'shdc';
  const SUIT_NAMES = { s: 'Spades', h: 'Hearts', d: 'Diamonds', c: 'Clubs' };
  const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
  // Indexed by numeric rank value (2..14).
  const RANK_NAMES = [null, null, 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
    'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace'];
  const RANK_PLURALS = [null, null, 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes', 'Sevens',
    'Eights', 'Nines', 'Tens', 'Jacks', 'Queens', 'Kings', 'Aces'];

  const HAND_RANKINGS = [
    { rank: 10, name: 'Royal Flush', example: 'A K Q J 10, all one suit' },
    { rank: 9, name: 'Straight Flush', example: 'Five in a row, all one suit' },
    { rank: 8, name: 'Four of a Kind', example: 'Four cards of one rank' },
    { rank: 7, name: 'Full House', example: 'Three of a kind plus a pair' },
    { rank: 6, name: 'Flush', example: 'Any five cards of one suit' },
    { rank: 5, name: 'Straight', example: 'Five in a row, mixed suits' },
    { rank: 4, name: 'Three of a Kind', example: 'Three cards of one rank' },
    { rank: 3, name: 'Two Pair', example: 'Two different pairs' },
    { rank: 2, name: 'One Pair', example: 'Two cards of one rank' },
    { rank: 1, name: 'High Card', example: 'None of the above' },
  ];
  const HAND_NAMES = {};
  HAND_RANKINGS.forEach((h) => { HAND_NAMES[h.rank] = h.name; });

  // Every way to choose 5 indexes out of n (n = 5, 6, 7), computed once.
  const COMBOS = {};
  for (let n = 5; n <= 7; n++) {
    const list = [];
    (function pick(start, chosen) {
      if (chosen.length === 5) { list.push(chosen.slice()); return; }
      for (let i = start; i < n; i++) { chosen.push(i); pick(i + 1, chosen); chosen.pop(); }
    })(0, []);
    COMBOS[n] = list;
  }

  /** Parse a card code into { rank: 2..14, suit: 's'|'h'|'d'|'c', code: 'As' }. Throws if invalid. */
  function parseCard(input) {
    if (input && typeof input === 'object' && typeof input.code === 'string') return parseCard(input.code);
    if (typeof input !== 'string') throw new Error('Invalid card: ' + String(input));
    const s = input.trim()
      .replace(/[︎️]/g, '')
      .replace('♠', 's').replace('♥', 'h').replace('♦', 'd').replace('♣', 'c');
    const m = /^(10|[2-9tjqka])([shdc])$/i.exec(s);
    if (!m) throw new Error('Invalid card: ' + input);
    const r = m[1] === '10' ? 'T' : m[1].toUpperCase();
    const suit = m[2].toLowerCase();
    return { rank: RANK_CHARS.indexOf(r) + 2, suit: suit, code: r + suit };
  }

  function normalizeCode(card) { return parseCard(card).code; }

  /** Human-friendly label, e.g. "Th" -> "10♥". */
  function displayCard(card) {
    const c = parseCard(card);
    return rankLabel(c.code[0]) + SUIT_SYMBOLS[c.suit];
  }

  function rankLabel(rankChar) { return rankChar === 'T' ? '10' : rankChar; }

  function isRed(card) { const s = parseCard(card).suit; return s === 'h' || s === 'd'; }

  /** Codes that appear more than once in the list (after normalizing "10h" -> "Th" etc). */
  function findDuplicates(cards) {
    const seen = new Set();
    const dups = new Set();
    cards.filter(Boolean).forEach((c) => {
      const code = normalizeCode(c);
      if (seen.has(code)) dups.add(code);
      seen.add(code);
    });
    return Array.from(dups);
  }

  /** True if `card` is not already among `placedCards`. Used by the UI to block duplicates. */
  function isCardAvailable(card, placedCards) {
    const code = normalizeCode(card);
    return !(placedCards || []).some((p) => p && normalizeCode(p) === code);
  }

  /**
   * Evaluate exactly 5 parsed cards.
   * Returns { category (1..10), tiebreak (rank values, most significant first), score, cards }.
   * `score` is a single number: higher always means a stronger hand, equal means a tie.
   */
  function evaluate5(cards) {
    const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
    const suit0 = cards[0].suit;
    const isFlush = cards[1].suit === suit0 && cards[2].suit === suit0 &&
      cards[3].suit === suit0 && cards[4].suit === suit0;

    const counts = {};
    for (let i = 0; i < 5; i++) counts[ranks[i]] = (counts[ranks[i]] || 0) + 1;
    // Groups sorted by size, then rank: e.g. full house K K K 5 5 -> [{K,3},{5,2}]
    const groups = Object.keys(counts)
      .map((r) => ({ rank: +r, count: counts[r] }))
      .sort((a, b) => b.count - a.count || b.rank - a.rank);

    let straightHigh = 0;
    if (groups.length === 5) {
      if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
      else if (ranks[0] === 14 && ranks[1] === 5) straightHigh = 5; // the wheel: A-2-3-4-5, Ace plays low
    }

    const g = groups.map((x) => x.rank);
    let category;
    let tiebreak;
    if (straightHigh && isFlush) {
      category = straightHigh === 14 ? 10 : 9;
      tiebreak = [straightHigh];
    } else if (groups[0].count === 4) {
      category = 8; tiebreak = g;
    } else if (groups[0].count === 3 && groups[1].count === 2) {
      category = 7; tiebreak = g;
    } else if (isFlush) {
      category = 6; tiebreak = ranks;
    } else if (straightHigh) {
      category = 5; tiebreak = [straightHigh];
    } else if (groups[0].count === 3) {
      category = 4; tiebreak = g;
    } else if (groups[0].count === 2 && groups[1].count === 2) {
      category = 3; tiebreak = g;
    } else if (groups[0].count === 2) {
      category = 2; tiebreak = g;
    } else {
      category = 1; tiebreak = ranks;
    }

    // Pack category + up to 5 tiebreak ranks into one comparable number (base 16).
    let score = category;
    for (let i = 0; i < 5; i++) score = score * 16 + (tiebreak[i] || 0);

    return { category: category, tiebreak: tiebreak, score: score, cards: cards, straightHigh: straightHigh, counts: counts };
  }

  /** Order the best five for display: groups first (trips before pair), high to low; wheel puts the Ace last. */
  function orderCards(ev) {
    const value = (c) => (ev.straightHigh === 5 && c.rank === 14 ? 1 : c.rank);
    return ev.cards.slice().sort((a, b) =>
      (ev.counts[b.rank] - ev.counts[a.rank]) ||
      (value(b) - value(a)) ||
      (SUIT_CHARS.indexOf(a.suit) - SUIT_CHARS.indexOf(b.suit)));
  }

  function describe(category, tb, suit) {
    const N = (r) => RANK_NAMES[r];
    const P = (r) => RANK_PLURALS[r];
    const S = SUIT_NAMES[suit];
    switch (category) {
      case 10: return 'Ace to Ten, all ' + S;
      case 9: return N(tb[0]) + '-high Straight Flush in ' + S + (tb[0] === 5 ? ' (A-2-3-4-5)' : '');
      case 8: return 'Four ' + P(tb[0]) + ' with ' + N(tb[1]) + ' kicker';
      case 7: return P(tb[0]) + ' full of ' + P(tb[1]);
      case 6: return 'Flush in ' + S + ', ' + N(tb[0]) + ' high';
      case 5: return 'Straight, ' + N(tb[0]) + ' high' +
        (tb[0] === 14 ? ' (Broadway)' : tb[0] === 5 ? ' (the Wheel: A-2-3-4-5)' : '');
      case 4: return 'Three ' + P(tb[0]) + ' with ' + N(tb[1]) + ' kicker';
      case 3: return P(tb[0]) + ' and ' + P(tb[1]) + ' with ' + N(tb[2]) + ' kicker';
      case 2: return 'Pair of ' + P(tb[0]) + ' with ' + N(tb[1]) + ' kicker';
      default: return N(tb[0]) + ' high with ' + N(tb[1]) + ' kicker';
    }
  }

  function finalize(ev) {
    const ordered = orderCards(ev);
    return {
      rank: ev.category,                 // 1..10, 10 = strongest
      name: HAND_NAMES[ev.category],
      description: describe(ev.category, ev.tiebreak, ordered[0].suit),
      score: ev.score,                   // compare two hands with this
      tiebreak: ev.tiebreak.slice(),
      cards: ordered.map((c) => c.code), // the best five, display order
    };
  }

  /** Best 5-card hand from 5, 6 or 7 cards. Checks every 5-card combination. */
  function evaluateHand(cards) {
    if (!Array.isArray(cards)) throw new Error('evaluateHand expects an array of cards');
    if (cards.length < 5 || cards.length > 7) {
      throw new Error('Need between 5 and 7 cards, got ' + cards.length);
    }
    const parsed = cards.map(parseCard);
    const dups = findDuplicates(parsed.map((c) => c.code));
    if (dups.length) throw new Error('Duplicate card: ' + dups.join(', '));

    let best = null;
    const combos = COMBOS[parsed.length];
    for (let i = 0; i < combos.length; i++) {
      const k = combos[i];
      const ev = evaluate5([parsed[k[0]], parsed[k[1]], parsed[k[2]], parsed[k[3]], parsed[k[4]]]);
      if (!best || ev.score > best.score) best = ev;
    }
    return finalize(best);
  }

  /**
   * The app's entry point: the player's 2 hole cards plus 3–5 board cards.
   * Empty slots (null/undefined) are ignored. Returns null until there are
   * 2 hole cards and at least 3 board cards.
   */
  function evaluatePlayerHand(hole, board) {
    const h = (hole || []).filter(Boolean).map(normalizeCode);
    const b = (board || []).filter(Boolean).map(normalizeCode);
    if (h.length > 2) throw new Error('A player has only 2 hole cards');
    if (b.length > 5) throw new Error('The board has at most 5 cards');
    if (h.length < 2 || b.length < 3) return null;

    const result = evaluateHand(h.concat(b));
    result.stage = ['Flop', 'Turn', 'River'][b.length - 3];
    result.totalCards = h.length + b.length;
    result.boardPlays = false;
    if (b.length === 5) {
      const boardOnly = evaluateHand(b);
      if (boardOnly.score === result.score) {
        // Your hole cards don't beat the board by itself — show the board's five.
        result.boardPlays = true;
        result.cards = boardOnly.cards;
      }
    }
    result.holeCardsUsed = result.cards.filter((c) => h.indexOf(c) !== -1).length;
    return result;
  }

  /** 1 if a is stronger, -1 if b is stronger, 0 for a tie. Accepts results or card arrays. */
  function compareHands(a, b) {
    const sa = Array.isArray(a) ? evaluateHand(a).score : a.score;
    const sb = Array.isArray(b) ? evaluateHand(b).score : b.score;
    return sa > sb ? 1 : sa < sb ? -1 : 0;
  }

  return {
    RANK_CHARS: RANK_CHARS,
    SUIT_CHARS: SUIT_CHARS,
    SUIT_NAMES: SUIT_NAMES,
    SUIT_SYMBOLS: SUIT_SYMBOLS,
    RANK_NAMES: RANK_NAMES,
    HAND_RANKINGS: HAND_RANKINGS,
    parseCard: parseCard,
    normalizeCode: normalizeCode,
    displayCard: displayCard,
    rankLabel: rankLabel,
    isRed: isRed,
    findDuplicates: findDuplicates,
    isCardAvailable: isCardAvailable,
    evaluate5: evaluate5,
    evaluateHand: evaluateHand,
    evaluatePlayerHand: evaluatePlayerHand,
    compareHands: compareHands,
  };
});
