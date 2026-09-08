(() => {
  const C = window.SHOP_CONFIG;
  if (!C) return;
  const CART_KEY = 'grabacup_cart_v1';
  const productByPage = Object.entries(C.products).reduce((m,[id,p]) => (m[p.page]=id,m),{});
  const money = n => new Intl.NumberFormat('zh-TW',{style:'currency',currency:C.currency,maximumFractionDigits:0}).format(n||0);
  const getCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch { return {}; } };
  const saveCart = cart => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); renderCart(); };
  const totalQty = cart => Object.values(cart).reduce((s,q)=>s+q,0);
  const subtotal = cart => Object.entries(cart).reduce((s,[id,q])=>s+(C.products[id]?.price||0)*q,0);
  const promoCalc = cart => {
    const p=C.promotions||{}, st=subtotal(cart), qty=totalQty(cart);
    const amountCfg=p.amountDiscount||{};
    const amountDiscount=Math.min(amountCfg.maxDiscount||0, Math.floor(st/(amountCfg.step||Infinity))*(amountCfg.amountPerStep||0));
    const qTier=(p.quantityDiscounts||[]).find(t=>qty>=t.minQty);
    const quantityDiscount=qTier?Math.round(st*qTier.rate):0;
    let discount=0, discountLabel='';
    if(p.discountStacking==='stack'){ discount=amountDiscount+quantityDiscount; discountLabel=[amountDiscount?'滿額折扣':'',quantityDiscount?qTier.label:''].filter(Boolean).join('＋'); }
    else if(quantityDiscount>amountDiscount){ discount=quantityDiscount; discountLabel=qTier?.label||'滿件折扣'; }
    else if(amountDiscount>0){ discount=amountDiscount; discountLabel='每滿千折百'; }
    const giftQty=Math.min(p.gift?.maxQty||0, Math.floor(st/(p.gift?.step||Infinity)));
    const freeShipping=st>=(p.freeShippingThreshold||Infinity);
    const shipping=freeShipping?0:(C.shippingFee||0);
    return {subtotal:st,qty,amountDiscount,quantityDiscount,quantityTier:qTier,discount,discountLabel,giftQty,freeShipping,shipping,total:Math.max(0,st-discount+shipping)};
  };
  const remaining = (value, threshold) => Math.max(0, threshold-value);
  const add = (id,qty=1) => { if(!C.products[id]) return; const cart=getCart(); cart[id]=(cart[id]||0)+Math.max(1,Number(qty)||1); saveCart(cart); toast(`${C.products[id].name} 已加入購物車`); openPromo(); };
  const setQty = (id,qty) => { const cart=getCart(); if(qty<=0) delete cart[id]; else cart[id]=Math.min(99,qty); saveCart(cart); };
  const clear = () => saveCart({});
  const toast = text => { let el=document.querySelector('.cart-toast'); if(!el){el=document.createElement('div');el.className='cart-toast';document.body.appendChild(el)} el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800); };

  function injectShell(){
    const nav=document.querySelector('.nav');
    if(nav && !document.querySelector('.cart-trigger')){
      const b=document.createElement('button'); b.className='cart-trigger'; b.type='button'; b.setAttribute('aria-label','開啟購物車');
      b.innerHTML='<span class="cart-icon">🛒</span><span>購物車</span><b class="cart-count">0</b>';
      const cta=nav.querySelector('.nav-cta'); nav.insertBefore(b,cta||null); b.addEventListener('click',openCart);
    }
    if(!document.querySelector('.cart-drawer')){
      const wrap=document.createElement('div'); wrap.innerHTML=`<div class="cart-backdrop" aria-hidden="true"></div><aside class="cart-drawer" aria-label="購物車"><div class="cart-head"><div><span class="eyebrow">YOUR CART</span><h2>購物車</h2></div><button class="cart-close" type="button" aria-label="關閉購物車">×</button></div><div class="cart-test-note">${C.testMode?'目前為綠界 Stage 測試環境；商品價格已使用正式售價，測試付款不會實際扣款。':'正式購物模式'}</div><div class="cart-items"></div><div class="cart-summary"><div><span>商品小計</span><b class="cart-subtotal">NT$0</b></div><div class="cart-total"><span>合計</span><strong class="cart-total-money">NT$0</strong></div><a class="btn cart-checkout" href="checkout.html">前往結帳</a><button class="cart-clear" type="button">清空購物車</button></div></aside>`;
      document.body.append(...wrap.children);
      document.querySelector('.cart-backdrop').addEventListener('click',closeCart);
      document.querySelector('.cart-close').addEventListener('click',closeCart);
      document.querySelector('.cart-clear').addEventListener('click',clear);
    }
    if(!document.querySelector('.promo-modal')){
      const promo=document.createElement('div'); promo.innerHTML=`<div class="promo-backdrop" aria-hidden="true"></div><section class="promo-modal" role="dialog" aria-modal="true" aria-label="購物優惠"><button class="promo-close" type="button" aria-label="關閉">×</button><div class="promo-head"><span class="eyebrow">SHOPPING OFFERS</span><h2>再買一點，優惠更多</h2><p>系統會依購物車金額與件數，自動套用符合條件的優惠。</p></div><div class="promo-list"></div><div class="promo-actions"><button class="btn promo-continue" type="button">繼續選購</button><a class="btn btn-outline" href="checkout.html">前往結帳</a></div><p class="promo-note">折扣規則：金額折扣與滿件折扣預設擇優套用；免運與滿額贈可同時享有。</p></section>`;
      document.body.append(...promo.children);
      document.querySelector('.promo-backdrop').addEventListener('click',closePromo);
      document.querySelector('.promo-close').addEventListener('click',closePromo);
      document.querySelector('.promo-continue').addEventListener('click',()=>{closePromo(); closeCart();});
    }
  }
  function openCart(){ document.body.classList.add('cart-open'); document.querySelector('.cart-drawer')?.classList.add('open'); document.querySelector('.cart-backdrop')?.classList.add('open'); }
  function closeCart(){ document.body.classList.remove('cart-open'); document.querySelector('.cart-drawer')?.classList.remove('open'); document.querySelector('.cart-backdrop')?.classList.remove('open'); }
  function openPromo(){ renderPromos(); document.body.classList.add('promo-open'); document.querySelector('.promo-modal')?.classList.add('open'); document.querySelector('.promo-backdrop')?.classList.add('open'); }
  function closePromo(){ document.body.classList.remove('promo-open'); document.querySelector('.promo-modal')?.classList.remove('open'); document.querySelector('.promo-backdrop')?.classList.remove('open'); }
  function promoCard(type,title,desc,status,done=false){ return `<article class="promo-card ${done?'achieved':''}"><div class="promo-badge">${done?'✓':'優惠'}</div><div><b>${type}</b><h3>${title}</h3><p>${desc}</p><span>${status}</span></div></article>`; }
  function renderPromos(){
    const box=document.querySelector('.promo-list'); if(!box)return; const cart=getCart(), r=promoCalc(cart), p=C.promotions||{};
    const free=p.freeShippingThreshold||1000, amount=p.amountDiscount||{}, gift=p.gift||{};
    const amountLevels=[1000,2000,3000], amountBenefits=[100,200,300], qtyLevels=[3,6], qtyLabels=['9 折','8 折'], giftLevels=[2000,4000,6000];
    let html='';
    html+=promoCard('滿額免運','滿千免運費','單筆商品小計滿 NT$1,000 即享免運。',r.freeShipping?'已達成免運優惠':`再買 ${money(remaining(r.subtotal,free))} 即享免運`,r.freeShipping);
    amountLevels.forEach((lv,i)=>html+=promoCard('滿額折扣',`滿 ${money(lv)} 折 ${money(amountBenefits[i])}`,'每滿千現折一百，最高折抵 NT$300。',r.subtotal>=lv?`已達成：可折 ${money(amountBenefits[i])}`:`再買 ${money(remaining(r.subtotal,lv))} 即享折抵 ${money(amountBenefits[i])}`,r.subtotal>=lv));
    qtyLevels.forEach((lv,i)=>html+=promoCard('滿件折扣',`滿 ${lv} 件 ${qtyLabels[i]}`,'滿 3 件 9 折，滿 6 件 8 折。',r.qty>=lv?`已達成 ${qtyLabels[i]} 優惠`:`再買 ${remaining(r.qty,lv)} 件商品即可享 ${qtyLabels[i]}`,r.qty>=lv));
    giftLevels.forEach((lv,i)=>html+=promoCard('滿額贈',`滿 ${money(lv)} 贈 ${gift.productName||'開心果瑪奇朵10入'} × ${i+1}`,'每滿 NT$2,000 贈 1 盒，最多 3 盒。',r.subtotal>=lv?`已達成：贈品 × ${i+1}`:`再買 ${money(remaining(r.subtotal,lv))} 即享贈品 × ${i+1}`,r.subtotal>=lv));
    box.innerHTML=html;
  }
  function renderCart(){
    const cart=getCart(); document.querySelectorAll('.cart-count').forEach(e=>e.textContent=totalQty(cart));
    const box=document.querySelector('.cart-items'); if(!box) return;
    const rows=Object.entries(cart).filter(([id,q])=>C.products[id]&&q>0);
    if(!rows.length){ box.innerHTML='<div class="cart-empty"><div>☕</div><h3>購物車還是空的</h3><p>從 9 款飲品中挑一杯喜歡的加入吧。</p><a href="product.html" class="text-link">前往產品總覽 →</a></div>'; }
    else box.innerHTML=rows.map(([id,q])=>{const p=C.products[id];return `<div class="cart-item"><a href="${p.page}"><img src="${p.image}" alt="${p.name}"></a><div class="cart-item-copy"><a href="${p.page}"><b>${p.name}</b></a><span>售價 ${money(p.price)}</span><div class="qty-control"><button type="button" data-cart-minus="${id}">−</button><input value="${q}" inputmode="numeric" aria-label="${p.name}數量" data-cart-qty="${id}"><button type="button" data-cart-plus="${id}">＋</button></div></div><button class="cart-remove" type="button" data-cart-remove="${id}" aria-label="移除${p.name}">×</button></div>`}).join('');
    const r=promoCalc(cart); document.querySelector('.cart-subtotal').textContent=money(r.subtotal); document.querySelector('.cart-total-money').textContent=money(r.total); const summary=document.querySelector('.cart-summary'); let promoLine=summary?.querySelector('.cart-promo-lines'); if(summary&&!promoLine){promoLine=document.createElement('div');promoLine.className='cart-promo-lines';summary.insertBefore(promoLine,summary.querySelector('.cart-total'));} if(promoLine) promoLine.innerHTML=`${r.discount?`<div><span>${r.discountLabel}</span><b>−${money(r.discount)}</b></div>`:''}<div><span>運費</span><b>${r.freeShipping?'滿額免運':(C.shippingFee?money(C.shippingFee):'結帳時計算／目前 $0')}</b></div>${r.giftQty?`<div class="gift-line"><span>滿額贈</span><b>${C.promotions.gift.productName} × ${r.giftQty}</b></div>`:''}<button type="button" class="promo-link" onclick="document.querySelector('.promo-modal')?.classList.add('open');document.querySelector('.promo-backdrop')?.classList.add('open');document.body.classList.add('promo-open');">查看購物優惠 →</button>`;
    renderPromos();
    document.querySelectorAll('[data-cart-minus]').forEach(b=>b.onclick=()=>setQty(b.dataset.cartMinus,(getCart()[b.dataset.cartMinus]||1)-1));
    document.querySelectorAll('[data-cart-plus]').forEach(b=>b.onclick=()=>setQty(b.dataset.cartPlus,(getCart()[b.dataset.cartPlus]||0)+1));
    document.querySelectorAll('[data-cart-remove]').forEach(b=>b.onclick=()=>setQty(b.dataset.cartRemove,0));
    document.querySelectorAll('[data-cart-qty]').forEach(i=>i.onchange=()=>setQty(i.dataset.cartQty,Math.max(0,parseInt(i.value)||0)));
  }
  function enhanceCatalog(){
    document.querySelectorAll('.catalog-card').forEach(card=>{const name=card.querySelector('h3')?.textContent.trim(); const entry=Object.entries(C.products).find(([,p])=>p.name===name); if(!entry)return; const [id,p]=entry; if(card.querySelector('.catalog-buy'))return; const copy=card.querySelector('.catalog-copy'); const row=document.createElement('div'); row.className='catalog-commerce'; row.innerHTML=`<strong>售價 ${money(p.price)}</strong><button type="button" class="btn catalog-buy" data-add-product="${id}">加入購物車</button>`; copy.appendChild(row);});
  }
  function enhanceDetail(){
    const file=location.pathname.split('/').pop();
    const id=productByPage[file];
    if(!id)return;

    const p=C.products[id];
    const currentCart=getCart();
    const currentQty=Math.max(1,currentCart[id]||1);

    const slot=document.querySelector('.hero-purchase-slot');
    if(slot){
      slot.innerHTML=`
        <div class="hero-purchase-card">
          <div class="hero-purchase-price">
            <span>售價</span>
            <strong>${money(p.price)}</strong>
            <small>1 盒 10 包</small>
          </div>

          <div class="hero-purchase-controls">
            <label>
              <span>購買數量</span>
              <div class="hero-qty-control">
                <button type="button" data-detail-minus="${id}" aria-label="${p.name}減少一件">−</button>
                <input id="detailQty" type="number" min="1" max="99" value="${currentQty}" inputmode="numeric" aria-label="${p.name}購買數量">
                <button type="button" data-detail-plus="${id}" aria-label="${p.name}增加一件">＋</button>
              </div>
            </label>

            <button type="button" class="btn hero-add-cart" data-add-product="${id}" data-set-detail-qty="1">
              加入購物車
            </button>
          </div>

          <div class="hero-purchase-footer">
            <span>${currentCart[id] ? `購物車目前已有 ${currentCart[id]} 件` : '可直接在此選擇數量並加入購物車'}</span>
            <a href="checkout.html" class="text-link">直接前往結帳 →</a>
          </div>
        </div>`;
    }

    const spec=[...document.querySelectorAll('.spec-table>div')].find(d=>d.querySelector('b')?.textContent.trim()==='售價');
    if(spec) spec.querySelector('span').textContent='售價 '+money(p.price);
  }
  function bindAdd(){
    document.addEventListener('click',e=>{
      const minus=e.target.closest('[data-detail-minus]');
      const plus=e.target.closest('[data-detail-plus]');

      if(minus || plus){
        const input=document.getElementById('detailQty');
        if(!input)return;
        const next=Math.max(1,Math.min(99,(parseInt(input.value)||1)+(plus?1:-1)));
        input.value=next;
        return;
      }

      const b=e.target.closest('[data-add-product]');
      if(!b)return;

      if(b.dataset.setDetailQty){
        const qty=Math.max(1,Math.min(99,parseInt(document.getElementById('detailQty')?.value)||1));
        setQty(b.dataset.addProduct,qty);
        toast(`${C.products[b.dataset.addProduct].name} 已更新為 ${qty} 件`);
        openPromo();
        return;
      }

      const qty=b.dataset.useDetailQty?document.getElementById('detailQty')?.value:1;
      add(b.dataset.addProduct,qty);
    });
  }
  function renderCheckout(formState={}){
    const root=document.getElementById('checkoutApp'); if(!root)return;
    const cart=getCart(), rows=Object.entries(cart).filter(([id,q])=>C.products[id]&&q>0);
    if(!rows.length){
      root.innerHTML='<div class="checkout-empty"><h1>購物車沒有商品</h1><p>先挑幾款喜歡的飲品，再回來結帳。</p><a class="btn" href="product.html">前往選購</a></div>';
      return;
    }

    const r=promoCalc(cart),st=r.subtotal;
    const ship=Object.entries(C.shippingOptions||{}).map(([id,o])=>`<option value="${id}">${o.label}｜${o.freeThreshold?`滿 ${money(o.freeThreshold)} 免運，未滿 ${money(o.fee)}`:money(o.fee)}</option>`).join('');

    root.innerHTML=`<div class="checkout-grid">
      <section class="checkout-panel">
        <div class="eyebrow">CHECKOUT</div><h1>結帳資料</h1>
        <form id="checkoutForm">
          <label>姓名<input name="name" required autocomplete="name"></label>
          <label>手機<input name="phone" required autocomplete="tel"></label>
          <label>Email<input name="email" type="email" required autocomplete="email"></label>
          <label>配送方式<select name="shippingMethod" id="shippingMethod">${ship}</select></label>
          <p id="shippingNote" class="checkout-help"></p>
          <label>付款方式<select name="paymentMethod" id="paymentMethod">
            <option value="credit">信用卡｜VISA / MASTER / JCB</option>
            <option value="cod">宅配取貨付款｜加收 NT$60</option>
          </select></label>
          <p id="paymentNote" class="checkout-help"></p>
          <label>訂單備註<textarea name="note" rows="4"></textarea></label>
          <div class="checkout-note">
            <p><strong>優惠：</strong>每滿千折百（最高 NT$300）與滿 3 件 9 折／滿 6 件 8 折擇優套用；滿額贈可同時享有。</p>
            ${C.testMode?'<p><strong>測試模式：</strong>目前使用綠界 Stage 測試環境，不會實際扣款。</p>':''}
          </div>
          <button class="btn checkout-pay" type="submit">確認付款 · <span id="checkoutButtonTotal"></span></button>
          <p id="checkoutStatus" class="checkout-status" aria-live="polite"></p>
        </form>
      </section>

      <aside class="order-panel">
        <div class="eyebrow">ORDER SUMMARY</div><h2>訂單摘要</h2>
        <p class="order-edit-hint">可直接調整數量；點擊商品圖片或名稱可返回商品頁繼續選購。</p>
        <div class="order-list">
          ${rows.map(([id,q])=>{
            const p=C.products[id];
            return `<div class="order-row" data-checkout-product="${id}">
              <a class="order-product-image" href="${p.page}" aria-label="查看${p.name}">
                <img src="${p.image}" alt="${p.name}">
              </a>
              <div class="order-product-copy">
                <a class="order-product-name" href="${p.page}"><b>${p.name}</b></a>
                <div class="order-qty-control" aria-label="${p.name}數量">
                  <button type="button" data-checkout-minus="${id}" aria-label="${p.name}減少一件">−</button>
                  <input type="number" min="0" max="99" value="${q}" inputmode="numeric" data-checkout-qty="${id}" aria-label="${p.name}數量">
                  <button type="button" data-checkout-plus="${id}" aria-label="${p.name}增加一件">＋</button>
                </div>
              </div>
              <strong class="order-line-total">${money(p.price*q)}</strong>
            </div>`;
          }).join('')}
        </div>
        <div class="order-totals">
          <div><span>商品小計</span><b>${money(st)}</b></div>
          ${r.discount?`<div><span>${r.discountLabel}</span><b>−${money(r.discount)}</b></div>`:''}
          <div><span>運費</span><b id="checkoutShipping"></b></div>
          <div><span>付款手續費</span><b id="checkoutPaymentFee"></b></div>
          ${r.giftQty?`<div><span>滿額贈</span><b>${C.promotions.gift.productName} × ${r.giftQty}</b></div>`:''}
          <div class="grand"><span>應付總額</span><strong id="checkoutGrand"></strong></div>
        </div>
      </aside>
    </div>`;

    // 修改商品數量重新計算時，保留使用者已填的結帳資料。
    const form=document.getElementById('checkoutForm');
    ['name','phone','email','note'].forEach(k=>{
      if(form.elements[k] && formState[k]!==undefined) form.elements[k].value=formState[k];
    });
    if(formState.shippingMethod && C.shippingOptions?.[formState.shippingMethod]) form.elements.shippingMethod.value=formState.shippingMethod;
    if(formState.paymentMethod && C.paymentOptions?.[formState.paymentMethod]) form.elements.paymentMethod.value=formState.paymentMethod;

    const update=()=>{
      const sm=document.getElementById('shippingMethod').value,
            pm=document.getElementById('paymentMethod').value,
            sf=shippingFeeFor(sm,st),
            pf=paymentFeeFor(pm,st),
            total=Math.max(0,st-r.discount+sf+pf);
      document.getElementById('checkoutShipping').textContent=sf?money(sf):'免運';
      document.getElementById('checkoutPaymentFee').textContent=pf?money(pf):'NT$0';
      document.getElementById('checkoutGrand').textContent=money(total);
      document.getElementById('checkoutButtonTotal').textContent=money(total);
      document.getElementById('shippingNote').textContent=C.shippingOptions[sm]?.note||'';
      document.getElementById('paymentNote').textContent=C.paymentOptions[pm]?.note||'';
    };

    const changeCheckoutQty=(id,nextQty)=>{
      const state=checkoutFormState();
      const current=getCart();
      nextQty=Math.max(0,Math.min(99,parseInt(nextQty)||0));
      if(nextQty<=0) delete current[id]; else current[id]=nextQty;
      saveCart(current); // localStorage：離開結帳頁或回商品頁後仍會保留數量
      renderCheckout(state);
    };

    root.querySelectorAll('[data-checkout-minus]').forEach(btn=>btn.addEventListener('click',()=>{
      const id=btn.dataset.checkoutMinus;
      changeCheckoutQty(id,(getCart()[id]||0)-1);
    }));
    root.querySelectorAll('[data-checkout-plus]').forEach(btn=>btn.addEventListener('click',()=>{
      const id=btn.dataset.checkoutPlus;
      changeCheckoutQty(id,(getCart()[id]||0)+1);
    }));
    root.querySelectorAll('[data-checkout-qty]').forEach(input=>{
      input.addEventListener('change',()=>changeCheckoutQty(input.dataset.checkoutQty,input.value));
      input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();input.blur();}});
    });

    document.getElementById('shippingMethod').addEventListener('change',update);
    document.getElementById('paymentMethod').addEventListener('change',update);
    update();
    document.getElementById('checkoutForm').addEventListener('submit',startCheckout);
  }
  async function startCheckout(e){
    e.preventDefault(); const status=document.getElementById('checkoutStatus'), btn=e.currentTarget.querySelector('.checkout-pay'); const fd=new FormData(e.currentTarget); const cart=getCart();
    const items=Object.entries(cart).filter(([id,q])=>C.products[id]&&q>0).map(([id,quantity])=>({id,quantity}));
    btn.disabled=true; btn.textContent='建立訂單中…'; status.textContent='';
    try{
      const base=(C.apiBaseUrl||'').replace(/\/$/,''); const r=await fetch(base+'/api/ecpay/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,customer:{name:fd.get('name'),phone:fd.get('phone'),email:fd.get('email'),note:fd.get('note'),shippingMethod:fd.get('shippingMethod'),paymentMethod:fd.get('paymentMethod')}})});
      const data=await r.json(); if(!r.ok) throw new Error(data.error||'建立訂單失敗');
      sessionStorage.setItem('grabacup_last_order',data.orderNo); const form=document.createElement('form'); form.method='POST'; form.action=data.action; form.style.display='none'; Object.entries(data.fields).forEach(([k,v])=>{const i=document.createElement('input');i.type='hidden';i.name=k;i.value=v;form.appendChild(i)}); document.body.appendChild(form); form.submit();
    }catch(err){status.textContent=err.message+'。若網站放在 GitHub Pages，請先設定 shop-config.js 的 apiBaseUrl 指向已部署的 Node 後端。'; btn.disabled=false;btn.textContent='重新前往綠界付款';}
  }
  function renderPaymentResult(){
    const root=document.getElementById('paymentResult'); if(!root)return; const order=sessionStorage.getItem('grabacup_last_order'); root.innerHTML=`<div class="payment-result-card"><div class="result-icon">✓</div><div class="eyebrow">PAYMENT RETURN</div><h1>已返回 GRAB A CUP</h1><p>綠界的「返回商店」不代表付款一定成功；正式付款結果應以綠界伺服器回傳至 ReturnURL 的通知為準。</p>${order?`<p class="order-no">訂單編號：<b>${order}</b></p>`:''}<div class="hero-actions"><a class="btn" href="product.html">繼續逛商品</a><a class="text-link" href="contact.html">需要協助？聯絡我們 →</a></div></div>`;
  }
  document.addEventListener('DOMContentLoaded',()=>{injectShell();renderCart();enhanceCatalog();enhanceDetail();bindAdd();renderCheckout();renderPaymentResult();});
  window.GrabACupCart={add,getCart,clear,openCart};
})();
