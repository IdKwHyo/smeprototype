import {sampleMenus,validateMenus,analyze,project,evaluate,parseCsv,menuCsv,createDrafts} from './core.mjs';
const $=id=>document.getElementById(id);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-TH',{style:'currency',currency:'THB',maximumFractionDigits:2}).format(n);
const storageKey='sme-commercial-workflow-v1';
const fresh=()=>({business:{name:'Soi Kitchen',type:'Independent Thai restaurant',audience:'Office workers near the restaurant',tone:'Warm',budget:600},menus:structuredClone(sampleMenus),plan:{menu:sampleMenus[0].name,discount:10,extraOrders:40,existingOrders:20,budget:600},drafts:null,draftFresh:false,step:0,maxStep:0,approved:false,actual:{totalOrders:60,baselineOrders:20,spend:600},result:null});
let state=fresh();
try {const saved=JSON.parse(localStorage.getItem(storageKey));if(saved&&saved.business&&saved.plan&&saved.actual&&saved.step>=0&&saved.step<=3&&saved.maxStep>=saved.step&&saved.maxStep<=3){validateMenus(saved.menus);state={...state,...saved};}}catch{}
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{$('input-status').textContent='Browser storage is unavailable. This session still works, but changes will not survive a reload.';}}
function fail(id,message){$(id).textContent=message;$(id).hidden=false;}
function clearError(id){$(id).hidden=true;}
function number(id){const el=$(id);if(el.value.trim()===''||!el.checkValidity())throw Error('Complete all numeric fields with values in the allowed range.');return Number(el.value);}
function download(name,text,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

function renderMenuInputs(){
  const columns=[['name','text'],['weekday','number'],['weekend','number'],['price','number'],['ingredients','number'],['packaging','number'],['fee','number']];
  $('menu-inputs').innerHTML=state.menus.map((m,i)=>`<tr>${columns.map(([key,type])=>`<td><input data-row="${i}" data-key="${key}" aria-label="${esc(key)} for menu item ${i+1}" type="${type}" value="${esc(m[key])}" required ${type==='text'?'maxlength="100"':`min="${key==='price'?'0.01':'0'}" max="${key==='fee'?'100':'10000000'}" step="${['weekday','weekend'].includes(key)?'1':'0.01'}"`}></td>`).join('')}<td><button type="button" class="secondary" data-remove="${i}" aria-label="Remove ${esc(m.name)}">Remove</button></td></tr>`).join('');
}
function readMenus(){
  const menus=state.menus.map(()=>({}));
  for(const input of $('menu-inputs').querySelectorAll('input')){if(!input.checkValidity()||input.value.trim()==='')throw Error('Complete every menu field. Orders must be whole numbers and costs cannot be negative.');menus[Number(input.dataset.row)][input.dataset.key]=input.dataset.key==='name'?input.value.trim():Number(input.value);}
  return validateMenus(menus);
}
function readBusiness(){return {name:$('business-name').value.trim(),type:$('business-type').value.trim(),audience:$('audience').value.trim(),tone:$('tone').value,budget:number('budget')};}
function populate(){
  for(const [id,key] of [['business-name','name'],['business-type','type'],['audience','audience'],['tone','tone'],['budget','budget']])$(id).value=state.business[key];
  renderMenuInputs();
  for(const [id,key] of [['discount','discount'],['extra-orders','extraOrders'],['existing-orders','existingOrders'],['plan-budget','budget']])$(id).value=state.plan[key];
  for(const [id,key] of [['actual-orders','totalOrders'],['baseline-orders','baselineOrders'],['actual-spend','spend']])$(id).value=state.actual[key];
  setDraftFields();
  $('check-capacity').checked=state.approved;$('check-content').checked=state.approved;
}
function invalidate(){state.maxStep=0;state.approved=false;state.result=null;state.draftFresh=false;updateNav();}
function updateNav(){document.querySelectorAll('[data-step]').forEach(b=>{const n=Number(b.dataset.step);b.disabled=n>state.maxStep;if(n===state.step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});}
function showStep(step,focus=true){
  if(step>state.maxStep)return;
  state.step=step;
  ['business','analysis','campaign','results'].forEach((name,i)=>$(name+'-screen').hidden=i!==step);
  if(step===1)renderAnalysis();
  if(step===2)renderCampaign();
  if(step===3){$('approval-label').textContent=`Approved in this browser: ${state.plan.menu} · ${state.plan.discount}% discount · ${money(state.plan.budget)} spending. Record the outcome after running the campaign manually.`;renderResults();}
  updateNav();save();
  if(focus) {const heading=$(['business','analysis','campaign','results'][step]+'-title');heading.focus();window.scrollTo({top:0,behavior:'instant'});}
}

function metric(label,value){return `<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;}
function renderAnalysis(){
  const a=analyze(state.menus);
  const lowerWeekday=a.weekdayDaily<a.weekendDaily;
  const gap=a.weekendDaily>0?Math.round((1-a.weekdayDaily/a.weekendDaily)*100):0;
  $('analysis-content').innerHTML=`<div class="metrics">${metric('Sales · Previous 14 days',money(a.sales))}${metric('Contribution · Before fixed overhead',money(a.totalContribution))}${metric('Orders · One item per order',a.orders)}</div>
    <div class="analysis-note"><h2>Finding</h2><p>${lowerWeekday?`Weekdays average ${a.weekdayDaily.toFixed(1)} orders per day, compared with ${a.weekendDaily.toFixed(1)} on weekends — ${gap}% lower.`:`Weekdays average ${a.weekdayDaily.toFixed(1)} orders per day, compared with ${a.weekendDaily.toFixed(1)} on weekends. This data does not show a weekday demand gap.`}</p><p>${a.recommended?`Suggested item to investigate: <strong>${esc(a.recommended)}</strong>. It has positive unit contribution${lowerWeekday?' and appears suitable for testing weekday demand':''}.`:'Every menu item has zero or negative contribution under the entered costs. Review pricing and costs before funding a campaign.'}</p></div>
    <h2>Evidence by menu item</h2><div class="table-wrap"><table><thead><tr><th>Item</th><th>Weekday orders / day</th><th>Weekend orders / day</th><th>Contribution / item</th></tr></thead><tbody>${a.rows.map(m=>`<tr><td>${esc(m.name)}</td><td>${m.weekdayDaily.toFixed(1)}</td><td>${m.weekendDaily.toFixed(1)}</td><td>${money(m.contribution)}</td></tr>`).join('')}</tbody></table></div>
    <details><summary>How the analyst calculated this</summary><p>Unit contribution = price × (1 − fee / 100) − ingredient cost − packaging cost. Weekday orders are divided by 10 days; weekend orders by 4 days. The suggested item is the positive-contribution menu item with the largest weekday-to-weekend daily order gap multiplied by its unit contribution. If no item has a positive gap, the highest unit contribution is used. This heuristic identifies a candidate for testing, not an optimal strategy.</p></details>
    <details><summary>What the team still needs to know</summary><p>Capacity at lunch, customer motivations, competitor offers, additional labour costs, and genuine advertising response are unknown. Two weeks of orders can be affected by holidays, weather, stock availability, and other factors. There is no live market research or customer segmentation in this prototype.</p></details>`;
  $('make-plan').disabled=!a.recommended;
}
function selectedMenu(){const menu=state.menus.find(m=>m.name===state.plan.menu);if(!menu)throw Error('Choose an available menu item.');return menu;}
function readPlan(){return {menu:$('campaign-menu').value,discount:number('discount'),extraOrders:number('extra-orders'),existingOrders:number('existing-orders'),budget:number('plan-budget')};}
function renderCampaign(){
  $('campaign-menu').innerHTML=state.menus.map(m=>`<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');$('campaign-menu').value=state.plan.menu;
  $('campaign-audience').textContent=state.business.audience;
  $('campaign-reason').textContent=`Test a focused weekday lunch offer for ${state.business.name}. Use your menu economics to set an offer that can cover its campaign spending.`;
  setDraftFields();renderProjection();
}
function renderProjection(){
  try{
    const p=project(selectedMenu(),state.plan);clearError('plan-error');
    $('projection').innerHTML=`<div class="metrics">${metric('Offer price',money(p.sellingPrice))}${metric('Contribution / offer order',money(p.offer))}${metric('Estimated incremental contribution',money(p.net))}</div>
      <p class="${p.net<0?'warning':'muted'}">${p.offer<=0?'This offer has no positive unit contribution. Adjust the menu, discount, or costs before approval.':p.net<0?'The current assumptions produce a loss after campaign spending. Review the offer and order assumptions.':'The current assumptions produce a positive contribution after campaign spending.'}</p>
      <p class="muted">Break-even: ${p.breakEven===null?'unavailable with zero or negative offer contribution':`${p.breakEven} additional orders`} with ${state.plan.existingOrders} existing orders taking the offer. Discount impact on existing orders: ${money(p.existingLoss)}.</p>
      <details><summary>Projection formula and assumptions</summary><p>Expected additional orders × discounted unit contribution − lost contribution on existing orders − campaign spending. Platform fees are applied to the discounted selling price. The restaurant funds the full discount. Order estimates are entered by you, and no ad conversion forecast is being made.</p></details>`;
    $('approve').disabled=p.offer<=0;
  }catch(e){fail('plan-error',e.message);$('projection').innerHTML='';$('approve').disabled=true;}
}
function setDraftFields(){for(const [id,key] of [['social-draft','social'],['message-draft','message'],['announcement-draft','announcement']])$(id).value=state.drafts?.[key]??'';}
function generateDrafts(){state.drafts=createDrafts(state.business,selectedMenu(),state.plan);state.draftFresh=true;setDraftFields();$('draft-status').textContent='Drafts updated from the current plan. Edit them and review before approving.';save();}
function planChanged(){
  try{const next=readPlan();project(state.menus.find(m=>m.name===next.menu),next);state.plan=next;state.draftFresh=false;state.approved=false;state.maxStep=2;state.result=null;$('check-capacity').checked=false;$('check-content').checked=false;$('draft-status').textContent='The plan changed. Generate updated drafts, then review the checklist.';renderProjection();updateNav();save();}
  catch(e){fail('plan-error',e.message);$('approve').disabled=true;}
}
function renderResults(){
  if(!state.result){$('results-content').innerHTML='<p class="panel muted">Enter the campaign results above, or load the synthetic example to continue the workflow.</p>';return;}
  const r=state.result;const p=project(selectedMenu(),state.plan);
  $('results-content').innerHTML=`<div class="panel"><h2>Campaign review</h2><div class="metrics">${metric('Orders above estimated baseline',r.incrementalOrders)}${metric('Estimated incremental contribution',money(r.net))}${metric('Planned contribution',money(p.net))}</div><p><strong>Suggested next step:</strong> ${r.net>0?'Repeat a small test with a comparable baseline and confirm whether the contribution improvement persists.':r.net===0?'The campaign broke even under the entered assumptions. Review the offer and acquisition costs before repeating.':'Revise the offer or reduce campaign spending before repeating. Review whether discounting existing orders outweighed additional demand.'}</p><p class="muted">Estimated incremental contribution = offer orders × offer contribution − baseline orders × regular contribution − actual campaign spending. Ingredient costs and fees are assumed unchanged from the plan. This is an estimate, not net profit or a proven causal effect.</p></div>`;
}
function runResults(){
  try{state.actual={totalOrders:number('actual-orders'),baselineOrders:number('baseline-orders'),spend:number('actual-spend')};state.result=evaluate(selectedMenu(),state.plan,state.actual);clearError('results-error');renderResults();save();}
  catch(e){fail('results-error',e.message);}
}
function briefText(){const p=project(selectedMenu(),state.plan);return `SME Commercial Team — Campaign brief\n\nBusiness: ${state.business.name}\nType: ${state.business.type}\nAudience: ${state.business.audience}\nGoal: Grow profitable weekday lunch sales\nFeatured item: ${state.plan.menu}\nDiscount: ${state.plan.discount}%\nOffer price: ${money(p.sellingPrice)}\nCampaign spending: ${money(state.plan.budget)}\nExpected additional orders (assumption): ${state.plan.extraOrders}\nExisting orders taking offer (assumption): ${state.plan.existingOrders}\nEstimated incremental contribution: ${money(p.net)}\nBreak-even additional orders: ${p.breakEven??'Unavailable'}\nStatus: ${state.approved?'Approved in browser':'Draft'}\n\nSOCIAL POST\n${state.drafts?.social??''}\n\nCUSTOMER MESSAGE\n${state.drafts?.message??''}\n\nANNOUNCEMENT\n${state.drafts?.announcement??''}\n\nPrototype: template-based simulated AI outputs. Verify dates, facts and fulfilment capacity before manual publishing. Contribution excludes fixed overhead, taxes and additional labour costs. Order assumptions are not predictions.\n`;}

$('business-form').addEventListener('submit',e=>{e.preventDefault();try{state.business=readBusiness();if(!state.business.name||!state.business.audience||!state.business.type)throw Error('Enter the business name, type, and target customers.');state.menus=readMenus();state.maxStep=1;clearError('business-error');showStep(1);}catch(err){fail('business-error',err.message);}});
$('business-form').addEventListener('input',()=>{invalidate();try{state.business=readBusiness();state.menus=readMenus();save();}catch{}});
$('menu-inputs').addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;if(state.menus.length===1){toast('Keep at least one menu item.');return;}try{state.menus=readMenus();}catch{}state.menus.splice(Number(b.dataset.remove),1);renderMenuInputs();invalidate();save();});
$('add-menu').addEventListener('click',()=>{if(state.menus.length>=100){toast('The prototype supports up to 100 menu items.');return;}try{state.menus=readMenus();}catch{}let n=state.menus.length+1;while(state.menus.some(m=>m.name===`New menu item ${n}`))n++;state.menus.push({name:`New menu item ${n}`,weekday:0,weekend:0,price:80,ingredients:25,packaging:5,fee:20});renderMenuInputs();invalidate();save();$('menu-inputs').lastElementChild.querySelector('input').focus();});
$('sample-csv').addEventListener('click',()=>download('sample-menu-data.csv',menuCsv(sampleMenus),'text/csv'));
$('csv-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw Error('Use a CSV smaller than 1 MB.');state.menus=parseCsv(await file.text());renderMenuInputs();invalidate();save();clearError('business-error');$('input-status').textContent=`Imported ${state.menus.length} menu items from ${file.name}. Check costs and confirm the 14-day reporting period.`;}catch(err){fail('business-error',err.message);}e.target.value='';});
document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>showStep(Number(b.dataset.step))));
document.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>showStep(Number(b.dataset.back))));
$('make-plan').addEventListener('click',()=>{const a=analyze(state.menus);if(!a.recommended)return;state.plan={menu:a.recommended,discount:10,extraOrders:40,existingOrders:20,budget:state.business.budget};for(const [id,key] of [['discount','discount'],['extra-orders','extraOrders'],['existing-orders','existingOrders'],['plan-budget','budget']])$(id).value=state.plan[key];state.maxStep=2;state.approved=false;$('check-capacity').checked=false;$('check-content').checked=false;generateDrafts();showStep(2);});
for(const id of ['campaign-menu','discount','extra-orders','existing-orders','plan-budget'])$(id).addEventListener('input',planChanged);
for(const [id,key] of [['social-draft','social'],['message-draft','message'],['announcement-draft','announcement']])$(id).addEventListener('input',()=>{state.drafts??={};state.drafts[key]=$(id).value;state.approved=false;state.maxStep=2;$('check-content').checked=false;updateNav();save();});
$('regenerate').addEventListener('click',()=>{try{state.plan=readPlan();project(selectedMenu(),state.plan);generateDrafts();toast('Template drafts generated.');}catch(e){fail('plan-error',e.message);}});
$('download-brief').addEventListener('click',()=>{try{state.plan=readPlan();download('campaign-brief.txt',briefText());}catch(e){fail('plan-error',e.message);}});
$('approve').addEventListener('click',()=>{try{state.plan=readPlan();const p=project(selectedMenu(),state.plan);if(p.offer<=0)throw Error('Adjust the offer so each order has positive contribution.');if(!state.draftFresh)throw Error('Generate updated drafts after changing the plan.');if(!$('check-capacity').checked||!$('check-content').checked){$('draft-status').textContent='Complete both review checks before approving.';(!$('check-capacity').checked?$('check-capacity'):$('check-content')).focus();return;}state.approved=true;state.maxStep=3;state.actual={totalOrders:state.plan.extraOrders+state.plan.existingOrders,baselineOrders:state.plan.existingOrders,spend:state.plan.budget};state.result=null;for(const [id,key] of [['actual-orders','totalOrders'],['baseline-orders','baselineOrders'],['actual-spend','spend']])$(id).value=state.actual[key];showStep(3);}catch(e){fail('plan-error',e.message);}});
$('results-form').addEventListener('submit',e=>{e.preventDefault();runResults();});
$('results-form').addEventListener('input',()=>{state.result=null;$('results-content').innerHTML='<p class="panel muted">Results changed. Select Evaluate results to update the review.</p>';save();});
$('demo-results').addEventListener('click',()=>{const actual={totalOrders:state.plan.extraOrders+state.plan.existingOrders+10,baselineOrders:state.plan.existingOrders,spend:state.plan.budget};for(const [id,key] of [['actual-orders','totalOrders'],['baseline-orders','baselineOrders'],['actual-spend','spend']])$(id).value=actual[key];runResults();toast('Synthetic results loaded.');});
$('download-results').addEventListener('click',()=>{if(!state.result){toast('Evaluate results before downloading.');return;}download('campaign-results.txt',`Campaign results — ${state.business.name}\nMenu: ${state.plan.menu}\nOffer orders: ${state.actual.totalOrders}\nEstimated baseline orders: ${state.actual.baselineOrders}\nActual campaign spending: ${money(state.actual.spend)}\nEstimated additional orders: ${state.result.incrementalOrders}\nEstimated incremental contribution: ${money(state.result.net)}\n\nBaseline and costs are assumptions. This comparison does not establish causality. Fixed overhead, taxes and additional labour costs are excluded.\n`);});
$('reset').addEventListener('click',()=>{state=fresh();populate();$('input-status').textContent='Synthetic example restored.';clearError('business-error');clearError('plan-error');clearError('results-error');$('draft-status').textContent='';showStep(0);toast('Demo reset.');});
populate();showStep(state.step,false);
