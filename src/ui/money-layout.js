// Display-only: preserve amounts, currency text, permissions and event handlers.
(() => {
  'use strict';
  window.RpaMoneyLayout?.destroy();

  const number = String.raw`(?:[+\-\u2212]\s*)?\d+(?:[.,\u00a0\u202f ]\d{3})*(?:[.,]\d{1,2})?`;
  const currency = String.raw`(?:VND|VNĐ|đồng|₫|đ)(?![\p{L}\p{N}])`;
  const whole = new RegExp(`^\\s*${number}\\s*${currency}\\s*$`, 'iu');
  const fragment = new RegExp(`${number}\\s*${currency}`, 'giu');
  const ignored = 'script,style,noscript,textarea,input,select,option,svg,canvas,code,pre,[contenteditable]:not([contenteditable="false"]),[data-rpa-money-ignore]';
  const inlineTags = new Set(['SPAN', 'B', 'STRONG', 'SMALL', 'U', 'EM', 'I', 'S', 'BR']);
  const managed = new Set();
  const observed = new Set();
  let frame = 0;
  let destroyed = false;

  function mark(element) {
    element.classList.add('rpa-money');
    managed.add(element);
  }

  function discover() {
    for (const element of managed) {
      if (!element.isConnected || !whole.test(element.textContent)) {
        element.classList.remove('rpa-money');
        element.style.removeProperty('--rpa-money-size');
        managed.delete(element);
      }
    }
    // Whole-value elements also cover a number and an underlined currency in
    // separate text nodes. Prefer the innermost value to avoid sizing its card.
    for (const element of document.body.querySelectorAll('*')) {
      if (element.closest(ignored) || element.closest('.rpa-money') || !whole.test(element.textContent)) continue;
      if ([...element.querySelectorAll('*')].some(child => !inlineTags.has(child.tagName))) continue;
      if ([...element.children].some(child => whole.test(child.textContent))) continue;
      mark(element);
    }
    // Inline totals such as "Tổng: 100.000 ₫" need a dedicated unbroken box.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement?.closest(`${ignored},.rpa-money`) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const matches = [...node.data.matchAll(fragment)];
      if (!matches.length) continue;
      const parts = document.createDocumentFragment();
      let offset = 0;
      for (const match of matches) {
        parts.append(document.createTextNode(node.data.slice(offset, match.index)));
        const span = document.createElement('span');
        span.textContent = match[0];
        mark(span);
        parts.append(span);
        offset = match.index + match[0].length;
      }
      parts.append(document.createTextNode(node.data.slice(offset)));
      node.replaceWith(parts);
    }
  }

  function fit(element) {
    // Removing only our size override recovers the natural font from existing
    // responsive styles, so the value can grow back after a resize/tab change.
    element.style.removeProperty('--rpa-money-size');
    if (!element.getClientRects().length) return;
    const style = getComputedStyle(element);
    const available = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    if (available <= 0) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    let size = parseFloat(style.fontSize);
    for (let attempt = 0; attempt < 3; attempt++) {
      const width = range.getBoundingClientRect().width;
      if (width <= available + 0.1) break;
      size = Math.max(1, Math.floor(size * available / width * 100) / 100);
      element.style.setProperty('--rpa-money-size', `${size}px`);
    }
  }

  function refresh() {
    frame = 0;
    if (destroyed || !document.body) return;
    discover();
    const nextObserved = new Set();
    for (const element of managed) {
      nextObserved.add(element);
      if (element.parentElement) nextObserved.add(element.parentElement);
      fit(element);
    }
    for (const element of observed) if (!nextObserved.has(element)) {
      resizeObserver.unobserve(element);
      observed.delete(element);
    }
    for (const element of nextObserved) if (!observed.has(element)) {
      resizeObserver.observe(element);
      observed.add(element);
    }
  }

  function schedule() {
    if (!destroyed && !frame) frame = requestAnimationFrame(refresh);
  }

  const resizeObserver = new ResizeObserver(schedule);
  const mutationObserver = new MutationObserver(schedule);
  function start() {
    if (destroyed) return;
    mutationObserver.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'open'] });
    refresh();
  }
  window.addEventListener('resize', schedule, { passive: true });
  document.fonts?.addEventListener('loadingdone', schedule);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.RpaMoneyLayout = Object.freeze({
    refresh: schedule,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', schedule);
      document.fonts?.removeEventListener('loadingdone', schedule);
      document.removeEventListener('DOMContentLoaded', start);
      for (const element of managed) {
        element.classList.remove('rpa-money');
        element.style.removeProperty('--rpa-money-size');
      }
      managed.clear();
      observed.clear();
    }
  });
})();
