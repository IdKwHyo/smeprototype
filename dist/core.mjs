export const sampleMenus = [
  {name:'Basil chicken rice', weekday:120, weekend:80, price:89, ingredients:29, packaging:5, fee:20},
  {name:'Garlic pork rice', weekday:95, weekend:62, price:95, ingredients:34, packaging:5, fee:20},
  {name:'Thai iced tea', weekday:85, weekend:55, price:45, ingredients:10, packaging:4, fee:20}
];

export function validateMenus(menus) {
  if (!Array.isArray(menus) || !menus.length || menus.length>100) throw Error('Include between 1 and 100 menu items.');
  for (const m of menus) {
    if (!m.name?.trim()) throw Error('Every menu item needs a name.');
    for (const k of ['weekday','weekend','price','ingredients','packaging','fee']) {
      if (typeof m[k] !== 'number' || !Number.isFinite(m[k]) || m[k]<0) throw Error('Use valid, non-negative numbers for every menu field.');
    }
    if (m.price<=0) throw Error('Menu prices must be greater than zero.');
    if (m.fee>100) throw Error('Platform fees must be between 0 and 100%.');
    if (!Number.isInteger(m.weekday)||!Number.isInteger(m.weekend)) throw Error('Order counts must be whole numbers.');
  }
  const names=menus.map(m=>m.name.trim().toLowerCase());
  if(new Set(names).size!==names.length)throw Error('Use a different name for each menu item.');
  return menus;
}

export function contribution(menu, discount=0) {
  const sellingPrice=menu.price*(1-discount/100);
  return sellingPrice*(1-menu.fee/100)-menu.ingredients-menu.packaging;
}

export function analyze(menus) {
  validateMenus(menus);
  const rows=menus.map(m=>({...m,contribution:contribution(m),weekdayDaily:m.weekday/10,weekendDaily:m.weekend/4}));
  const viable=rows.filter(m=>m.contribution>0);
  const ranked=[...viable].sort((a,b)=>
    Math.max(0,b.weekendDaily-b.weekdayDaily)*b.contribution-Math.max(0,a.weekendDaily-a.weekdayDaily)*a.contribution || b.contribution-a.contribution);
  const sales=rows.reduce((s,m)=>s+(m.weekday+m.weekend)*m.price,0);
  const totalContribution=rows.reduce((s,m)=>s+(m.weekday+m.weekend)*m.contribution,0);
  const orders=rows.reduce((s,m)=>s+m.weekday+m.weekend,0);
  return {rows,recommended:ranked[0]?.name??null,sales,totalContribution,orders,
    weekdayDaily:rows.reduce((s,m)=>s+m.weekdayDaily,0),weekendDaily:rows.reduce((s,m)=>s+m.weekendDaily,0)};
}

export function project(menu, plan) {
  for (const k of ['discount','extraOrders','existingOrders','budget']) if (!Number.isFinite(plan[k])||plan[k]<0) throw Error('Campaign assumptions must be valid, non-negative numbers.');
  if (plan.discount>50) throw Error('Use a discount between 0 and 50%.');
  if (!Number.isInteger(plan.extraOrders)||!Number.isInteger(plan.existingOrders)) throw Error('Campaign orders must be whole numbers.');
  const base=contribution(menu),offer=contribution(menu,plan.discount);
  const existingLoss=plan.existingOrders*(base-offer);
  const net=plan.extraOrders*offer-existingLoss-plan.budget;
  return {base,offer,existingLoss,net,sellingPrice:menu.price*(1-plan.discount/100),
    breakEven:offer>0?Math.ceil((existingLoss+plan.budget)/offer):null};
}

export function evaluate(menu, plan, actual) {
  for (const k of ['totalOrders','baselineOrders','spend']) if (!Number.isFinite(actual[k])||actual[k]<0) throw Error('Results must be valid, non-negative numbers.');
  if (!Number.isInteger(actual.totalOrders)||!Number.isInteger(actual.baselineOrders)) throw Error('Result orders must be whole numbers.');
  const p=project(menu,plan);
  return {incrementalOrders:actual.totalOrders-actual.baselineOrders,
    net:actual.totalOrders*p.offer-actual.baselineOrders*p.base-actual.spend};
}

export function parseCsv(text) {
  const records=[]; let row=[],cell='',quoted=false;
  text=String(text).replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') {if(quoted&&text[i+1]==='"'){cell+='"';i++;} else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell.trim());cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))records.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw Error('The CSV contains an unclosed quote.');
  row.push(cell.trim());if(row.some(Boolean))records.push(row);
  const expected=['menu','weekday_orders','weekend_orders','price','ingredient_cost','packaging_cost','fee_percent'];
  const headers=records.shift()?.map(x=>x.toLowerCase());
  if(!headers||expected.some(x=>!headers.includes(x)))throw Error('Use the column names in the downloadable sample CSV.');
  const index=expected.map(x=>headers.indexOf(x));
  const menus=records.map(r=> {
    if(index.some(i=>r[i]===undefined||r[i]===''))throw Error('Every CSV row needs all seven fields.');
    const v=index.map(i=>r[i]);
    return {name:v[0],weekday:Number(v[1]),weekend:Number(v[2]),price:Number(v[3]),ingredients:Number(v[4]),packaging:Number(v[5]),fee:Number(v[6])};
  });
  return validateMenus(menus);
}

export function menuCsv(menus) {
  const quote=x=>'"'+String(x).replaceAll('"','""')+'"';
  return 'menu,weekday_orders,weekend_orders,price,ingredient_cost,packaging_cost,fee_percent\n'+menus.map(m=>[quote(m.name),m.weekday,m.weekend,m.price,m.ingredients,m.packaging,m.fee].join(',')).join('\n');
}

export function createDrafts(business,menu,plan) {
  const price=(menu.price*(1-plan.discount/100)).toFixed(2);
  const opening=business.tone==='Direct'?'Weekday lunch, sorted.':business.tone==='Polished'?'A considered choice for your weekday lunch.':'Make your weekday lunch a little easier.';
  const offer=plan.discount>0?`${plan.discount}% off ${menu.name} — THB ${price}.`:`${menu.name} — THB ${price}.`;
  return {
    social:`${opening}\n\n${offer}\nFrom ${business.name}, for ${business.audience}.\nAvailable Monday–Friday, 11:00–14:00, during the campaign week.\nOrder through your usual restaurant channel.`,
    message:`Hello from ${business.name}. Our weekday lunch feature is ${menu.name} at THB ${price}${plan.discount>0?` (${plan.discount}% off)`:''}. Available Monday–Friday, 11:00–14:00, during the campaign week. We'd love to see you.`,
    announcement:`${business.name} announces a weekday lunch campaign for ${business.audience}, featuring ${menu.name} at THB ${price}. The campaign runs Monday–Friday, 11:00–14:00, for one week. Confirm campaign dates and ordering details before publishing.`
  };
}
