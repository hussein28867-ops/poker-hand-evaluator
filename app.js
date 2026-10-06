/* app.js \u2014 UI for the hand evaluator. All poker logic lives in evaluator.js. */
(function () {
  'use strict';

  const E = window.PokerEvaluator;
  const S = window.PokerScoring;
  const STORAGE_KEY = 'poker-hand-evaluator:v2';
  const RANK_PICKER = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
  const SUIT_PICKER = ['s', 'h', 'd', 'c'];
  const TEXT_VS = '\ufe0e'; // keep \u2665 \u2666 \u2660 \u2663 as text, never emoji
  const SLOT_LABELS = {
    board: ['Flop', 'Flop', 'Flop', 'Turn', 'River'],
    hand: ['Card 1', 'Card 2'],
  };
  const ZONE_NAMES = { board: 'Board', hand: 'Your Hand' };

  const state = { board: [null, null, null, null, null], hand: [null, null] };
  let lastResult = null;      // official result currently shown, to detect changes/improvements
  let lastHouseTotal = null;  // House Points total currently shown, to detect increases
  let picker = null;          // { zone, index, returnFocus }

  const $ = (id) => document.getElementById(id);
  const els = {
    boardSlots: $('board-slots'),
    handSlots: $('hand-slots'),
    stageChip: $('stage-chip'),
    clearAll: $('clear-all'),
    hint: $('res-hint'),
    hintSub: $('hint-sub'),
    body: $('res-body'),
    stage: $('res-stage'),
    chipUp: $('chip-up'),
    name: $('res-name'),
    desc: $('res-desc'),
    rank: $('res-rank'),
    bar: $('res-bar'),
    cards: $('res-cards'),
    note: $('res-note'),
    rankMax: $('res-rank-max'),
    cheatList: $('cheat-list'),
    houseBody: $('house-body'),
    houseEmpty: $('house-empty'),
    houseTotal: $('house-total'),
    houseChipUp: $('house-chip-up'),
    houseBreakdown: $('house-breakdown'),
    backdrop: $('backdrop'),
    sheetTitle: $('sheet-title'),
    sheetSub: $('sheet-sub'),
    sheetBody: $('sheet-body'),
    sheetBack: $('sheet-back'),
    sheetClose: $('sheet-close'),
  };

  // ---------- Persistence (survives an accidental reload mid-hand) ----------

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) return;
      const valid = (arr, n) => Array.isArray(arr) && arr.length === n;
      if (valid(saved.board, 5) && valid(saved.hand, 2)) {
        const all = saved.board.concat(saved.hand);
        if (E.findExcessCards(all).length === 0) {
          all.forEach((c) => { if (c) E.parseCard(c); }); // throws on garbage
          state.board = saved.board;
          state.hand = saved.hand;
        }
      }
    } catch (e) { /* ignore bad or blocked storage */ }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  // ---------- Helpers ----------

  function allPlaced() { return state.board.concat(state.hand).filter(Boolean); }

  function placedExcept(zone, index) {
    const out = [];
    ['board', 'hand'].forEach((z) => state[z].forEach((c, i) => {
      if (c && !(z === zone && i === index)) out.push(c);
    }));
    return out;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function cardLabel(code) { return E.rankLabel(code[0]) + E.SUIT_SYMBOLS[code[1]] + TEXT_VS; }

  function spokenCard(code) {
    return E.RANK_NAMES[E.parseCard(code).rank] + ' of ' + E.SUIT_NAMES[code[1]];
  }

  /** A CSS-drawn playing card. */
  function cardFace(code) {
    const c = el('div', 'card' + (E.isRed(code) ? ' red' : ''));
    const corner = el('div', 'corner');
    corner.appendChild(el('span', 'r', E.rankLabel(code[0])));
    corner.appendChild(el('span', 's', E.SUIT_SYMBOLS[code[1]] + TEXT_VS));
    c.appendChild(corner);
    c.appendChild(el('div', 'pip', E.SUIT_SYMBOLS[code[1]] + TEXT_VS));
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  // ---------- Slots ----------

  function buildSlots() {
    ['board', 'hand'].forEach((zone) => {
      const wrap = zone === 'board' ? els.boardSlots : els.handSlots;
      state[zone].forEach((_, i) => {
        const b = el('button', 'slot');
        b.type = 'button';
        b.dataset.zone = zone;
        b.dataset.index = String(i);
        b.addEventListener('click', () => onSlotTap(zone, i, b));
        wrap.appendChild(b);
      });
    });
  }

  function renderSlots(best) {
    const bestSet = best ? new Set(best.cards) : null;
    document.querySelectorAll('.slot').forEach((b) => {
      const zone = b.dataset.zone;
      const i = +b.dataset.index;
      const code = state[zone][i];
      b.textContent = '';
      b.classList.toggle('empty', !code);
      b.classList.toggle('filled', !!code);
      b.classList.toggle('in-best', !!(code && bestSet && bestSet.has(code)));
      b.classList.toggle('not-best', !!(code && bestSet && !bestSet.has(code)));
      if (code) {
        b.appendChild(cardFace(code));
        b.setAttribute('aria-label', ZONE_NAMES[zone] + ': ' + spokenCard(code) + '. Tap to change or remove.');
      } else {
        b.appendChild(el('span', 'plus', '+'));
        b.appendChild(el('span', 'lbl', SLOT_LABELS[zone][i]));
        b.setAttribute('aria-label', ZONE_NAMES[zone] + ', ' + SLOT_LABELS[zone][i] + ': empty. Tap to add a card.');
      }
    });
  }

  // ---------- Result panel ----------

  function buildStaticParts() {
    const n = E.RANK_COUNT;
    els.rankMax.textContent = 'out of ' + n;
    for (let i = 0; i < n; i++) {
      const seg = el('div', 'seg');
      // red \u2192 amber \u2192 green across the segments
      seg.style.setProperty('--seg', 'hsl(' + Math.round(4 + i * (130 / (n - 1))) + ', 78%, 56%)');
      els.bar.appendChild(seg);
    }
    els.bar.style.gridTemplateColumns = 'repeat(' + n + ', 1fr)';
    E.HAND_RANKINGS.forEach((h) => {
      const li = el('li');
      li.dataset.rank = String(h.rank);
      li.appendChild(el('span', 'num', h.rank + '/' + n));
      li.appendChild(el('span', 'nm', h.name));
      li.appendChild(el('span', 'ex', h.example));
      els.cheatList.appendChild(li);
    });
  }

  function renderResult() {
    const hand = state.hand.filter(Boolean);
    const board = state.board.filter(Boolean);
    let result = null;
    try { result = E.evaluatePlayerHand(hand, board); } catch (e) { result = null; }

    // Board stage chip
    const stageNames = { 3: 'Flop', 4: 'Turn', 5: 'River' };
    els.stageChip.textContent = stageNames[board.length] || (board.length === 0 ? 'Waiting for flop' : board.length + ' of 3 flop cards');
    els.stageChip.classList.toggle('live', !!stageNames[board.length]);

    if (!result) {
      els.hint.hidden = false;
      els.body.hidden = true;
      els.houseBody.hidden = true;
      const need = [];
      if (hand.length < 2) need.push((2 - hand.length) + ' of your cards');
      if (board.length < 3) need.push((3 - board.length) + ' more board card' + (3 - board.length === 1 ? '' : 's'));
      els.hintSub.textContent = need.length ? 'Still needed: ' + need.join(' and ') : '';
      highlightCheat(0);
      lastResult = null;
      lastHouseTotal = null;
      return null;
    }

    const changed = !lastResult || lastResult.score !== result.score ||
      lastResult.cards.join() !== result.cards.join();

    els.hint.hidden = true;
    els.body.hidden = false;
    els.stage.textContent = result.stage + ' \u00b7 ' + result.totalCards + ' cards';
    els.name.textContent = result.name;
    els.desc.textContent = result.description;
    els.rank.textContent = String(result.rank);
    Array.prototype.forEach.call(els.bar.children, (seg, i) => seg.classList.toggle('on', i < result.rank));

    els.cards.textContent = '';
    result.cards.forEach((code) => els.cards.appendChild(cardFace(code)));
    els.cards.setAttribute('aria-label', 'Best five: ' + result.cards.map(spokenCard).join(', '));

    if (result.boardPlays) {
      els.note.hidden = false;
      els.note.textContent = 'The board plays \u2014 your 2 cards don\u2019t improve on the 5 community cards, so everyone still in the hand has at least this.';
    } else {
      els.note.hidden = true;
    }

    if (changed) {
      if (lastResult && result.score > lastResult.score) {
        els.chipUp.hidden = false;
        els.chipUp.textContent = result.rank > lastResult.rank
          ? '\u25b2 Up from ' + lastResult.name
          : '\u25b2 Stronger ' + result.name;
      } else {
        els.chipUp.hidden = true;
      }
      els.body.classList.remove('changed');
      void els.body.offsetWidth; // restart the animation
      els.body.classList.add('changed');
    }

    highlightCheat(result.rank);
    lastResult = result;

    renderHouse(hand, board);

    return result;
  }

  function renderHouse(hand, board) {
    const house = S.computeHousePoints(hand, board);
    els.houseBody.hidden = !house;
    if (!house) { lastHouseTotal = null; return; }

    const changed = lastHouseTotal === null || lastHouseTotal !== house.total;

    els.houseTotal.textContent = String(house.total);
    els.houseBreakdown.textContent = '';
    if (house.breakdown.length === 0) {
      els.houseEmpty.hidden = false;
    } else {
      els.houseEmpty.hidden = true;
      house.breakdown.forEach((line) => {
        const li = el('li');
        const parts = /^(.*): \+(\d+)$/.exec(line.label);
        li.appendChild(el('span', 'house-line-label', parts ? parts[1] : line.label));
        li.appendChild(el('span', 'house-line-points', '+' + line.points));
        els.houseBreakdown.appendChild(li);
      });
    }

    if (changed) {
      if (lastHouseTotal !== null && house.total > lastHouseTotal) {
        els.houseChipUp.hidden = false;
        els.houseChipUp.textContent = '\u25b2 +' + (house.total - lastHouseTotal);
      } else {
        els.houseChipUp.hidden = true;
      }
      els.houseBody.classList.remove('changed');
      void els.houseBody.offsetWidth; // restart the animation
      els.houseBody.classList.add('changed');
    }

    lastHouseTotal = house.total;
  }

  function highlightCheat(rank) {
    Array.prototype.forEach.call(els.cheatList.children, (li) => {
      const on = +li.dataset.rank === rank;
      li.classList.toggle('current', on);
      if (on) li.setAttribute('aria-current', 'true'); else li.removeAttribute('aria-current');
    });
  }

  function render() {
    const result = renderResult();
    renderSlots(result);
  }

  // ---------- Picker sheet ----------

  function openSheet() {
    els.backdrop.classList.add('open');
    els.backdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sheet-open');
  }

  function closeSheet() {
    els.backdrop.classList.remove('open');
    els.backdrop.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sheet-open');
    const focusTarget = picker && picker.returnFocus;
    picker = null;
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }

  function setSheet(title, sub, showBack) {
    els.sheetTitle.textContent = title;
    els.sheetSub.textContent = sub;
    els.sheetBack.hidden = !showBack;
    els.sheetBody.textContent = '';
  }

  function slotName(zone, index) {
    return zone === 'board'
      ? 'Board \u00b7 ' + SLOT_LABELS.board[index] + (index < 3 ? ' card ' + (index + 1) : ' card')
      : 'Your Hand \u00b7 ' + SLOT_LABELS.hand[index];
  }

  function onSlotTap(zone, index, button) {
    picker = { zone: zone, index: index, returnFocus: button };
    if (state[zone][index]) showActions(); else showRanks();
    openSheet();
  }

  function showActions() {
    const code = state[picker.zone][picker.index];
    setSheet(cardLabel(code), slotName(picker.zone, picker.index), false);
    const preview = cardFace(code);
    preview.classList.add('action-card');
    els.sheetBody.appendChild(preview);

    const list = el('div', 'action-list');
    const change = el('button', 'action-btn', 'Change card');
    change.type = 'button';
    change.addEventListener('click', () => showRanks());
    const remove = el('button', 'action-btn danger', 'Remove card');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      state[picker.zone][picker.index] = null;
      save();
      render();
      closeSheet();
    });
    list.appendChild(change);
    list.appendChild(remove);
    els.sheetBody.appendChild(list);
    change.focus({ preventScroll: true });
  }

  function showRanks() {
    setSheet('Pick a rank', slotName(picker.zone, picker.index), !!state[picker.zone][picker.index]);
    const taken = placedExcept(picker.zone, picker.index);
    const grid = el('div', 'rank-grid');
    RANK_PICKER.forEach((r) => {
      const b = el('button', 'rank-btn', E.rankLabel(r));
      b.type = 'button';
      // A rank is only unavailable once every suit has all MAX_COPIES copies on the table.
      b.disabled = SUIT_PICKER.every((s) => !E.isCardAvailable(r + s, taken));
      b.setAttribute('aria-label', E.RANK_NAMES[E.parseCard(r + 's').rank] + (b.disabled ? ', all used' : ''));
      b.addEventListener('click', () => showSuits(r));
      grid.appendChild(b);
    });
    els.sheetBody.appendChild(grid);
    const first = grid.querySelector('button:not(:disabled)');
    if (first) first.focus({ preventScroll: true });
  }

  function showSuits(rank) {
    const current = state[picker.zone][picker.index];
    setSheet('Pick a suit', E.rankLabel(rank) + ' of \u2026', true);
    picker.backTo = 'ranks';
    const taken = placedExcept(picker.zone, picker.index);
    const grid = el('div', 'suit-grid');
    SUIT_PICKER.forEach((s) => {
      const code = rank + s;
      const b = el('button', 'suit-btn' + (s === 'h' || s === 'd' ? ' red' : ''));
      b.type = 'button';
      b.appendChild(el('span', 'big', E.rankLabel(rank) + E.SUIT_SYMBOLS[s] + TEXT_VS));
      b.appendChild(el('span', 'name', E.SUIT_NAMES[s]));
      const count = E.countCopies(code, taken);
      const available = count < E.MAX_COPIES;
      b.disabled = !available;
      // Four decks: up to MAX_COPIES of the exact same card can be on the table at once.
      const tagTexts = [];
      if (!available) tagTexts.push('All ' + E.MAX_COPIES + ' placed');
      else if (count > 0) tagTexts.push(count + ' of ' + E.MAX_COPIES + ' placed');
      if (code === current) { b.classList.add('current'); tagTexts.push('Current'); }
      if (tagTexts.length) {
        const stack = el('div', 'tag-stack');
        tagTexts.forEach((t) => stack.appendChild(el('span', 'tag', t)));
        b.appendChild(stack);
      }
      b.setAttribute('aria-label', spokenCard(code) +
        (available ? (count > 0 ? ', ' + count + ' already placed' : '') : ', all ' + E.MAX_COPIES + ' copies already placed'));
      b.addEventListener('click', () => {
        if (!E.isCardAvailable(code, placedExcept(picker.zone, picker.index))) return;
        state[picker.zone][picker.index] = code;
        save();
        render();
        closeSheet();
      });
      grid.appendChild(b);
    });
    els.sheetBody.appendChild(grid);
    const first = grid.querySelector('button:not(:disabled)');
    if (first) first.focus({ preventScroll: true });
  }

  els.sheetBack.addEventListener('click', () => {
    if (!picker) return;
    if (picker.backTo === 'ranks') { picker.backTo = null; showRanks(); } else showActions();
  });
  els.sheetClose.addEventListener('click', closeSheet);
  els.backdrop.addEventListener('click', (e) => { if (e.target === els.backdrop) closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && picker) closeSheet(); });

  els.clearAll.addEventListener('click', () => {
    state.board = [null, null, null, null, null];
    state.hand = [null, null];
    lastResult = null;
    lastHouseTotal = null;
    save();
    render();
  });

  // ---------- Start ----------

  buildSlots();
  buildStaticParts();
  load();
  render();
  // Don't animate the very first paint after a reload.
  els.body.classList.remove('changed');
  els.chipUp.hidden = true;
  els.houseBody.classList.remove('changed');
  els.houseChipUp.hidden = true;

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
    });
  }

  // Exposed for debugging in the console.
  window.__pokerApp = { state: state, render: render, allPlaced: allPlaced };
})();
