import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const recoveredCss = (await Promise.all(['layout', 'obligations', 'bank-qr'].map(name => readFile(new URL(`recovered/frontend-extensions/${name}.css`, root), 'utf8')))).join('\n');
const overlayCss = await readFile(new URL('src/ui/money-layout.css', root), 'utf8');
const overlayClient = await readFile(new URL('src/ui/money-layout.js', root), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const samples = [
  ['card', '<div class="money" data-sample>VALUE</div>'],
  ['note', '<article class="note"><div class="note-total-row"><div class="money" data-sample>VALUE</div><button class="linkbutton">Sửa</button><button class="linkbutton">Xóa</button></div></article>'],
  ['person', '<div class="people"><div class="person"><span class="person-details">Thành viên minh họa<b data-sample>VALUE</b></span><button>Đã trả</button></div></div>'],
  ['summary', '<div class="rpa-obligation-switch"><button><span>Cần trả</span><strong data-sample>VALUE</strong></button><button><span>Cần thu</span><strong>0 ₫</strong></button></div>'],
  ['creditor', '<details class="rpa-obligation-group" open><summary><span class="rpa-obligation-person">Thành viên minh họa có tên dài<small>1 khoản chưa thanh toán</small></span><strong data-sample>VALUE</strong><button class="rpa-bank-qr-icon">QR</button></summary></details>'],
  ['item', '<details class="rpa-obligation-group" open><ul><li><span><b>Khoản chi minh họa</b><time>25/10/2026</time></span><strong data-sample>VALUE</strong></li></ul></details>'],
  ['table', '<table><tbody><tr><td>Chi tiêu</td><td data-sample>VALUE</td></tr></tbody></table>'],
  ['inline', '<p data-sample>Giá trị: VALUE</p>'],
  ['nested-unit', '<div class="money" data-sample>NUMBER <u>đ</u></div>']
].filter(([kind]) => !process.env.MONEY_LAYOUT_CASE || process.env.MONEY_LAYOUT_CASE === kind);
const amounts = ['100.000 ₫', '100.000.000.000 ₫', '-999.999.999.999 ₫', '0 ₫', '1.000.000.000.000.000.000 ₫'];
const base = `*{box-sizing:border-box}body{margin:0;padding:16px;background:#f5f7f2;font:16px/1.4 Arial,sans-serif;color:#193e30}main{max-width:720px;margin:auto}.tab{display:none}.tab.active{display:block}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sample{min-width:0;padding:12px;border:1px solid #dde6de;border-radius:14px;background:white;margin:6px 0}.sample:not([data-kind="card"]):not([data-kind="nested-unit"]){grid-column:1/-1}.money{font-size:1.65rem;font-weight:700}button{font:inherit;border:1px solid #ccded2;border-radius:7px;padding:5px;background:#f5faf7;color:inherit}table{table-layout:fixed;width:100%;border-collapse:collapse}td:first-child{width:35%}td{padding:3px}nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}`;
const markup = `<nav>${['notes','report','personal','payments','settings'].map((name,i) => `<button data-tab="${name}">${name}</button>`).join('')}</nav><main>${['notes','report','personal','payments','settings'].map((tab,i) => `<section class="tab ${i===0?'active':''}" id="${tab}"><h2>${tab}</h2><div class="cards">${samples.map(([name,html]) => `<div class="sample" data-kind="${name}">${html.replaceAll('VALUE',amounts[1]).replaceAll('NUMBER','100.000.000.000')}</div>`).join('')}</div></section>`).join('')}</main>`;

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let checked = 0;
  for (const width of [320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.setContent(`<style>${base}\n${recoveredCss}\n${overlayCss}</style>${markup}`);
    await page.addScriptTag({ content: `document.querySelector('nav').onclick=e=>{if(!e.target.dataset.tab)return;document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.id===e.target.dataset.tab));};` });
    if (overlayClient) await page.addScriptTag({ content: overlayClient });
    for (const tab of ['notes','report','personal','payments','settings']) {
      await page.locator(`[data-tab="${tab}"]`).click();
      for (const amount of amounts) {
        await page.evaluate(({ tab, amount }) => {
          document.querySelectorAll(`#${tab} [data-sample]`).forEach(el => {
            if (el.closest('[data-kind="nested-unit"]')) el.innerHTML = `${amount.replace(' ₫', '')} <u>đ</u>`;
            else el.textContent = (el.closest('[data-kind="inline"]') ? 'Giá trị: ' : '') + amount;
          });
        }, { tab, amount });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const failures = await page.locator(`#${tab} [data-sample]`).evaluateAll((elements, amount) => elements.flatMap(el => {
          const range = document.createRange();range.selectNodeContents(el);
          if (el.closest('[data-kind="inline"]')) {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let skip = 'Giá trị: '.length;
            while (walker.nextNode()) {
              if (skip < walker.currentNode.length) {range.setStart(walker.currentNode, skip);break;}
              skip -= walker.currentNode.length;
            }
          }
          const rects = [...range.getClientRects()].filter(r=>r.width>0);
          const lineTops = [...new Set(rects.map(r=>Math.round(r.top)))];
          const sample = el.closest('.sample'), outer = sample.getBoundingClientRect();
          const overflow = rects.some(r=>r.right>outer.right-2 || r.left<outer.left+2);
          const expected = sample.dataset.kind === 'nested-unit' ? amount.replace(' ₫', ' đ') : (sample.dataset.kind === 'inline' ? 'Giá trị: ' : '') + amount;
          const changedText = el.textContent !== expected;
          const overlapsButton = [...sample.querySelectorAll('button')].filter(button=>!button.contains(el)).some(button => {
            const b = button.getBoundingClientRect();
            return rects.some(r=>Math.min(r.right,b.right)-Math.max(r.left,b.left)>0.5 && Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top)>0.5);
          });
          return lineTops.length>1 || overflow || changedText || overlapsButton ? [{kind:sample.dataset.kind,lines:lineTops.length,overflow,changedText,overlapsButton,text:el.textContent}] : [];
        }), amount);
        assert.deepEqual(failures, [], `${width}px / ${tab} / ${amount}: amount must remain on one line inside its card`);
        checked += samples.length;
      }
    }
  }
  // A value must regain its natural size when the same live DOM gets more room.
  await page.locator('[data-tab="personal"]').click();
  await page.locator('#personal [data-kind="card"] [data-sample]').evaluate(el => {el.textContent='100.000.000.000 ₫';});
  await page.setViewportSize({width:320,height:1000});
  await page.waitForTimeout(80);
  const smallFont = await page.locator('#personal [data-kind="card"] [data-sample]').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  await page.setViewportSize({width:1280,height:1000});
  await page.waitForTimeout(80);
  const largeFont = await page.locator('#personal [data-kind="card"] [data-sample]').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  assert.ok(largeFont>smallFont, 'Money should grow back when the viewport widens');
  // Editing/payment fields and plain numeric text must retain their behavior.
  await page.evaluate(() => {
    const fixture=document.createElement('div');fixture.id='interaction-fixture';
    fixture.innerHTML='<input value="100.000 ₫"><textarea>100.000 ₫</textarea><select><option>100.000 ₫</option></select><span contenteditable="true">100.000 ₫</span><span data-plain>123456789</span><button>Thanh toán 100.000 ₫</button>';
    fixture.querySelector('button').addEventListener('click',()=>{fixture.dataset.clicked='yes';});
    document.body.append(fixture);
  });
  await page.waitForTimeout(80);
  const untouched = await page.locator('#interaction-fixture').evaluate(el => [...el.querySelectorAll('input,textarea,select,[contenteditable],[data-plain]')].every(node=>!node.classList.contains('rpa-money')&&!node.querySelector('.rpa-money')));
  assert.ok(untouched, 'Inputs, editable content and plain numbers must not be decorated');
  await page.locator('#interaction-fixture button').click();
  assert.equal(await page.locator('#interaction-fixture').getAttribute('data-clicked'), 'yes');
  await page.locator('#interaction-fixture').evaluate(el=>el.remove());
  assert.deepEqual(errors, []);
  await page.setViewportSize({width:390,height:1100});
  await page.locator('[data-tab="personal"]').click();
  await page.locator('#personal [data-sample]').evaluateAll(elements=>elements.forEach(el=>{
    if(el.closest('[data-kind="nested-unit"]'))el.innerHTML='100.000.000.000 <u>đ</u>';
    else el.textContent=(el.closest('[data-kind="inline"]')?'Giá trị: ':'')+'100.000.000.000 ₫';
  }));
  await mkdir(new URL('.build/', root), {recursive:true});
  await page.screenshot({path:new URL('.build/money-layout-review.png',root).pathname,fullPage:true});
  console.log(`${checked} money layouts passed across five widths and five tabs; dynamic rerenders checked.`);
} finally {
  await browser.close();
}
