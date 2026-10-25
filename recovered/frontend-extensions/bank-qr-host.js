// Same-origin transport; identity always comes from the server session.
const RpaBankQrHost=(()=>{
 const selection=()=>typeof ensureReportDateState==='function'&&['notes','report','personal'].includes(tab)?ensureReportDateState().scope:(typeof scope==='string'?scope:'all');
 const actor=()=>D?.user?.active===true?D.user.id:null;
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
  saveOwn:body=>request('/api/bank-profile',{method:'PUT',body}),
  readCreditor:id=>{const bounds=range();const query=new URLSearchParams({start:bounds.start,end:bounds.end,scope:selection()});return request('/api/users/'+encodeURIComponent(id)+'/bank-profile?'+query);}
 }});
 let previousView=null,previousGroups=null;
 function sync(){
  feature.syncSession();
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
  if(result.status!=='ok'||mode!=='pay')return;
  void feature.decoratePayGroups({root,groups:result.pay.groups,direction:'pay'});
 }
 const previousRender=render;
 render=function(...args){feature.close();sync();const result=previousRender(...args);mount();return result;};
 return Object.freeze({decorate,mount,sync});
})();
