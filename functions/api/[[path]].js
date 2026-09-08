// GRAB A CUP Cloudflare Pages Functions API
// 路由：/api/*
// Secrets 請在 Cloudflare Pages > Settings > Variables and Secrets 設定。

const PRODUCTS = {
  'peach-oolong': {name:'水蜜桃烏龍',price:178},
  'coconut-latte': {name:'生椰拿鐵',price:178},
  'jasmine-cream-americano': {name:'茉莉奶蓋美式',price:178},
  'jasmine-light-latte': {name:'茉莉輕雪拿鐵',price:168},
  'classic-latte': {name:'拿鐵時光',price:158},
  'rouge-spring-americano': {name:'胭脂春美式',price:168},
  'kainak-latte': {name:'凱娜克拿鐵',price:210},
  'pistachio-macchiato': {name:'開心果瑪奇朵',price:198},
  'berry-cocoa-light-milk-tea': {name:'綜合莓可可輕乳茶',price:188}
};

const SHIPPING_OPTIONS = {
  home:{label:'宅配（台灣本島）',fee:100,freeThreshold:1000},
  chilled:{label:'宅配冷藏（台灣本島）',fee:250,freeThreshold:2000},
  frozen:{label:'宅配冷凍（台灣本島）',fee:350,freeThreshold:3000},
  post:{label:'郵寄',fee:125,freeThreshold:null}
};

const PAYMENT_OPTIONS = {
  credit:{label:'信用卡',type:'fixed',fee:0},
  cod:{label:'取貨時付款',type:'fixed',fee:60}
};

const PROMOTIONS = {
  freeShippingThreshold:1000,
  amountDiscount:{step:1000,amountPerStep:100,maxDiscount:300},
  quantityDiscounts:[
    {minQty:6,rate:0.20,label:'滿 6 件 8 折'},
    {minQty:3,rate:0.10,label:'滿 3 件 9 折'}
  ],
  gift:{step:2000,maxQty:3,productName:'開心果瑪奇朵10入'},
  discountStacking:'best-of'
};

const ENTERPRISE_RATE = 0.80;

const json = (data,status=200) => new Response(JSON.stringify(data),{
  status,
  headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});

const safeText=(v,max=100)=>String(v||'').replace(/[<>#&]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const enterprisePrice=price=>Math.round(price*ENTERPRISE_RATE);

function enterpriseCodes(env){
  return String(env.ENTERPRISE_CODES||'').split(',').map(s=>s.trim()).filter(Boolean);
}

function bytesToBase64Url(bytes){
  let binary='';
  bytes.forEach(b=>binary+=String.fromCharCode(b));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function base64UrlToBytes(s){
  s=s.replace(/-/g,'+').replace(/_/g,'/');
  while(s.length%4)s+='=';
  const binary=atob(s);
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
function textToBase64Url(text){
  return bytesToBase64Url(new TextEncoder().encode(text));
}
function base64UrlToText(text){
  return new TextDecoder().decode(base64UrlToBytes(text));
}
async function hmac(text,secret){
  const key=await crypto.subtle.importKey(
    'raw',new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['sign']
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text))));
}
async function signEnterpriseToken(code,env){
  const payload=textToBase64Url(JSON.stringify({c:code,exp:Date.now()+12*60*60*1000}));
  return `${payload}.${await hmac(payload,env.ENTERPRISE_SECRET)}`;
}
async function verifyEnterpriseToken(request,env){
  try{
    const token=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
    const [payload,sig]=token.split('.');
    if(!payload||!sig||!env.ENTERPRISE_SECRET)return null;
    const expected=await hmac(payload,env.ENTERPRISE_SECRET);
    if(sig!==expected)return null;
    const data=JSON.parse(base64UrlToText(payload));
    if(!data.exp||Date.now()>data.exp||!enterpriseCodes(env).includes(data.c))return null;
    return data;
  }catch{return null;}
}

function calculatePromotions(subtotal,qty){
  const a=PROMOTIONS.amountDiscount;
  const amountDiscount=Math.min(a.maxDiscount,Math.floor(subtotal/a.step)*a.amountPerStep);
  const tier=PROMOTIONS.quantityDiscounts.find(t=>qty>=t.minQty);
  const quantityDiscount=tier?Math.round(subtotal*tier.rate):0;
  let discount=0,discountLabel='';
  if(quantityDiscount>amountDiscount){
    discount=quantityDiscount; discountLabel=tier?.label||'滿件折扣';
  }else if(amountDiscount>0){
    discount=amountDiscount; discountLabel='每滿千折百';
  }
  const giftQty=Math.min(PROMOTIONS.gift.maxQty,Math.floor(subtotal/PROMOTIONS.gift.step));
  return {discount,discountLabel,giftQty};
}

function formatDate(d=new Date()){
  const z=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}/${z(d.getMonth()+1)}/${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}
function orderNo(){
  const bytes=new Uint8Array(2); crypto.getRandomValues(bytes);
  return (`G${Date.now().toString(36).toUpperCase()}${[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase()}`).slice(0,20);
}
function ecpayUrlEncode(str){
  return encodeURIComponent(str).replace(/%20/g,'+').replace(/~/g,'%7E')
    .replace(/%2D/gi,'-').replace(/%5F/gi,'_').replace(/%2E/gi,'.')
    .replace(/%21/gi,'!').replace(/%2A/gi,'*').replace(/%28/gi,'(').replace(/%29/gi,')');
}
async function sha256Hex(text){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
}
async function checkMacValue(params,env){
  const sorted=Object.keys(params)
    .filter(k=>k!=='CheckMacValue'&&params[k]!==undefined&&params[k]!==null&&params[k]!=='')
    .sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base'}))
    .map(k=>`${k}=${params[k]}`).join('&');
  const raw=`HashKey=${env.ECPAY_HASH_KEY}&${sorted}&HashIV=${env.ECPAY_HASH_IV}`;
  return sha256Hex(ecpayUrlEncode(raw).toLowerCase());
}
function ecpayConfig(env){
  const prod=String(env.ECPAY_MODE||'stage').toLowerCase()==='prod';
  return {
    prod,
    merchantId:env.ECPAY_MERCHANT_ID||(prod?'':'3002607'),
    hashKey:env.ECPAY_HASH_KEY||(prod?'':'pwFHCqoQZGmho4w6'),
    hashIV:env.ECPAY_HASH_IV||(prod?'':'EkRm7iFT261dpevs'),
    action:prod?'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5':'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
  };
}
function origin(request,env){
  return String(env.PUBLIC_BASE_URL||new URL(request.url).origin).replace(/\/$/,'');
}
async function bodyJson(request){
  try{return await request.json()}catch{return {}}
}

async function normalCheckout(request,env){
  const cfg=ecpayConfig(env);
  if(!cfg.merchantId||!cfg.hashKey||!cfg.hashIV)return json({error:'綠界正式環境金鑰尚未設定'},500);
  const body=await bodyJson(request);
  const items=Array.isArray(body.items)?body.items:[];
  const normalized=items.map(x=>({id:String(x.id||''),quantity:Math.max(1,Math.min(99,parseInt(x.quantity)||1))})).filter(x=>PRODUCTS[x.id]);
  if(!normalized.length)return json({error:'購物車沒有有效商品'},400);

  const subtotal=normalized.reduce((s,x)=>s+PRODUCTS[x.id].price*x.quantity,0);
  const qty=normalized.reduce((s,x)=>s+x.quantity,0);
  const promo=calculatePromotions(subtotal,qty);
  const shippingMethod=String(body.customer?.shippingMethod||'home');
  const paymentMethod=String(body.customer?.paymentMethod||'credit');
  const shippingOpt=SHIPPING_OPTIONS[shippingMethod],paymentOpt=PAYMENT_OPTIONS[paymentMethod];
  if(!shippingOpt||!paymentOpt)return json({error:'配送或付款方式無效'},400);
  const shipping=shippingOpt.freeThreshold&&subtotal>=shippingOpt.freeThreshold?0:shippingOpt.fee;
  const paymentFee=paymentOpt.type==='rate'?Math.round(subtotal*(paymentOpt.rate||0)):(paymentOpt.fee||0);
  const total=Math.max(1,subtotal-promo.discount+shipping+paymentFee);
  const no=orderNo();

  const parts=normalized.map(x=>`${safeText(PRODUCTS[x.id].name,40)} x${x.quantity}`);
  if(promo.discount)parts.push(`${promo.discountLabel} -NT$${promo.discount}`);
  if(promo.giftQty)parts.push(`${PROMOTIONS.gift.productName} 贈品 x${promo.giftQty}`);
  if(shipping)parts.push(`${shippingOpt.label} NT$${shipping}`);
  if(paymentFee)parts.push(`${paymentOpt.label}手續費 NT$${paymentFee}`);

  const base=origin(request,env);
  const fields={
    MerchantID:cfg.merchantId,MerchantTradeNo:no,MerchantTradeDate:formatDate(),PaymentType:'aio',
    TotalAmount:String(total),TradeDesc:'GRAB A CUP order',ItemName:parts.join('#').slice(0,390),
    ReturnURL:`${base}/api/ecpay/return`,ChoosePayment:'ALL',EncryptType:'1',
    ClientBackURL:`${base}/payment-result.html`
  };
  fields.CheckMacValue=await checkMacValue(fields,{...env,ECPAY_HASH_KEY:cfg.hashKey,ECPAY_HASH_IV:cfg.hashIV});
  return json({orderNo:no,action:cfg.action,fields});
}

async function enterpriseCheckout(request,env){
  const auth=await verifyEnterpriseToken(request,env);
  if(!auth)return json({error:'企業登入已失效，請重新登入'},401);
  const cfg=ecpayConfig(env);
  if(!cfg.merchantId||!cfg.hashKey||!cfg.hashIV)return json({error:'綠界正式環境金鑰尚未設定'},500);
  const body=await bodyJson(request);
  const items=Array.isArray(body.items)?body.items:[];
  const normalized=items.map(x=>({id:String(x.id||''),quantity:Math.max(1,Math.min(99,parseInt(x.quantity)||1))})).filter(x=>PRODUCTS[x.id]);
  if(!normalized.length)return json({error:'企業採購清單沒有有效商品'},400);

  const subtotal=normalized.reduce((s,x)=>s+enterprisePrice(PRODUCTS[x.id].price)*x.quantity,0);
  const shippingMethod=String(body.customer?.shippingMethod||'home');
  const shippingOpt=SHIPPING_OPTIONS[shippingMethod];
  if(!shippingOpt)return json({error:'配送方式無效'},400);
  const shipping=shippingOpt.freeThreshold&&subtotal>=shippingOpt.freeThreshold?0:shippingOpt.fee;
  const total=Math.max(1,subtotal+shipping);
  const no=orderNo();
  const parts=normalized.map(x=>`${safeText(PRODUCTS[x.id].name,35)}企業價 x${x.quantity}`);
  if(shipping)parts.push(`${shippingOpt.label} NT$${shipping}`);

  const base=origin(request,env);
  const fields={
    MerchantID:cfg.merchantId,MerchantTradeNo:no,MerchantTradeDate:formatDate(),PaymentType:'aio',
    TotalAmount:String(total),TradeDesc:'GRAB A CUP enterprise order',ItemName:parts.join('#').slice(0,390),
    ReturnURL:`${base}/api/ecpay/return`,ChoosePayment:'ALL',EncryptType:'1',
    ClientBackURL:`${base}/payment-result.html`
  };
  fields.CheckMacValue=await checkMacValue(fields,{...env,ECPAY_HASH_KEY:cfg.hashKey,ECPAY_HASH_IV:cfg.hashIV});
  return json({orderNo:no,action:cfg.action,fields});
}

export async function onRequest(context){
  const {request,env,params}=context;
  const path='/' + (Array.isArray(params.path)?params.path.join('/'):String(params.path||''));
  const method=request.method.toUpperCase();

  if(path==='/health'&&method==='GET')return json({ok:true,platform:'cloudflare-pages-functions',mode:String(env.ECPAY_MODE||'stage')});

  if(path==='/enterprise/login'&&method==='POST'){
    const body=await bodyJson(request);
    const code=safeText(body.code,80);
    const codes=enterpriseCodes(env);
    if(!codes.length)return json({error:'企業代號尚未設定，請先在 Cloudflare 設定 ENTERPRISE_CODES'},503);
    if(!env.ENTERPRISE_SECRET)return json({error:'ENTERPRISE_SECRET 尚未設定'},503);
    if(!codes.includes(code))return json({error:'企業代號錯誤，請確認後再試'},401);
    return json({ok:true,token:await signEnterpriseToken(code,env),expiresIn:43200});
  }

  if(path==='/enterprise/prices'&&method==='GET'){
    if(!await verifyEnterpriseToken(request,env))return json({error:'企業登入已失效，請重新登入'},401);
    const products={};
    Object.entries(PRODUCTS).forEach(([id,p])=>products[id]={name:p.name,retailPrice:p.price,enterprisePrice:enterprisePrice(p.price)});
    return json({ok:true,discountRate:ENTERPRISE_RATE,products});
  }

  if(path==='/enterprise/checkout'&&method==='POST')return enterpriseCheckout(request,env);
  if(path==='/ecpay/checkout'&&method==='POST')return normalCheckout(request,env);

  if(path==='/ecpay/return'&&method==='POST'){
    // 綠界 Server-to-Server 回傳：驗證 CheckMacValue。
    const cfg=ecpayConfig(env);
    const form=Object.fromEntries(await request.formData());
    const received=String(form.CheckMacValue||'');
    const expected=await checkMacValue(form,{...env,ECPAY_HASH_KEY:cfg.hashKey,ECPAY_HASH_IV:cfg.hashIV});
    return new Response(received===expected?'1|OK':'0|CheckMacValueError',{
      status:200,headers:{'content-type':'text/plain; charset=utf-8'}
    });
  }

  return json({error:'API route not found'},404);
}
