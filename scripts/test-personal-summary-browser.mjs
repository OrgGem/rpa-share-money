import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const wrapper = await readFile(new URL('../.build/ui-wrapper.mjs', import.meta.url), 'utf8');
function literal(name) {
  const match = new RegExp(`^const ${name}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*");`, 'm').exec(wrapper);
  assert.ok(match, `Missing built literal: ${name}`);
  return JSON.parse(match[1]);
}
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<main id="app"></main>');
  await page.addScriptTag({ content: `
    var D={user:{id:'demo-actor',active:true},notes:[],users:[]};
    var tab='notes', selectedScope='me', amount='100.000 <u>đ</u>';
    var withSlot=true, duplicate=false;
    function range(){return {start:'2026-01-01',end:'2026-01-31'};}
    function filtered(){return D.notes;}
    function ensureReportDateState(){return {scope:selectedScope};}
    var RpaBankQrHost={decorate(){}};
    function summaryCard(id){return '<div class="card" id="'+id+'"><small>Chi tiêu cá nhân</small><div class="money">'+amount+'</div></div>';}
    function render(){
      document.getElementById('app').innerHTML='<div class="cards">'+summaryCard('personal-total')+
        (duplicate?summaryCard('duplicate-total'):'')+
        '<div class="card" id="paid-total"><small>Đã thanh toán/tự trả</small><div class="money">20.000 ₫</div></div>'+
        '<div class="card" id="unpaid-total"><small>Chưa thanh toán</small><div class="money">80.000 ₫</div></div>'+
        (withSlot?'<div class="card"><small>Số khoản ghi nhận</small><strong>2</strong></div>':'')+
        '</div><article class="note" id="authored-note"><small>Chi tiêu cá nhân</small><div class="money">500 ₫</div><button id="edit-note">Sửa</button></article>'+
        '<div class="modal" id="edit-modal"><small>Chi tiêu cá nhân</small><div class="money">700 ₫</div><input value="700"></div>';
      document.getElementById('edit-note').onclick=()=>window.editClicks=(window.editClicks||0)+1;
    }
  ` });
  // Exercise the same mount/presentation order and count-slot conversion as the
  // deployed wrapper, rather than mocking its summary-card detection.
  await page.addScriptTag({ content: literal('obligationsClient') });
  await page.addScriptTag({ content: literal('presentationLabels') });
  let checks = 0;
  for (const tab of ['notes', 'report', 'personal']) {
    for (const scope of ['all', 'me', 'demo-other']) {
      await page.evaluate(({ tab: nextTab, scope }) => {
        tab = nextTab; selectedScope = scope; render();
      }, { tab, scope });
      assert.equal(await page.locator('#personal-total').count(), scope === 'me' ? 0 : 1, `${tab}/${scope}: summary visibility`);
      if (scope !== 'me') assert.equal(await page.locator('#personal-total small').textContent(), 'Chi tiêu cá nhân');
      assert.equal(await page.locator('#paid-total .money').textContent(), '20.000 ₫');
      assert.equal(await page.locator('#unpaid-total .money').textContent(), '80.000 ₫');
      assert.equal(await page.locator('.rpa-obligation-switch button').count(), 2);
      assert.equal(await page.locator('#authored-note small').textContent(), 'Chi tiêu cá nhân');
      assert.equal(await page.locator('#edit-modal small').textContent(), 'Chi tiêu cá nhân');
      await page.locator('#edit-note').click();
      assert.equal(await page.evaluate(() => editClicks), ++checks);
      // Reapplying without a host render must not restore a removed summary.
      await page.evaluate(() => RpaPresentationLabels.apply());
      assert.equal(await page.locator('#personal-total').count(), scope === 'me' ? 0 : 1);
    }
  }
  for (const amount of ['0 ₫', '-1.000 ₫', '1.000.000.000.000 <u>đ</u>']) {
    await page.evaluate(value => { tab='notes'; selectedScope='me'; amount=value; render(); }, amount);
    assert.equal(await page.locator('#personal-total').count(), 0, amount);
    checks++;
  }
  // Keep the existing conservative boundaries around unrelated or ambiguous UI.
  for (const scenario of ['inactive', 'outside-tab', 'missing-slot', 'duplicate-card', 'authored-collision']) {
    await page.evaluate(scenario => {
      tab='report'; selectedScope='me'; D.user.active=true; D.notes=[]; withSlot=true; duplicate=false;
      if(scenario==='inactive')D.user.active=false;
      if(scenario==='outside-tab')tab='payments';
      if(scenario==='missing-slot')withSlot=false;
      if(scenario==='duplicate-card')duplicate=true;
      if(scenario==='authored-collision')D.notes=[{title:'Chi tiêu cá nhân'}];
      render();
    }, scenario);
    assert.equal(await page.locator('#personal-total').count(), 1, `Preserve ${scenario}`);
    checks++;
  }
  assert.deepEqual(errors, []);
  console.log(`Chromium: ${checks} summary/filter cases passed; notes, report, personal, totals and controls verified.`);
} finally {
  await browser.close();
}
