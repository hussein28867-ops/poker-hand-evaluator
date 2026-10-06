/*
 * scoring.js \u2014 "House Points": a second, separate scoring system for the
 * player's hand. It never mixes with the official poker ranking in
 * evaluator.js. Pure logic, no DOM.
 *
 * "Hole cards" = the player's 2 cards. "Board" = 3 to 5 community cards.
 * "Face cards" = J, Q, K, A. "Suited" = same suit.
 *
 * Works in the browser (window.PokerScoring) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./evaluator.js'));
  else root.PokerScoring = factory(root.PokerEvaluator);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  // Every point value lives here \u2014 edit values without touching the logic below.
  const POINTS = {
    pocketPair: 1,              // both hole cards the same rank
    pocketPairSuited: 2,        // ...and the same suit (replaces pocketPair, not added to it)
    twoFaceSameSuit: 2,         // two different face cards in hand, same suit
    pairWithBoardBase: 1,       // one hole card's rank matches one board card's rank
    pairWithBoardSuited: 2,     // ...and the two cards share a suit (replaces the base value)
    pairWithBoardFaceMultiplier: 2, // doubles the pair-with-board value when the rank is a face card
    threeOfAKind: 5,            // hole + board, replaces all pair points for that rank
    fourOfAKind: 7,             // replaces the three-of-a-kind points for that rank
    fiveOfAKind: 10,            // replaces the four-of-a-kind points for that rank (needs 4 decks)
    suitMatchPerCard: 1,        // per board card sharing a hole card's suit, per hole card
  };

  const SHORT_RANK = { 1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
    9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const isFace = (rank) => E.FACE_RANKS.indexOf(rank) !== -1;

  /**
   * Pocket pair, pair-with-board, three/four/five of a kind \u2014 all one family:
   * for each rank the player holds, total count = hole copies + board copies.
   * The count alone decides the category, so higher counts naturally replace
   * (never stack with) lower ones for that same rank.
   */
  function scoreRankFamily(hole, board, add) {
    const holeRanks = hole[0].rank === hole[1].rank ? [hole[0].rank] : [hole[0].rank, hole[1].rank];
    holeRanks.forEach((r) => {
      const holeOfRank = hole.filter((c) => c.rank === r);
      const boardOfRank = board.filter((c) => c.rank === r);
      const n = holeOfRank.length + boardOfRank.length;
      if (n < 2) return;
      const rankName = E.RANK_PLURALS[r];

      if (n === 2 && holeOfRank.length === 2) {
        const suited = holeOfRank[0].suit === holeOfRank[1].suit;
        const pts = suited ? POINTS.pocketPairSuited : POINTS.pocketPair;
        add('Pocket pair' + (suited ? ', suited' : '') + ' (' + rankName + '): +' + pts, pts);
      } else if (n === 2) {
        const suited = holeOfRank[0].suit === boardOfRank[0].suit;
        let pts = suited ? POINTS.pairWithBoardSuited : POINTS.pairWithBoardBase;
        const face = isFace(r);
        if (face) pts *= POINTS.pairWithBoardFaceMultiplier;
        const tags = [face ? 'face' : null, suited ? 'suited' : null].filter(Boolean);
        add('Pair with board' + (tags.length ? ' (' + tags.join(', ') + ')' : '') + ' (' + rankName + '): +' + pts, pts);
      } else if (n === 3) {
        add('Three of a kind (' + rankName + '): +' + POINTS.threeOfAKind, POINTS.threeOfAKind);
      } else if (n === 4) {
        add('Four of a kind (' + rankName + '): +' + POINTS.fourOfAKind, POINTS.fourOfAKind);
      } else {
        // n >= 5. Named hands stop at five of a kind; extra copies score the same.
        add('Five of a kind (' + rankName + '): +' + POINTS.fiveOfAKind, POINTS.fiveOfAKind);
      }
    });
  }

  /** Two different face cards in hand, same suit. (A suited pocket pair of face cards is scored as a pocket pair only.) */
  function scoreSuitedFaceCards(hole, add) {
    if (hole[0].rank === hole[1].rank) return;
    if (hole[0].suit !== hole[1].suit) return;
    if (!isFace(hole[0].rank) || !isFace(hole[1].rank)) return;
    add('Suited face cards (' + E.RANK_NAMES[hole[0].rank] + ', ' + E.RANK_NAMES[hole[1].rank] + '): +' +
      POINTS.twoFaceSameSuit, POINTS.twoFaceSameSuit);
  }

  /** For each hole card, +1 per board card of the same suit (regardless of rank). */
  function scoreSuitMatching(hole, board, add) {
    hole.forEach((hc) => {
      const n = board.filter((bc) => bc.suit === hc.suit).length;
      if (n === 0) return;
      const pts = n * POINTS.suitMatchPerCard;
      add(E.SUIT_NAMES[hc.suit] + ' on board x' + n + ' (your ' + E.rankLabel(hc.code[0]) + E.SUIT_SYMBOLS[hc.suit] + '): +' + pts, pts);
    });
  }

  /**
   * Best run of 3+ consecutive ranks (hole + board, Ace high or low, no
   * wrap-around) that uses at least one hole card. Repeated ranks count once.
   * Points = (distinct hole ranks inside the run) x (run length - 2).
   */
  function bestStraightContribution(hole, board) {
    const holeRanks = new Set(hole.map((c) => c.rank));
    const allRanks = new Set(hole.concat(board).map((c) => c.rank));
    const hasAceHole = holeRanks.has(14);
    const hasAceAny = allRanks.has(14);
    const present = (v) => (v === 1 || v === 14 ? hasAceAny : allRanks.has(v));
    const fromHole = (v) => (v === 1 || v === 14 ? hasAceHole : holeRanks.has(v));

    let best = { points: 0, length: 0, low: 0, high: 0 };
    for (let low = 1; low <= 12; low++) {
      for (let len = 3; low + len - 1 <= 14; len++) {
        const high = low + len - 1;
        let ok = true;
        const holeRanksInRun = new Set();
        for (let v = low; v <= high; v++) {
          if (!present(v)) { ok = false; break; }
          if (fromHole(v)) holeRanksInRun.add(v);
        }
        if (!ok || holeRanksInRun.size === 0) continue;
        const pts = holeRanksInRun.size * (len - 2);
        if (pts > best.points) best = { points: pts, length: len, low: low, high: high };
      }
    }
    return best;
  }

  function scoreStraight(hole, board, add) {
    const best = bestStraightContribution(hole, board);
    if (best.points <= 0) return;
    const parts = [];
    for (let v = best.low; v <= best.high; v++) parts.push(SHORT_RANK[v]);
    add('Straight contribution (' + parts.join('-') + '): +' + best.points, best.points);
  }

  /**
   * Compute House Points for an arbitrary set of hole/board cards (no
   * minimum card count \u2014 used internally and by tests). Returns
   * { total, breakdown: [{ label, points }] }.
   */
  function scoreCards(holeCodes, boardCodes) {
    const hole = (holeCodes || []).filter(Boolean).map(E.parseCard);
    const board = (boardCodes || []).filter(Boolean).map(E.parseCard);
    const breakdown = [];
    let total = 0;
    const add = (label, pts) => {
      if (!pts) return;
      breakdown.push({ label: label, points: pts });
      total += pts;
    };

    if (hole.length === 2) {
      scoreRankFamily(hole, board, add);
      scoreSuitedFaceCards(hole, add);
      scoreSuitMatching(hole, board, add);
      scoreStraight(hole, board, add);
    }

    return { total: total, breakdown: breakdown };
  }

  /**
   * The app's entry point: House Points for the player's 2 hole cards plus
   * 3\u20135 board cards. Returns null until there are 2 hole cards and at least
   * 3 board cards (mirrors evaluatePlayerHand's gating).
   */
  function computeHousePoints(hole, board) {
    const h = (hole || []).filter(Boolean);
    const b = (board || []).filter(Boolean);
    if (h.length !== 2 || b.length < 3 || b.length > 5) return null;
    return scoreCards(h, b);
  }

  return {
    POINTS: POINTS,
    scoreCards: scoreCards,
    computeHousePoints: computeHousePoints,
  };
});
