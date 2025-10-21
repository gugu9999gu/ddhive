/**
 * Meta Pixel integration helper with optional fallback payload delivery.
 */
const pixelConfig = {
    debug: true,
    /**
     * Set the following if you still want to relay events to a custom endpoint.
     * fallbackEndpoint: "https://pixel.example.com/collect",
     * fallbackSiteId: "PIXEL-DEMO-001"
     */
    fallbackEndpoint: null,
    fallbackSiteId: null
};

const STANDARD_EVENTS = new Set(["PageView", "AddToCart", "InitiateCheckout", "Purchase"]);

function cleanPayload(payload) {
    if (!payload || typeof payload !== "object") {
        return {};
    }

    return Object.entries(payload).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
            acc[key] = value;
        }
        return acc;
    }, {});
}

function deliverToMetaPixel(eventName, payload) {
    if (typeof window === "undefined" || typeof window.fbq !== "function") {
        return false;
    }

    const cleaned = cleanPayload(payload);

    try {
        if (STANDARD_EVENTS.has(eventName)) {
            window.fbq("track", eventName, cleaned);
        } else {
            window.fbq("trackCustom", eventName, cleaned);
        }
        return true;
    } catch (error) {
        if (pixelConfig.debug) {
            console.error(`[pixel] Meta Pixel delivery failed: ${eventName}`, error);
        }
        return false;
    }
}

async function deliverToFallback(eventName, payload) {
    if (!pixelConfig.fallbackEndpoint || typeof window === "undefined") {
        return false;
    }

    const globalNavigator = window.navigator || {};
    const eventPayload = {
        event: eventName,
        siteId: pixelConfig.fallbackSiteId,
        timestamp: new Date().toISOString(),
        userAgent: globalNavigator.userAgent,
        locale: globalNavigator.language || "ko-KR",
        ...cleanPayload(payload)
    };

    const body = JSON.stringify(eventPayload);

    if (typeof globalNavigator.sendBeacon === "function") {
        const delivered = globalNavigator.sendBeacon(pixelConfig.fallbackEndpoint, body);
        if (delivered) {
            return true;
        }
    }

    try {
        await fetch(pixelConfig.fallbackEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body
        });
        return true;
    } catch (error) {
        if (pixelConfig.debug) {
            console.error(`[pixel] Fallback delivery failed: ${eventName}`, error);
        }
        return false;
    }
}

async function sendPixelEvent(eventName, payload = {}) {
    if (!eventName) {
        if (pixelConfig.debug) {
            console.warn("[pixel] Event name is required.");
        }
        return;
    }

    const cleanedPayload = cleanPayload(payload);
    const metaDelivered = deliverToMetaPixel(eventName, cleanedPayload);
    let fallbackDelivered = false;

    if (!metaDelivered) {
        fallbackDelivered = await deliverToFallback(eventName, cleanedPayload);
    } else if (pixelConfig.fallbackEndpoint) {
        // Fire-and-forget relay to fallback endpoint when configured.
        deliverToFallback(eventName, cleanedPayload);
    }

    if (pixelConfig.debug) {
        console.info(`[pixel] ${eventName}`, {
            metaDelivered,
            fallbackDelivered,
            payload: cleanedPayload
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    sendPixelEvent("PageView", {
        path: window.location.pathname,
        referrer: document.referrer || null
    });
});

window.sendPixelEvent = sendPixelEvent;
