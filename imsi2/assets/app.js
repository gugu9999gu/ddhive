/* AirFit Storefront - UX Focused PDP + Checkout */
(function(){
  const $ = (sel, ctx=document)=>ctx.querySelector(sel);
  const $$ = (sel, ctx=document)=>Array.from(ctx.querySelectorAll(sel));

  const CART_KEY = 'airfit_cart_v1';
  const OFFER_END_KEY = 'airfit_offer_end_v1';
  const OFFER_MINUTES = 20; // 20분 타임세일

  const SHIPPING_BASE = 3000;
  const FREE_SHIP_THRESHOLD = 50000;

  const COUPONS = {
    NOW10: { code:'NOW10', type:'percent', value:10, minSubtotal:0, label:'지금 10% 즉시할인' },
    SAVE15: { code:'SAVE15', type:'percent', value:15, minSubtotal:100000, label:'10만원 이상 15% 할인' },
    FREESHIP: { code:'FREESHIP', type:'shipping', value:0, minSubtotal:0, label:'무료배송 쿠폰' },
  };

  function formatKRW(v){
    return v.toLocaleString('ko-KR', { style:'currency', currency:'KRW', maximumFractionDigits:0 });
  }

  function readCart(){
    try{ return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }catch{ return []; }
  }
  function writeCart(items){ localStorage.setItem(CART_KEY, JSON.stringify(items)); }
  function cartCount(){ return readCart().reduce((s,i)=>s+i.qty,0); }

  function ensureOfferEnd(){
    const now = Date.now();
    const saved = Number(localStorage.getItem(OFFER_END_KEY)||0);
    if(!saved || saved < now){
      const end = now + OFFER_MINUTES*60*1000;
      localStorage.setItem(OFFER_END_KEY, String(end));
      return end;
    }
    return saved;
  }

  function startCountdown(){
    const el = $('#countdownText');
    if(!el) return;
    let end = ensureOfferEnd();
    function tick(){
      const remain = end - Date.now();
      if(remain <= 0){
        // 만료 시 5분 연장(라스트찬스)
        end = Date.now() + 5*60*1000;
        localStorage.setItem(OFFER_END_KEY, String(end));
      }
      const r = Math.max(0, end - Date.now());
      const m = Math.floor(r/60000);
      const s = Math.floor((r%60000)/1000);
      el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      requestAnimationFrame(()=>setTimeout(tick, 250));
    }
    tick();
  }

  function updateHeaderCartCount(){
    const c = $('#cartCountHeader');
    if(c) c.textContent = String(cartCount());
  }

  function addToCart(item){
    const items = readCart();
    // 옵션 동일시 병합
    const key = (x)=>[x.id,x.variant||'',x.warranty?'W':''].join('|');
    const idx = items.findIndex(x=>key(x)===key(item));
    if(idx>-1){ items[idx].qty += item.qty; }
    else{ items.push(item); }
    writeCart(items);
    updateHeaderCartCount();
  }

  function removeFromCart(index){
    const items = readCart();
    items.splice(index,1);
    writeCart(items);
    updateHeaderCartCount();
  }

  function updateQty(index, qty){
    const items = readCart();
    items[index].qty = Math.max(1, qty|0);
    writeCart(items);
    updateHeaderCartCount();
  }

  function bestCouponFor(subtotal){
    const options = Object.values(COUPONS);
    let best = null; let bestSave = 0;
    for(const c of options){
      if(subtotal < c.minSubtotal) continue;
      const save = c.type==='percent' ? Math.floor(subtotal*c.value/100) : 0; // 배송쿠폰은 별도
      if(save > bestSave){ bestSave = save; best = c; }
    }
    // 배송만 무료인 경우도 고려
    if(!best && subtotal>=0){ best = COUPONS.FREESHIP; }
    return best;
  }

  function computeTotals(cart, coupon){
    const subtotal = cart.reduce((s,i)=>s + i.price*i.qty + (i.warranty?9900:0)*i.qty, 0);
    let discount = 0;
    let shipping = subtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIPPING_BASE;

    if(coupon){
      if(coupon.type==='percent' && subtotal >= (coupon.minSubtotal||0)){
        discount = Math.floor(subtotal * coupon.value / 100);
      }else if(coupon.type==='shipping'){
        shipping = 0;
      }
    }

    const total = Math.max(0, subtotal - discount) + shipping;
    const savings = discount + (shipping===0 ? SHIPPING_BASE : 0);
    return { subtotal, discount, shipping, total, savings };
  }

  function initPDP(){
    // 제품 데이터(예시)
    const PRODUCT = {
      id: 'airfit-pro',
      title: '에어핏 무선 이어버드 Pro',
      price: 59000,
      compareAt: 89000,
      image: 'https://images.unsplash.com/photo-1590658006833-8e5f0c0b1c73?q=80&w=800&auto=format&fit=crop'
    };

    // 썸네일 상호작용
    $$('.thumb').forEach(th=>{
      th.addEventListener('click',()=>{
        $$('.thumb').forEach(t=>t.classList.remove('is-active'));
        th.classList.add('is-active');
        $('#mainImage').src = th.src.replace('w=300','w=1200');
      });
    });

    // 가격/절약 표시
    $('#priceCurrent').textContent = formatKRW(PRODUCT.price);
    $('#priceCompare').textContent = formatKRW(PRODUCT.compareAt);
    $('#savingsInfo').textContent = `지금 구매 시 ${formatKRW(PRODUCT.compareAt - PRODUCT.price)} 절약`;
    $('#stickyPrice').textContent = formatKRW(PRODUCT.price);

    // 재고/사회적 증거
    const stockLeft = Math.floor(Math.random()*6)+3; // 3~8
    const stockBadge = $('#stockBadge');
    stockBadge.textContent = `품절 임박 · ${stockLeft}개 남음`;
    stockBadge.style.background = 'rgba(255,107,107,.15)';
    stockBadge.style.color = '#ff9b9b';
    stockBadge.style.borderColor = 'rgba(255,107,107,.3)';

    function tickSocial(){
      const n = Math.floor(Math.random()*3)+1; // 1~3
      $('#socialProof').textContent = `방금 ${n}명이 이 상품을 구매했습니다`;
      setTimeout(tickSocial, Math.floor(Math.random()*10000)+15000);
    }
    tickSocial();

    // 수량 조절
    $$('.qty-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const input = $('#qty');
        const v = Number(input.value||1);
        if(btn.dataset.action==='inc') input.value = v+1;
        else input.value = Math.max(1, v-1);
      });
    });

    function collectOptions(){
      const color = $('input[name="color"]:checked')?.value || '기본';
      const warranty = $('#warranty')?.checked || false;
      const qty = Math.max(1, Number($('#qty').value||1));
      return { color, warranty, qty };
    }

    function toCartItem(opts){
      return {
        id: PRODUCT.id,
        title: PRODUCT.title,
        price: PRODUCT.price,
        image: PRODUCT.image,
        variant: `색상:${opts.color}`,
        warranty: opts.warranty,
        qty: opts.qty
      };
    }

    $('#addToCartBtn')?.addEventListener('click',()=>{
      const opts = collectOptions();
      addToCart(toCartItem(opts));
      // 시각적 피드백
      $('#addToCartBtn').textContent = '담겼습니다!';
      setTimeout(()=>$('#addToCartBtn').textContent = '장바구니 담기', 1200);
    });

    function goCheckoutWithAdd(){
      const opts = collectOptions();
      addToCart(toCartItem(opts));
      location.href = 'checkout.html';
    }

    $('#buyNowBtn')?.addEventListener('click', goCheckoutWithAdd);
    $('#stickyCartBtn')?.addEventListener('click', ()=>{
      const opts = collectOptions();
      addToCart(toCartItem(opts));
    });
    $('#stickyBuyBtn')?.addEventListener('click', goCheckoutWithAdd);
  }

  function renderCartList(){
    const list = $('#cartItems');
    const empty = $('#cartEmpty');
    if(!list || !empty) return;
    const items = readCart();
    list.innerHTML = '';
    if(items.length===0){ empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    items.forEach((it, idx)=>{
      const li = document.createElement('li');
      li.className = 'cart-item';
      li.innerHTML = `
        <img src="${it.image}" alt="${it.title}" width="64" height="64" style="border-radius:8px;object-fit:cover"/>
        <div>
          <div style="font-weight:700">${it.title}</div>
          <div class="meta">${it.variant || ''} ${it.warranty?'· 1년추가보증':''}</div>
          <div class="meta">단가 ${formatKRW(it.price)} / 소계 ${formatKRW(it.price*it.qty + (it.warranty?9900:0)*it.qty)}</div>
        </div>
        <div class="right">
          <div class="qty">
            <button class="qty-btn" data-act="dec" aria-label="수량 감소">−</button>
            <input type="number" value="${it.qty}" min="1" />
            <button class="qty-btn" data-act="inc" aria-label="수량 증가">＋</button>
          </div>
          <button class="remove-btn">삭제</button>
        </div>
      `;
      const input = $('input[type="number"]', li);
      const btns = $$('.qty-btn', li);
      const remove = $('.remove-btn', li);
      btns[0].addEventListener('click',()=>{ input.value = Math.max(1, Number(input.value)-1); onQty(); });
      btns[1].addEventListener('click',()=>{ input.value = Math.max(1, Number(input.value)+1); onQty(); });
      input.addEventListener('change', onQty);
      function onQty(){ updateQty(idx, Number(input.value)||1); renderSummary(); renderCartList(); }
      remove.addEventListener('click',()=>{ removeFromCart(idx); renderSummary(); renderCartList(); });
      list.appendChild(li);
    });
  }

  function currentCoupon(){
    const code = ($('#couponInput')?.value || '').trim().toUpperCase();
    return COUPONS[code] || null;
  }

  function applyCouponMessage(msg, ok){
    const el = $('#couponMessage');
    if(!el) return;
    el.textContent = msg;
    el.style.color = ok? 'var(--accent)' : 'var(--muted)';
  }

  function renderSummary(){
    const items = readCart();
    const subtotal = items.reduce((s,i)=>s + i.price*i.qty + (i.warranty?9900:0)*i.qty, 0);

    // 배송 무료까지 진행바
    const prog = Math.min(100, Math.floor(subtotal / FREE_SHIP_THRESHOLD * 100));
    const remain = Math.max(0, FREE_SHIP_THRESHOLD - subtotal);
    if($('#shipProgress')) $('#shipProgress').style.width = `${prog}%`;
    if($('#shipHint')) $('#shipHint').textContent = remain>0? `${formatKRW(remain)} 추가 시 무료배송` : '무료배송 달성!';

    // 쿠폰 적용
    const coupon = currentCoupon();
    const totals = computeTotals(items, coupon);
    if($('#sumSubtotal')) $('#sumSubtotal').textContent = formatKRW(totals.subtotal);
    if($('#sumDiscount')) $('#sumDiscount').textContent = `-${formatKRW(totals.discount)}`;
    if($('#sumShipping')) $('#sumShipping').textContent = formatKRW(totals.shipping);
    if($('#sumTotal')) $('#sumTotal').textContent = formatKRW(totals.total);
    if($('#sumSavings')) $('#sumSavings').textContent = `총 절약: ${formatKRW(totals.savings)}`;

    // 쿠폰 검증 메시지
    if(coupon){
      if(coupon.type==='percent' && subtotal < (coupon.minSubtotal||0)){
        applyCouponMessage(`이 쿠폰은 ${formatKRW(coupon.minSubtotal)} 이상에서 사용 가능합니다.`, false);
      }else{
        applyCouponMessage(`${coupon.code} 적용됨 · 할인 ${coupon.type==='percent'? coupon.value+'%' : '배송비 무료'}`, true);
      }
    }else{
      applyCouponMessage('쿠폰 코드를 입력하고 적용을 눌러주세요. 예) NOW10', false);
    }
  }

  function initCheckout(){
    // 장바구니 렌더
    renderCartList();

    // 빈 카트면 버튼 비활성
    const hasItems = readCart().length>0;
    if(!hasItems){
      $('#placeOrderBtn')?.setAttribute('disabled','true');
    }

    // NOW10 자동 적용 유도
    const input = $('#couponInput');
    if(input && !input.value) input.value = 'NOW10';
    renderSummary();

    $('#applyCouponBtn')?.addEventListener('click', renderSummary);
    $('#bestCouponBtn')?.addEventListener('click', ()=>{
      const subtotal = readCart().reduce((s,i)=>s + i.price*i.qty + (i.warranty?9900:0)*i.qty, 0);
      const best = bestCouponFor(subtotal);
      if(best){
        $('#couponInput').value = best.code;
        applyCouponMessage(`최고 혜택 쿠폰 ${best.code} 적용`, true);
        renderSummary();
      }
    });

    $('#paymentForm')?.addEventListener('submit', (e)=>{
      e.preventDefault();
      if(readCart().length===0){ alert('장바구니가 비어 있습니다.'); return; }
      const requiredIds = ['email','name','phone','address','agree'];
      for(const id of requiredIds){
        const el = document.getElementById(id);
        if((el.type==='checkbox' && !el.checked) || (el.type!=='checkbox' && !el.value.trim())){
          el.focus();
          alert('필수 정보를 모두 입력/동의해주세요.');
          return;
        }
      }
      // 모의 결제 성공
      alert('주문이 완료되었습니다! 감사합니다.');
      localStorage.removeItem(CART_KEY);
      updateHeaderCartCount();
      location.href = 'index.html';
    });
  }

  function initSticky(){ updateHeaderCartCount(); }

  function boot(){
    startCountdown();
    updateHeaderCartCount();
    const page = document.body.getAttribute('data-page');
    if(page==='product') initPDP();
    if(page==='checkout') initCheckout();
    initSticky();
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
