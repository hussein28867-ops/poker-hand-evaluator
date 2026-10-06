/*
 * Tests for evaluator.js (four-deck rules: repeats allowed, 11 hand ranks).
 *   Node:    node tests/evaluator.test.js
 *   Browser: open tests/index.html
 */
(function () {
  'use strict';
  const isNode = typeof module === 'object' && typeof require === 'function';
  const E = isNode ? require('../evaluator.js') : window.PokerEvaluator;

  const tests = [];
  const test = (name, fn) => tests.push({ name: name, fn: fn });
  const cards = (s) => s.trim().split(/\s+/);
  const ev = (s) => E.evaluateHand(cards(s));

  function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
  function eq(actual, expected, msg) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(expected) +
        ', got ' + JSON.stringify(actual));
    }
  }
  function throws(fn, pattern) {
    try { fn(); } catch (e) {
      if (pattern && !pattern.test(e.message)) throw new Error('wrong error: ' + e.message);
      return;
    }
    throw new Error('expected an error to be thrown');
  }
  const sameSet = (a, b) => a.slice().sort().join() === b.slice().sort().join();

  // ---------- Every official hand type (11 ranks, strongest = 11) ----------

  test('Royal Flush is 11/11', () => {
    const r = ev('As Ks Qs Js Ts');
    eq(r.rank, 11); eq(r.name, 'Royal Flush'); eq(r.description, 'Ace to Ten, all Spades');
  });

  test('Five of a Kind is 10/11 (needs four decks)', () => {
    const r = ev('9h 9h 9d 9d 9c');
    eq(r.rank, 10); eq(r.name, 'Five of a Kind'); eq(r.description, 'Five Nines');
    eq(E.compareHands(r, ev('As Ks Qs Js Ts')), -1, 'five of a kind loses to royal flush');
  });

  test('Straight Flush is 9/11', () => {
    const r = ev('9h 8h 7h 6h 5h');
    eq(r.rank, 9); eq(r.name, 'Straight Flush');
    eq(r.description, 'Nine-high Straight Flush in Hearts');
    eq(E.compareHands(ev('9h 9h 9d 9d 9c'), r), 1, 'five of a kind beats straight flush');
  });

  test('Four of a Kind with kicker', () => {
    const r = ev('Qc Qd Qh Qs 3d');
    eq(r.rank, 8); eq(r.description, 'Four Queens with Three kicker');
    eq(r.cards, ['Qs', 'Qh', 'Qd', 'Qc', '3d']);
  });

  test('Full House: "Kings full of Fives"', () => {
    const r = ev('Kh Kd 5s Kc 5h');
    eq(r.rank, 7); eq(r.name, 'Full House'); eq(r.description, 'Kings full of Fives');
    eq(r.cards.map((c) => c[0]), ['K', 'K', 'K', '5', '5']);
  });

  test('Flush: "Flush in Hearts, Ace high"', () => {
    const r = ev('Ah 9h 7h 4h 2h');
    eq(r.rank, 6); eq(r.description, 'Flush in Hearts, Ace high');
  });

  test('Straight (mixed suits)', () => {
    const r = ev('9c 8d 7h 6s 5c');
    eq(r.rank, 5); eq(r.description, 'Straight, Nine high');
  });

  test('Three of a Kind with kicker', () => {
    const r = ev('7s 7h 7d Ac 2h');
    eq(r.rank, 4); eq(r.description, 'Three Sevens with Ace kicker');
  });

  test('Two Pair with kicker', () => {
    const r = ev('Ac Ad Td Th Qs');
    eq(r.rank, 3); eq(r.description, 'Aces and Tens with Queen kicker');
  });

  test('One Pair: "Pair of Nines with Ace kicker"', () => {
    const r = ev('9s 9d Ah 7c 3d');
    eq(r.rank, 2); eq(r.description, 'Pair of Nines with Ace kicker');
  });

  test('High Card', () => {
    const r = ev('Ad Jc 8h 6s 2c');
    eq(r.rank, 1); eq(r.name, 'High Card'); eq(r.description, 'Ace high with Jack kicker');
  });

  // ---------- The Ace, high and low ----------

  test('Wheel straight A-2-3-4-5 counts as a Five-high straight', () => {
    const r = ev('Ah 2c 3d 4s 5h');
    eq(r.rank, 5); eq(r.tiebreak, [5]);
    eq(r.description, 'Straight, Five high (the Wheel: A-2-3-4-5)');
    eq(r.cards, ['5h', '4s', '3d', '2c', 'Ah'], 'Ace shown at the low end');
  });

  test('Wheel loses to a Six-high straight', () => {
    eq(E.compareHands(cards('Ah 2c 3d 4s 5h'), cards('2d 3c 4h 5s 6d')), -1);
  });

  test('Broadway (A-K-Q-J-10) is the highest straight', () => {
    const r = ev('As Kd Qh Jc Th');
    eq(r.rank, 5); eq(r.description, 'Straight, Ace high (Broadway)');
    eq(E.compareHands(r, ev('Kd Qh Jc Th 9s')), 1);
  });

  test('No wrap-around: Q-K-A-2-3 is not a straight', () => {
    eq(ev('Qh Kd As 2c 3h').rank, 1);
  });

  test('Steel wheel (A-5 suited) is a Straight Flush, not a Royal', () => {
    const r = ev('Ad 2d 3d 4d 5d');
    eq(r.rank, 9); eq(r.description, 'Five-high Straight Flush in Diamonds (A-2-3-4-5)');
  });

  // ---------- Ties and kickers ----------

  test('Tie: identical ranks in different suits', () => {
    eq(E.compareHands(cards('Ah Kd 9c 7s 3h'), cards('As Kc 9d 7h 3c')), 0);
  });

  test('Kicker decides between the same pair', () => {
    eq(E.compareHands(cards('Ah Ad Kc 7s 3h'), cards('As Ac Qd Jh 9c')), 1);
  });

  test('Tie: 7th card below the best five does not matter', () => {
    const a = cards('Ah Ad Kc Qs Jh 3c 2d');
    const b = cards('As Ac Kd Qh Jc 4d 2h');
    eq(E.compareHands(a, b), 0);
  });

  test('Higher pair in Two Pair wins over better kicker', () => {
    eq(E.compareHands(cards('Kh Kd 3c 3s 2h'), cards('Qs Qc Jd Jh Ac')), 1);
  });

  // ---------- Category vs category ----------

  test('Flush vs Straight Flush: 7 cards holding both pick the Straight Flush', () => {
    // Hearts 5-6-7-8-9 plus Ah: an Ace-high flush is also available, but the straight flush is stronger.
    const r = ev('5h 6h 7h 8h 9h Ah Kc');
    eq(r.rank, 9); eq(r.description, 'Nine-high Straight Flush in Hearts');
    eq(r.cards, ['9h', '8h', '7h', '6h', '5h']);
    eq(E.compareHands(r, ev('Ah Kh 8h 4h 2h')), 1, 'straight flush beats ace-high flush');
  });

  test('Flush beats a Straight when 7 cards contain both', () => {
    const r = ev('4c 5d 6c 7c 8h Kc 2c');
    eq(r.rank, 6); eq(r.description, 'Flush in Clubs, King high');
  });

  test('Full House beats Two Pair', () => {
    const fh = ev('3h 3d 3c 2s 2h');
    const tp = ev('Ah Ad Kc Ks Qh');
    eq(E.compareHands(fh, tp), 1);
    eq(E.compareHands(tp, fh), -1);
  });

  test('Two sets of trips in 7 cards make the best Full House', () => {
    const r = ev('Kh Kd Kc Qs Qh Qd 2c');
    eq(r.rank, 7); eq(r.description, 'Kings full of Queens');
  });

  test('Three pairs in 7 cards: best two pairs + best kicker', () => {
    const r = ev('Ah Ad Kc Ks Qh Qd 2c');
    eq(r.rank, 3); eq(r.description, 'Aces and Kings with Queen kicker');
  });

  // ---------- Flop / Turn / River (5, 6, 7 cards) ----------

  test('Flop: exactly 5 cards (2 hole + 3 board)', () => {
    const r = E.evaluatePlayerHand(['Ah', 'Kd'], ['As', '7c', '2d']);
    eq(r.stage, 'Flop'); eq(r.totalCards, 5);
    eq(r.rank, 2); eq(r.description, 'Pair of Aces with King kicker');
  });

  test('Turn: 6 cards, hand improves to Two Pair', () => {
    const r = E.evaluatePlayerHand(['Ah', 'Kd'], ['As', '7c', '2d', 'Kc']);
    eq(r.stage, 'Turn'); eq(r.totalCards, 6);
    eq(r.rank, 3); eq(r.description, 'Aces and Kings with Seven kicker');
  });

  test('River: 7 cards, hand improves to a Full House', () => {
    const r = E.evaluatePlayerHand(['Ah', 'Kd'], ['As', '7c', '2d', 'Kc', 'Ad']);
    eq(r.stage, 'River'); eq(r.totalCards, 7);
    eq(r.rank, 7); eq(r.description, 'Aces full of Kings');
    assert(sameSet(r.cards, ['Ah', 'As', 'Ad', 'Kd', 'Kc']), 'best five: ' + r.cards);
    eq(r.holeCardsUsed, 2);
  });

  test('Board cards can be entered in any slot order (gaps ignored)', () => {
    const r = E.evaluatePlayerHand(['Ah', 'Kd'], [null, 'As', null, '7c', '2d']);
    eq(r.stage, 'Flop'); eq(r.rank, 2);
  });

  test('No result before 2 hole cards and 3 board cards', () => {
    eq(E.evaluatePlayerHand(['Ah', 'Kd'], ['As', '7c']), null);
    eq(E.evaluatePlayerHand(['Ah'], ['As', '7c', '2d']), null);
    eq(E.evaluatePlayerHand([null, null], [null, null, null, null, null]), null);
  });

  test('"Board plays" is flagged when hole cards do not improve the board', () => {
    const r = E.evaluatePlayerHand(['2c', '3d'], ['Ts', 'Jh', 'Qd', 'Kc', 'As']);
    eq(r.rank, 5); eq(r.boardPlays, true); eq(r.holeCardsUsed, 0);
    const r2 = E.evaluatePlayerHand(['Ac', '3d'], ['As', 'Jh', '8d', '5c', '2s']);
    eq(r2.boardPlays, false);
  });

  // ---------- Four decks: repeats allowed, deck-limit validation ----------

  test('The same exact card may appear up to 4 times (four decks)', () => {
    const r = ev('5h 5h 5h 5h 9c');
    eq(r.rank, 8); eq(r.name, 'Four of a Kind'); eq(r.description, 'Four Fives with Nine kicker');
  });

  test('A 5th copy of the same exact card is rejected (deck limit)', () => {
    throws(() => ev('5h 5h 5h 5h 5h'), /Only 4 copies.*5h/);
  });

  test('A repeated card inside a flush still counts as a flush', () => {
    const r = ev('2h 2h 5h 9h Kh');
    eq(r.rank, 6); eq(r.name, 'Flush'); eq(r.description, 'Flush in Hearts, King high');
  });

  test('Five of a kind from mixed suits across decks', () => {
    const r = ev('9h 9h 9d 9d 9c');
    eq(r.rank, 10); eq(r.name, 'Five of a Kind');
  });

  test('isCardAvailable allows up to 4 copies, blocks the 5th', () => {
    const placed = ['5h', '5h', '5h', 'Kd'];
    eq(E.isCardAvailable('5h', placed), true, '3 placed, a 4th is still fine');
    eq(E.isCardAvailable('5h', placed.concat('5h')), false, '4 placed, a 5th is blocked');
    eq(E.countCopies('5h', placed), 3);
    eq(E.findExcessCards(['5h', '5h', '5h', '5h', '5h']), ['5h']);
    eq(E.findExcessCards(['5h', '5h', '5h', '5h']), []);
  });

  test('A straight still needs 5 DIFFERENT consecutive ranks, even with repeats available', () => {
    // Two 7s plus 5,6,8,9: no 5-rank run exists, so this is not a straight.
    const r = ev('5h 6h 7h 7d 8c 9s');
    eq(r.rank, 5); eq(r.description, 'Straight, Nine high');
  });

  // ---------- Duplicate / invalid input ----------

  test('isCardAvailable blocks a 5th exact copy (used by the suit picker)', () => {
    const placed = ['5h', null, 'Kd', null, null, 'As', null];
    eq(E.isCardAvailable('5d', placed), true);
    eq(E.isCardAvailable('10c', ['Tc', 'Tc', 'Tc', 'Tc']), false, '"10c" and "Tc" are the same card');
  });

  test('Invalid input is rejected', () => {
    throws(() => ev('As Kd Qh Jc'), /between 5 and 7/);
    throws(() => ev('As Kd Qh Jc Tc 9c 8c 7c'), /between 5 and 7/);
    throws(() => E.parseCard('1s'), /Invalid card/);
    throws(() => E.parseCard('Ax'), /Invalid card/);
    eq(E.parseCard('10\u2665').code, 'Th');
    eq(E.displayCard('Th'), '10\u2665');
  });

  // ---------- Exhaustive proof (single deck, no repeats: a sanity check that four-deck changes didn't disturb classic poker math) ----------

  test('Exhaustive: all 2,598,960 five-card hands (no repeats) match known category counts and 7,462 distinct strengths', () => {
    const deck = [];
    for (const r of E.RANK_CHARS) for (const s of E.SUIT_CHARS) deck.push(E.parseCard(r + s));
    const counts = new Array(E.RANK_COUNT + 1).fill(0);
    const distinct = new Set();
    let total = 0;
    for (let a = 0; a < 48; a++)
      for (let b = a + 1; b < 49; b++)
        for (let c = b + 1; c < 50; c++)
          for (let d = c + 1; d < 51; d++)
            for (let e = d + 1; e < 52; e++) {
              const r = E.evaluate5([deck[a], deck[b], deck[c], deck[d], deck[e]]);
              counts[r.category]++;
              distinct.add(r.score);
              total++;
            }
    eq(total, 2598960);
    // rank: 1 highCard, 2 onePair, 3 twoPair, 4 trips, 5 straight, 6 flush,
    // 7 fullHouse, 8 fourKind, 9 straightFlush, 10 fiveOfAKind (impossible, single deck), 11 royalFlush.
    eq(counts.slice(1), [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 36, 0, 4],
      'counts for High Card .. Royal Flush');
    eq(distinct.size, 7462, 'distinct hand strengths');
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
    const out = document.getElementById('results');
    out.innerHTML = '<h2>' + summary + '</h2>' + lines.map((l) =>
      '<pre class="' + (l.ok ? 'ok' : 'fail') + '">' + (l.ok ? '\u2713 ' : '\u2717 ') +
      l.text.replace(/</g, '&lt;') + '</pre>').join('');
  }
})();
