import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/ui/bank-qr-host.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const requests = [], decorations = [];
  let now=0;
  let api;
  const context = vm.createContext({
    D: { user: { id: 'synthetic-actor', active: true }, notes: [] }, tab: 'personal', scope: 'all',
    range: () => ({start:'2026-01-01',end:'2026-01-31'}), render: () => {},
    URLSearchParams, Date: {now:()=>now}, Error, Map, Set,
    fetch: (path, options) => new Promise(resolve => requests.push({path,options,resolve})),
    document: {querySelector:()=>null},
    RpaBankQr: {createBankQrFeature(options) {
      api=options.api;
      return {syncSession(){},close(){},mountSettings(){},async decoratePayGroups({groups}) {
        decorations.push(await Promise.all(groups.map(group=>api.readCreditor(group.userId))));
      }};
    }}
  });
  vm.runInContext(source,context);
  const result={status:'ok',pay:{groups:[{userId:'synthetic-owner-a'},{userId:'synthetic-owner-b'}]}};
  return {context,requests,decorations,result,advance(ms){now+=ms;},get api(){return api;},decorate(mode=null){context.result=result;context.mode=mode;vm.runInContext('RpaBankQrHost.decorate({},result,mode)',context);}};
}
function reply(request, data={revision:1}, status=200) {
  request.resolve({ok:status===200,json:async()=>({success:status===200,data,error:{code:'NOT_FOUND'}})});
}

test('warms creditor profiles before selecting pay, joins in-flight work and reuses results', async()=>{
  const h=setup();h.decorate();await tick();
  assert.equal(h.requests.length,2,'opening app must start both independent profile reads');
  h.decorate('pay');await tick();
  assert.equal(h.requests.length,2,'pay must join the pending reads');
  h.requests.forEach(request=>reply(request));await tick();
  h.decorate('pay');await tick();
  assert.equal(h.requests.length,2,'switching back to pay must reuse warm profiles');
  assert.equal(h.decorations.length,2);
});

test('opening QR bypasses warm cache; expired availability reloads', async()=>{
  const h=setup();h.decorate();await tick();h.requests.forEach(request=>reply(request));await tick();
  const fresh=h.api.readCreditor('synthetic-owner-a',{fresh:true});
  assert.equal(h.requests.length,3);
  reply(h.requests[2],{revision:2});assert.equal((await fresh).revision,2);
  h.advance(30001);
  const expired=h.api.readCreditor('synthetic-owner-a');assert.equal(h.requests.length,4);
  reply(h.requests[3]);await expired;
});

test('filter and account transitions discard cached and late responses', async()=>{
  const h=setup();const old=h.api.readCreditor('synthetic-owner-a');
  h.context.scope='me';
  reply(h.requests[0]);await assert.rejects(old,/ACCOUNT_OR_FILTER_CHANGED/);
  const next=h.api.readCreditor('synthetic-owner-a');assert.equal(h.requests.length,2);
  assert.match(h.requests[1].path,/scope=me/);
  h.context.D.user={id:'synthetic-other-actor',active:true};
  reply(h.requests[1]);await assert.rejects(next,/ACCOUNT_CHANGED/);
  const switched=h.api.readCreditor('synthetic-owner-a');assert.equal(h.requests.length,3);
  assert.equal(h.requests[2].options.headers['X-RPA-Actor'],'synthetic-other-actor');
  reply(h.requests[2]);await switched;
});

test('background failure is retryable and signed-out renders do not require date state', async()=>{
  const h=setup();const first=h.api.readCreditor('synthetic-owner-a');reply(h.requests[0],null,404);
  await assert.rejects(first,/PROFILE_REQUEST_FAILED/);
  const second=h.api.readCreditor('synthetic-owner-a');assert.equal(h.requests.length,2);reply(h.requests[1]);await second;
  h.context.D={user:null};h.context.range=()=>{throw Error('date state unavailable');};
  h.context.tab='login';vm.runInContext('RpaBankQrHost.sync()',h.context);
  assert.equal(h.requests.length,2);
});

test('prefetch limits parallel work to four independent creditors', async()=>{
  const h=setup();h.result.pay.groups=Array.from({length:7},(_,i)=>({userId:`synthetic-owner-${i}`}));
  h.decorate();await tick();assert.equal(h.requests.length,4);
  reply(h.requests[0]);await tick();assert.equal(h.requests.length,5);
  h.context.D.user=null;vm.runInContext('RpaBankQrHost.sync()',h.context);
  h.requests.slice(1).forEach(request=>reply(request));await tick();assert.equal(h.requests.length,5);
});
