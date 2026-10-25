// Presentation only. Canonical scope and note/modal boundaries are recovered
// wrapper contracts. No data, payment flags or event handlers are modified.
const RpaPresentationLabels=(()=>{
 const personal='Chi tiêu cá nhân';
 const baseProtected='select,option,input,textarea,button,a,nav,header,footer,script,style,template,dialog,[contenteditable],.modal,[data-note-id]';
 const paidPattern=/^đã\s+thanh\s+toán\s*\/\s*tự\s+trả$/iu;
 const normalize=text=>text.normalize('NFC').trim().replace(/\s+/gu,' ').replace(/\s*\/\s*/gu,'/').toLocaleLowerCase('vi');
 const changes=new Map();
 function userContains(text,kind='paid'){
  try{
   if(kind==='personal')return JSON.stringify(D).includes(text);
   const wanted=normalize(text),compact=wanted.replace(/\s/gu,''),pieces=new Set(),stack=[D],seen=new WeakSet();
   while(stack.length){const value=stack.pop();if(typeof value==='string'){const normalized=normalize(value);if(normalized.includes(wanted))return true;const piece=normalized.replace(/\s/gu,'');if(piece&&compact.includes(piece))pieces.add(piece);}
    if(value&&typeof value==='object'&&!seen.has(value)){seen.add(value);stack.push(...Object.values(value));}}
   // Authored fields may be rendered adjacent, even across inline elements.
   // Protect a label that can be composed entirely from those field values.
   const parts=Array(compact.length+1).fill(-1);parts[0]=0;
   for(let i=0;i<compact.length;i++)if(parts[i]>=0){
    if(compact[i]==='/')parts[i+1]=Math.max(parts[i+1],parts[i]);
    for(const piece of pieces)if(compact.startsWith(piece,i))parts[i+piece.length]=Math.max(parts[i+piece.length],parts[i]+1);
   }
   return parts[compact.length]>=2;
  }catch{return true;}
 }
 function protectedNode(node,kind='personal'){
  const element=node.nodeType===Node.ELEMENT_NODE?node:node.parentElement;
  return !element||!!element.closest(baseProtected+(kind==='personal'?',.note':''));
 }
 function change(node,next,kind){changes.set(node,{original:node.nodeValue,next,kind});node.nodeValue=next;}
 function findPersonalSummaryCard(labelNode){
  if(!['notes','report','personal'].includes(tab))return null;
  const slots=[...document.querySelectorAll('[data-rpa-obligation-slot]')];
  const currency=/^(?:[₫đ]|VND)?\s*[+-]?\d[\d.,\s]*\s*(?:[₫đ]|VND)?$/iu;
  const protectedCard=baseProtected+',.note,[data-rpa-obligation-slot],.rpa-obligation-switch,.rpa-obligation-group';
  for(let card=labelNode.parentElement,depth=0;card&&depth<3;card=card.parentElement,depth++){
   if(['BODY','HTML','MAIN'].includes(card.tagName)||card.closest(protectedCard)||card.querySelector(protectedCard))break;
   const branches=[...card.childNodes].filter(n=>n.textContent.trim());
   if(branches.length!==2)continue;
   const labelBranch=branches.find(n=>n===labelNode||n.contains?.(labelNode));
   if(!labelBranch||labelBranch.textContent.trim()!==personal)continue;
   const amountBranch=branches.find(n=>n!==labelBranch),amount=amountBranch.textContent.trim();
   let digitNodes=0;if(amountBranch.nodeType===Node.TEXT_NODE)digitNodes=/\d/u.test(amountBranch.nodeValue)?1:0;else{const texts=document.createTreeWalker(amountBranch,NodeFilter.SHOW_TEXT);while(texts.nextNode())if(/\d/u.test(texts.currentNode.nodeValue))digitNodes++;}
   if(digitNodes!==1)continue;
   // Require currency, not merely an arbitrary number/count/amount-only row.
   if(!/[₫đ]|VND/iu.test(amount)||!currency.test(amount))continue;
   if(!slots.some(slot=>!card.contains(slot)&&(card.compareDocumentPosition(slot)&Node.DOCUMENT_POSITION_FOLLOWING)))continue;
   return card;
  }
  return null;
 }
 function apply(){
  for(const [node,c] of changes){if(node.isConnected&&node.nodeValue===c.next&&!protectedNode(node,c.kind)&&(!c.next.trim()||!userContains(c.next.trim(),c.kind)))node.nodeValue=c.original;}
  changes.clear();
  const hidePersonal=D?.user?.active===true&&['notes','report','personal'].includes(tab)&&typeof ensureReportDateState==='function'&&ensureReportDateState().scope==='me';
  // Status text is generated from paid flags; user-authored strings come from D.
  // A collision anywhere in that data conservatively protects every copy.
  if(!userContains('Đã thanh toán/tự trả')){
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT),elements=[];
   while(walker.nextNode())elements.push(walker.currentNode);
   for(const element of elements.reverse()){
    if(element.matches('.note')||protectedNode(element,'paid')||element.querySelector(baseProtected+',h1,h2,h3,h4,h5,h6,p,div,section,article,ul,ol,li,table,form')||!paidPattern.test(element.textContent.trim()))continue;
    const texts=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),nodes=[];while(texts.nextNode())nodes.push(texts.currentNode);
    if(!nodes.length||nodes.some(n=>protectedNode(n,'paid')))continue;
    // Keep all nested elements, attributes and listeners. Only their text changes.
    const text=element.textContent,slash=text.indexOf('/');let start=0,end=slash;
    while(start<end&&/\s/u.test(text[start]))start++;while(end>start&&/\s/u.test(text[end-1]))end--;
    let offset=0,space=false,firstLetter=true;
    for(const node of nodes){let next='';for(const char of node.nodeValue){const position=offset;offset+=char.length;
     if(position<start||position>=end)continue;
     if(/\s/u.test(char)){if(!space)next+=' ';space=true;}else{const lower=char.toLocaleLowerCase('vi');next+=firstLetter?lower.toLocaleUpperCase('vi'):lower;firstLetter=false;space=false;}}
     if(next!==node.nodeValue)change(node,next,'paid');
    }
   }
  }
  if(hidePersonal&&!userContains(personal,'personal')){
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
   const labels=nodes.filter(node=>node.isConnected&&!protectedNode(node)&&node.nodeValue.trim()===personal);
   const candidates=new Set(labels.map(findPersonalSummaryCard).filter(Boolean));
   const card=candidates.size===1?[...candidates][0]:null;
   // Never reinsert a detached financial summary: only a fresh host render
   // may create a new one for a changed account, range or selection.
   if(card)card.remove();
   for(const node of labels)if(node.isConnected)change(node,'','personal');
  }
 }
 const previous=render;
 render=function(...args){const result=previous(...args);apply();return result;};
 return Object.freeze({apply});
})();
