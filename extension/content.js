(function () {
  const ENHANCED_ATTR = "data-flightdeal-enhanced";
  const STYLE_ID = "flightdeal-extension-style";

  function readData(element, key) {
    return (
      element.dataset?.[key] ??
      element.getAttribute(`data-${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`)
    );
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .flightdeal-badge {
        margin-top: 8px;
        padding: 8px 10px;
        border-radius: 999px;
        border: 1px solid rgba(13, 107, 95, 0.22);
        background: rgba(255, 251, 243, 0.98);
        color: #15543d;
        font: 600 12px/1.2 "Trebuchet MS", sans-serif;
        cursor: pointer;
      }

      .flightdeal-panel {
        margin-top: 8px;
        padding: 12px;
        border-radius: 14px;
        border: 1px solid rgba(31, 36, 31, 0.12);
        background: rgba(255, 251, 243, 0.98);
        color: #1f241f;
        font: 14px/1.4 Georgia, serif;
      }

      .flightdeal-panel strong,
      .flightdeal-panel b {
        font-family: "Trebuchet MS", sans-serif;
      }

      .flightdeal-panel__muted {
        color: #5d6158;
      }

      .flightdeal-panel__title {
        margin-bottom: 6px;
        font: 700 12px/1 "Trebuchet MS", sans-serif;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #15543d;
      }
    `;
    document.head.appendChild(style);
  }

  function findCards() {
    const explicit = Array.from(document.querySelectorAll("[data-flightdeal-role='result-card']"));

    if (explicit.length > 0) {
      return explicit;
    }

    return Array.from(
      document.querySelectorAll("main [role='button'], main [role='listitem']"),
    ).filter((element) => {
      const text = element.textContent ?? "";
      return /\bnonstop\b|\bstop\b/i.test(text) && /\d/.test(text);
    });
  }

  function extractSearchContext() {
    const explicit = document.querySelector("[data-flightdeal-role='search-context']");

    if (explicit) {
      return {
        origin: readData(explicit, "origin"),
        destination: readData(explicit, "destination"),
        departureDate: readData(explicit, "departureDate"),
        cabin: readData(explicit, "cabin"),
      };
    }

    const rootText = document.body.textContent ?? "";
    const routeMatch = rootText.match(/\b([A-Z]{3})\s*(?:to|→|-)\s*([A-Z]{3})\b/);
    const cabinMatch = rootText.match(/\b(economy|premium economy|business|first)\b/i);
    const departureDate = document
      .querySelector("[data-flightdeal-departure-date]")
      ?.getAttribute("data-flightdeal-departure-date");

    if (!routeMatch || !departureDate) {
      return null;
    }

    return {
      origin: routeMatch[1],
      destination: routeMatch[2],
      departureDate,
      cabin: cabinMatch ? cabinMatch[1].toLowerCase().replace(/\s+/g, "_") : undefined,
    };
  }

  function extractFingerprint(card) {
    const detailId = card.getAttribute("data-flightdeal-detail-id");
    const detailRoot =
      (detailId && document.querySelector(`[data-flightdeal-detail="${detailId}"]`)) ||
      document.querySelector("[data-flightdeal-detail='active']");
    const segmentNodes = [
      ...card.querySelectorAll("[data-flightdeal-role='segment']"),
      ...(detailRoot ? detailRoot.querySelectorAll("[data-flightdeal-role='segment']") : []),
    ];
    const segments = segmentNodes
      .map((segment) => ({
        marketingCarrier: readData(segment, "marketingCarrier"),
        operatingCarrier: readData(segment, "operatingCarrier") || null,
        flightNumber: readData(segment, "flightNumber"),
        originAirport: readData(segment, "originAirport"),
        destinationAirport: readData(segment, "destinationAirport"),
        departureTime: readData(segment, "departureTime"),
        arrivalTime: readData(segment, "arrivalTime") || null,
      }))
      .filter(
        (segment) =>
          segment.marketingCarrier &&
          segment.flightNumber &&
          segment.originAirport &&
          segment.destinationAirport &&
          segment.departureTime,
      );

    if (segments.length === 0) {
      return null;
    }

    return {
      segmentCount: segments.length,
      stopCount: Math.max(0, segments.length - 1),
      segments,
    };
  }

  function renderMatchedAwards(panel, result) {
    if (result.matchStatus === "insufficient_identity") {
      panel.innerHTML = `
        <div class="flightdeal-panel__title">FlightDeal</div>
        <div class="flightdeal-panel__muted">Open itinerary details to resolve an exact match.</div>
      `;
      return;
    }

    if (result.matchStatus === "no_match" || result.matchedAwards.length === 0) {
      panel.innerHTML = `
        <div class="flightdeal-panel__title">FlightDeal</div>
        <div>No exact award match found.</div>
      `;
      return;
    }

    const best = result.matchedAwards[0];
    const fundingPath =
      best.bestFundingPath?.parts
        .map((part) => `${part.amount}${part.currency === "amex_mr" ? " Amex" : " Chase"}`)
        .join(" + ") ?? "Not fundable";

    panel.innerHTML = `
      <div class="flightdeal-panel__title">FlightDeal</div>
      <div><strong>${best.milesPrice.toLocaleString()} ${best.pricingProgramDisplay || best.sourceProgram}</strong> + $${best.taxesUsd}</div>
      <div class="flightdeal-panel__muted">${best.reachable ? "Reachable" : "Unreachable"} · ${fundingPath}</div>
      <div class="flightdeal-panel__muted">${best.explanations[0] || "Exact itinerary match."}</div>
    `;
  }

  async function handleBadgeClick(card, badge, panel) {
    badge.disabled = true;
    badge.textContent = "Checking exact award match…";

    try {
      const searchContext = extractSearchContext();
      const itineraryFingerprint = extractFingerprint(card);

      if (!searchContext || !itineraryFingerprint) {
        renderMatchedAwards(panel, {
          matchStatus: "insufficient_identity",
          matchedAwards: [],
        });
        return;
      }

      const response = await chrome.runtime.sendMessage({
        type: "flightdeal.match-awards",
        payload: {
          searchContext,
          itineraryFingerprint,
        },
      });

      if (!response?.ok) {
        throw new Error(response?.error || "FlightDeal extension request failed.");
      }

      renderMatchedAwards(panel, response.result);
    } catch (error) {
      panel.innerHTML = `
        <div class="flightdeal-panel__title">FlightDeal</div>
        <div class="flightdeal-panel__muted">${
          error instanceof Error ? error.message : "Unexpected extension error."
        }</div>
      `;
    } finally {
      badge.disabled = false;
      badge.textContent = "Check exact award options";
    }
  }

  function enhanceCard(card) {
    if (card.getAttribute(ENHANCED_ATTR) === "true") {
      return;
    }

    card.setAttribute(ENHANCED_ATTR, "true");
    card.style.position = card.style.position || "relative";

    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = "flightdeal-badge";
    badge.textContent = "Check exact award options";

    const panel = document.createElement("div");
    panel.className = "flightdeal-panel";
    panel.hidden = true;

    badge.addEventListener("click", () => {
      panel.hidden = false;
      handleBadgeClick(card, badge, panel);
    });

    card.appendChild(badge);
    card.appendChild(panel);
  }

  function scan() {
    ensureStyles();
    findCards().forEach((card) => enhanceCard(card));
  }

  const observer = new MutationObserver(() => scan());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
