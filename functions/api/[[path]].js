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
const RESET_TTL_MS=20*60*1000;
const RESET_COOLDOWN_MS=10*60*1000;

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
      session_version INTEGER NOT NULL DEFAULT 0,
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
      postal_code TEXT DEFAULT '',
      shipping_address TEXT DEFAULT '',
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
    )`,
    `CREATE TABLE IF NOT EXISTS marketing_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT '',
      source TEXT DEFAULT 'website',
      consent INTEGER NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'subscribed',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_type TEXT DEFAULT '',
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT '',
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      consent INTEGER NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT DEFAULT '',
      requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )`
  ];
  await env.DB.batch(sqls.map(sql=>env.DB.prepare(sql)));
  const customerColumns=(await env.DB.prepare('PRAGMA table_info(customers)').all()).results||[];
  if(!customerColumns.some(column=>column.name==='session_version')){
    try{await env.DB.prepare('ALTER TABLE customers ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0').run();}
    catch(error){if(!String(error?.message||error).toLowerCase().includes('duplicate column'))throw error;}
  }
  const orderColumns=(await env.DB.prepare('PRAGMA table_info(orders)').all()).results||[];
  const orderColumnNames=new Set(orderColumns.map(column=>String(column.name||'')));
  const orderMigrations=[
    ['postal_code',"ALTER TABLE orders ADD COLUMN postal_code TEXT DEFAULT ''"],
    ['shipping_address',"ALTER TABLE orders ADD COLUMN shipping_address TEXT DEFAULT ''"]
  ];
  for(const [column,sql] of orderMigrations){
    if(orderColumnNames.has(column))continue;
    try{await env.DB.prepare(sql).run();}
    catch(error){if(!String(error?.message||error).toLowerCase().includes('duplicate column'))throw error;}
  }
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
async function resetTokenHash(token){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(token)));
  return bytesToBase64Url(new Uint8Array(digest));
}
function emailHtmlEscape(value){
  return String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
async function sendPasswordResetEmail(env,to,resetUrl){
  const apiKey=String(env.RESEND_API_KEY||''),from=String(env.PASSWORD_RESET_FROM||'');
  if(!apiKey||!from)throw new Error('密碼重設寄信服務尚未設定');
  const safeUrl=emailHtmlEscape(resetUrl);
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
    body:JSON.stringify({
      from,to:[to],subject:'GRAB A CUP 會員密碼重設',
      html:`<div style="font-family:Arial,sans-serif;line-height:1.7;color:#3d241b"><h2>重設你的 GRAB A CUP 密碼</h2><p>我們收到你的密碼重設申請。請在 20 分鐘內點擊下方按鈕設定新密碼。</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#572314;color:#fff;text-decoration:none">設定新密碼</a></p><p style="color:#76665d;font-size:13px">若你沒有提出申請，請忽略這封信，你的密碼不會改變。</p></div>`
    })
  });
  if(!response.ok)throw new Error('密碼重設信暫時無法寄出');
}
async function signAuth(payload,env,ttlMs=24*60*60*1000){
  const secret=authSecret(env);
  if(!secret) throw new Error('會員驗證金鑰尚未設定');
  const body=textToBase64Url(JSON.stringify({...payload,exp:Date.now()+ttlMs}));
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
async function verifyMemberAuth(request,env){
  const auth=await verifyAuth(request,env,'member');
  if(!auth)return null;
  const member=await env.DB.prepare('SELECT id,email,session_version FROM customers WHERE id=?').bind(auth.id).first();
  if(!member||Number(auth.v||0)!==Number(member.session_version||0))return null;
  return {...auth,email:member.email};
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
    (order_no,customer_id,customer_email,order_type,subtotal,discount,shipping_fee,payment_fee,total,payment_status,fulfillment_status,shipping_method,payment_method,postal_code,shipping_address,note,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,'pending','pending',?,?,?,?,?,?,?)`)
    .bind(no,cst?.id||null,normalizeEmail(customer?.email),orderType,subtotal,discount,shipping,paymentFee,total,shippingMethod,paymentMethod,safeText(customer?.postalCode,10),safeText(customer?.address,200),safeText(note,500),nowIso(),nowIso()).run();
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
  const customer=body.customer||{};
  if(!String(customer.name||'').trim()||!normalizeEmail(customer.email)||!String(customer.phone||'').trim()||!String(customer.postalCode||'').trim()||!String(customer.address||'').trim()){
    return json({error:'請完整填寫姓名、手機、Email、郵遞區號與收件地址'},400);
  }
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
  try{ await persistOrder(env,{no,customer:body.customer||{},orderType:'retail',items:normalized,subtotal,discount:promo.discount,shipping,paymentFee,total,shippingMethod,paymentMethod,note:body.customer?.note||''}); }
  catch(e){ console.error('persist retail order',e); }
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
  try{ await persistOrder(env,{no,customer:body.customer||{},orderType:'enterprise',items:normalized,subtotal,discount:0,shipping,paymentFee:0,total,shippingMethod,paymentMethod:'ecpay',note:body.customer?.note||''}); }
  catch(e){ console.error('persist enterprise order',e); }
  return json({orderNo:no,action:cfg.action,fields});
}

export async function onRequest(context){
  const {request,env,params}=context;
  const path='/' + (Array.isArray(params.path)?params.path.join('/'):String(params.path||''));
  const method=request.method.toUpperCase();

  if(path==='/health'&&method==='GET')return json({ok:true,platform:'cloudflare-pages-functions',mode:String(env.ECPAY_MODE||'stage')});

  if(path==='/contact'&&method==='POST'){
    try{
      await ensureSchema(env);
      const b=await bodyJson(request);
      if(String(b.website||'').trim())return json({ok:true,message:'訊息已送出'});
      const name=safeText(b.name,80),email=normalizeEmail(b.email),subject=safeText(b.subject,160),message=safeText(b.message,2000);
      if(b.consent!==true)return json({error:'請先同意隱私權政策'},400);
      if(!name||!email||!email.includes('@')||!subject||!message)return json({error:'請完整填寫姓名、Email、主旨與訊息'},400);
      await env.DB.prepare(`INSERT INTO contact_messages(contact_type,name,email,phone,subject,message,consent,status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,1,'new',?,?)`)
        .bind(safeText(b.type,60),name,email,safeText(b.phone,40),subject,message,nowIso(),nowIso()).run();
      return json({ok:true,message:'訊息已送出，我們會儘快回覆你。'});
    }catch(e){return json({error:e.message||'目前無法送出訊息'},500);}
  }

  if(path==='/marketing/subscribe'&&method==='POST'){
    try{
      await ensureSchema(env);
      const b=await bodyJson(request);
      if(String(b.website||'').trim())return json({ok:true,message:'訂閱成功'});
      const email=normalizeEmail(b.email),consent=b.consent===true;
      if(!consent)return json({error:'請先勾選同意接收新品與優惠資訊'},400);
      if(!email||email.length>160||!email.includes('@'))return json({error:'請輸入有效的 Email'},400);
      const name=safeText(b.name,80),source=safeText(b.source||'website',60)||'website';
      await env.DB.prepare(`INSERT INTO marketing_leads(email,name,source,consent,status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET
        name=CASE WHEN excluded.name<>'' THEN excluded.name ELSE marketing_leads.name END,
        source=excluded.source,consent=1,status='subscribed',updated_at=excluded.updated_at`)
        .bind(email,name,source,1,'subscribed',nowIso(),nowIso()).run();
      return json({ok:true,message:'訂閱成功！之後有新品與優惠會優先通知你。'});
    }catch(e){return json({error:e.message||'目前無法完成訂閱'},500);}
  }

  if(path==='/member/register'&&method==='POST'){
    try{
      await ensureSchema(env);
      const b=await bodyJson(request), email=normalizeEmail(b.email), password=String(b.password||'');
      if(!email||!email.includes('@')||password.length<8)return json({error:'請輸入有效 Email，密碼至少 8 碼'},400);
      const old=await env.DB.prepare('SELECT id,password_hash FROM customers WHERE email=?').bind(email).first();
      if(old?.password_hash)return json({error:'此 Email 已註冊會員'},409);
      const ph=await passwordHash(password);
      let customer=old;
      if(old){
        await env.DB.prepare("UPDATE customers SET name=?,phone=?,password_hash=?,password_salt=?,member_status='active',updated_at=? WHERE id=?")
          .bind(safeText(b.name,80),safeText(b.phone,40),ph.hash,ph.salt,nowIso(),old.id).run();
        customer=await env.DB.prepare('SELECT * FROM customers WHERE id=?').bind(old.id).first();
      }else{
        const ins=await env.DB.prepare("INSERT INTO customers(email,name,phone,password_hash,password_salt,member_status,created_at,updated_at) VALUES(?,?,?,?,?,'active',?,?)")
          .bind(email,safeText(b.name,80),safeText(b.phone,40),ph.hash,ph.salt,nowIso(),nowIso()).run();
        customer=await env.DB.prepare('SELECT * FROM customers WHERE id=?').bind(ins.meta.last_row_id).first();
      }
      await setCustomerTag(env,customer.id,'新客');
      return json({ok:true,token:await signAuth({id:customer.id,email,role:'member',v:Number(customer.session_version||0)},env),member:{id:customer.id,email,name:customer.name}});
    }catch(e){return json({error:e.message||'註冊失敗'},500);}
  }

  if(path==='/member/login'&&method==='POST'){
    try{
      await ensureSchema(env);
      const b=await bodyJson(request), email=normalizeEmail(b.email), password=String(b.password||'');
      const customer=await env.DB.prepare('SELECT * FROM customers WHERE email=?').bind(email).first();
      if(!customer?.password_hash)return json({error:'Email 或密碼錯誤'},401);
      const ph=await passwordHash(password,customer.password_salt);
      if(ph.hash!==customer.password_hash)return json({error:'Email 或密碼錯誤'},401);
      return json({ok:true,token:await signAuth({id:customer.id,email,role:'member',v:Number(customer.session_version||0)},env),member:{id:customer.id,email,name:customer.name}});
    }catch(e){return json({error:e.message||'登入失敗'},500);}
  }

  if(path==='/member/forgot-password'&&method==='POST'){
    try{
      await ensureSchema(env);
      if(!env.RESEND_API_KEY||!env.PASSWORD_RESET_FROM)return json({error:'密碼重設寄信服務尚未設定，請聯絡網站管理員'},503);
      const b=await bodyJson(request),email=normalizeEmail(b.email);
      if(!email||email.length>160||!email.includes('@'))return json({error:'請輸入有效的 Email'},400);
      const customer=await env.DB.prepare('SELECT id,password_hash FROM customers WHERE email=?').bind(email).first();
      const generic={ok:true,message:'如果此 Email 已註冊，我們會寄出密碼重設信，請檢查收件匣與垃圾郵件。'};
      if(!customer?.password_hash)return json(generic);
      const cutoff=new Date(Date.now()-RESET_COOLDOWN_MS).toISOString();
      const recent=await env.DB.prepare("SELECT id FROM password_reset_tokens WHERE customer_id=? AND requested_at>? AND used_at='' LIMIT 1").bind(customer.id,cutoff).first();
      if(recent)return json(generic);
      const rawToken=bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      const tokenHash=await resetTokenHash(rawToken),expiresAt=new Date(Date.now()+RESET_TTL_MS).toISOString(),now=nowIso();
      await env.DB.prepare("UPDATE password_reset_tokens SET used_at=? WHERE customer_id=? AND used_at=''").bind(now,customer.id).run();
      await env.DB.prepare('INSERT INTO password_reset_tokens(customer_id,token_hash,expires_at,requested_at) VALUES(?,?,?,?)')
        .bind(customer.id,tokenHash,expiresAt,now).run();
      try{await sendPasswordResetEmail(env,email,`${origin(request,env)}/member.html?reset=${encodeURIComponent(rawToken)}`);}
      catch(error){
        await env.DB.prepare("UPDATE password_reset_tokens SET used_at=? WHERE token_hash=? AND used_at=''").bind(nowIso(),tokenHash).run();
        throw error;
      }
      return json(generic);
    }catch(e){return json({error:e.message||'目前無法寄出密碼重設信'},500);}
  }

  if(path==='/member/reset-password'&&method==='POST'){
    try{
      await ensureSchema(env);
      const b=await bodyJson(request),token=String(b.token||''),password=String(b.password||'');
      if(token.length<32)return json({error:'重設連結無效，請重新申請'},400);
      if(password.length<8||password.length>128)return json({error:'新密碼需為 8 至 128 碼'},400);
      const tokenHash=await resetTokenHash(token),now=nowIso();
      const reset=await env.DB.prepare("SELECT id,customer_id FROM password_reset_tokens WHERE token_hash=? AND used_at='' AND expires_at>? LIMIT 1").bind(tokenHash,now).first();
      if(!reset)return json({error:'重設連結無效或已過期，請重新申請'},400);
      const ph=await passwordHash(password);
      const marker=`${now}#${crypto.randomUUID()}`;
      const results=await env.DB.batch([
        env.DB.prepare("UPDATE password_reset_tokens SET used_at=? WHERE id=? AND used_at='' AND expires_at>?").bind(marker,reset.id,now),
        env.DB.prepare("UPDATE customers SET password_hash=?,password_salt=?,session_version=session_version+1,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM password_reset_tokens WHERE id=? AND used_at=?)")
          .bind(ph.hash,ph.salt,now,reset.customer_id,reset.id,marker)
      ]);
      if(!results[0]?.meta?.changes||!results[1]?.meta?.changes)return json({error:'重設連結已使用，請重新申請'},400);
      await env.DB.prepare("UPDATE password_reset_tokens SET used_at=? WHERE customer_id=? AND used_at=''").bind(now,reset.customer_id).run();
      return json({ok:true,message:'密碼已更新，請使用新密碼登入。'});
    }catch(e){return json({error:e.message||'目前無法更新密碼'},500);}
  }

  if(path==='/member/me'&&method==='GET'){
    await ensureSchema(env);
    const a=await verifyMemberAuth(request,env); if(!a)return json({error:'請重新登入'},401);
    const member=await env.DB.prepare('SELECT id,email,name,phone,company,tax_id,member_status,created_at FROM customers WHERE id=?').bind(a.id).first();
    const tags=(await env.DB.prepare('SELECT t.name,t.color FROM tags t JOIN customer_tags ct ON ct.tag_id=t.id WHERE ct.customer_id=?').bind(a.id).all()).results||[];
    return json({ok:true,member:{...member,tags},orders:await ordersForCustomer(env,a.id,a.email)});
  }

  if(path==='/member/profile'&&method==='PUT'){
    await ensureSchema(env);
    const a=await verifyMemberAuth(request,env); if(!a)return json({error:'請重新登入'},401);
    const b=await bodyJson(request);
    await env.DB.prepare('UPDATE customers SET name=?,phone=?,company=?,tax_id=?,updated_at=? WHERE id=?')
      .bind(safeText(b.name,80),safeText(b.phone,40),safeText(b.company,120),safeText(b.taxId,20),nowIso(),a.id).run();
    return json({ok:true});
  }

  if(path==='/admin/login'&&method==='POST'){
    const b=await bodyJson(request);
    if(!env.ADMIN_SECRET)return json({error:'ADMIN_SECRET 尚未設定'},503);
    if(String(b.password||'')!==String(env.ADMIN_SECRET))return json({error:'管理密碼錯誤'},401);
    return json({ok:true,token:await signAuth({role:'admin'},env,60*1000),expiresIn:60});
  }

  if(path==='/admin/refresh'&&method==='POST'){
    if(!await verifyAuth(request,env,'admin'))return json({error:'管理登入已失效'},401);
    return json({ok:true,token:await signAuth({role:'admin'},env,60*1000),expiresIn:60});
  }

  if(path==='/admin/dashboard'&&method==='GET'){
    await ensureSchema(env);
    if(!await verifyAuth(request,env,'admin'))return json({error:'管理登入已失效'},401);
    const customers=(await env.DB.prepare(`SELECT c.id,c.email,c.name,c.phone,c.company,c.member_status,c.notes,c.created_at,
      COUNT(DISTINCT o.id) order_count,COALESCE(SUM(o.total),0) lifetime_value
      FROM customers c LEFT JOIN orders o ON o.customer_id=c.id GROUP BY c.id ORDER BY c.id DESC LIMIT 200`).all()).results||[];
    for(const x of customers)x.tags=(await env.DB.prepare('SELECT t.id,t.name,t.color FROM tags t JOIN customer_tags ct ON ct.tag_id=t.id WHERE ct.customer_id=?').bind(x.id).all()).results||[];
    const orders=(await env.DB.prepare(`SELECT o.*,c.name customer_name,s.carrier,s.tracking_no,s.status shipping_status
      FROM orders o LEFT JOIN customers c ON c.id=o.customer_id LEFT JOIN shipments s ON s.order_id=o.id ORDER BY o.id DESC LIMIT 200`).all()).results||[];
    const tags=(await env.DB.prepare('SELECT * FROM tags ORDER BY id').all()).results||[];
    const leads=(await env.DB.prepare('SELECT id,email,name,source,status,created_at,updated_at FROM marketing_leads ORDER BY id DESC LIMIT 500').all()).results||[];
    const contacts=(await env.DB.prepare('SELECT id,contact_type,name,email,phone,subject,message,status,created_at FROM contact_messages ORDER BY id DESC LIMIT 500').all()).results||[];
    return json({ok:true,customers,orders,tags,leads,contacts});
  }

  if(path==='/admin/customer'&&method==='PUT'){
    await ensureSchema(env);
    if(!await verifyAuth(request,env,'admin'))return json({error:'管理登入已失效'},401);
    const b=await bodyJson(request), id=Number(b.id);
    await env.DB.prepare('UPDATE customers SET notes=?,updated_at=? WHERE id=?').bind(safeText(b.notes,1000),nowIso(),id).run();
    if(Array.isArray(b.tagIds)){
      await env.DB.prepare('DELETE FROM customer_tags WHERE customer_id=?').bind(id).run();
      for(const tagId of b.tagIds)await env.DB.prepare('INSERT OR IGNORE INTO customer_tags(customer_id,tag_id) VALUES(?,?)').bind(id,Number(tagId)).run();
    }
    return json({ok:true});
  }

  if(path==='/admin/order'&&method==='PUT'){
    await ensureSchema(env);
    if(!await verifyAuth(request,env,'admin'))return json({error:'管理登入已失效'},401);
    const b=await bodyJson(request), id=Number(b.id);
    await env.DB.prepare('UPDATE orders SET payment_status=?,fulfillment_status=?,updated_at=? WHERE id=?')
      .bind(safeText(b.paymentStatus,30),safeText(b.fulfillmentStatus,30),nowIso(),id).run();
    await env.DB.prepare(`INSERT INTO shipments(order_id,carrier,tracking_no,status,shipped_at,delivered_at,updated_at)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET carrier=excluded.carrier,tracking_no=excluded.tracking_no,status=excluded.status,shipped_at=excluded.shipped_at,delivered_at=excluded.delivered_at,updated_at=excluded.updated_at`)
      .bind(id,safeText(b.carrier,60),safeText(b.trackingNo,100),safeText(b.shippingStatus,30),safeText(b.shippedAt,40),safeText(b.deliveredAt,40),nowIso()).run();
    return json({ok:true});
  }

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
    if(received===expected && env.DB){
      try{
        await ensureSchema(env);
        const no=String(form.MerchantTradeNo||'');
        const paid=String(form.RtnCode||'')==='1';
        const order=await env.DB.prepare('SELECT id FROM orders WHERE order_no=?').bind(no).first();
        if(order){
          await env.DB.prepare('UPDATE orders SET payment_status=?,ecpay_rtn_code=?,ecpay_trade_no=?,updated_at=? WHERE id=?')
            .bind(paid?'paid':'failed',safeText(form.RtnCode,20),safeText(form.TradeNo,80),nowIso(),order.id).run();
          await env.DB.prepare('INSERT INTO order_events(order_id,event_type,message,created_at) VALUES(?,?,?,?)')
            .bind(order.id,'payment',paid?'綠界付款成功':'綠界付款未成功',nowIso()).run();
        }
      }catch(e){console.error('ecpay d1 update',e);}
    }
    return new Response(received===expected?'1|OK':'0|CheckMacValueError',{
      status:200,headers:{'content-type':'text/plain; charset=utf-8'}
    });
  }

  return json({error:'API route not found'},404);
}
