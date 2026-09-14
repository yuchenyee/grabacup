document.addEventListener('DOMContentLoaded',()=>{
  // Public navigation must not expose the CRM administration entry.
  document.querySelectorAll('.links a[href="crm-admin.html"]').forEach(link=>link.remove());
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
  if(form){
    form.removeAttribute('data-endpoint');
    const initialStatus=document.getElementById('formStatus');
    if(initialStatus)initialStatus.textContent='送出後，訊息將安全儲存在本站 CRM，供管理者後續處理。';
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const status=document.getElementById('formStatus');
      const btn=form.querySelector('button[type="submit"]');
      const fd=new FormData(form);
      const payload={
        type:fd.get('聯絡類型')||'',
        name:fd.get('姓名')||'',
        email:fd.get('email')||'',
        phone:fd.get('電話')||'',
        subject:fd.get('主旨')||'',
        message:fd.get('訊息')||'',
        consent:fd.get('同意隱私權政策')==='是',
        website:fd.get('_honey')||''
      };
      btn.disabled=true;
      btn.textContent='傳送中…';
      status.textContent='正在安全儲存訊息…';
      status.style.fontWeight='700';
      status.style.color='#572314';
      try{
        const res=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw new Error(data.error||'送出失敗');
        form.reset();
        status.textContent=data.message||'訊息已送出，我們會儘快回覆你。';
        status.style.color='#397343';
      }catch(error){
        status.textContent=error.message||'目前無法送出表單，請直接來信 info@bravewave.com.tw。';
        status.style.color='#c91820';
      }finally{
        btn.disabled=false;
        btn.textContent='送出訊息';
      }
    });
  }
  const leadForm=document.getElementById('marketingLeadForm');
  if(leadForm) leadForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const status=document.getElementById('leadStatus');
    const button=leadForm.querySelector('button[type="submit"]');
    const fd=new FormData(leadForm);
    const payload={
      name:fd.get('name')||'',
      email:fd.get('email')||'',
      source:fd.get('source')||'homepage',
      consent:fd.get('consent')==='yes',
      website:fd.get('website')||''
    };
    button.disabled=true;
    button.textContent='加入中…';
    status.textContent='正在儲存你的訂閱資料…';
    status.className='lead-status';
    try{
      const res=await fetch('/api/marketing/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||'目前無法完成訂閱');
      leadForm.reset();
      status.textContent=data.message||'訂閱成功！之後有新品與優惠會優先通知你。';
      status.className='lead-status is-success';
    }catch(error){
      status.textContent=error.message;
      status.className='lead-status is-error';
    }finally{
      button.disabled=false;
      button.textContent='加入新品與優惠通知';
    }
  });

});