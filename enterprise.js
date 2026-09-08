(() => {
  const API = ''; // Cloudflare Pages Functions 與前端同網域
  const TOKEN_KEY = 'grabacup_enterprise_token';
  let enterpriseProducts = {};
  let token = sessionStorage.getItem(TOKEN_KEY) || '';

  const money = n => 'NT$' + Number(n||0).toLocaleString('zh-TW');
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  function setStatus(el, msg, ok=false){
    if(!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-ok', !!ok);
  }

  async function api(path, options={}){
    const headers = {'Content-Type':'application/json', ...(options.headers||{})};
    if(token) headers.Authorization = `Bearer ${token}`;
    let res;
    try{
      res = await fetch(API + path, {...options, headers});
    }catch(err){
      throw new Error('無法連線企業驗證服務，請確認網站已由 Cloudflare Pages 部署且 Functions 已啟用。');
    }
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || '系統暫時無法處理，請稍後再試');
    return data;
  }

  async function loadEnterprisePrices(){
    if(!token) return false;
    try{
      const data = await api('/api/enterprise/prices');
      enterpriseProducts = data.products || {};
      $$('.enterprise-product').forEach(card=>{
        const id=card.dataset.product, p=enterpriseProducts[id];
        if(!p) return;
        card.classList.add('is-unlocked');
        card.querySelector('.enterprise-pricing').innerHTML =
          `<span class="enterprise-retail">售價 ${money(p.retailPrice)}</span><strong>企業價 ${money(p.enterprisePrice)}</strong><em>8 折</em>`;
      });
      $('#enterprisePriceHint').textContent='企業身份已驗證，以下為企業專屬 8 折採購價。';
      $('#enterpriseSession').hidden=false;
      $('#enterpriseCheckoutBtn').disabled=false;
      $('#enterpriseLogin').classList.add('is-authenticated');
      $('#enterpriseLogin').innerHTML='<span class="enterprise-login-card__tag">ENTERPRISE MEMBER</span><h2>企業身份驗證成功</h2><p>企業專屬價格已解鎖，可直接選擇商品數量進行採購。</p><a class="btn" href="#enterpriseProducts">開始企業採購 →</a>';
      updateSubtotal();
      return true;
    }catch(err){
      token='';
      sessionStorage.removeItem(TOKEN_KEY);
      return false;
    }
  }

  function selectedItems(){
    return $$('[data-qty]').map(i=>({id:i.dataset.qty,quantity:Math.max(0,parseInt(i.value)||0)})).filter(x=>x.quantity>0);
  }

  function subtotal(){
    return selectedItems().reduce((sum,x)=>sum+(enterpriseProducts[x.id]?.enterprisePrice||0)*x.quantity,0);
  }

  function updateSubtotal(){
    if(!token || !Object.keys(enterpriseProducts).length){
      $('#enterpriseSubtotal').textContent='請先登入';
      return;
    }
    const total=subtotal();
    $('#enterpriseSubtotal').textContent=money(total);
    $('#enterpriseCheckoutTotal').textContent=money(total);
  }

  $('#enterpriseLoginForm')?.addEventListener('submit', async e=>{
    e.preventDefault();
    const status=$('#enterpriseLoginStatus');
    setStatus(status,'驗證中…');
    try{
      const code=$('#enterpriseCode').value.trim();
      const data=await api('/api/enterprise/login',{method:'POST',body:JSON.stringify({code})});
      token=data.token;
      sessionStorage.setItem(TOKEN_KEY,token);
      await loadEnterprisePrices();
      location.hash='enterpriseProducts';
    }catch(err){ setStatus(status,err.message); }
  });

  document.addEventListener('click',e=>{
    const plus=e.target.closest('[data-plus]'), minus=e.target.closest('[data-minus]');
    if(plus || minus){
      if(!token){ location.hash='enterpriseLogin'; return; }
      const id=(plus||minus).dataset.plus || (plus||minus).dataset.minus;
      const input=document.querySelector(`[data-qty="${id}"]`);
      const next=Math.max(0,Math.min(99,(parseInt(input.value)||0)+(plus?1:-1)));
      input.value=next; updateSubtotal();
    }
  });
  $$('[data-qty]').forEach(i=>i.addEventListener('input',updateSubtotal));

  $('#enterpriseLogout')?.addEventListener('click',()=>{
    sessionStorage.removeItem(TOKEN_KEY);
    location.reload();
  });

  $('#enterpriseCheckoutBtn')?.addEventListener('click',()=>{
    if(!token){ location.hash='enterpriseLogin'; return; }
    if(!selectedItems().length){ alert('請至少選擇 1 件企業採購商品。'); return; }
    $('#enterpriseCheckout').hidden=false;
    updateSubtotal();
    location.hash='enterpriseCheckout';
  });

  $('#enterpriseCheckoutForm')?.addEventListener('submit', async e=>{
    e.preventDefault();
    const status=$('#enterpriseCheckoutStatus'), items=selectedItems();
    if(!items.length){ setStatus(status,'請先選擇採購商品。'); return; }
    const fd=new FormData(e.currentTarget);
    setStatus(status,'正在建立企業訂單…');
    try{
      const data=await api('/api/enterprise/checkout',{
        method:'POST',
        body:JSON.stringify({
          items,
          customer:{
            company:fd.get('company'), taxId:fd.get('taxId'), name:fd.get('name'),
            phone:fd.get('phone'), email:fd.get('email'),
            shippingMethod:fd.get('shippingMethod'), note:fd.get('note')
          }
        })
      });
      const form=document.createElement('form');
      form.method='POST'; form.action=data.action;
      Object.entries(data.fields||{}).forEach(([k,v])=>{const i=document.createElement('input');i.type='hidden';i.name=k;i.value=v;form.appendChild(i);});
      document.body.appendChild(form); form.submit();
    }catch(err){ setStatus(status,err.message); }
  });

  loadEnterprisePrices();
})();