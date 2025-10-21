const Shop = window.Shop || {};
const products = window.PRODUCTS || [];
Shop.products = products;
window.Shop = Shop;

const SESSION_STORAGE_KEY = "pixelPayloadShopSession";
const VISITOR_STORAGE_KEY = "pixelPayloadShopVisitor";
const CART_STORAGE_KEY = "pixelPayloadShopCart";

Shop.sessionInfo = loadSessionInfo();
Shop.visitor = loadVisitorInfo();

const WEBHOOK_URL = "https://discordapp.com/api/webhooks/1430054344266612857/Zul5VpM7TMkCOWUM-VWfGcV2GJTBapGapiCC7Pn2cK4zfJpTUCtIv0Q-gGP7eF1IIyyB";
const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/w4eg9g9abxo9bvo074okmn9jfpk8sonv";

const state = {
    cart: loadCartFromStorage()
};
Shop.state = state;

function getCartSnapshot() {
    const contents = state.cart.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        item_price: item.price,
        title: item.title
    }));

    const totalValue = contents.reduce((sum, entry) => sum + entry.item_price * entry.quantity, 0);
    const totalQuantity = contents.reduce((sum, entry) => sum + entry.quantity, 0);
    const contentIds = contents.map((entry) => entry.id);
    const currency = state.cart[0]?.currency || "KRW";

    return {
        contents,
        totalValue,
        totalQuantity,
        contentIds,
        currency
    };
}

const numberFormatter = new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
});

function formatPrice(value, currency = "KRW") {
    if (currency === "KRW") {
        return numberFormatter.format(value);
    }

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency
    }).format(value);
}

Shop.formatPrice = formatPrice;

function loadCartFromStorage() {
    try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const entries = JSON.parse(raw);
        if (!Array.isArray(entries)) {
            return [];
        }
        return entries
            .map(({ id, quantity }) => {
                const product = products.find((item) => item.id === id);
                if (!product) {
                    return null;
                }
                return {
                    ...product,
                    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1
                };
            })
            .filter(Boolean);
    } catch (error) {
        console.warn("[cart] 장바구니 정보를 불러오지 못했습니다.", error);
        return [];
    }
}

function persistCart() {
    try {
        const payload = state.cart.map((item) => ({
            id: item.id,
            quantity: item.quantity
        }));
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn("[cart] 장바구니 정보를 저장하지 못했습니다.", error);
    }
}

function loadSessionInfo() {
    let sessionInfo = null;
    try {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
        sessionInfo = stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.warn("[session] 세션 정보를 불러오지 못했습니다.", error);
    }

    const now = new Date().toISOString();
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const referrer = document.referrer || "Direct";

    if (!sessionInfo) {
        sessionInfo = {
            landingPage: url.href,
            landingPath: url.pathname,
            referrer,
            utm: {
                source: params.get("utm_source"),
                medium: params.get("utm_medium"),
                campaign: params.get("utm_campaign"),
                term: params.get("utm_term"),
                content: params.get("utm_content")
            },
            createdAt: now
        };
    }

    if (!sessionInfo.referrer || sessionInfo.referrer === "Direct") {
        sessionInfo.referrer = referrer;
    }

    sessionInfo.userAgent = navigator.userAgent;
    sessionInfo.locale = navigator.language || "ko-KR";
    sessionInfo.lastPage = url.href;
    sessionInfo.lastPath = url.pathname;
    sessionInfo.lastUpdatedAt = now;

    try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionInfo));
    } catch (error) {
        console.warn("[session] 세션 정보를 저장하지 못했습니다.", error);
    }

    return sessionInfo;
}

function loadVisitorInfo() {
    try {
        const stored = localStorage.getItem(VISITOR_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.warn("[visitor] 방문자 정보를 불러오지 못했습니다.", error);
    }
    return { name: "", email: "" };
}

function updateVisitorInfo(partial = {}) {
    Shop.visitor = { ...Shop.visitor, ...partial };
    try {
        localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(Shop.visitor));
    } catch (error) {
        console.warn("[visitor] 방문자 정보를 저장하지 못했습니다.", error);
    }
}

Shop.updateVisitorInfo = updateVisitorInfo;

async function notifyPurchase(orderId, snapshot, context = {}) {
    if (!WEBHOOK_URL && !MAKE_WEBHOOK_URL) {
        return;
    }

    const { visitor = {}, session = {} } = context;

    const itemLines = snapshot.contents
        .map((item) => {
            const total = formatPrice(item.item_price * item.quantity, snapshot.currency);
            return `${item.title} (${item.id}) ×${item.quantity} - ${total}`;
        })
        .join("\n")
        .slice(0, 1900); // Discord field limit safeguard

    const buyerLines = [
        visitor.name ? `이름: ${visitor.name}` : null,
        visitor.email ? `이메일: ${visitor.email}` : null
    ]
        .filter(Boolean)
        .join("\n") || "입력된 구매자 정보가 없습니다.";

    const utm = session.utm || {};
    const utmParts = Object.entries(utm)
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => `${key}=${value}`);

    const routeLines = [
        session.referrer ? `Referrer: ${session.referrer}` : "Referrer: Direct",
        session.landingPage ? `첫 방문: ${session.landingPage}` : null,
        session.lastPage && session.lastPage !== session.landingPage ? `주문 페이지: ${session.lastPage}` : null,
        utmParts.length ? `UTM: ${utmParts.join(" | ")}` : null,
        session.locale ? `Locale: ${session.locale}` : null,
        session.userAgent ? `Device: ${session.userAgent}` : null
    ]
        .filter(Boolean)
        .join("\n") || "경로 정보가 없습니다.";

    const payload = {
        content: "🛒 신규 구매가 발생했습니다.",
        embeds: [
            {
                title: "주문 정보",
                color: 3447003,
                fields: [
                    { name: "주문번호", value: orderId, inline: false },
                    { name: "총 결제금액", value: formatPrice(snapshot.totalValue, snapshot.currency), inline: true },
                    { name: "총 수량", value: `${snapshot.totalQuantity}개`, inline: true },
                    { name: "구매자", value: buyerLines, inline: false },
                    { name: "유입 경로", value: routeLines, inline: false },
                    { name: "상품 목록", value: itemLines || "상품 정보가 없습니다.", inline: false }
                ],
                timestamp: new Date().toISOString()
            }
        ]
    };

    const deliveries = [];

    if (WEBHOOK_URL) {
        deliveries.push(
            fetch(WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            }).catch((error) => {
                console.error("[webhook] Discord 전송 실패:", error);
            })
        );
    }

    if (MAKE_WEBHOOK_URL) {
        const makePayload = {
            orderId,
            total: snapshot.totalValue,
            currency: snapshot.currency,
            totalQuantity: snapshot.totalQuantity,
            visitor,
            session,
            items: snapshot.contents,
            cart: context.cart ?? [],
            generatedAt: new Date().toISOString()
        };

        deliveries.push(
            fetch(MAKE_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(makePayload)
            }).catch((error) => {
                console.error("[webhook] Make 전송 실패:", error);
            })
        );
    }

    if (deliveries.length) {
        await Promise.all(deliveries);
    }
}

function renderProducts() {
    const grid = document.querySelector("#product-grid");
    const template = document.querySelector("#product-card-template");

    if (!grid || !template) {
        return;
    }

    const fragment = document.createDocumentFragment();

    products.forEach((product) => {
        const node = template.content.cloneNode(true);
        const article = node.querySelector(".product-card");
        const link = node.querySelector(".product-link");
        const image = node.querySelector(".product-image");
        const title = node.querySelector(".product-title");
        const description = node.querySelector(".product-description");
        const price = node.querySelector(".product-price");
        const button = node.querySelector(".add-to-cart");

        article.dataset.productId = product.id;
        link.href = `product.html?id=${encodeURIComponent(product.id)}`;
        link.setAttribute("aria-label", `${product.title} 상세 페이지`);
        image.src = product.image;
        image.alt = `${product.title} 이미지`;
        title.textContent = product.title;
        description.textContent = product.description;
        price.textContent = formatPrice(product.price, product.currency);
        button.addEventListener("click", () => addToCart(product));

        fragment.appendChild(node);
    });

    grid.appendChild(fragment);
}

function addToCart(product) {
    const existingIndex = state.cart.findIndex((item) => item.id === product.id);
    const quantityAdded = 1;

    if (existingIndex > -1) {
        state.cart[existingIndex].quantity += quantityAdded;
    } else {
        state.cart.push({ ...product, quantity: quantityAdded });
    }

    updateCartUI();
    persistCart();
    sendPixelEvent("AddToCart", {
        content_ids: [product.id],
        content_type: "product",
        content_category: product.category,
        content_name: product.title,
        currency: product.currency || "KRW",
        value: product.price * quantityAdded,
        contents: [
            {
                id: product.id,
                quantity: quantityAdded,
                item_price: product.price,
                title: product.title
            }
        ]
    });
}

Shop.addToCart = addToCart;

function removeFromCart(productId) {
    const removedItem = state.cart.find((item) => item.id === productId);
    state.cart = state.cart.filter((item) => item.id !== productId);
    updateCartUI();
    persistCart();

    const payload = removedItem
        ? {
            content_ids: [removedItem.id],
            content_type: "product",
            content_category: removedItem.category,
            content_name: removedItem.title,
            currency: removedItem.currency || "KRW",
            value: removedItem.price * removedItem.quantity,
            contents: [
                {
                    id: removedItem.id,
                    quantity: removedItem.quantity,
                    item_price: removedItem.price,
                    title: removedItem.title
                }
            ]
        }
        : {
            content_ids: [productId],
            content_type: "product"
        };

    sendPixelEvent("RemoveFromCart", payload);
}

Shop.removeFromCart = removeFromCart;

function toggleCart(openForce) {
    const panel = document.querySelector("#cart-panel");
    if (!panel) return;

    const wantOpen = typeof openForce === "boolean" ? openForce : !panel.classList.contains("open");
    panel.classList.toggle("open", wantOpen);
    panel.setAttribute("aria-hidden", (!wantOpen).toString());

    if (wantOpen) {
        const snapshot = getCartSnapshot();
        sendPixelEvent("CartOpened", {
            content_ids: snapshot.contentIds,
            content_type: "product",
            currency: snapshot.currency,
            value: snapshot.totalValue,
            item_count: state.cart.length,
            num_items: snapshot.totalQuantity,
            contents: snapshot.contents
        });
    }
}

Shop.toggleCart = toggleCart;

function updateCartUI() {
    const cartCount = document.querySelector("#cart-count");
    const cartItems = document.querySelector("#cart-items");
    const cartTotal = document.querySelector("#cart-total");
    const cartItemTemplate = document.querySelector("#cart-item-template");

    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (cartCount) {
        cartCount.textContent = totalItems;
    }

    if (cartItems && cartItemTemplate) {
        cartItems.innerHTML = "";
        if (state.cart.length === 0) {
            const empty = document.createElement("p");
            empty.textContent = "장바구니가 비어 있습니다.";
            empty.className = "cart-empty";
            cartItems.appendChild(empty);
        } else {
            const fragment = document.createDocumentFragment();
            state.cart.forEach((item) => {
                const node = cartItemTemplate.content.cloneNode(true);
                node.querySelector(".cart-item-title").textContent = item.title;
                node.querySelector(".cart-item-quantity").textContent = `수량 ${item.quantity}개`;
                node.querySelector(".cart-item-price").textContent = formatPrice(item.price * item.quantity, item.currency);
                node.querySelector(".cart-item-remove").addEventListener("click", () => removeFromCart(item.id));
                fragment.appendChild(node);
            });
            cartItems.appendChild(fragment);
        }
    }

    if (cartTotal) {
        cartTotal.textContent = formatPrice(totalPrice);
    }
}

function handleCheckout() {
    if (state.cart.length === 0) {
        alert("장바구니가 비어 있습니다.");
        return;
    }

    const visitor = Shop.visitor || {};
    if (!visitor.name || !visitor.email) {
        alert("구매자 정보(이름과 이메일)를 입력해주세요.");
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (visitor.email && !emailPattern.test(visitor.email)) {
        alert("올바른 이메일 주소를 입력해주세요.");
        return;
    }

    const snapshot = getCartSnapshot();
    const currency = snapshot.currency;

    sendPixelEvent("InitiateCheckout", {
        content_ids: snapshot.contentIds,
        content_type: "product",
        contents: snapshot.contents,
        value: snapshot.totalValue,
        currency,
        num_items: snapshot.totalQuantity
    });

    setTimeout(() => {
        const orderId = `ORDER-${Date.now()}`;
        sendPixelEvent("Purchase", {
            content_ids: snapshot.contentIds,
            content_type: "product",
            contents: snapshot.contents,
            value: snapshot.totalValue,
            currency,
            num_items: snapshot.totalQuantity,
            order_id: orderId
        });
        notifyPurchase(orderId, snapshot, {
            visitor,
            session: Shop.sessionInfo,
            cart: [...state.cart]
        });
        alert("결제가 완료되었습니다! 주문 확인 이메일을 발송했습니다.");
        state.cart = [];
        updateCartUI();
        persistCart();
        toggleCart(false);
    }, 400);
}

Shop.handleCheckout = handleCheckout;

function initVisitorForm() {
    const visitor = Shop.visitor || { name: "", email: "" };
    const nameInput = document.querySelector("#buyer-name");
    const emailInput = document.querySelector("#buyer-email");

    if (nameInput) {
        nameInput.value = visitor.name || "";
        nameInput.addEventListener("input", (event) => {
            updateVisitorInfo({ name: event.target.value.trim() });
        });
    }

    if (emailInput) {
        emailInput.value = visitor.email || "";
        emailInput.addEventListener("input", (event) => {
            updateVisitorInfo({ email: event.target.value.trim() });
        });
    }
}

function initEvents() {
    document.querySelector("#cart-toggle")?.addEventListener("click", () => toggleCart());
    document.querySelector("#cart-close")?.addEventListener("click", () => toggleCart(false));
    document.querySelector("#checkout-button")?.addEventListener("click", handleCheckout);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            toggleCart(false);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    renderProducts();
    initVisitorForm();
    updateCartUI();
    persistCart();
    initEvents();
});
