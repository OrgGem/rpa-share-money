import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const wrapper=await readFile(new URL('../.build/ui-wrapper.mjs',import.meta.url),'utf8');
const literal=name=>JSON.parse(new RegExp(`^const ${name}=("(?:[^"\\\\]|\\\\.)*");`,'m').exec(wrapper)[1]);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<div id="root"><details class="rpa-obligation-group" open><summary><span>Thành viên minh họa</span><strong>1.000 ₫</strong></summary></details></div>');
 await page.addScriptTag({content:`
  var D={user:{id:'00000000-0000-4000-8000-000000000001',active:true},notes:[]};
  var tab='personal',scope='all';function range(){return {start:'2026-01-01',end:'2026-01-31'};}function render(){}
  var owner='00000000-0000-4000-8000-000000000002';
  var result={status:'ok',pay:{groups:[{userId:owner,total:'1000'}]}};
  window.reads=[];window.resolvers=[];
  window.fetch=async function(url){reads.push(url);await new Promise(resolve=>resolvers.push(resolve));return {ok:true,json:async()=>({success:true,data:{ownerId:owner,bankBin:'970436',accountNumber:'DEMO123',nameVerified:false,revision:1,updatedAt:1,debtAmount:'1000'}})};};
 `});
 await page.addScriptTag({content:literal('bankQrBundle')});
 await page.addScriptTag({content:literal('bankQrHost')});
 await page.evaluate(()=>RpaBankQrHost.decorate(document.getElementById('root'),result,null));
 await page.waitForFunction(()=>reads.length===1);
 assert.equal(await page.locator('.rpa-bank-qr-icon').count(),0);
 await page.evaluate(()=>resolvers.shift()());
 await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
 await page.evaluate(()=>RpaBankQrHost.decorate(document.getElementById('root'),result,'pay'));
 await page.locator('.rpa-bank-qr-icon').waitFor();
 assert.equal(await page.evaluate(()=>reads.length),1,'Warm data must display QR without another network request');
 await page.locator('.rpa-bank-qr-icon').click();
 await page.waitForFunction(()=>reads.length===2);
 await page.evaluate(()=>resolvers.shift()());
 await page.locator('.bank-qr-share img').waitFor();
 assert.deepEqual(errors,[]);
 console.log('Chromium: real QR bundle uses prefetched availability and fetches fresh data on QR open.');
}finally{await browser.close();}
