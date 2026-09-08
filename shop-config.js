window.SHOP_CONFIG = {
  storeName: 'GRAB A CUP 葛拉卡咖啡',
  currency: 'TWD',
  testMode: true,
  apiBaseUrl: '',
  shippingFee: 100,
  shippingOptions: {
    home: { label:'宅配（台灣本島）', fee:100, freeThreshold:1000, note:'無法指定到達時間' },
    chilled: { label:'宅配冷藏（台灣本島）', fee:250, freeThreshold:2000, note:'長寬高總和 150 公分內、20 公斤以下；不可與常溫／冷凍併單' },
    frozen: { label:'宅配冷凍（台灣本島）', fee:350, freeThreshold:3000, note:'長寬高總和 150 公分內、20 公斤以下；不可與常溫併單' },
    post: { label:'郵寄', fee:125, freeThreshold:null, note:'長寬高總和不超過 90 公分、20 公斤以下，且不得小於 14×9 公分' }
  },
  paymentOptions: {
    credit: { label:'信用卡', feeType:'fixed', fee:0, note:'接受 VISA / MASTER / JCB' },
    cod: { label:'取貨時付款', feeType:'fixed', fee:60, note:'宅配貨到付款加收 NT$60' },
    cvsCod: { label:'超商取貨時付款', feeType:'rate', rate:0.0075, note:'手續費為產品金額 0.75%；超商物流費尚未提供，暫不開放結帳' }
  },
  promotions: {
    freeShippingThreshold: 1000,
    amountDiscount: { step: 1000, amountPerStep: 100, maxDiscount: 300 },
    quantityDiscounts: [
      { minQty: 6, rate: 0.20, label: '滿 6 件 8 折' },
      { minQty: 3, rate: 0.10, label: '滿 3 件 9 折' }
    ],
    gift: { step: 2000, maxQty: 3, productName: '開心果瑪奇朵10入', productId: 'pistachio-macchiato' },
    // 金額折扣與滿件折扣預設不併用，系統自動採較優惠者；免運與滿額贈可同時享有。
    discountStacking: 'best-of'
  },
  products: {
    'peach-oolong': { name:'水蜜桃烏龍', price:178, image:'images/01-水蜜桃烏龍.png', page:'product-peach-oolong.html' },
    'coconut-latte': { name:'生椰拿鐵', price:178, image:'images/02-生椰拿鐵.png', page:'product-coconut-latte.html' },
    'jasmine-cream-americano': { name:'茉莉奶蓋美式', price:178, image:'images/03-茉莉奶蓋美式.png', page:'product-jasmine-cream-americano.html' },
    'jasmine-light-latte': { name:'茉莉輕雪拿鐵', price:168, image:'images/04-茉莉輕雪拿鐵.png', page:'product-jasmine-light-latte.html' },
    'classic-latte': { name:'拿鐵時光', price:158, image:'images/05-拿鐵時光.png', page:'product-classic-latte.html' },
    'rouge-spring-americano': { name:'胭脂春美式', price:168, image:'images/06-胭脂春美式.png', page:'product-rouge-spring-americano.html' },
    'kainak-latte': { name:'凱娜克拿鐵', price:210, image:'images/07-凱娜克拿鐵.png', page:'product-kainak-latte.html' },
    'pistachio-macchiato': { name:'開心果瑪奇朵', price:198, image:'images/08-開心果瑪奇朵.png', page:'product-pistachio-macchiato.html' },
    'berry-cocoa-light-milk-tea': { name:'綜合莓可可輕乳茶', price:188, image:'images/09-綜合莓可可輕乳茶.png', page:'product-berry-cocoa-light-milk-tea.html' }
  }
};
