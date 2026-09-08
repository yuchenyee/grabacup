const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = (process.env.ECPAY_MODE || 'stage').toLowerCase() === 'prod';
const merchantId = process.env.ECPAY_MERCHANT_ID || (isProd ? '' : '3002607');
const hashKey = process.env.ECPAY_HASH_KEY || (isProd ? '' : 'pwFHCqoQZGmho4w6');
const hashIV = process.env.ECPAY_HASH_IV || (isProd ? '' : 'EkRm7iFT261dpevs');
const publicBase = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/,'');
const frontendUrl = (process.env.FRONTEND_URL || `http://localhost:${PORT}`).replace(/\/$/,'');
const allowedOrigins = (process.env.ALLOWED_ORIGINS || frontendUrl).split(',').map(s=>s.trim()).filter(Boolean);
const ecpayAction = isProd ? 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5' : 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5';
const orderFile = path.join(__dirname,'orders.json');
const enterpriseCodes = (process.env.ENTERPRISE_CODES || (isProd ? '' : 'GRAB2026')).split(',').map(s=>s.trim()).filter(Boolean);
const enterpriseSecret = process.env.ENTERPRISE_SECRET || hashKey || 'grabacup-stage-enterprise-secret';
const ENTERPRISE_RATE = 0.80;

const shippingFee = Math.max(0, parseInt(process.env.SHIPPING_FEE || '0',10) || 0);

const PRODUCTS = {
  'peach-oolong': {name:'水蜜桃烏龍',price:178}, 'coconut-latte':{name:'生椰拿鐵',price:178},
  'jasmine-cream-americano':{name:'茉莉奶蓋美式',price:178}, 'jasmine-light-latte':{name:'茉莉輕雪拿鐵',price:168},
  'classic-latte':{name:'拿鐵時光',price:158}, 'rouge-spring-americano':{name:'胭脂春美式',price:168},
  'kainak-latte':{name:'凱娜克拿鐵',price:210}, 'pistachio-macchiato':{name:'開心果瑪奇朵',price:198},
  'berry-cocoa-light-milk-tea':{name:'綜合莓可可輕乳茶',price:188}
};

const SHIPPING_OPTIONS = {
  home:{label:'宅配（台灣本島）',fee:100,freeThreshold:1000},
  chilled:{label:'宅配冷藏（台灣本島）',fee:250,freeThreshold:2000},
  frozen:{label:'宅配冷凍（台灣本島）',fee:350,freeThreshold:3000},
  post:{label:'郵寄',fee:125,freeThreshold:null}
};
const PAYMENT_OPTIONS = { credit:{label:'信用卡',type:'fixed',fee:0}, cod:{label:'取貨時付款',type:'fixed',fee:60} };

const PROMOTIONS = {
  freeShippingThreshold: 1000,
  amountDiscount: {step:1000, amountPerStep:100, maxDiscount:300},
  quantityDiscounts: [{minQty:6,rate:0.20,label:'滿 6 件 8 折'},{minQty:3,rate:0.10,label:'滿 3 件 9 折'}],
  gift: {step:2000,maxQty:3,productName:'開心果瑪奇朵10入'},
  discountStacking: 'best-of'
};
function calculatePromotions(subtotal,qty){
  const a=PROMOTIONS.amountDiscount;
  const amountDiscount=Math.min(a.maxDiscount,Math.floor(subtotal/a.step)*a.amountPerStep);
  const tier=PROMOTIONS.quantityDiscounts.find(t=>qty>=t.minQty);
  const quantityDiscount=tier?Math.round(subtotal*tier.rate):0;
  let discount=0,discountLabel='';
  if(PROMOTIONS.discountStacking==='stack'){
    discount=amountDiscount+quantityDiscount;
    discountLabel=[amountDiscount?'每滿千折百':'',quantityDiscount?tier.label:''].filter(Boolean).join('＋');
  }else if(quantityDiscount>amountDiscount){discount=quantityDiscount;discountLabel=tier?.label||'滿件折扣';}
  else if(amountDiscount>0){discount=amountDiscount;discountLabel='每滿千折百';}
  const giftQty=Math.min(PROMOTIONS.gift.maxQty,Math.floor(subtotal/PROMOTIONS.gift.step));
  const freeShipping=subtotal>=PROMOTIONS.freeShippingThreshold;
  return {amountDiscount,quantityDiscount,discount,discountLabel,giftQty,freeShipping,totalBeforeFees:Math.max(1,subtotal-discount)};
}

app.use(cors({origin(origin,cb){if(!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null,true); cb(new Error('Origin not allowed'));}}));
app.use(express.json({limit:'200kb'}));
app.use(express.urlencoded({extended:false}));

function ecpayUrlEncode(str){
  return encodeURIComponent(str).replace(/%20/g,'+').replace(/~/g,'%7E')
    .replace(/%2D/gi,'-').replace(/%5F/gi,'_').replace(/%2E/gi,'.')
    .replace(/%21/gi,'!').replace(/%2A/gi,'*').replace(/%28/gi,'(').replace(/%29/gi,')');
}
function checkMacValue(params){
  const sorted = Object.keys(params).filter(k=>k !== 'CheckMacValue' && params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base'})).map(k=>`${k}=${params[k]}`).join('&');
  const raw = `HashKey=${hashKey}&${sorted}&HashIV=${hashIV}`;
  return crypto.createHash('sha256').update(ecpayUrlEncode(raw).toLowerCase()).digest('hex').toUpperCase();
}
function formatDate(d=new Date()){
  const z=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}/${z(d.getMonth()+1)}/${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}
function orderNo(){ return `G${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`.slice(0,20); }
function safeText(v,max=100){ return String(v||'').replace(/[<>#&]/g,' ').replace(/\s+/g,' ').trim().slice(0,max); }
function loadOrders(){try{return JSON.parse(fs.readFileSync(orderFile,'utf8'))}catch{return {}}}

function enterprisePrice(price){ return Math.round(price * ENTERPRISE_RATE); }
function signEnterpriseToken(code){
  const payload = Buffer.from(JSON.stringify({c:code,exp:Date.now()+12*60*60*1000})).toString('base64url');
  const sig = crypto.createHmac('sha256',enterpriseSecret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyEnterpriseToken(token){
  try{
    const [payload,sig]=String(token||'').split('.');
    if(!payload||!sig) return null;
    const expected=crypto.createHmac('sha256',enterpriseSecret).update(payload).digest('base64url');
    if(sig.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return null;
    const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    if(!data.exp || Date.now()>data.exp || !enterpriseCodes.includes(data.c)) return null;
    return data;
  }catch{return null;}
}
function enterpriseAuth(req){
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  return verifyEnterpriseToken(token);
}

function saveOrder(no,data){const all=loadOrders();all[no]={...(all[no]||{}),...data,updatedAt:new Date().toISOString()};try{fs.writeFileSync(orderFile,JSON.stringify(all,null,2))}catch(e){console.warn('order persistence failed',e.message)}}

app.get('/api/health',(req,res)=>res.json({ok:true,mode:isProd?'prod':'stage'}));


app.post('/api/enterprise/login',(req,res)=>{
  const code=safeText(req.body?.code,80);
  if(!enterpriseCodes.length) return res.status(503).json({error:'企業代號尚未設定，請聯絡品牌管理員'});
  if(!enterpriseCodes.includes(code)) return res.status(401).json({error:'企業代號錯誤，請確認後再試'});
  res.json({ok:true,token:signEnterpriseToken(code),expiresIn:43200});
});

app.get('/api/enterprise/prices',(req,res)=>{
  if(!enterpriseAuth(req)) return res.status(401).json({error:'企業登入已失效，請重新登入'});
  const products={};
  Object.entries(PRODUCTS).forEach(([id,p])=>{
    products[id]={name:p.name,retailPrice:p.price,enterprisePrice:enterprisePrice(p.price)};
  });
  res.json({ok:true,discountRate:ENTERPRISE_RATE,products});
});

app.post('/api/enterprise/checkout',(req,res)=>{
  try{
    const auth=enterpriseAuth(req);
    if(!auth) return res.status(401).json({error:'企業登入已失效，請重新登入'});
    if(!merchantId || !hashKey || !hashIV) return res.status(500).json({error:'綠界正式環境金鑰尚未設定'});
    const items=Array.isArray(req.body.items)?req.body.items:[];
    const normalized=items.map(x=>({id:String(x.id||''),quantity:Math.max(1,Math.min(99,parseInt(x.quantity)||1))})).filter(x=>PRODUCTS[x.id]);
    if(!normalized.length) return res.status(400).json({error:'企業採購清單沒有有效商品'});
    const subtotal=normalized.reduce((sum,x)=>sum+enterprisePrice(PRODUCTS[x.id].price)*x.quantity,0);
    const shippingMethod=String(req.body.customer?.shippingMethod||'home');
    const shippingOpt=SHIPPING_OPTIONS[shippingMethod];
    if(!shippingOpt) return res.status(400).json({error:'配送方式無效'});
    const shipping=shippingOpt.freeThreshold&&subtotal>=shippingOpt.freeThreshold?0:shippingOpt.fee;
    const total=Math.max(1,subtotal+shipping);
    const no=orderNo();
    const itemParts=normalized.map(x=>`${safeText(PRODUCTS[x.id].name,35)}企業價 x${x.quantity}`);
    if(shipping) itemParts.push(`${shippingOpt.label} NT$${shipping}`);
    const fields={
      MerchantID:merchantId,MerchantTradeNo:no,MerchantTradeDate:formatDate(),PaymentType:'aio',
      TotalAmount:String(total),TradeDesc:'GRAB A CUP enterprise order',
      ItemName:itemParts.join('#').slice(0,390),ReturnURL:`${publicBase}/api/ecpay/return`,
      ChoosePayment:'ALL',EncryptType:'1',ClientBackURL:`${frontendUrl}/payment-result.html`
    };
    fields.CheckMacValue=checkMacValue(fields);
    saveOrder(no,{
      status:'created',orderType:'enterprise',enterpriseCode:auth.c,subtotal,shipping,total,
      items:normalized.map(x=>({...x,unitPrice:enterprisePrice(PRODUCTS[x.id].price)})),
      customer:{
        company:safeText(req.body.customer?.company,100),taxId:safeText(req.body.customer?.taxId,20),
        name:safeText(req.body.customer?.name,50),phone:safeText(req.body.customer?.phone,30),
        email:safeText(req.body.customer?.email,100),note:safeText(req.body.customer?.note,300)
      }
    });
    res.json({orderNo:no,action:ecpayAction,fields});
  }catch(err){console.error(err);res.status(500).json({error:'建立企業訂單時發生錯誤'});}
});

app.post('/api/ecpay/checkout',(req,res)=>{
  try{
    if(!merchantId || !hashKey || !hashIV) return res.status(500).json({error:'綠界正式環境金鑰尚未設定'});
    if(isProd && Object.values(PRODUCTS).some(p=>p.price===100)) return res.status(500).json({error:'正式模式偵測到異常商品價格，請確認 server/server.js 與前端 shop-config.js 的正式售價'});
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const normalized = items.map(x=>({id:String(x.id||''),quantity:Math.max(1,Math.min(99,parseInt(x.quantity)||1))})).filter(x=>PRODUCTS[x.id]);
    if(!normalized.length) return res.status(400).json({error:'購物車沒有有效商品'});
    const subtotal = normalized.reduce((s,x)=>s+PRODUCTS[x.id].price*x.quantity,0);
    const qty = normalized.reduce((s,x)=>s+x.quantity,0);
    const promo = calculatePromotions(subtotal,qty);
    const shippingMethod=String(req.body.customer?.shippingMethod||'home'), paymentMethod=String(req.body.customer?.paymentMethod||'credit');
    const shippingOpt=SHIPPING_OPTIONS[shippingMethod], paymentOpt=PAYMENT_OPTIONS[paymentMethod];
    if(!shippingOpt||!paymentOpt) return res.status(400).json({error:'配送或付款方式無效'});
    const shipping=shippingOpt.freeThreshold&&subtotal>=shippingOpt.freeThreshold?0:shippingOpt.fee;
    const paymentFee=paymentOpt.type==='rate'?Math.round(subtotal*(paymentOpt.rate||0)):(paymentOpt.fee||0);
    const total=Math.max(1,subtotal-promo.discount+shipping+paymentFee);
    Object.assign(promo,{shipping,paymentFee,shippingMethod,paymentMethod});
    if(!Number.isInteger(total) || total < 1) return res.status(400).json({error:'訂單金額無效'});
    const no=orderNo();
    const itemParts = normalized.map(x=>`${safeText(PRODUCTS[x.id].name,40)} x${x.quantity}`);
    if(promo.discount) itemParts.push(`${safeText(promo.discountLabel,30)} -NT$${promo.discount}`);
    if(promo.giftQty) itemParts.push(`${PROMOTIONS.gift.productName} 贈品 x${promo.giftQty}`); if(promo.shipping) itemParts.push(`${shippingOpt.label} NT$${promo.shipping}`); if(promo.paymentFee) itemParts.push(`${paymentOpt.label}手續費 NT$${promo.paymentFee}`);
    const itemName = itemParts.join('#').slice(0,390);
    const fields = {
      MerchantID: merchantId,
      MerchantTradeNo: no,
      MerchantTradeDate: formatDate(),
      PaymentType: 'aio',
      TotalAmount: String(total),
      TradeDesc: 'GRAB A CUP order',
      ItemName: itemName,
      ReturnURL: `${publicBase}/api/ecpay/return`,
      ChoosePayment: 'ALL',
      EncryptType: '1',
      ClientBackURL: `${frontendUrl}/payment-result.html`
    };
    fields.CheckMacValue=checkMacValue(fields);
    saveOrder(no,{status:'created',subtotal,total,promotion:promo,items:normalized,customer:{name:safeText(req.body.customer?.name,50),phone:safeText(req.body.customer?.phone,30),email:safeText(req.body.customer?.email,100),note:safeText(req.body.customer?.note,200)}});
    res.json({orderNo:no,action:ecpayAction,fields});
  }catch(err){console.error(err);res.status(500).json({error:'建立綠界訂單時發生錯誤'});}
});

app.post('/api/ecpay/return',(req,res)=>{
  const body=req.body||{}; const expected=checkMacValue(body); const valid=expected===String(body.CheckMacValue||'').toUpperCase();
  if(!valid){console.warn('ECPay invalid CheckMacValue',body.MerchantTradeNo);return res.status(400).send('0|CheckMacValue Error');}
  const no=body.MerchantTradeNo; const simulated=String(body.SimulatePaid||'0')==='1';
  const paid=String(body.RtnCode)==='1';
  saveOrder(no,{status:simulated?'simulated_paid':(paid?'paid':'payment_failed'),ecpay:{TradeNo:body.TradeNo,RtnCode:body.RtnCode,RtnMsg:body.RtnMsg,PaymentDate:body.PaymentDate,PaymentType:body.PaymentType,SimulatePaid:body.SimulatePaid}});
  res.type('text/plain').send('1|OK');
});

app.get('/api/order-status/:orderNo',(req,res)=>{const o=loadOrders()[req.params.orderNo];if(!o)return res.status(404).json({error:'找不到訂單'});res.json({orderNo:req.params.orderNo,status:o.status,total:o.total,updatedAt:o.updatedAt});});

if (require.main === module) app.listen(PORT,()=>console.log(`GRAB A CUP ECPay server on http://localhost:${PORT} (${isProd?'prod':'stage'})`));
module.exports={app,checkMacValue,ecpayUrlEncode};
