import type {
  Cabin,
  ExtensionSearchContext,
  FlightSegmentFingerprint,
  PageItineraryFingerprint,
} from "@/lib/domain/types";

const CABIN_REGEX = /\b(economy|premium economy|business|first)\b/i;
const AIRPORT_PAIR_REGEX = /\b([A-Z]{3})\s*(?:to|→|-)\s*([A-Z]{3})\b/;

function normalizeCabin(value: string): Cabin | null {
  const normalized = value.toLowerCase().trim().replace(/\s+/g, "_");

  if (normalized === "premium_economy") {
    return "premium_economy";
  }

  if (normalized === "economy" || normalized === "business" || normalized === "first") {
    return normalized;
  }

  return null;
}

function readDataset(element: HTMLElement, key: string) {
  return element.dataset[key] ?? element.getAttribute(`data-${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`);
}

function extractSegmentFromNode(node: HTMLElement): FlightSegmentFingerprint | null {
  const marketingCarrier = readDataset(node, "marketingCarrier") ?? "";
  const operatingCarrier = readDataset(node, "operatingCarrier");
  const flightNumber = readDataset(node, "flightNumber") ?? "";
  const originAirport = readDataset(node, "originAirport") ?? "";
  const destinationAirport = readDataset(node, "destinationAirport") ?? "";
  const departureTime = readDataset(node, "departureTime") ?? "";
  const arrivalTime = readDataset(node, "arrivalTime");

  if (!marketingCarrier || !flightNumber || !originAirport || !destinationAirport || !departureTime) {
    return null;
  }

  return {
    marketingCarrier,
    operatingCarrier: operatingCarrier ?? null,
    flightNumber,
    originAirport,
    destinationAirport,
    departureTime,
    arrivalTime: arrivalTime ?? null,
  };
}

function detailRootForCard(card: HTMLElement, root: ParentNode) {
  const directDetailId = card.getAttribute("data-flightdeal-detail-id");

  if (directDetailId && "querySelector" in root) {
    const linked = root.querySelector<HTMLElement>(`[data-flightdeal-detail="${directDetailId}"]`);

    if (linked) {
      return linked;
    }
  }

  return card.closest<HTMLElement>("[data-flightdeal-detail]") ?? root.querySelector?.("[data-flightdeal-detail='active']") ?? null;
}

export function findGoogleFlightsResultCards(root: ParentNode) {
  const cards = Array.from(
    root.querySelectorAll<HTMLElement>(
      "[data-flightdeal-role='result-card'], main [role='button'], main [role='listitem']",
    ),
  );

  return [...new Set(cards)].filter((card) => {
    if (card.dataset.flightdealRole === "result-card") {
      return true;
    }

    const text = card.textContent ?? "";
    return /\bnonstop\b|\bstop\b/i.test(text) && /\d/.test(text);
  });
}

export function extractSearchContext(root: ParentNode): ExtensionSearchContext | null {
  const explicit = root.querySelector<HTMLElement>("[data-flightdeal-role='search-context']");

  if (explicit) {
    const cabin = normalizeCabin(readDataset(explicit, "cabin") ?? "");

    return {
      origin: readDataset(explicit, "origin") ?? "",
      destination: readDataset(explicit, "destination") ?? "",
      departureDate: readDataset(explicit, "departureDate") ?? "",
      cabin: cabin ?? undefined,
    };
  }

  const bodyText = root instanceof Document ? root.body?.textContent ?? "" : "";
  const routeMatch = bodyText.match(AIRPORT_PAIR_REGEX);
  const cabinMatch = bodyText.match(CABIN_REGEX);
  const dateNode = root.querySelector<HTMLElement>("[data-flightdeal-departure-date]");
  const departureDate = dateNode?.dataset.flightdealDepartureDate ?? "";

  if (!routeMatch || !departureDate) {
    return null;
  }

  return {
    origin: routeMatch[1],
    destination: routeMatch[2],
    departureDate,
    cabin: cabinMatch ? normalizeCabin(cabinMatch[1]) ?? undefined : undefined,
  };
}

export function extractItineraryFingerprint(
  card: HTMLElement,
  root: ParentNode,
): PageItineraryFingerprint | null {
  const detailRoot = detailRootForCard(card, root);
  const segmentNodes = [
    ...card.querySelectorAll<HTMLElement>("[data-flightdeal-role='segment']"),
    ...(detailRoot?.querySelectorAll<HTMLElement>("[data-flightdeal-role='segment']") ?? []),
  ];
  const segments = segmentNodes
    .map((node) => extractSegmentFromNode(node))
    .filter((segment): segment is FlightSegmentFingerprint => segment !== null);

  if (segments.length === 0) {
    return null;
  }

  return {
    segmentCount: segments.length,
    stopCount: Math.max(0, segments.length - 1),
    segments,
  };
}
