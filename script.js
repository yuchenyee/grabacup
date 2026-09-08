document.addEventListener('DOMContentLoaded',()=>{
  const file=location.pathname.split('/').pop()||'index.html';
  document.querySelectorAll('.links a').forEach(a=>{if(a.getAttribute('href')===file)a.classList.add('active')});
  const menu=document.querySelector('.menu-toggle'), links=document.querySelector('.links');
  if(menu&&links){menu.addEventListener('click',()=>{const open=links.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))});document.querySelectorAll('.links a').forEach(a=>a.addEventListener('click',()=>links.classList.remove('open')))}
  const filters=document.querySelectorAll('.filter-btn'), cards=document.querySelectorAll('.catalog-card');
  filters.forEach(btn=>btn.addEventListener('click',()=>{filters.forEach(b=>b.classList.remove('active'));btn.classList.add('active');const f=btn.dataset.filter;cards.forEach(c=>c.classList.toggle('hidden',f!=='all'&&c.dataset.cat!==f))}));
  const sf=document.getElementById('storeSearchBtn'); if(sf) sf.addEventListener('click',()=>{const e=document.getElementById('storeEmpty');e.querySelector('h3').textContent='目前尚未匯入門市資料';e.querySelector('p').textContent='版型與搜尋介面已完成。提供實際門市清單後即可接上篩選與地圖。'});
  const form=document.getElementById('contactForm'); if(form) form.addEventListener('submit',e=>{e.preventDefault();const s=document.getElementById('formStatus');s.textContent='表單欄位驗證已完成，但尚未設定收件端點，因此目前不會送出資料。';s.style.fontWeight='700';s.style.color='#572314'});
});