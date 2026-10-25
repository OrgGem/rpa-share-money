// Same-origin transport; identity always comes from the server session.
const RpaBankQrHost=(()=>{
 const selection=()=>typeof ensureReportDateState==='function'&&['notes','report','personal'].includes(tab)?ensureReportDateState().scope:(typeof scope==='string'?scope:'all');
 const actor=()=>D?.user?.active===true?D.user.id:null;
 const profiles=new Map(),pending=new Map();
 const PROFILE_TTL=30000,MAX_PROFILES=100;
 let profileContext=null,generation=0;
 function syncProfiles(){
  if(!actor()||!Array.isArray(D?.notes)){
   if(profileContext!==null){generation++;profileContext=null;profiles.clear();pending.clear();}
   return null;
  }
  if(!['notes','report','personal'].includes(tab))return null;
  const bounds=range();
  const next=JSON.stringify([actor(),bounds.start,bounds.end,selection(),D?.notes]);
  if(next!==profileContext){profileContext=next;generation++;profiles.clear();pending.clear();}
  return bounds;
 }
 function readCreditor(id,{fresh=false}={}){
  const bounds=syncProfiles(),epoch=generation;
  if(!actor()||!bounds)return Promise.reject(new Error('PROFILE_CONTEXT_UNAVAILABLE'));
  const cached=profiles.get(id);
  if(!fresh&&cached&&Date.now()-cached.savedAt<PROFILE_TTL)return Promise.resolve(cached.data);
  if(!fresh&&pending.has(id))return pending.get(id);
  profiles.delete(id);
  const query=new URLSearchParams({start:bounds.start,end:bounds.end,scope:selection()});
  const task=request('/api/users/'+encodeURIComponent(id)+'/bank-profile?'+query).then(data=>{
   syncProfiles();
   if(epoch!==generation)throw new Error('ACCOUNT_OR_FILTER_CHANGED');
   if(pending.get(id)===task){
    if(profiles.size>=MAX_PROFILES)profiles.delete(profiles.keys().next().value);
    profiles.set(id,{data,savedAt:Date.now()});
   }
   return data;
  }).finally(()=>{if(pending.get(id)===task)pending.delete(id);});
  pending.set(id,task);return task;
 }
 function prefetch(groups){
  const ids=[...new Set(groups.map(group=>group.userId))],epoch=generation;
  let index=0;
  // Warm independently of the selected panel without flooding the GAS gateway.
  void Promise.allSettled(Array.from({length:Math.min(4,ids.length)},async()=>{
   while(index<ids.length&&epoch===generation){
    const id=ids[index++];try{await readCreditor(id);}catch{/* Retry on a later render; never cache failures. */}
   }
  }));
 }
 async function request(path,{method='GET',body}={}){
  const expected=actor();if(!expected)throw new Error('SIGNED_OUT');
  const headers={'X-RPA-Actor':expected};
  if(method==='PUT'){
   const csrfResponse=await fetch('/api/csrf',{credentials:'same-origin',cache:'no-store'});
   const csrf=await csrfResponse.json();
   if(!csrfResponse.ok||csrf.success!==true||typeof csrf.data?.csrfToken!=='string'||actor()!==expected)throw new Error('CSRF_UNAVAILABLE');
   headers['Content-Type']='application/json';headers['X-CSRF-Token']=csrf.data.csrfToken;
  }
  if(actor()!==expected)throw new Error('ACCOUNT_CHANGED');
  const response=await fetch(path,{method,headers,body:body?JSON.stringify(body):undefined,credentials:'same-origin',cache:'no-store'});
  const result=await response.json();
  if(actor()!==expected)throw new Error('ACCOUNT_CHANGED');
  if(!response.ok||result.success!==true){const error=new Error('PROFILE_REQUEST_FAILED');error.code=result.error?.code;throw error;}
  return result.data;
 }
 const feature=RpaBankQr.createBankQrFeature({getContext:()=>({actorId:actor(),active:!!actor()}),api:{
  readOwn:()=>request('/api/bank-profile'),
  saveOwn:async body=>{const data=await request('/api/bank-profile',{method:'PUT',body});generation++;profiles.clear();pending.clear();return data;},
  readCreditor
 }});
 let previousView=null,previousGroups=null;
 function sync(){
  feature.syncSession();
  syncProfiles();
  const view=JSON.stringify([actor(),tab,selection(),D?.notes,typeof range==='function'&&['notes','report','personal'].includes(tab)?range():null]);
  if(view!==previousView){feature.close();previousView=view;}
 }
 function mount(){
  sync();if(!actor()||tab!=='local-settings')return;
  const settings=document.querySelector('.local-member-settings');if(!settings)return;
  let root=document.getElementById('rpa-bank-profile-settings');
  if(!root){root=document.createElement('div');root.id='rpa-bank-profile-settings';settings.after(root);void feature.mountSettings(root);}
 }
 function decorate(root,result,mode){
  sync();const groupsView=JSON.stringify([actor(),tab,mode,result]);if(groupsView!==previousGroups){feature.close();previousGroups=groupsView;}
  if(result.status!=='ok')return;
  prefetch(result.pay.groups);
  if(mode!=='pay')return;
  void feature.decoratePayGroups({root,groups:result.pay.groups,direction:'pay'});
 }
 const previousRender=render;
 render=function(...args){feature.close();sync();const result=previousRender(...args);mount();return result;};
 return Object.freeze({decorate,mount,sync});
})();
