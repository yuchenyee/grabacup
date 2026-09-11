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

// ===== CRM / Member system =====
const nowIso=()=>new Date().toISOString();
const normalizeEmail=v=>String(v||'').trim().toLowerCase();
const authSecret=env=>String(env.MEMBER_SECRET||env.ENTERPRISE_SECRET||'');

async function ensureSchema(env){
  if(!env.DB) throw new Error('D1 binding DB 尚未啟用');
  const sqls=[
    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      company TEXT DEFAULT '',
      tax_id TEXT DEFAULT '',
      password_hash TEXT DEFAULT '',
      password_salt TEXT DEFAULT '',
      member_status TEXT DEFAULT 'guest',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      customer_email TEXT DEFAULT '',
      order_type TEXT DEFAULT 'retail',
      subtotal INTEGER DEFAULT 0,
      discount INTEGER DEFAULT 0,
      shipping_fee INTEGER DEFAULT 0,
      payment_fee INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      payment_status TEXT DEFAULT 'pending',
      fulfillment_status TEXT DEFAULT 'pending',
      shipping_method TEXT DEFAULT '',
      payment_method TEXT DEFAULT '',
      note TEXT DEFAULT '',
      ecpay_rtn_code TEXT DEFAULT '',
      ecpay_trade_no TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      line_total INTEGER NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL,
      carrier TEXT DEFAULT '',
      tracking_no TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      shipped_at TEXT DEFAULT '',
      delivered_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#572314'
    )`,
    `CREATE TABLE IF NOT EXISTS customer_tags (
      customer_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY(customer_id,tag_id),
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    )`
  ];
  await env.DB.batch(sqls.map(sql=>env.DB.prepare(sql)));
  for(const [name,color] of [['新客','#B88632'],['回購客','#2E7D32'],['VIP','#C62828'],['企業客戶','#6A1B9A'],['大量採購','#1565C0']]){
    await env.DB.prepare('INSERT OR IGNORE INTO tags(name,color) VALUES(?,?)').bind(name,color).run();
  }
}

async function passwordHash(password,saltB64=''){
  const salt=saltB64?base64UrlToBytes(saltB64):crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(password)),{name:'PBKDF2'},false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:60000},key,256);
  return {salt:bytesToBase64Url(salt),hash:bytesToBase64Url(new Uint8Array(bits))};
}
async function signAuth(payload,env){
  const secret=authSecret(env);
  if(!secret) throw new Error('會員驗證金鑰尚未設定');
  const body=textToBase64Url(JSON.stringify({...payload,exp:Date.now()+24*60*60*1000}));
  return `${body}.${await hmac(body,secret)}`;
}
async function verifyAuth(request,env,role=''){
  try{
    const secret=authSecret(env); if(!secret)return null;
    const token=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
    const [body,sig]=token.split('.'); if(!body||!sig)return null;
    if(sig!==await hmac(body,secret))return null;
    const data=JSON.parse(base64UrlToText(body));
    if(!data.exp||Date.now()>data.exp)return null;
    if(role&&data.role!==role)return null;
    return data;
  }catch{return null;}
}
async function upsertCustomer(env,customer={}){
  await ensureSchema(env);
  const email=normalizeEmail(customer.email);
  if(!email)return null;
  const existing=await env.DB.prepare('SELECT * FROM customers WHERE email=?').bind(email).first();
  if(existing){
    await env.DB.prepare(`UPDATE customers SET
      name=CASE WHEN ?<>'' THEN ? ELSE name END,
      phone=CASE WHEN ?<>'' THEN ? ELSE phone END,
      company=CASE WHEN ?<>'' THEN ? ELSE company END,
      tax_id=CASE WHEN ?<>'' THEN ? ELSE tax_id END,
      updated_at=? WHERE id=?`)
      .bind(safeText(customer.name,80),safeText(customer.name,80),safeText(customer.phone,40),safeText(customer.phone,40),
        safeText(customer.company,120),safeText(customer.company,120),safeText(customer.taxId,20),safeText(customer.taxId,20),nowIso(),existing.id).run();
    return {...existing,name:customer.name||existing.name,phone:customer.phone||existing.phone,company:customer.company||existing.company,tax_id:customer.taxId||existing.tax_id};
  }
  const ins=await env.DB.prepare('INSERT INTO customers(email,name,phone,company,tax_id,member_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
    .bind(email,safeText(customer.name,80),safeText(customer.phone,40),safeText(customer.company,120),safeText(customer.taxId,20),'guest',nowIso(),nowIso()).run();
  return await env.DB.prepare('SELECT * FROM customers WHERE id=?').bind(ins.meta.last_row_id).first();
}
async function setCustomerTag(env,customerId,tagName){
  const tag=await env.DB.prepare('SELECT id FROM tags WHERE name=?').bind(tagName).first();
  if(tag) await env.DB.prepare('INSERT OR IGNORE INTO customer_tags(customer_id,tag_id) VALUES(?,?)').bind(customerId,tag.id).run();
}
async function refreshAutoTags(env,customerId,orderType,total){
  const stats=await env.DB.prepare('SELECT COUNT(*) count, COALESCE(SUM(total),0) spend FROM orders WHERE customer_id=?').bind(customerId).first();
  if(Number(stats?.count||0)<=1) await setCustomerTag(env,customerId,'新客');
  if(Number(stats?.count||0)>=2) await setCustomerTag(env,customerId,'回購客');
  if(Number(stats?.spend||0)>=5000) await setCustomerTag(env,customerId,'VIP');
  if(orderType==='enterprise') await setCustomerTag(env,customerId,'企業客戶');
  if(Number(total||0)>=3000) await setCustomerTag(env,customerId,'大量採購');
}
async function persistOrder(env,{no,customer,orderType='retail',items,subtotal,discount=0,shipping=0,paymentFee=0,total,shippingMethod='',paymentMethod='',note=''}) {
  const cst=await upsertCustomer(env,customer);
  const ins=await env.DB.prepare(`INSERT OR IGNORE INTO orders
    (order_no,customer_id,customer_email,order_type,subtotal,discount,shipping_fee,payment_fee,total,payment_status,fulfillment_status,shipping_method,payment_method,note,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,'pending','pending',?,?,?,?,?)`)
    .bind(no,cst?.id||null,normalizeEmail(customer?.email),orderType,subtotal,discount,shipping,paymentFee,total,shippingMethod,paymentMethod,safeText(note,500),nowIso(),nowIso()).run();
  let order=await env.DB.prepare('SELECT * FROM orders WHERE order_no=?').bind(no).first();
  if(ins.meta.changes && order){
    for(const x of items){
      const p=PRODUCTS[x.id]; const unit=orderType==='enterprise'?enterprisePrice(p.price):p.price;
      await env.DB.prepare('INSERT INTO order_items(order_id,product_id,product_name,unit_price,quantity,line_total) VALUES(?,?,?,?,?,?)')
        .bind(order.id,x.id,p.name,unit,x.quantity,unit*x.quantity).run();
    }
    await env.DB.prepare('INSERT OR IGNORE INTO shipments(order_id,status,updated_at) VALUES(?,?,?)').bind(order.id,'pending',nowIso()).run();
    await env.DB.prepare('INSERT INTO order_events(order_id,event_type,message,created_at) VALUES(?,?,?,?)').bind(order.id,'created','訂單建立',nowIso()).run();
    if(cst?.id) await refreshAutoTags(env,cst.id,orderType,total);
  }
  return order;
}
async function ordersForCustomer(env,customerId,email){
  const {results}=await env.DB.prepare('SELECT * FROM orders WHERE customer_id=? OR customer_email=? ORDER BY id DESC').bind(customerId,email).all();
  const out=[];
  for(const o of results||[]){
    const items=(await env.DB.prepare('SELECT product_id,product_name,unit_price,quantity,line_total FROM order_items WHERE order_id=?').bind(o.id).all()).results||[];
    const shipment=await env.DB.prepare('SELECT carrier,tracking_no,status,shipped_at,delivered_at FROM shipments WHERE order_id=?').bind(o.id).first();
    out.push({...o,items,shipment:shipment||null});
  }
  return out;
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
