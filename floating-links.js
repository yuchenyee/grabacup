(() => {
  const social = {
    line: 'https://lin.ee/zlyt749',
    facebook: 'https://www.facebook.com/bravewavetw',
    instagram: 'https://www.instagram.com/ui_bravewave/'
  };

  const items = [
    {key: 'line', label: 'LINE', mark: 'LINE'},
    {key: 'facebook', label: 'Facebook', mark: 'f'},
    {key: 'instagram', label: 'Instagram', mark: '◎'}
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

  function createAction({key, label, mark}, href) {
    const action = document.createElement(href ? 'a' : 'span');
    action.className = `floating-action floating-action--${key}${href ? '' : ' is-pending'}`;
    action.setAttribute('aria-label', href ? `前往 ${label}` : `${label} 連結待設定`);
    action.title = href ? `前往 ${label}` : `${label} 連結待設定`;
    if (href) {
      action.href = href;
      action.target = '_blank';
      action.rel = 'noopener noreferrer';
    }
    const icon = document.createElement('span');
    icon.className = 'floating-action__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = mark;
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
    rail.appendChild(createAction({key: 'shop', label: '購買產品', mark: '🛒'}, '/product.html'));
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
