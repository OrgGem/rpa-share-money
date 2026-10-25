// Vietnam lunar-year table adapter. Calendar labels are local civil dates (UTC+7).
// Year codes vendored from @dqcai/vn-lunar 1.0.1 (MIT), original author Đoàn Quốc Cường.
// https://github.com/cuongdqpayment/dqcai-vn-lunar/blob/main/src/constants.ts
// Rules: Hồ Ngọc Đức, https://www.xemamlich.uhm.vn/calrules_en.html
// Supports lunar years 1976 through 2050; the 2051 code is an end-boundary sentinel.
/*
MIT License — table data from @dqcai/vn-lunar, Copyright (c) 2025 Đoàn Quốc Cường.
Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the
Software without restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions: The above copyright notice and this
permission notice shall be included in all copies or substantial portions of the
Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
const VnLunar = (() => {
  const codes = [3986776, 6337856, 4896160, 3626406, 6067632, 4606384, 3189108, 5678256, 4237904, 2730578, 5139744, 3779911, 6204256, 4756336, 3427061, 5917040, 4482224, 2913443, 5302864, 4024920, 6444704, 4893392, 3577557, 6066912, 4639072, 3070292, 5559456, 4119120, 2782546, 5133984, 3712935, 6202832, 4887216, 3320501, 5810512, 4371616, 2931364, 5287248, 3954137, 6441888, 5023152, 3625334, 6050416, 4614448, 3176756, 5532320, 4107600, 2775890, 5262176, 3712742, 6202592, 4772448, 3336805, 5690656, 4250272, 2971299, 5396176, 3951355, 6441424, 5022928, 3657910, 5943888, 4502816, 3071269, 5551520, 4085200, 2774450, 5261744, 3843447, 6202544, 4762192, 3387989, 5795104, 4238688, 2968419, 5395312];
  const dayMs = 86400000;
  const cache = new Map();
  const firstDay = year => Math.floor(Date.UTC(year, 0, 1) / dayMs) + (codes[year - 1976] >>> 17);
  function months(year) {
    if (!Number.isInteger(year) || year < 1976 || year > 2050) return [];
    if (cache.has(year)) return cache.get(year);
    const code = codes[year - 1976], leap = code & 15, entries = [];
    let start = firstDay(year);
    for (let month = 1; month <= 12; month++) {
      const length = 29 + ((code >>> (16 - month)) & 1);
      entries.push(Object.freeze({year, month, leap: false, start, length}));
      start += length;
      if (leap === month) {
        const leapLength = 29 + ((code >>> 16) & 1);
        entries.push(Object.freeze({year, month, leap: true, start, length: leapLength}));
        start += leapLength;
      }
    }
    if (start !== firstDay(year + 1)) throw new Error('Invalid Vietnamese lunar year data');
    cache.set(year, Object.freeze(entries));
    return cache.get(year);
  }
  function epoch(iso) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const ms = Date.parse(iso + 'T00:00:00Z');
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === iso ? ms / dayMs : null;
  }
  const iso = day => new Date(day * dayMs).toISOString().slice(0, 10);
  function fromSolar(value) {
    const day = epoch(value);
    if (day === null || day < firstDay(1976) || day >= firstDay(2051)) return null;
    let year = Number(value.slice(0, 4));
    if (day < firstDay(year)) year--;
    const entry = months(year).find(m => day >= m.start && day < m.start + m.length);
    return entry ? {...entry, day: day - entry.start + 1} : null;
  }
  function toSolar(day, month, year, leap = false) {
    const entry = months(year).find(m => m.month === month && m.leap === !!leap);
    return entry && Number.isInteger(day) && day >= 1 && day <= entry.length ? iso(entry.start + day - 1) : null;
  }
  return Object.freeze({months, fromSolar, toSolar, epoch, iso, firstDay, minYear: 1976, maxYear: 2050});
})();

let vnCalendarActor = null;
let vnCalendarMode = 'solar';
let vnCalendarViewDate = null;
let vnCalendarSelectedDate = null;
let vnCalendarStorageMessage = '';
function vnCalendarModeKey() { return D?.user?.id ? 'rpa-money:calendar-mode:v1:' + encodeURIComponent(D.user.id) : null; }
function ensureVnCalendarState() {
  if (vnCalendarActor !== D?.user?.id) {
    vnCalendarActor = D?.user?.id;
    vnCalendarMode = 'solar';
    vnCalendarViewDate = null;
    vnCalendarSelectedDate = VnLunar.epoch(anchor) !== null ? anchor : today();
    vnCalendarStorageMessage = '';
    try {
      const raw = localStorage.getItem(vnCalendarModeKey());
      if (raw) {
        const value = JSON.parse(raw);
        if (value.version !== 1 || !['solar','lunar'].includes(value.mode)) throw new Error('Invalid calendar preference');
        vnCalendarMode = value.mode;
      }
    } catch { vnCalendarStorageMessage = 'Không đọc được chế độ đã lưu; đang dùng lịch Dương.'; }
  }
  if (!vnCalendarViewDate || vnCalendarViewDate.slice(0, 7) !== calendarMonth) {
    const candidate = vnCalendarSelectedDate?.startsWith(calendarMonth + '-') ? vnCalendarSelectedDate : today().startsWith(calendarMonth + '-') ? today() : calendarMonth + '-01';
    vnCalendarViewDate = VnLunar.epoch(candidate) !== null ? candidate : today();
  }
  if (vnCalendarMode === 'lunar' && !VnLunar.fromSolar(vnCalendarViewDate)) {
    vnCalendarMode = 'solar';
    vnCalendarStorageMessage = 'Lịch Âm hỗ trợ năm âm 1976–2050; ngày đang xem được hiển thị bằng lịch Dương.';
  }
}
function vnCalendarVisibleMonth() {
  ensureVnCalendarState();
  if (vnCalendarMode === 'lunar') {
    const lunar = VnLunar.fromSolar(vnCalendarViewDate);
    return {start: lunar.start, length: lunar.length, lunar, title: `Tháng ${lunar.month}${lunar.leap ? ' nhuận' : ''} năm ${lunar.year}`, mode: 'Âm lịch Việt Nam · UTC+7'};
  }
  const [year, month] = calendarMonthParts();
  return {start: Date.UTC(year, month - 1, 1) / 86400000, length: new Date(Date.UTC(year, month, 0)).getUTCDate(), title: calendarMonthLabel(), mode: 'Dương lịch'};
}
function toggleVnCalendarMode() {
  const current = vnCalendarVisibleMonth();
  const selected = VnLunar.epoch(vnCalendarSelectedDate);
  const reference = selected !== null && selected >= current.start && selected < current.start + current.length ? vnCalendarSelectedDate : vnCalendarViewDate;
  if (vnCalendarMode === 'solar' && !VnLunar.fromSolar(reference)) { toast('Lịch Âm hỗ trợ năm âm 1976–2050.'); return; }
  vnCalendarViewDate = reference;
  calendarMonth = reference.slice(0, 7);
  vnCalendarMode = vnCalendarMode === 'solar' ? 'lunar' : 'solar';
  vnCalendarStorageMessage = '';
  try { localStorage.setItem(vnCalendarModeKey(), JSON.stringify({version: 1, mode: vnCalendarMode})); }
  catch { vnCalendarStorageMessage = 'Chế độ chỉ áp dụng trong phiên này vì trình duyệt không cho lưu.'; }
  render();
}
shiftCalendarMonth = function(delta) {
  if (delta !== -1 && delta !== 1) return;
  const current = vnCalendarVisibleMonth();
  if (vnCalendarMode === 'lunar') {
    const target = current.start + (delta > 0 ? current.length : -1);
    const iso = VnLunar.iso(target), lunar = VnLunar.fromSolar(iso);
    if (!lunar) { toast('Lịch Âm hỗ trợ năm âm 1976–2050.'); return; }
    vnCalendarViewDate = iso;
    calendarMonth = iso.slice(0, 7);
  } else {
    const [year, month] = calendarMonthParts();
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    vnCalendarViewDate = date.toISOString().slice(0, 10);
    calendarMonth = vnCalendarViewDate.slice(0, 7);
  }
  render();
};
function selectVnCalendarDate(date) {
  if (VnLunar.epoch(date) === null) return;
  vnCalendarSelectedDate = date;
  vnCalendarViewDate = date;
  calendarMonth = date.slice(0, 7);
  anchor = date;
  period = 'day';
  scope = 'me';
  category = 'all';
  tab = 'notes';
  if (typeof setCalendarDateContext === 'function') setCalendarDateContext(date);
  render();
}
function vnCalendarDateTotals(start, length) {
  const totals = Object.create(null), end = start + length;
  for (const note of D.notes) {
    if (note.deleted === true) continue;
    const date = String(note.date || '').slice(0, 10), day = VnLunar.epoch(date);
    if (day === null || day < start || day >= end) continue;
    const allocation = (Array.isArray(note.allocations) ? note.allocations : []).find(a => a.userId === D.user.id);
    if (!allocation || !Number.isFinite(Number(allocation.amount)) || Number(allocation.amount) <= 0) continue;
    const count = totals[date] || (totals[date] = {paid: 0, unpaid: 0});
    if (allocation.paid || allocation.userId === note.payerId) count.paid++;
    else count.unpaid++;
  }
  return totals;
}
calendarOverview = function() {
  const current = vnCalendarVisibleMonth(), currentDate = today();
  const firstOffset = (new Date(current.start * 86400000).getUTCDay() + 6) % 7;
  const totalCells = Math.ceil((firstOffset + current.length) / 7) * 7;
  const totals = vnCalendarDateTotals(current.start, current.length);
  const cells = Array.from({length: totalCells}, (_, index) => {
    const number = index - firstOffset + 1;
    if (number < 1 || number > current.length) return '<div class="calendar-day calendar-padding" aria-hidden="true"></div>';
    const date = VnLunar.iso(current.start + number - 1), count = totals[date] || {paid: 0, unpaid: 0};
    const label = vnCalendarMode === 'lunar' ? `Ngày ${number} tháng ${current.lunar.month}${current.lunar.leap ? ' nhuận' : ''} năm ${current.lunar.year} âm lịch; ${date} dương lịch` : `${date} dương lịch`;
    return `<button type="button" class="calendar-day calendar-date-button ${date === currentDate ? 'calendar-today' : ''} ${date === vnCalendarSelectedDate ? 'calendar-selected' : ''}" data-date="${date}" data-paid="${count.paid}" data-unpaid="${count.unpaid}" aria-label="${esc(label)}: ${count.paid} đã thanh toán, ${count.unpaid} chưa thanh toán. Xem chi tiêu ngày này" ${date === currentDate ? 'aria-current="date"' : ''} onclick="selectVnCalendarDate('${date}')"><span class="calendar-number">${number}</span><span class="calendar-markers">${count.paid ? `<span class="calendar-marker calendar-paid" aria-hidden="true">✓<small>${count.paid}</small></span>` : ''}${count.unpaid ? `<span class="calendar-marker calendar-unpaid" aria-hidden="true">◷<small>${count.unpaid}</small></span>` : ''}</span></button>`;
  }).join('');
  const isLunar = vnCalendarMode === 'lunar';
  const previousDisabled = isLunar && !VnLunar.fromSolar(VnLunar.iso(current.start - 1));
  const nextDisabled = isLunar && !VnLunar.fromSolar(VnLunar.iso(current.start + current.length));
  return `<section class="mini-calendar" data-mode="${vnCalendarMode}" data-month="${calendarMonth}" aria-label="Lịch chi tiêu ${esc(current.title)} ${current.mode}"><div class="calendar-heading"><button class="calendar-nav" type="button" aria-label="Tháng trước ${isLunar ? 'âm lịch' : 'dương lịch'}" onclick="shiftCalendarMonth(-1)" ${previousDisabled ? 'disabled' : ''}>‹</button><div class="calendar-month-title"><b>${esc(current.title)}</b><small>${current.mode}</small><small>${esc(calendarScope().caption)}</small></div><button class="calendar-nav" type="button" aria-label="Tháng sau ${isLunar ? 'âm lịch' : 'dương lịch'}" onclick="shiftCalendarMonth(1)" ${nextDisabled ? 'disabled' : ''}>›</button></div><div class="calendar-weekdays" aria-hidden="true">${['T2','T3','T4','T5','T6','T7','CN'].map(day => `<span>${day}</span>`).join('')}</div><div class="calendar-days">${cells}</div><div class="calendar-footer"><div class="calendar-legend"><span><i class="calendar-marker calendar-paid" aria-hidden="true">✓</i> Đã thanh toán</span><span><i class="calendar-marker calendar-unpaid" aria-hidden="true">◷</i> Chưa thanh toán</span></div><button class="calendar-mode-toggle" type="button" role="switch" aria-checked="${isLunar}" aria-label="Đang dùng lịch ${isLunar ? 'Âm Việt Nam' : 'Dương'}, chuyển sang lịch ${isLunar ? 'Dương' : 'Âm Việt Nam'}" title="Chuyển Âm/Dương; lịch Âm Việt Nam UTC+7 hỗ trợ năm âm 1976–2050. Chế độ lưu trên thiết bị này." onclick="toggleVnCalendarMode()"><span aria-hidden="true">${isLunar ? '☾' : '☀'}</span></button></div>${vnCalendarStorageMessage ? `<small class="calendar-storage-message" role="status">${esc(vnCalendarStorageMessage)}</small>` : ''}</section>`;
};
