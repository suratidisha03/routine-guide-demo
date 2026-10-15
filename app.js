// The Routine Guide demo: interactions + GA4 data-layer events (Stage 5, guide p.14-15).
// Events follow Google's recommended e-commerce names. No personal data is ever pushed.
window.dataLayer = window.dataLayer || [];

const PRODUCTS = {
  P7880:   { item_id: 'P7880',   item_name: 'Soy Hydrating Gentle Face Cleanser', item_brand: 'fresh', item_category: 'Cleanser', price: 39.00,
             detail: `<h2 id="detailTitle">fresh Soy Hydrating Gentle Face Cleanser</h2><p><strong>$39.00</strong> for 5 oz / 150 mL. Mini (1.6 oz) available.</p>
             <p><strong>What to expect:</strong> A gel cleanser with a cucumber scent and a light lather. The brand says it removes eye makeup, including mascara; some reviewers found it weak on heavier makeup. Prefer no scent? Try the mini first.</p>
             <p class="muted">Listed skin types: normal, dry, combination, oily. Directions (brand): wet skin, massage over face and eyes, rinse; morning and night.</p>` },
  P248407: { item_id: 'P248407', item_name: 'Ultra Repair Cream Intense Hydration', item_brand: 'First Aid Beauty', item_category: 'Moisturizer', price: 42.00,
             detail: `<h2 id="detailTitle">First Aid Beauty Ultra Repair Cream</h2><p><strong>$42.00</strong> for 6 oz / 170 mL. Mini (2 oz) available.</p>
             <p class="muted">Listed skin types: normal, dry, combination. Fragrance free (brand). Ingredients include colloidal oatmeal, shea butter, allantoin, ceramide NP; the list also includes eucalyptus leaf oil.</p>
             <button class="btn ghost" id="tipsToggle" aria-expanded="false" aria-controls="tips">If it pills: tips to try</button>
             <div class="tips" id="tips" hidden><strong>If it pills:</strong> Some reviewers see pilling, especially over serums or retinol. Try a thin layer, let earlier steps dry, and press it in.</div>` },
  P427421: { item_id: 'P427421', item_name: 'Protini Polypeptide Firming Refillable Moisturizer', item_brand: 'Drunk Elephant', item_category: 'Moisturizer', price: 72.00,
             detail: `<h2 id="detailTitle">Drunk Elephant Protini Polypeptide Cream</h2><p><strong>$72.00</strong> for 50 mL. Mini (15 mL) and 50 mL refill pod available.</p>
             <p><strong>Is it right for you?</strong> Listed for normal, combination and oily skin. Some reviewers reported breakouts, so patch-test before full use.</p>
             <p class="muted">Directions (brand): morning and night on clean, dry skin.</p>` }
};

const cart = []; // {item_id, quantity}

// QA-33 fix: the bag survives a reload and can be rebuilt from a cart email link.
// Link format: index.html?cart=P248407 or ?cart=P248407:2,P7880:1 (known product ids only, quantity 1 to 9).
// Restoring a bag fires no add_to_cart event, so GA4 counts only real clicks.
const CART_KEY = 'routineGuideCart';
function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {} }
function parseCart(text) {
  const out = [];
  String(text || '').split(',').forEach(part => {
    const [id, q] = part.trim().split(':');
    const qty = Math.min(9, Math.max(1, parseInt(q, 10) || 1));
    if (!PRODUCTS[id]) return;
    const line = out.find(c => c.item_id === id);
    if (line) line.quantity = Math.min(9, line.quantity + qty); else out.push({ item_id: id, quantity: qty });
  });
  return out;
}
function loadCart() {
  const fromLink = new URLSearchParams(location.search).get('cart');
  if (fromLink !== null) { const lines = parseCart(fromLink); return { lines, fromLink: true, linkBroken: lines.length === 0 }; }
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return { lines: Array.isArray(saved) ? saved.filter(c => c && PRODUCTS[c.item_id]).map(c => ({ item_id: c.item_id, quantity: Math.min(9, Math.max(1, parseInt(c.quantity, 10) || 1)) })) : [], fromLink: false };
  } catch (e) { return { lines: [], fromLink: false }; }
}
const $ = (id) => document.getElementById(id);
const money = (n) => '$' + n.toFixed(2);
let lastFocus = null;

function itemFor(id, quantity = 1) {
  const p = PRODUCTS[id];
  return { item_id: p.item_id, item_name: p.item_name, item_brand: p.item_brand, item_category: p.item_category, price: p.price, quantity };
}
function cartItems() { return cart.map(c => itemFor(c.item_id, c.quantity)); }
function cartValue() { return cartItems().reduce((s, i) => s + i.price * i.quantity, 0); }

function track(event, ecommerce, extra = {}) {
  if (ecommerce) window.dataLayer.push({ ecommerce: null }); // clear previous ecommerce object (Google's recommendation)
  window.dataLayer.push(Object.assign({ event }, ecommerce ? { ecommerce } : {}, extra));
}

function open(id) { lastFocus = document.activeElement; const o = $(id); o.hidden = false; o.querySelector('.close').focus(); }
function close(o) { o.hidden = true; if (lastFocus) lastFocus.focus(); }
document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o || e.target.hasAttribute('data-close')) close(o); });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.overlay:not([hidden])').forEach(close); });

// view_item: product details displayed
document.querySelectorAll('[data-action="details"]').forEach(btn => btn.addEventListener('click', () => {
  const id = btn.closest('.card').dataset.id;
  $('detailBody').innerHTML = PRODUCTS[id].detail + `<p><button class="btn" id="detailAdd">Add to bag</button></p>`;
  open('detailOverlay');
  track('view_item', { currency: 'USD', value: PRODUCTS[id].price, items: [itemFor(id)] });
  $('detailAdd').addEventListener('click', () => addToCart(id, $('detailAdd')));
  const t = $('tipsToggle');
  if (t) t.addEventListener('click', () => {
    const tips = $('tips'); const opening = tips.hidden; tips.hidden = !opening; t.setAttribute('aria-expanded', String(opening));
    if (opening) track('select_content', null, { content_type: 'layering_tips', content_id: id });
  });
}));

// add_to_cart: once per completed click
function addToCart(id, btn) {
  const line = cart.find(c => c.item_id === id);
  if (line) line.quantity += 1; else cart.push({ item_id: id, quantity: 1 });
  renderCart();
  track('add_to_cart', { currency: 'USD', value: PRODUCTS[id].price, items: [itemFor(id)] });
  showAdded(id, btn);
}
// QA-21 fix: visible + screen-reader confirmation after Add to bag
const toast = document.createElement('div');
toast.id = 'addedToast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
toast.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:9999;background:#1f1b16;color:#fff;padding:12px 16px;border-radius:10px;font:inherit;max-width:calc(100vw - 32px);box-shadow:0 4px 16px rgba(0,0,0,.2);opacity:0;transition:opacity .2s;pointer-events:none';
document.body.appendChild(toast);
let toastTimer;
function showAdded(id, btn) {
  const n = cart.reduce((s, c) => s + c.quantity, 0);
  toast.textContent = `Added to bag: ${PRODUCTS[id].item_brand} ${PRODUCTS[id].item_name}. Bag now has ${n} item${n === 1 ? '' : 's'}.`;
  toast.style.opacity = '1';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  if (btn) { const label = btn.textContent; btn.textContent = 'Added ✓'; setTimeout(() => { btn.textContent = label; }, 1200); }
}
document.querySelectorAll('[data-action="add"]').forEach(btn => btn.addEventListener('click', () => addToCart(btn.closest('.card').dataset.id, btn)));

function renderList(ul) {
  ul.innerHTML = cart.length ? cartItems().map(i => `<li><span>${i.item_brand} ${i.item_name} × ${i.quantity}</span><span>${money(i.price * i.quantity)}</span></li>`).join('')
                             : '<li><span class="muted">Your bag is empty.</span></li>';
}
function renderCart() {
  $('cartCount').textContent = cart.reduce((s, c) => s + c.quantity, 0);
  renderList($('cartList')); $('cartTotal').textContent = money(cartValue());
  $('checkoutBtn').disabled = cart.length === 0;
  saveCart();
}
$('openCart').addEventListener('click', () => { renderCart(); open('cartOverlay'); });

// begin_checkout
$('checkoutBtn').addEventListener('click', () => {
  if (!cart.length) return;
  close($('cartOverlay'));
  renderList($('coList')); $('coTotal').textContent = money(cartValue());
  open('checkoutOverlay');
  track('begin_checkout', { currency: 'USD', value: cartValue(), items: cartItems() });
});

// purchase: unique transaction_id; guarded so it can never fire twice for the same order
let orderInFlight = false;
$('placeOrder').addEventListener('click', () => {
  if (orderInFlight || !cart.length) return;
  orderInFlight = true; $('placeOrder').disabled = true;
  const txn = 'DEMO-' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const fired = JSON.parse(sessionStorage.getItem('firedTxns') || '[]');
  if (!fired.includes(txn)) {
    track('purchase', { transaction_id: txn, currency: 'USD', value: cartValue(), items: cartItems() });
    fired.push(txn); sessionStorage.setItem('firedTxns', JSON.stringify(fired));
  }
  $('txnId').textContent = txn;
  close($('checkoutOverlay')); open('confirmOverlay');
  cart.length = 0; renderCart();
  orderInFlight = false; $('placeOrder').disabled = false;
});

// sign_up: demo form; validates format, never stores or sends the email, never pushes it to the data layer
$('signupForm').addEventListener('submit', e => {
  e.preventDefault();
  const input = $('email');
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
  $('emailError').hidden = ok;
  input.setAttribute('aria-invalid', String(!ok));
  if (!ok) { input.focus(); return; }
  input.value = '';
  $('signupForm').hidden = true; $('signupSuccess').hidden = false;
  track('sign_up', null, { method: 'demo_form' });
});

// Restore the bag on load. A cart email link opens the bag straight away.
const restored = loadCart();
restored.lines.forEach(l => cart.push(l));
renderCart();
if (restored.fromLink) {
  if (restored.linkBroken) $('cartReminder').textContent = "We couldn't find the items from that link. Browse the three products below.";
  open('cartOverlay');
}
