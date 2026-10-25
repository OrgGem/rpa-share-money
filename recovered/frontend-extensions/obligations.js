var RpaObligationModel = (() => {
  const shareKeys = new Set(['userId', 'amount', 'paid', 'confirmedBy', 'paidAt', 'paymentBatchId']);
  const id = value => typeof value === 'string' && value.length > 0;
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
    return value;
  }
  function build({actorId, active, notes, start, end}) {
    const empty = status => ({status, actorId: active && id(actorId) ? actorId : null, start, end, pay: {total: status === 'signed-out' ? '0' : null, groups: []}, receive: {total: status === 'signed-out' ? '0' : null, groups: []}});
    if (active !== true || !id(actorId)) return empty('signed-out');
    if (!validDate(start) || !validDate(end) || start > end) return empty('invalid-range');
    if (!Array.isArray(notes)) return empty('unavailable');
    const canonical = new Map();
    let invalid = false;
    // Snapshot revisions identify the current note; ledger receipts are never netted.
    for (const note of notes) {
      if (!note || !id(note.id) || !Number.isSafeInteger(note.revision) || note.revision < 0) { invalid = true; continue; }
      const previous = canonical.get(note.id);
      if (!previous || note.revision > previous.revision) canonical.set(note.id, note);
      else if (note.revision === previous.revision && JSON.stringify(stable(note)) !== JSON.stringify(stable(previous))) invalid = true;
    }
    const pay = new Map(), receive = new Map();
    function add(groups, userId, note, share) {
      let group = groups.get(userId);
      if (!group) { group = {userId, total: 0n, items: []}; groups.set(userId, group); }
      const amount = BigInt(share.amount);
      group.total += amount;
      group.items.push({noteId: note.id, date: String(note.date).slice(0, 10), title: String(note.title || 'Khoản chi'), amount: String(amount)});
    }
    for (const note of canonical.values()) {
      if (note.deleted === true) continue;
      const date = String(note.date || '').slice(0, 10);
      if (!validDate(date)) { invalid = true; continue; }
      if (date < start || date > end) continue;
      if (!id(note.payerId) || !Array.isArray(note.allocations) || (note.deleted !== undefined && typeof note.deleted !== 'boolean')) { invalid = true; continue; }
      const relevant = note.payerId === actorId || note.allocations.some(share => share?.userId === actorId);
      if (!relevant) continue;
      const shares = new Map();
      for (const share of note.allocations) {
        if (!share || !id(share.userId)) { invalid = true; continue; }
        const previous = shares.get(share.userId);
        if (previous && JSON.stringify(stable(previous)) !== JSON.stringify(stable(share))) invalid = true;
        else shares.set(share.userId, share);
      }
      for (const share of shares.values()) {
        if (share.userId === note.payerId) continue;
        if (!Number.isSafeInteger(share.amount) || share.amount < 0 || typeof share.paid !== 'boolean' || Object.keys(share).some(key => !shareKeys.has(key))) { invalid = true; continue; }
        if (share.paid || share.amount === 0) continue;
        if (share.userId === actorId) add(pay, note.payerId, note, share);
        else if (note.payerId === actorId) add(receive, share.userId, note, share);
      }
    }
    if (invalid) return empty('unavailable');
    function output(groups) {
      const values = [...groups.values()].sort((a, b) => a.userId.localeCompare(b.userId));
      for (const group of values) group.items.sort((a, b) => a.date.localeCompare(b.date) || a.noteId.localeCompare(b.noteId));
      return {total: String(values.reduce((sum, group) => sum + group.total, 0n)), groups: values.map(group => ({...group, total: String(group.total)}))};
    }
    return {status: 'ok', actorId, start, end, pay: output(pay), receive: output(receive)};
  }
  return Object.freeze({build});
})();

// Read-only presentation over the app's authorized, currently filtered notes.
const RpaObligationUi = (() => {
  let actor = null;
  const views = new Map();
  const snapshotOwners = new WeakMap();
  let lastMountStatus = 'not-rendered';
  const escape = value => String(value).replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
  const label = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
  const money = value => new Intl.NumberFormat('vi-VN', {style: 'currency', currency: 'VND', maximumFractionDigits: 0}).format(BigInt(value));
  const dateLabel = value => value.slice(8, 10) + '/' + value.slice(5, 7) + '/' + value.slice(0, 4);
  function currentActor() { return D?.user?.active === true && typeof D.user.id === 'string' ? D.user.id : null; }
  function resetActor() {
    const next = currentActor();
    if (next !== actor) { actor = next; views.clear(); }
    // Observe ownership on every render, including settings/other pages, before
    // the date-tab guard. An old array must never be claimed by a new account.
    const loadedNotes = D?.notes;
    if (Array.isArray(loadedNotes) && !snapshotOwners.has(loadedNotes)) snapshotOwners.set(loadedNotes, next);
    return next;
  }
  function findSlots() {
    const slots = new Set(document.querySelectorAll('[data-rpa-obligation-slot]'));
    for (const element of document.querySelectorAll('small,span,label,p,div')) {
      if (element.closest('.note,.modal,header,nav,footer,button,a,[data-rpa-obligation-slot]') || label(element.textContent) !== 'so khoan ghi nhan') continue;
      // Replace only a count card whose other text is a number. Never replace a
      // containing page/section or an expense with the same title.
      for (let parent = element.parentElement, depth = 0; parent && depth < 3; parent = parent.parentElement, depth++) {
        if (['BODY', 'HTML', 'MAIN'].includes(parent.tagName) || parent.querySelector('button,a,input,select,textarea,.note,.modal')) break;
        const rest = label(parent.textContent).replace('so khoan ghi nhan', '').trim();
        if (/^\d[\d.,\s]*$/.test(rest)) { slots.add(parent); break; }
      }
    }
    return [...slots];
  }
  function removeExpenseTotalCards() {
    const title = 'tong khoan chi';
    const labels = new Set([...document.querySelectorAll('small,span,label,p,div,b,strong')].filter(element => label(element.textContent) === title));
    const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (texts.nextNode()) if (label(texts.currentNode.textContent) === title) labels.add(texts.currentNode.parentElement);
    for (const element of labels) {
      if (!element.isConnected || element.closest('.note,.modal,header,nav,footer,button,a,table,script,style,[data-rpa-obligation-slot]')) continue;
      for (let card = element, depth = 0; card && depth < 4; card = card.parentElement, depth++) {
        if (['BODY', 'HTML', 'MAIN'].includes(card.tagName) || card.querySelector('button,a,input,select,textarea,.note,.modal,[data-rpa-obligation-slot]')) break;
        const rest = label(card.textContent).replace(title, '').trim();
        if (/^(?:₫|d|vnd)?\s*[+-]?\d[\d.,\s]*(?:₫|d|vnd)?$/.test(rest)) {
          card.remove();
          break;
        }
      }
    }
  }
  function snapshot() {
    try {
      const bounds = range();
      const loadedNotes = D?.notes;
      // A bootstrap response supplies a new notes array. Never reuse an array
      // previously associated with another signed-in account during a transition.
      if (!Array.isArray(loadedNotes) || snapshotOwners.get(loadedNotes) !== actor) {
        return {status: 'unavailable', start: bounds?.start, end: bounds?.end, pay: {total: null, groups: []}, receive: {total: null, groups: []}};
      }
      return RpaObligationModel.build({actorId: actor, active: !!actor, notes: filtered(), start: bounds?.start, end: bounds?.end});
    } catch { return {status: 'unavailable', pay: {total: null, groups: []}, receive: {total: null, groups: []}}; }
  }
  function userName(id) {
    const user = (D?.users || []).find(value => value.id === id);
    return typeof user?.name === 'string' && user.name.trim() ? user.name : 'Thành viên • ' + id.slice(-6);
  }
  function groupHtml(group) {
    return `<details class="rpa-obligation-group" open><summary><span class="rpa-obligation-person">${escape(userName(group.userId))}<small>${group.items.length} khoản chưa thanh toán</small></span><strong>${escape(money(group.total))}</strong></summary><ul>${group.items.map(item => `<li data-note-id="${escape(item.noteId)}"><span><b>${escape(item.title)}</b><time datetime="${escape(item.date)}">${dateLabel(item.date)}</time></span><strong>${escape(money(item.amount))}</strong></li>`).join('')}</ul></details>`;
  }
  function renderSlot(slot, result, mode, index) {
    slot.classList.add('rpa-obligation-slot');
    slot.dataset.rpaObligationSlot = 'true';
    slot.dataset.start = result.start || '';
    slot.dataset.end = result.end || '';
    const panelId = 'rpa-obligation-panel-' + index;
    const valid = result.status === 'ok';
    const buttons = [['pay', 'Cần trả'], ['receive', 'Cần thu']].map(([direction, title]) => `<button type="button" data-direction="${direction}" aria-pressed="${mode === direction}" aria-controls="${panelId}" onclick="selectRpaObligationView('${direction}')"><span>${title}</span><strong>${valid ? escape(money(result[direction].total)) : '—'}</strong></button>`).join('');
    let body = '';
    if (!valid) body = `<p class="rpa-obligation-empty" role="status">${result.status === 'invalid-range' ? 'Vui lòng chọn khoảng ngày hợp lệ để xem công nợ.' : 'Chưa thể xác định đủ số tiền còn nợ. Vui lòng làm mới dữ liệu.'}</p>`;
    else if (mode) {
      const data = result[mode];
      body = `<section id="${panelId}" class="rpa-obligation-panel" aria-label="${mode === 'pay' ? 'Các khoản bạn cần trả' : 'Các khoản bạn cần thu'}"><p class="rpa-obligation-period">Từ ${dateLabel(result.start)} đến ${dateLabel(result.end)} · Theo bộ lọc hiện tại</p>${data.groups.length ? data.groups.map(groupHtml).join('') : `<p class="rpa-obligation-empty" role="status">${mode === 'pay' ? 'Bạn không có khoản cần trả' : 'Bạn không có khoản cần thu'} trong khoảng ngày và bộ lọc đang chọn.</p>`}</section>`;
    }
    slot.innerHTML = `<div class="rpa-obligation-switch" role="group" aria-label="Công nợ của bạn">${buttons}</div>${body}`;
    RpaBankQrHost.decorate(slot,result,mode);
  }
  function mount() {
    resetActor();
    removeExpenseTotalCards();
    const slots = findSlots();
    if (!actor) {
      for (const slot of slots.filter(value => value.dataset.rpaObligationSlot)) slot.replaceChildren();
      lastMountStatus = 'inactive'; return;
    }
    // These are the three tabs with a confirmed canonical date component.
    if (!['notes', 'report', 'personal'].includes(tab)) { lastMountStatus = 'outside-confirmed-tabs'; return; }
    const result = snapshot(), mode = views.get(tab) || null;
    slots.forEach((slot, index) => renderSlot(slot, result, mode, index));
    lastMountStatus = slots.length ? result.status : 'count-slot-not-found';
  }
  function select(mode) {
    if (!['pay', 'receive'].includes(mode) || !resetActor()) return;
    views.set(tab, mode);
    mount();
    document.querySelector(`.rpa-obligation-switch button[data-direction="${mode}"]`)?.focus();
  }
  return Object.freeze({mount, select, get lastMountStatus() { return lastMountStatus; }});
})();
function selectRpaObligationView(mode) { RpaObligationUi.select(mode); }
const originalRpaObligationRender = render;
render = function(...args) {
  const result = originalRpaObligationRender(...args);
  RpaObligationUi.mount();
  return result;
};
