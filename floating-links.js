(() => {
  const social = {
    line: 'https://lin.ee/zlyt749',
    facebook: 'https://www.facebook.com/bravewavetw',
    instagram: 'https://www.instagram.com/ui_bravewave/'
  };

  const items = [
    {key: 'line', label: 'LINE', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5h16v13H11l-5 3v-3H4z"/><path d="M7.5 9h9M7.5 12.5h7"/></svg>'},
    {key: 'facebook', label: 'Facebook', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.4 21v-8h2.7l.4-3.2h-3.1V7.7c0-.9.3-1.4 1.6-1.4h1.7V3.4a22 22 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.2v2.3H8.2V13H11v8z"/></svg>'},
    {key: 'instagram', label: 'Instagram', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17.3" cy="6.8" r=".9"/></svg>'}
  ];

  function safeSocialUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  function createAction({key, label, svg}, href) {
    const action = document.createElement(href ? 'a' : 'span');
    action.className = `floating-action floating-action--${key}${href ? '' : ' is-pending'}`;
    const description = href ? (key === 'shop' ? '前往購買產品' : `前往 ${label}`) : `${label} 連結待設定`;
    action.setAttribute('aria-label', description);
    action.title = description;
    if (href) {
      action.href = href;
      if (!href.startsWith('/')) {
        action.target = '_blank';
        action.rel = 'noopener noreferrer';
      }
    }
    const icon = document.createElement('span');
    icon.className = 'floating-action__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = svg;
    const text = document.createElement('span');
    text.className = 'floating-action__text';
    text.textContent = label;
    action.append(icon, text);
    return action;
  }

  function mount() {
    if (document.querySelector('.floating-actions')) return;
    const rail = document.createElement('nav');
    rail.className = 'floating-actions';
    rail.setAttribute('aria-label', '快捷連結');
    items.forEach(item => rail.appendChild(createAction(item, safeSocialUrl(social[item.key]))));
    rail.appendChild(createAction({key: 'shop', label: '購買產品', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 4.5h2.4l2.3 10.8h11.2l2.1-8H5.6"/><circle cx="9" cy="19.5" r="1"/><circle cx="18" cy="19.5" r="1"/></svg>'}, '/product.html'));
    const top = document.createElement('button');
    top.type = 'button';
    top.className = 'floating-action floating-action--top';
    top.setAttribute('aria-label', '回到頁面頂部');
    top.title = '回到頁面頂部';
    top.innerHTML = '<span class="floating-action__icon" aria-hidden="true">↑</span><span class="floating-action__text">回到頂部</span>';
    top.addEventListener('click', () => {
      window.scrollTo({top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    });
    rail.appendChild(top);
    document.body.appendChild(rail);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
