/*
 * Tests for scoring.js ("House Points").
 *   Node:    node tests/scoring.test.js
 *   Browser: open tests/index.html
 *
 * Most tests check the points attributed to ONE specific rule (via
 * pointsFor, which sums every breakdown line whose label contains a given
 * substring) rather than the hand's grand total. That's deliberate: rules
 * are scored independently and added together, so a hand built to show off
 * one rule's example often also triggers rule 7 (suit matching) as a side
 * effect of sharing a suit with the pairing card. Testing the rule's own
 * line keeps each test about exactly the rule it names. The "stacking" and
 * "four-deck" tests near the bottom check real grand totals instead.
 */
(function () {
  'use strict';
  const isNode = typeof module === 'object' && typeof require === 'function';
  const E = isNode ? require('../evaluator.js') : window.PokerEvaluator;
  const S = isNode ? require('../scoring.js') : window.PokerScoring;

  const tests = [];
  const test = (name, fn) => tests.push({ name: name, fn: fn });
  const cards = (s) => (s ? s.trim().split(/\s+/) : []);

  function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
  function eq(actual, expected, msg) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(expected) +
        ', got ' + JSON.stringify(actual));
    }
  }

  const result = (hole, board) => S.scoreCards(cards(hole), cards(board));
  const total = (hole, board) => result(hole, board).total;
  /** Sum of every breakdown line whose label contains `substr` \u2014 isolates one rule's contribution. */
  const pointsFor = (hole, board, substr) =>
    result(hole, board).breakdown.filter((b) => b.label.indexOf(substr) !== -1)
      .reduce((sum, b) => sum + b.points, 0);

  // ---------- Rule 8: straight contribution ----------

  test('Straight: hole 3,5 + board 4 -> +2', () => {
    eq(total('3h 5d', '4c'), 2);
  });

  test('Straight: hole 4 + board 3,5 -> +1', () => {
    eq(total('4h 9d', '3c 5s'), 1); // 9d is an unrelated filler so hole has 2 cards
  });

  test('Straight: hole 3,6 + board 4,5 -> +4', () => {
    eq(total('3h 6d', '4c 5s'), 4);
  });

  test('Straight: Ace plays both low (A-2-3-4) and high (J-Q-K-A)', () => {
    eq(pointsFor('Ah 9h', '2c 3d 4s', 'Straight contribution'), 2, 'ace-low run');
    eq(pointsFor('Ah 9h', 'Kc Qd Jc', 'Straight contribution'), 2, 'ace-high run');
  });

  test('Straight: Q-K-A-2-3 does not wrap into one run of 5 \u2014 and only the best single run scores, not the sum of both', () => {
    // Q-K-A (hole has the Q) and A-2-3 (hole has the 2) are each worth +1 alone; a wrap would
    // falsely bridge them into one 5-run, and summing them would double-count the shared Ace.
    eq(total('Qh 2d', 'Kc As 3s'), 1);
  });

  // ---------- Rule 1/3/4/5/6: pocket pair, pair-with-board, trips, quads, five of a kind ----------

  test('Pair with board, offsuit vs suited: hole 7\u2665 + board 7\u2663 -> +1, hole 7\u2665 + board 7\u2665 -> +2', () => {
    eq(pointsFor('7h Kd', '7c 2c 3c', 'Pair with board'), 1);
    eq(pointsFor('7h Kd', '7h 2c 3c', 'Pair with board'), 2);
  });

  test('Face pairs double: hole A,K + board A,K scores +2 and +2 = +4 (offsuit) or +4 and +4 = +8 (suited)', () => {
    eq(pointsFor('Ah Kd', 'Ac Kc 2s', 'Pair with board'), 4, 'offsuit face pairs');
    eq(pointsFor('Ah Kd', 'Ah Kd 2s', 'Pair with board'), 8, 'suited face pairs');
  });

  test('Pocket pair: hole 9\u26659\u2665 (suited) -> +2, hole 9\u26659\u2660 (offsuit) -> +1', () => {
    eq(pointsFor('9h 9h', '2c 3d 4s', 'Pocket pair'), 2);
    eq(pointsFor('9h 9s', '2c 3d 4s', 'Pocket pair'), 1);
  });

  test('Three of a kind replaces pocket-pair points: +5 flat', () => {
    eq(pointsFor('9h 9s', '9c 2d 4s', 'Three of a kind'), 5);
  });

  test('Four of a kind replaces three-of-a-kind points: +7 flat', () => {
    eq(pointsFor('9h 9s', '9c 9d 4s', 'Four of a kind'), 7);
  });

  test('Five of a kind (needs four decks) replaces four-of-a-kind points: +10 flat', () => {
    eq(pointsFor('5s 5d', '5h 5h 5c', 'Five of a kind'), 10); // 5h appears twice: legal, four decks allow up to 4
  });

  // ---------- Rule 2: two suited face cards ----------

  test('Hole K\u2665Q\u2665 -> +2 (two different face cards, same suit)', () => {
    eq(pointsFor('Kh Qh', '2c 3d 4s', 'Suited face cards'), 2);
  });

  test('A suited pocket pair of face cards scores as a pocket pair only, not rule 2 as well', () => {
    const r = result('Jh Jh', '2c 3d 4s'); // same exact card twice: legal, four decks
    eq(r.total, 2, 'pocket pair suited (+2) only');
    assert(!r.breakdown.some((b) => b.label.indexOf('Suited face cards') !== -1), 'rule 2 should not also fire');
  });

  // ---------- Rule 7: suit matching ----------

  test('Hole 5\u2665 + 3 hearts on board -> +3', () => {
    eq(total('5h 2d', '9h Jh Qh'), 3);
  });

  test('Hole 5\u2663 + 2 clubs on board -> +2', () => {
    eq(total('5c 2d', '9c Jc Qh'), 2);
  });

  test('Suit matching counts each hole card separately, even when they share a suit', () => {
    // Both hole cards are hearts; 3 hearts on the board scores +3 for each = +6, as two lines.
    const r = result('5h 8h', '9h Jh Qh');
    eq(r.total, 6);
    eq(r.breakdown.length, 2);
  });

  // ---------- Stacking: several rules in one hand ----------

  test('Stacking: pair-with-board + suited face cards + suit matching all add up', () => {
    // Hole K\u2665Q\u2665, board K\u2663 9\u2665 2\u2660:
    //   King pairs with board K\u2663 (face, offsuit): +2
    //   K\u2665/Q\u2665 are suited face cards: +2
    //   K\u2665 matches the one heart (9\u2665) on board: +1; Q\u2665 matches it too: +1
    const r = result('Kh Qh', 'Kc 9h 2s');
    eq(r.total, 2 + 2 + 1 + 1);
    eq(r.breakdown.length, 4);
  });

  // ---------- Four-deck cases ----------

  test('The same card 4 times: hole 5\u2660,5\u2666 + board 5\u2665,5\u2665,5\u2663 -> five of a kind (+10)', () => {
    eq(total('5s 5d', '5h 5h 5c'), 10); // the second 5h is a 2nd physical copy, legal (max 4)
  });

  test('Five of a kind from hole + board copies spread across suits', () => {
    eq(pointsFor('9h 9d', '9c 9s 9h', 'Five of a kind'), 10);
  });

  // ---------- Gating: computeHousePoints requires 2 hole + 3..5 board cards ----------

  test('computeHousePoints returns null before 2 hole cards and 3 board cards', () => {
    eq(S.computeHousePoints(cards('Ah Kd'), cards('Ac 2d')), null);
    eq(S.computeHousePoints(cards('Ah'), cards('Ac 2d 3s')), null);
    eq(S.computeHousePoints([], []), null);
  });

  test('computeHousePoints works at 3, 4 and 5 board cards (flop, turn, river)', () => {
    const flop = S.computeHousePoints(cards('Ah Kd'), cards('Ac 2d 3s'));
    const turn = S.computeHousePoints(cards('Ah Kd'), cards('Ac 2d 3s 4h'));
    const river = S.computeHousePoints(cards('Ah Kd'), cards('Ac 2d 3s 4h 5c'));
    assert(flop && turn && river, 'all three stages should return a result');
    assert(river.total >= flop.total, 'more board cards should not lose points here');
  });

  // ---------- Runner ----------

  let passed = 0;
  const lines = [];
  tests.forEach((t, i) => {
    const start = Date.now();
    try {
      t.fn();
      passed++;
      lines.push({ ok: true, text: (i + 1) + '. ' + t.name + ' (' + (Date.now() - start) + ' ms)' });
    } catch (e) {
      lines.push({ ok: false, text: (i + 1) + '. ' + t.name + '\n     ' + e.message });
    }
  });
  const summary = passed + ' / ' + tests.length + ' tests passed';

  if (isNode) {
    lines.forEach((l) => console.log((l.ok ? '  \u2713 ' : '  \u2717 ') + l.text));
    console.log('\n' + summary);
    if (passed !== tests.length) process.exitCode = 1;
  } else {
    const out = document.getElementById('scoring-results');
    out.innerHTML = '<h2>' + summary + '</h2>' + lines.map((l) =>
      '<pre class="' + (l.ok ? 'ok' : 'fail') + '">' + (l.ok ? '\u2713 ' : '\u2717 ') +
      l.text.replace(/</g, '&lt;') + '</pre>').join('');
  }
})();
