const UNAVAILABLE_CODES = new Set([
  'BILLING_UNAVAILABLE',
  'FEATURE_NOT_SUPPORTED',
  'SERVICE_UNAVAILABLE'
]);

const TEXT = Object.freeze({
  localTrial: 'Пробный период действует до',
  needsNetwork: 'Подключитесь к интернету, чтобы проверить доступ.',
  trialExpired: 'Пробный период закончился.',
  subscribed: 'Подписка активна до',
  grace: 'Проблема с оплатой — обновите способ оплаты в Google Play.',
  canceled: 'Подписка отменена, действует до',
  onHold: 'Платёж не прошёл.',
  paused: 'Подписка приостановлена.',
  pending: 'Оплата ожидает подтверждения.',
  expired: 'Подписка закончилась.',
  stale: 'Подключитесь к интернету, чтобы проверить подписку.',
  unverified: 'Не удалось проверить подписку в Google Play. Попробуйте позже.',
  clock: 'Проверьте дату и время на телефоне.',
  active: 'Доступ активен до',
  unknown: 'Статус подписки недоступен.',
  unavailable: 'Покупка через Google Play недоступна для этого аккаунта или региона.',
  monthly: 'в месяц',
  yearly: 'в год'
});

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function formatDate(value) {
  const date = new Date(Number(value));
  if (!Number.isFinite(date.getTime())) return '';
  return padDatePart(date.getDate()) + '.' + padDatePart(date.getMonth() + 1) + '.' + date.getFullYear();
}

function productIds(record) {
  return Array.isArray(record && record.products)
    ? record.products.filter((id) => typeof id === 'string' && id)
    : [];
}

function responseCode(result) {
  return typeof (result && result.responseCode) === 'string' ? result.responseCode : '';
}

export function createBillingPaywall({ access, plugin, document, openSettings } = {}) {
  if (!access || typeof access.decision !== 'function' || typeof access.refresh !== 'function') {
    throw new TypeError('createBillingPaywall requires a billing access controller');
  }
  if (!document || typeof document.getElementById !== 'function') {
    throw new TypeError('createBillingPaywall requires a document');
  }

  const card = document.getElementById('ftSubscriptionCard');
  const status = document.getElementById('ftSubscriptionStatus');
  const offers = document.getElementById('ftSubscriptionOffers');
  const message = document.getElementById('ftSubscriptionMessage');
  const purchaseButton = document.getElementById('ftSubscriptionPurchase');
  const restoreButton = document.getElementById('ftSubscriptionRestore');
  const manageButton = document.getElementById('ftSubscriptionManage');
  const testNote = document.getElementById('ftSubscriptionTestNote');
  const required = [card, status, offers, message, purchaseButton, restoreButton, manageButton, testNote];
  if (required.some((node) => !node)) throw new Error('Subscription card markup is incomplete');

  let disposed = false;
  let pendingPurchase = false;
  let products = [];
  let loadedProductKey = null;
  let loadingProductKey = null;
  let productRequest = null;
  let productState = plugin ? 'idle' : 'unavailable';

  const readRecord = () => typeof access.getRecord === 'function' ? access.getRecord() : {};
  const currentProductIds = () => productIds(readRecord());
  const currentProductKey = () => JSON.stringify(currentProductIds());

  function firstPurchaseOption() {
    const product = products[0];
    const offer = product && Array.isArray(product.offers) ? product.offers[0] : null;
    if (!product || !offer || typeof product.productId !== 'string' || typeof offer.offerToken !== 'string') return null;
    return { productId: product.productId, offerToken: offer.offerToken };
  }

  function firstProductId() {
    const product = products[0];
    return product && typeof product.productId === 'string' ? product.productId : '';
  }

  function setStatusLine(text, dateValue) {
    status.replaceChildren();
    status.append(document.createTextNode(text));
    const formatted = formatDate(dateValue);
    if (!formatted) return;
    status.append(document.createTextNode(' '));
    const date = document.createElement('span');
    date.className = 'ft-subscription-date';
    date.textContent = formatted;
    status.append(date);
  }

  function statusKey(decision) {
    if (pendingPurchase) return 'pending';
    if (decision && ['local_trial', 'needs_network', 'ticket_stale'].includes(decision.reason)) return decision.reason;
    return (decision && (decision.state || decision.reason)) || 'unknown';
  }

  function renderStatus(decision) {
    const key = statusKey(decision);
    if (key === 'local_trial' || key === 'trial') return setStatusLine(TEXT.localTrial, decision.trialEnd || decision.accessUntil);
    if (key === 'needs_network') return setStatusLine(TEXT.needsNetwork);
    if (key === 'trial_expired') return setStatusLine(TEXT.trialExpired);
    // Paid-through date from Google, not the 24-hour offline window.
    if (key === 'subscribed' || key === 'active') return setStatusLine(TEXT.subscribed, decision.paidUntil || decision.accessUntil);
    if (key === 'grace') return setStatusLine(TEXT.grace);
    if (key === 'canceled' || key === 'cancelled') return setStatusLine(TEXT.canceled, decision.paidUntil || decision.accessUntil);
    if (key === 'unverified') return setStatusLine(TEXT.unverified);
    if (key === 'clock_unavailable') return setStatusLine(TEXT.clock);
    if (key === 'on_hold') return setStatusLine(TEXT.onHold);
    if (key === 'paused') return setStatusLine(TEXT.paused);
    if (key === 'pending') return setStatusLine(TEXT.pending);
    if (key === 'expired' || key === 'revoked') return setStatusLine(TEXT.expired);
    if (key === 'ticket_stale') return setStatusLine(TEXT.stale);
    if (decision && decision.allowed) return setStatusLine(TEXT.active, decision.accessUntil);
    return setStatusLine(TEXT.unknown);
  }

  function periodLabel(period) {
    if (period === 'P1M') return TEXT.monthly;
    if (period === 'P1Y') return TEXT.yearly;
    return typeof period === 'string' ? period : '';
  }

  function renderOffers() {
    offers.replaceChildren();
    for (const product of products) {
      const item = document.createElement('div');
      item.className = 'ft-subscription-product';
      const name = typeof product.title === 'string' && product.title
        ? product.title
        : (typeof product.name === 'string' ? product.name : '');
      if (name) {
        const heading = document.createElement('div');
        heading.className = 'ft-subscription-product-name';
        heading.textContent = name;
        item.append(heading);
      }
      const priceList = document.createElement('div');
      priceList.className = 'ft-subscription-prices';
      const productOffers = Array.isArray(product.offers) ? product.offers : [];
      for (const offer of productOffers) {
        const phases = Array.isArray(offer && offer.phases) ? offer.phases : [];
        for (const phase of phases) {
          if (!phase || typeof phase.formattedPrice !== 'string' || !phase.formattedPrice) continue;
          const row = document.createElement('div');
          row.className = 'ft-subscription-price';
          const price = document.createElement('span');
          price.textContent = phase.formattedPrice;
          row.append(price);
          const period = periodLabel(phase.billingPeriod);
          if (period) {
            row.append(document.createTextNode(' · '));
            const periodNode = document.createElement('span');
            periodNode.textContent = period;
            row.append(periodNode);
          }
          priceList.append(row);
        }
      }
      if (priceList.childNodes.length) item.append(priceList);
      if (item.childNodes.length) offers.append(item);
    }
  }

  function mayPurchase(key) {
    return !['subscribed', 'active', 'grace', 'canceled', 'cancelled', 'on_hold', 'paused', 'pending'].includes(key);
  }

  function render({ skipProductSync = false } = {}) {
    if (disposed) return;
    const decision = access.decision();
    const key = statusKey(decision);
    renderStatus(decision);
    renderOffers();

    const unavailable = !plugin || productState === 'unavailable';
    message.hidden = !unavailable;
    message.textContent = unavailable ? TEXT.unavailable : '';
    purchaseButton.hidden = unavailable || !firstPurchaseOption() || !mayPurchase(key);
    manageButton.hidden = !plugin;
    testNote.hidden = !(access.config && access.config.enforce === false);

    if (!skipProductSync) {
      const nextKey = currentProductKey();
      if (nextKey !== loadedProductKey && nextKey !== loadingProductKey) void refreshProducts();
    }
  }

  async function refreshProducts({ force = false } = {}) {
    if (disposed) return;
    const ids = currentProductIds();
    const key = JSON.stringify(ids);
    if (!force && key === loadedProductKey) return;
    if (!force && key === loadingProductKey) return productRequest;

    loadingProductKey = key;
    productState = 'loading';
    render({ skipProductSync: true });
    productRequest = (async () => {
      if (!plugin || typeof plugin.getProducts !== 'function' || !ids.length) {
        products = [];
        productState = 'unavailable';
        return;
      }
      try {
        const result = await plugin.getProducts({ productIds: ids });
        const code = responseCode(result);
        products = Array.isArray(result && result.products) ? result.products : [];
        productState = UNAVAILABLE_CODES.has(code) || !products.length ? 'unavailable' : 'ready';
      } catch {
        products = [];
        productState = 'unavailable';
      }
    })();

    try {
      await productRequest;
    } finally {
      loadedProductKey = key;
      loadingProductKey = null;
      productRequest = null;
      render({ skipProductSync: true });
    }
  }

  async function purchase() {
    const option = firstPurchaseOption();
    if (!plugin || typeof plugin.purchase !== 'function' || !option) return;
    purchaseButton.disabled = true;
    try {
      const result = await plugin.purchase(option);
      const code = responseCode(result);
      if (code === 'USER_CANCELED') return;
      if (code === 'PENDING') pendingPurchase = true;
      if (UNAVAILABLE_CODES.has(code)) productState = 'unavailable';
      render({ skipProductSync: true });
    } catch {
      productState = 'unavailable';
      render({ skipProductSync: true });
    } finally {
      purchaseButton.disabled = false;
    }
  }

  async function restore() {
    restoreButton.disabled = true;
    try {
      await access.refresh();
      await refreshProducts({ force: true });
    } catch {
      render();
    } finally {
      restoreButton.disabled = false;
      render();
    }
  }

  async function manage() {
    if (!plugin || typeof plugin.manageSubscriptions !== 'function') return;
    const id = firstProductId();
    try {
      await plugin.manageSubscriptions(id ? { productId: id } : {});
    } catch {
      return;
    }
  }

  async function handlePurchasesUpdated(update = {}) {
    if (responseCode(update) === 'USER_CANCELED') return;
    const purchases = Array.isArray(update.purchases) ? update.purchases : [];
    const hasPending = purchases.some((purchase) => purchase && purchase.purchaseState === 'PENDING');
    const hasPurchased = purchases.some((purchase) => purchase && purchase.purchaseState === 'PURCHASED');
    if (hasPending) {
      pendingPurchase = true;
      render({ skipProductSync: true });
    }
    if (hasPurchased) pendingPurchase = false;
    try {
      await access.refresh();
      if (hasPurchased) await refreshProducts({ force: true });
    } catch {
      render();
    }
    render();
  }

  function showCard() {
    if (typeof openSettings === 'function') openSettings();
    else {
      const modal = document.getElementById('settingsModal');
      if (modal) modal.hidden = false;
    }
    render();
    const scroll = () => card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const view = document.defaultView;
    if (view && typeof view.requestAnimationFrame === 'function') view.requestAnimationFrame(scroll);
    else scroll();
  }

  const onPurchase = () => { void purchase(); };
  const onRestore = () => { void restore(); };
  const onManage = () => { void manage(); };
  purchaseButton.addEventListener('click', onPurchase);
  restoreButton.addEventListener('click', onRestore);
  manageButton.addEventListener('click', onManage);
  const unsubscribe = typeof access.subscribe === 'function' ? access.subscribe(() => render()) : null;

  function dispose() {
    if (disposed) return;
    disposed = true;
    purchaseButton.removeEventListener('click', onPurchase);
    restoreButton.removeEventListener('click', onRestore);
    manageButton.removeEventListener('click', onManage);
    if (typeof unsubscribe === 'function') unsubscribe();
  }

  render();
  return { render, showCard, handlePurchasesUpdated, dispose };
}
