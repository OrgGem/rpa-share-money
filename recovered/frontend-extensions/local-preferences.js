// Browser-only display preferences. Never sent through rpc or mutation payloads.
let localMemberPicker = null;
let localPreferredActor = null;

function localPreferredKey() {
  return D?.user?.id ? 'rpa-money:preferred-members:v1:' + encodeURIComponent(D.user.id) : null;
}
function localPreferredMembers() {
  return (D?.users || []).filter(u => u.active && !isAssignedTemp(u));
}
function readLocalPreferredMembers() {
  const key = localPreferredKey();
  if (!key) return {ids: [], warning: ''};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {ids: [], warning: ''};
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Array.isArray(value.ids) || !value.ids.every(id => typeof id === 'string')) throw new Error('Invalid preference');
    const allowed = new Set(localPreferredMembers().map(u => u.id));
    return {ids: [...new Set(value.ids)].filter(id => allowed.has(id)).slice(0, 5), warning: ''};
  } catch {
    return {ids: [], warning: 'Không đọc được cấu hình trên trình duyệt này. Danh sách đang dùng thứ tự mặc định; bạn có thể chọn và lưu lại trong Cài đặt.'};
  }
}
function localPreferredSettings() {
  if (!D?.user?.active) return '';
  const saved = readLocalPreferredMembers();
  localPreferredActor = D.user.id;
  return `<section class="card local-member-settings"><h2>Cài đặt</h2><h3>Thành viên ưu tiên</h3><p>Chọn tối đa 5 thành viên để hiển thị trước khi tạo khoản chi. Những chỗ còn lại được bổ sung theo thứ tự danh sách hiện có.</p><p class="notice">Chỉ áp dụng cho tài khoản này trên trình duyệt/thiết bị này. Cấu hình không được gửi lên máy chủ. Chọn ưu tiên không tự chọn người chia tiền.</p><form onsubmit="saveLocalPreferredMembers(event)"><div class="selectpeople local-preferred-options">${localPreferredMembers().map(u => `<label class="choose"><input type="checkbox" name="localPreferredMember" value="${esc(u.id)}" ${saved.ids.includes(u.id) ? 'checked' : ''} onchange="updateLocalPreferredChoice(this)"><span>${displayName(u.id)}</span></label>`).join('') || '<p class="muted">Chưa có thành viên có thể chọn.</p>'}</div><p id="localPreferredCount" aria-live="polite">Đã chọn ${saved.ids.length}/5 thành viên ưu tiên.</p><p id="localPreferredMessage" role="status">${esc(saved.warning)}</p><button type="submit">Lưu trên thiết bị này</button></form></section>`;
}
function updateLocalPreferredChoice(input) {
  const selected = [...document.querySelectorAll('[name=localPreferredMember]:checked')];
  if (selected.length > 5) {
    input.checked = false;
    $('localPreferredMessage').textContent = 'Chỉ chọn tối đa 5 thành viên ưu tiên.';
  } else $('localPreferredMessage').textContent = 'Có thay đổi chưa lưu.';
  $('localPreferredCount').textContent = 'Đã chọn ' + document.querySelectorAll('[name=localPreferredMember]:checked').length + '/5 thành viên ưu tiên.';
}
function saveLocalPreferredMembers(event) {
  event.preventDefault();
  if (!D?.user?.active || !D.user.id || localPreferredActor !== D.user.id) return;
  const allowed = new Set(localPreferredMembers().map(u => u.id));
  const ids = [...document.querySelectorAll('[name=localPreferredMember]:checked')].map(input => input.value).filter(id => allowed.has(id));
  if (ids.length > 5) { $('localPreferredMessage').textContent = 'Chỉ chọn tối đa 5 thành viên ưu tiên.'; return; }
  try {
    localStorage.setItem(localPreferredKey(), JSON.stringify({version: 1, ids}));
    $('localPreferredMessage').textContent = 'Đã lưu trên trình duyệt/thiết bị này.';
  } catch {
    $('localPreferredMessage').textContent = 'Không thể lưu trên trình duyệt này. Cấu hình chưa được lưu; màn tạo khoản chi sẽ dùng cấu hình đã lưu trước đó hoặc thứ tự mặc định.';
  }
}
function refreshLocalMemberPicker() {
  const state = localMemberPicker;
  if (!state || !draft || state.noteId !== draft.id || state.actor !== D?.user?.id) return;
  const inputs = [...$('modal').querySelectorAll('[name=member]')];
  const priority = readLocalPreferredMembers().ids.filter(id => inputs.some(input => input.value === id));
  const order = [...priority, ...inputs.map(input => input.value).filter(id => !priority.includes(id))];
  const shown = new Set(order.slice(0, 5));
  let hiddenSelected = 0;
  for (const input of inputs) {
    const hidden = !state.expanded && !shown.has(input.value);
    input.closest('label').classList.toggle('hidden', hidden);
    input.closest('label').style.order = String(order.indexOf(input.value));
    if (hidden && input.checked) hiddenSelected++;
  }
  const selectedCount = inputs.filter(input => input.checked).length;
  $('localMemberSummary').textContent = `Hiển thị ${state.expanded ? inputs.length : Math.min(5, inputs.length)}/${inputs.length} thành viên · Đã chọn ${selectedCount} · ${hiddenSelected} đã chọn đang ẩn`;
  const button = $('localMemberToggle');
  button.hidden = inputs.length <= 5;
  button.textContent = state.expanded ? 'Thu gọn' : `Xem tất cả (${inputs.length})`;
  button.setAttribute('aria-expanded', String(state.expanded));
}
function toggleLocalMemberPicker() {
  if (!localMemberPicker || localMemberPicker.actor !== D?.user?.id) return;
  localMemberPicker.expanded = !localMemberPicker.expanded;
  refreshLocalMemberPicker();
}
const originalLocalOpenNote = openNote;
openNote = function(id) {
  const creating = !D.notes.some(note => note.id === id);
  localMemberPicker = null;
  originalLocalOpenNote(id);
  if (!creating || !draft) return;
  const list = $('modal').querySelector('.selectpeople');
  if (!list) return;
  localMemberPicker = {noteId: draft.id, actor: D.user.id, expanded: false};
  list.id = 'localMemberChoices';
  list.classList.add('local-member-choices');
  list.insertAdjacentHTML('beforebegin', '<div class="local-member-toolbar"><small id="localMemberSummary" aria-live="polite"></small><button id="localMemberToggle" class="secondary" type="button" onclick="toggleLocalMemberPicker()" aria-controls="localMemberChoices" aria-expanded="false">Xem tất cả</button></div><small class="local-member-hint">Thu gọn chỉ ẩn danh sách; người đang chọn vẫn được chia tiền. Đổi người ưu tiên trong tab Cài đặt.</small>');
  refreshLocalMemberPicker();
};
const originalLocalRecalculate = recalculate;
recalculate = function(...args) {
  const result = originalLocalRecalculate(...args);
  refreshLocalMemberPicker();
  return result;
};
const originalLocalCloseModal = closeModal;
closeModal = function(...args) {
  localMemberPicker = null;
  return originalLocalCloseModal(...args);
};
const originalLocalAppContent = appContent;
appContent = function(...args) {
  if (tab === 'admin' && !canOpenAdminSettings()) tab = 'notes';
  const content = originalLocalAppContent(...args);
  const index = content.indexOf('</nav>');
  if (index < 0) return content;
  const settingsTab = D?.user?.active ? `<button class="${tab === 'local-settings' ? 'on' : ''}" onclick="openLocalSettingsPanel()">Cài đặt</button>` : '';
  const prefix = content.slice(0, index).replace(/<button[^>]*onclick="tab='admin';[^"]*"[^>]*>[\s\S]*?<\/button>/g, '') + settingsTab + '</nav>';
  return tab === 'local-settings' ? prefix + localPreferredSettings() : prefix + content.slice(index + 6);
};
function canOpenAdminSettings() { return !!D?.user?.active && D.user.role === 'admin'; }
function openLocalSettingsPanel() {
  if (!D?.user?.active || tab === 'local-settings') return;
  tab = 'local-settings';
  render();
  document.querySelector('button[onclick="openLocalSettingsPanel()"]')?.focus();
}
function openSettingsPanel() {
  if (!canOpenAdminSettings() || tab === 'admin') return;
  tab = 'admin';
  render();
  document.querySelector('.settings-shortcut')?.focus();
}
const originalSettingsShortcutRender = render;
render = function(...args) {
  if (tab === 'admin' && !canOpenAdminSettings()) tab = 'notes';
  const result = originalSettingsShortcutRender(...args);
  if (D?.authMethod === 'oidc') document.querySelector('header button[onclick="passwordDialog()"]')?.remove();
  else if (!D?.authMethod || D.authMethod === 'unknown') {
    const passwordButton = document.querySelector('header button[onclick="passwordDialog()"]');
    if (passwordButton) passwordButton.title = 'Phiên này chưa có thông tin phương thức đăng nhập; giữ chức năng đổi mật khẩu hiện có.';
  }
  const brand = document.querySelector('header .brand');
  if (brand) [...brand.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => node.remove());
  const paymentTab = [...document.querySelectorAll('nav.tabs button')].find(button => button.getAttribute('onclick')?.includes("tab='payments'"));
  if (paymentTab) paymentTab.textContent = 'Thanh toán';
  const paymentFilters = document.querySelector('.payment-filters');
  if (paymentFilters) {
    [...paymentFilters.querySelectorAll('label')].forEach(label => {
      const field = label.querySelector('select,input');
      if (!field) return;
      field.title = field.getAttribute('aria-label') || label.textContent.trim();
      const wrapper = document.createElement('div');
      wrapper.className = 'payment-filter-field';
      wrapper.append(field);
      label.replaceWith(wrapper);
    });
    [...paymentFilters.querySelectorAll('input[type="date"]')].forEach(field => paymentFilters.append(field.parentElement));
  }
  const refresh = document.querySelector('header .refresh-data');
  if (refresh && !canOpenAdminSettings()) refresh.remove();
  if (refresh && canOpenAdminSettings()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'linkbutton settings-shortcut' + (tab === 'admin' ? ' on' : '');
    button.title = 'Thành viên & cài đặt';
    button.setAttribute('aria-label', 'Thành viên & cài đặt');
    button.setAttribute('aria-pressed', String(tab === 'admin'));
    button.innerHTML = '<span aria-hidden="true">⚙</span>';
    button.onclick = openSettingsPanel;
    refresh.replaceWith(button);
  }
  const logoutButton = document.querySelector('header button[onclick="logout()"]');
  if (logoutButton) {
    logoutButton.type = 'button';
    logoutButton.classList.add('logout-shortcut');
    logoutButton.title = 'Đăng xuất';
    logoutButton.setAttribute('aria-label', 'Đăng xuất');
    logoutButton.innerHTML = '<svg class="logout-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>';
    const actions = document.createElement('div');
    actions.className = 'header-icon-actions';
    const gear = document.querySelector('.settings-shortcut');
    if (gear) { gear.before(actions); actions.append(gear); }
    else logoutButton.before(actions);
    actions.append(logoutButton);
  }
  return result;
};
// UI guards supplement existing server authorization; they grant no server access.
const originalGuardedAdminContent = adminContent;
adminContent = function(...args) { return canOpenAdminSettings() ? originalGuardedAdminContent(...args) : ''; };
function guardAdminUiAction(action) {
  return function(...args) {
    if (!canOpenAdminSettings()) { args[0]?.preventDefault?.(); return; }
    return action.apply(this, args);
  };
}
activate = guardAdminUiAction(activate);
saveSettings = guardAdminUiAction(saveSettings);
openTempUserDialog = guardAdminUiAction(openTempUserDialog);
renderTempUserDialog = guardAdminUiAction(renderTempUserDialog);
createTempUser = guardAdminUiAction(createTempUser);
openTempAssignment = guardAdminUiAction(openTempAssignment);
renderTempAssignmentDialog = guardAdminUiAction(renderTempAssignmentDialog);
previewTempAssignment = guardAdminUiAction(previewTempAssignment);
assignTempUser = guardAdminUiAction(assignTempUser);
