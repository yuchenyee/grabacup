document.addEventListener('DOMContentLoaded',()=>{
  const file=location.pathname.split('/').pop()||'index.html';
  document.querySelectorAll('.links a').forEach(a=>{if(a.getAttribute('href')===file)a.classList.add('active')});
  const menu=document.querySelector('.menu-toggle'), links=document.querySelector('.links');
  if(menu&&links){menu.addEventListener('click',()=>{const open=links.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))});document.querySelectorAll('.links a').forEach(a=>a.addEventListener('click',()=>links.classList.remove('open')))}
  document.querySelectorAll('input[type="password"]').forEach(input=>{
    if(input.closest('.password-wrap'))return;
    const wrap=document.createElement('span');
    wrap.className='password-wrap';
    input.parentNode.insertBefore(wrap,input);
    wrap.appendChild(input);
    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='password-toggle';
    toggle.textContent='顯示';
    toggle.setAttribute('aria-label','顯示密碼');
    toggle.setAttribute('aria-pressed','false');
    toggle.addEventListener('click',()=>{
      const showing=input.type==='text';
      input.type=showing?'password':'text';
      toggle.textContent=showing?'顯示':'隱藏';
      toggle.setAttribute('aria-label',showing?'顯示密碼':'隱藏密碼');
      toggle.setAttribute('aria-pressed',String(!showing));
      input.focus();
    });
    wrap.appendChild(toggle);
  });
  const filters=document.querySelectorAll('.filter-btn'), cards=document.querySelectorAll('.catalog-card');
  filters.forEach(btn=>btn.addEventListener('click',()=>{filters.forEach(b=>b.classList.remove('active'));btn.classList.add('active');const f=btn.dataset.filter;cards.forEach(c=>c.classList.toggle('hidden',f!=='all'&&c.dataset.cat!==f))}));
  const sf=document.getElementById('storeSearchBtn'); if(sf) sf.addEventListener('click',()=>{const e=document.getElementById('storeEmpty');e.querySelector('h3').textContent='目前尚未匯入門市資料';e.querySelector('p').textContent='版型與搜尋介面已完成。提供實際門市清單後即可接上篩選與地圖。'});
  const form=document.getElementById('contactForm');
  if(form) form.addEventListener('submit',async e=>{
    e.preventDefault();
    const s=document.getElementById('formStatus');
    const btn=form.querySelector('button[type="submit"]');
    const endpoint=form.dataset.endpoint;
    if(!endpoint)return;
    btn.disabled=true;
    btn.textContent='傳送中…';
    s.textContent='正在送出訊息…';
    s.style.fontWeight='700';
    s.style.color='#572314';
    try{
      const payload=Object.fromEntries(new FormData(form).entries());
      payload._replyto=payload.email||'';
      if(payload['聯絡類型']) payload._subject=`GRAB A CUP｜${payload['聯絡類型']}｜${payload['主旨']||'官網聯絡表單'}`;
      const res=await fetch(endpoint,{
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify(payload)
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok || data.success===false) throw new Error(data.message||'送出失敗');
      form.reset();
      s.textContent='訊息已送出，我們會透過 info@bravewave.com.tw 收到你的聯絡內容。';
      s.style.color='#397343';
    }catch(err){
      s.textContent='目前無法送出表單，請直接來信 info@bravewave.com.tw。';
      s.style.color='#c91820';
    }finally{
      btn.disabled=false;
      btn.textContent='送出訊息';
    }
  });
});