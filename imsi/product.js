const CATEGORY_LABELS = {
    home: "홈 데코",
    living: "리빙",
    kitchen: "키친",
    audio: "오디오",
    bedroom: "침실"
};

function formatCurrency(value, currency = "KRW") {
    if (typeof window.Shop?.formatPrice === "function") {
        return window.Shop.formatPrice(value, currency);
    }

    try {
        return new Intl.NumberFormat("ko-KR", {
            style: "currency",
            currency,
            maximumFractionDigits: 0
        }).format(value);
    } catch {
        return `${currency} ${value}`;
    }
}

function selectProduct(productId) {
    const catalog = window.Shop?.products || window.PRODUCTS || [];
    return catalog.find((item) => item.id === productId);
}

function populateHighlights(listEl, highlights = []) {
    if (!listEl) return;
    listEl.innerHTML = "";

    if (!Array.isArray(highlights) || highlights.length === 0) {
        const fallback = document.createElement("li");
        fallback.textContent = "제품 정보를 준비 중입니다.";
        listEl.appendChild(fallback);
        return;
    }

    const fragment = document.createDocumentFragment();
    highlights.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        fragment.appendChild(li);
    });
    listEl.appendChild(fragment);
}

function setHeroImage(imageEl, source, title) {
    if (!imageEl) return;
    imageEl.src = source;
    imageEl.alt = `${title} 이미지`;
}

function populateGallery(product) {
    const heroImage = document.querySelector("#detail-image");
    const thumbnailsEl = document.querySelector("#detail-thumbnails");

    if (!heroImage || !thumbnailsEl) {
        return;
    }

    const gallerySources = Array.from(
        new Set([product.image, ...(product.gallery || [])].filter(Boolean))
    );

    if (gallerySources.length === 0) {
        setHeroImage(heroImage, product.image, product.title);
        thumbnailsEl.innerHTML = "";
        return;
    }

    setHeroImage(heroImage, gallerySources[0], product.title);
    thumbnailsEl.innerHTML = "";

    const fragment = document.createDocumentFragment();

    gallerySources.forEach((src, index) => {
        const button = document.createElement("button");
        const thumb = document.createElement("img");
        button.type = "button";
        button.className = index === 0 ? "active" : "";
        thumb.src = src;
        thumb.alt = `${product.title} 썸네일 ${index + 1}`;
        button.appendChild(thumb);
        button.addEventListener("click", () => {
            setHeroImage(heroImage, src, product.title);
            thumbnailsEl
                .querySelectorAll("button")
                .forEach((node) => node.classList.remove("active"));
            button.classList.add("active");
        });
        fragment.appendChild(button);
    });

    thumbnailsEl.appendChild(fragment);
}

function setStarRating(element, ratingValue) {
    if (!element) return;
    const clamped = Math.max(0, Math.min(5, ratingValue || 0));
    const percentage = ((clamped / 5) * 100).toFixed(2);
    element.style.setProperty("--rating-percent", `${percentage}%`);
}

function renderRating(product) {
    const average = typeof product.rating === "number" ? product.rating : 0;
    const reviewCount = product.reviewCount ?? (product.reviews?.length ?? 0);

    const detailStars = document.querySelector("#detail-rating-stars");
    const reviewStars = document.querySelector("#review-rating-stars");
    const detailValueEl = document.querySelector("#detail-rating-value");
    const detailCountEl = document.querySelector("#detail-review-count");
    const reviewAverageEl = document.querySelector("#review-average");
    const reviewCountEl = document.querySelector("#review-count-summary");

    setStarRating(detailStars, average);
    setStarRating(reviewStars, average);

    const formattedCount = reviewCount.toLocaleString("ko-KR");
    if (detailValueEl) detailValueEl.textContent = average.toFixed(1);
    if (detailCountEl) detailCountEl.textContent = `${formattedCount}개의 리뷰`;
    if (reviewAverageEl) reviewAverageEl.textContent = average.toFixed(1);
    if (reviewCountEl) reviewCountEl.textContent = `${formattedCount}명 평가`;
}

function renderStory(product) {
    const introImage = document.querySelector("#detail-intro-image");
    const longDescription = document.querySelector("#detail-long-description");

    if (introImage) {
        const source = product.introImage || product.image;
        introImage.src = source;
        introImage.alt = `${product.title} 소개 이미지`;
    }

    if (longDescription) {
        longDescription.textContent = product.longDescription || product.description;
    }
}

function formatReviewDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleDateString("ko-KR");
}

function renderReviews(product) {
    const listEl = document.querySelector("#review-list");
    if (!listEl) return;

    const reviews = Array.isArray(product.reviews) ? product.reviews : [];
    listEl.innerHTML = "";

    if (reviews.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "아직 등록된 리뷰가 없습니다. 첫 번째 구매 후 후기를 남겨보세요!";
        listEl.appendChild(empty);
        return;
    }

    const fragment = document.createDocumentFragment();
    reviews.slice(0, 6).forEach((review) => {
        const card = document.createElement("article");
        card.className = "review-card";

        const header = document.createElement("div");
        header.className = "review-card-header";

        const titleWrapper = document.createElement("div");
        const nameEl = document.createElement("span");
        nameEl.className = "review-card-name";
        nameEl.textContent = review.user;
        const dateEl = document.createElement("span");
        dateEl.className = "review-card-date";
        dateEl.textContent = formatReviewDate(review.date);
        titleWrapper.appendChild(nameEl);
        titleWrapper.appendChild(dateEl);

        const starWrapper = document.createElement("div");
        starWrapper.className = "review-card-rating";
        const stars = document.createElement("span");
        stars.className = "rating-stars";
        setStarRating(stars, review.rating);
        starWrapper.appendChild(stars);

        header.appendChild(titleWrapper);
        header.appendChild(starWrapper);

        const commentEl = document.createElement("p");
        commentEl.className = "review-card-comment";
        commentEl.textContent = review.comment;

        card.appendChild(header);
        card.appendChild(commentEl);
        fragment.appendChild(card);
    });

    listEl.appendChild(fragment);
}

function renderProductDetail(product) {
    const titleEl = document.querySelector("#detail-title");
    const descEl = document.querySelector("#detail-description");
    const priceEl = document.querySelector("#detail-price");
    const categoryEl = document.querySelector("#detail-category");
    const breadcrumb = document.querySelector("#breadcrumb-current");
    const highlightsEl = document.querySelector("#detail-highlights");

    if (titleEl) titleEl.textContent = product.title;
    if (descEl) descEl.textContent = product.description;
    if (priceEl) priceEl.textContent = formatCurrency(product.price, product.currency);
    if (categoryEl) categoryEl.textContent = CATEGORY_LABELS[product.category] || product.category;
    if (breadcrumb) breadcrumb.textContent = product.title;

    populateHighlights(highlightsEl, product.highlights);
    populateGallery(product);
    renderRating(product);
    renderStory(product);
    renderReviews(product);
}

function renderRelatedProducts(currentProductId) {
    const grid = document.querySelector("#related-grid");
    const template = document.querySelector("#product-card-template");
    const catalog = window.Shop?.products || window.PRODUCTS || [];

    if (!grid || !template) return;

    grid.innerHTML = "";
    const candidates = catalog.filter((item) => item.id !== currentProductId);
    if (candidates.length === 0) {
        grid.innerHTML = "<p>함께 보면 좋은 다른 상품이 없습니다.</p>";
        return;
    }

    const recommended = candidates.sort(() => Math.random() - 0.5).slice(0, 3);

    const fragment = document.createDocumentFragment();
    recommended.forEach((product) => {
        const node = template.content.cloneNode(true);
        const article = node.querySelector(".product-card");
        const link = node.querySelector(".product-link");
        const image = node.querySelector(".product-image");
        const title = node.querySelector(".product-title");
        const description = node.querySelector(".product-description");
        const price = node.querySelector(".product-price");
        const button = node.querySelector(".add-to-cart");

        if (article) article.dataset.productId = product.id;
        if (link) {
            link.href = `product.html?id=${encodeURIComponent(product.id)}`;
            link.setAttribute("aria-label", `${product.title} 상세 페이지`);
        }
        if (image) {
            image.src = product.image;
            image.alt = `${product.title} 이미지`;
        }
        if (title) title.textContent = product.title;
        if (description) description.textContent = product.description;
        if (price) price.textContent = formatCurrency(product.price, product.currency);
        if (button) {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                window.Shop?.addToCart?.(product);
                window.Shop?.toggleCart?.(true);
            });
        }

        fragment.appendChild(node);
    });

    grid.appendChild(fragment);
}

function showNotFound() {
    const content = document.querySelector("#detail-content");
    const error = document.querySelector("#detail-error");
    const story = document.querySelector(".product-story");
    const reviews = document.querySelector(".product-reviews");
    const related = document.querySelector(".related-products");

    if (content) content.hidden = true;
    if (error) error.hidden = false;
    if (story) story.hidden = true;
    if (reviews) reviews.hidden = true;
    if (related) related.hidden = true;
}

function trackViewContent(product) {
    if (typeof window.sendPixelEvent === "function") {
        window.sendPixelEvent("ViewContent", {
            content_ids: [product.id],
            content_type: "product",
            content_category: product.category,
            content_name: product.title,
            value: product.price,
            currency: product.currency || "KRW"
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get("id");
    const product = selectProduct(productId);

    if (!product) {
        showNotFound();
        return;
    }

    document.title = `${product.title} | Pixel Payload Shop`;
    renderProductDetail(product);
    renderRelatedProducts(product.id);
    trackViewContent(product);

    document.querySelector("#detail-add-to-cart")?.addEventListener("click", () => {
        window.Shop?.addToCart?.(product);
        window.Shop?.toggleCart?.(true);
    });

    document.querySelector("#detail-go-to-cart")?.addEventListener("click", () => {
        window.Shop?.toggleCart?.(true);
    });
});
