// Shared date components with independent filter state for each spending tab.
let reportDateState = null;
let dateFilterActor = null;
let dateFilterStates = Object.create(null);
let dateFilterDefaults = null;
// Only the expense tab follows the clock. Explicit date/month choices stay pinned.
let expenseDateFollowsToday = false;
let expenseDateRolloverTimer = null;
function hasDateFilterComponents() { return ['notes', 'report', 'personal'].includes(tab); }
function reportValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function reportPresetRange(preset, reference) {
  const day = reportValidDate(reference) ? reference : today();
  if (preset === 'all') {
    const dates = (D?.notes || []).map(note => String(note.date || '').slice(0, 10)).filter(reportValidDate).sort();
    return {start: dates[0] || today(), end: dates[dates.length - 1] || today()};
  }
  const date = new Date(day + 'T12:00:00Z');
  if (preset === 'week') {
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const start = date.toISOString().slice(0, 10);
    date.setUTCDate(date.getUTCDate() + 6);
    return {start, end: date.toISOString().slice(0, 10)};
  }
  if (preset === 'month') {
    date.setUTCDate(1);
    const start = date.toISOString().slice(0, 10);
    date.setUTCMonth(date.getUTCMonth() + 1);
    date.setUTCDate(0);
    return {start, end: date.toISOString().slice(0, 10)};
  }
  return {start: day, end: day};
}
function expenseToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
function expensePresetRange(preset) {
  const current = expenseToday();
  if (preset !== 'all') return reportPresetRange(preset, current);
  // All-time covers today even when no expense has been recorded today.
  // Keep future-dated expenses included, preserving the existing all-time meaning.
  let start = current, end = current;
  for (const note of D?.notes || []) {
    const date = String(note.date || '').slice(0, 10);
    if (!reportValidDate(date)) continue;
    if (date < start) start = date;
    if (date > end) end = date;
  }
  return {start, end};
}
function ensureReportDateState() {
  if (dateFilterActor !== D?.user?.id) {
    const switchedAccount = dateFilterActor !== null;
    dateFilterActor = D?.user?.id;
    dateFilterStates = Object.create(null);
    expenseDateFollowsToday = false;
    reportDateState = null;
    dateFilterDefaults = switchedAccount ? {period: 'all', anchor: today(), scope: 'all', category: 'all'} : {period, anchor, scope, category};
  }
  const key = hasDateFilterComponents() ? tab : 'report';
  if (!dateFilterStates[key]) {
    const defaults = dateFilterDefaults;
    const preset = ['day', 'week', 'month', 'all'].includes(defaults.period) ? defaults.period : 'all';
    const initialRange = key === 'notes' ? expensePresetRange(preset) : reportPresetRange(preset, preset === 'month' ? today() : defaults.anchor);
    dateFilterStates[key] = {actor: D?.user?.id, preset, scope: key === 'personal' ? 'me' : defaults.scope, category: 'all', ...initialRange};
    if (key === 'notes') expenseDateFollowsToday = true;
  }
  if (key === 'notes' && expenseDateFollowsToday) Object.assign(dateFilterStates[key], expensePresetRange(dateFilterStates[key].preset));
  if (key === 'report') reportDateState = dateFilterStates[key];
  dateFilterStates[key].category = 'all';
  category = 'all';
  return dateFilterStates[key];
}
function reportDateError() {
  const state = ensureReportDateState();
  if (!state.start || !state.end) return 'Vui lòng chọn đủ Từ ngày và Đến ngày.';
  if (!reportValidDate(state.start) || !reportValidDate(state.end)) return 'Ngày lọc không hợp lệ.';
  if (state.start > state.end) return 'Từ ngày không được sau Đến ngày.';
  return '';
}
function setReportDatePreset(preset) {
  if (!['day', 'week', 'month', 'all', 'custom'].includes(preset)) return;
  const state = ensureReportDateState();
  state.preset = preset;
  if (preset !== 'custom') Object.assign(state, reportPresetRange(preset, preset === 'month' ? today() : state.start));
  if (tab === 'notes') {
    const current = expenseToday();
    expenseDateFollowsToday = preset !== 'custom' && (preset === 'all' || preset === 'month' || (state.start <= current && state.end >= current));
    if (expenseDateFollowsToday) Object.assign(state, expensePresetRange(preset));
  }
  render();
}
function shiftReportMonth(delta) {
  const state = ensureReportDateState();
  if (state.preset !== 'month' || (delta !== -1 && delta !== 1) || reportDateError()) return;
  const date = new Date(state.start + 'T12:00:00Z');
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + delta);
  if (tab === 'notes') expenseDateFollowsToday = false;
  Object.assign(state, reportPresetRange('month', date.toISOString().slice(0, 10)));
  render();
}
function setReportDateValue(side, value) {
  if (!['start', 'end'].includes(side)) return;
  const state = ensureReportDateState();
  if (tab === 'notes') expenseDateFollowsToday = false;
  state[side] = value;
  state.preset = 'custom';
  render();
}
function setReportUser(value) {
  ensureReportDateState().scope = value;
  scope = value;
  render();
}
// Retain the legacy handler safely for an already-open page or stale event.
function setDateFilterCategory() {
  if (!hasDateFilterComponents()) return;
  ensureReportDateState().category = 'all';
  category = 'all';
  render();
}
function setCalendarDateContext(date) {
  const state = ensureReportDateState();
  if (tab === 'notes') expenseDateFollowsToday = false;
  Object.assign(state, {preset: 'day', start: date, end: date, scope: 'me', category: 'all'});
}
const originalDateFilterRender = render;
render = function(...args) {
  if (D?.user?.active && hasDateFilterComponents()) scope = ensureReportDateState().scope;
  return originalDateFilterRender(...args);
};
const originalReportControls = controls;
controls = function(...args) {
  if (!hasDateFilterComponents()) return originalReportControls(...args);
  const state = ensureReportDateState();
  return `<div id="reportDateControls" class="report-date-controls"><div class="report-filter-row"><div class="report-filter-field"><div class="report-period-picker"><select id="reportDatePreset" aria-label="Loại thời gian" title="Loại thời gian" onchange="setReportDatePreset(this.value)">${[['day','Theo ngày'],['week','Theo tuần (T2–CN)'],['month','Theo tháng'],['all','Toàn bộ thời gian'],['custom','Tùy chỉnh']].map(([value,label]) => `<option value="${value}" ${state.preset === value ? 'selected' : ''}>${label}</option>`).join('')}</select>${state.preset === 'month' ? '<div class="report-month-nav"><button type="button" aria-label="Tháng trước" title="Tháng trước" onclick="shiftReportMonth(-1)">▲</button><button type="button" aria-label="Tháng sau" title="Tháng sau" onclick="shiftReportMonth(1)">▼</button></div>' : ''}</div></div><div class="report-filter-field"><select id="reportDateUser" aria-label="Người chi tiêu" title="Người chi tiêu" onchange="setReportUser(this.value)"><option value="all" ${state.scope === 'all' ? 'selected' : ''}>Cả nhóm</option><option value="me" ${state.scope === 'me' ? 'selected' : ''}>Chi tiêu của tôi</option>${D.users.filter(u => !isAssignedTemp(u)).map(u => `<option value="${esc(u.id)}" ${state.scope === u.id ? 'selected' : ''}>${optionName(u.id)}</option>`).join('')}</select></div></div><div class="report-filter-row"><div class="report-filter-field"><input id="reportDateStart" type="date" aria-label="Từ ngày báo cáo" title="Từ ngày báo cáo" value="${esc(state.start)}" onchange="setReportDateValue('start',this.value)"></div><div class="report-filter-field"><input id="reportDateEnd" type="date" aria-label="Đến ngày báo cáo" title="Đến ngày báo cáo" value="${esc(state.end)}" onchange="setReportDateValue('end',this.value)"></div></div></div><!--report-date-end-->`;
};
const originalReportRange = range;
range = function(...args) {
  if (!hasDateFilterComponents()) return originalReportRange(...args);
  const {start, end} = ensureReportDateState();
  return {start, end};
};
const originalReportFiltered = filtered;
filtered = function(...args) {
  if (!hasDateFilterComponents()) return originalReportFiltered(...args);
  if (reportDateError()) return [];
  const state = ensureReportDateState(), {start, end} = state;
  const id = state.scope === 'me' ? D.user.id : state.scope;
  return D.notes.filter(note => {
    // Note dates are the application's Vietnam-local calendar labels, not UTC instants.
    const date = String(note.date || '').slice(0, 10);
    return date >= start && date <= end && (id === 'all' || note.allocations.some(a => a.userId === id) || note.payerId === id || note.creatorId === id);
  });
};
const originalReportAppContent = appContent;
appContent = function(...args) {
  if (!hasDateFilterComponents()) return originalReportAppContent(...args);
  ensureReportDateState();
  const content = originalReportAppContent(...args);
  const marker = '<!--report-date-end-->';
  const index = content.indexOf(marker);
  if (index < 0) return content;
  const error = reportDateError();
  if (error) return content.slice(0, index + marker.length) + `<div class="error" role="alert">${esc(error)}</div>`;
  return content.replace(/<!--report-date-end--><small>[\s\S]*?<\/small>/, marker);
};
const originalReportExport = exportReport;
exportReport = function(...args) {
  if (hasDateFilterComponents() && reportDateError()) { toast(reportDateError()); return; }
  return originalReportExport(...args);
};

function refreshExpenseDefaultRange() {
  const state = dateFilterStates.notes;
  if (!D?.user?.active || tab !== 'notes' || !state || !expenseDateFollowsToday) return;
  const {start, end} = state;
  ensureReportDateState();
  if (start !== state.start || end !== state.end) render();
}
function scheduleExpenseDateRollover() {
  clearTimeout(expenseDateRolloverTimer);
  const nextMidnight = Date.parse(expenseToday() + 'T00:00:00+07:00') + 86400000;
  expenseDateRolloverTimer = setTimeout(() => {
    refreshExpenseDefaultRange();
    scheduleExpenseDateRollover();
  }, Math.max(1, nextMidnight - Date.now() + 25));
}
function resumeExpenseDefaultRange() {
  refreshExpenseDefaultRange();
  scheduleExpenseDateRollover();
}
window.addEventListener('focus', resumeExpenseDefaultRange);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) resumeExpenseDefaultRange();
});
scheduleExpenseDateRollover();
