import type {
  AwardItineraryFingerprint,
  FlightSegmentFingerprint,
  PageItineraryFingerprint,
} from "@/lib/domain/types";

const MAX_DEPARTURE_TIME_DELTA_MS = 1000 * 60 * 10;

function normalizeCarrier(value: string | null | undefined) {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeFlightNumber(value: string | null | undefined) {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeAirport(value: string | null | undefined) {
  return (value ?? "").toUpperCase().replace(/[^A-Z]/g, "");
}

function parseTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function sameFlightIdentity(a: FlightSegmentFingerprint, b: FlightSegmentFingerprint) {
  const flightA = normalizeFlightNumber(a.flightNumber);
  const flightB = normalizeFlightNumber(b.flightNumber);

  if (!flightA || !flightB || flightA !== flightB) {
    return false;
  }

  const carriersA = new Set(
    [a.marketingCarrier, a.operatingCarrier]
      .map((carrier) => normalizeCarrier(carrier))
      .filter(Boolean),
  );
  const carriersB = new Set(
    [b.marketingCarrier, b.operatingCarrier]
      .map((carrier) => normalizeCarrier(carrier))
      .filter(Boolean),
  );

  for (const carrier of carriersA) {
    if (carriersB.has(carrier)) {
      return true;
    }
  }

  return false;
}

function sameAirportSequence(a: FlightSegmentFingerprint, b: FlightSegmentFingerprint) {
  return (
    normalizeAirport(a.originAirport) === normalizeAirport(b.originAirport) &&
    normalizeAirport(a.destinationAirport) === normalizeAirport(b.destinationAirport)
  );
}

function sameDepartureTime(a: FlightSegmentFingerprint, b: FlightSegmentFingerprint) {
  const timeA = parseTime(a.departureTime);
  const timeB = parseTime(b.departureTime);

  if (timeA === null || timeB === null) {
    return a.departureTime.trim() === b.departureTime.trim();
  }

  return Math.abs(timeA - timeB) <= MAX_DEPARTURE_TIME_DELTA_MS;
}

export function hasSufficientItineraryIdentity(fingerprint: PageItineraryFingerprint) {
  if (
    fingerprint.segmentCount < 1 ||
    fingerprint.segmentCount !== fingerprint.segments.length ||
    fingerprint.stopCount !== Math.max(0, fingerprint.segmentCount - 1)
  ) {
    return false;
  }

  return fingerprint.segments.every((segment) => {
    return Boolean(
      normalizeCarrier(segment.marketingCarrier) &&
        normalizeFlightNumber(segment.flightNumber) &&
        normalizeAirport(segment.originAirport) &&
        normalizeAirport(segment.destinationAirport) &&
        segment.departureTime.trim(),
    );
  });
}

export function isExactItineraryMatch(
  pageFingerprint: PageItineraryFingerprint,
  awardFingerprint: AwardItineraryFingerprint,
) {
  if (!hasSufficientItineraryIdentity(pageFingerprint)) {
    return false;
  }

  if (
    pageFingerprint.segmentCount !== awardFingerprint.segmentCount ||
    pageFingerprint.stopCount !== awardFingerprint.stopCount ||
    pageFingerprint.segments.length !== awardFingerprint.segments.length
  ) {
    return false;
  }

  return pageFingerprint.segments.every((pageSegment, index) => {
    const awardSegment = awardFingerprint.segments[index];

    return (
      sameAirportSequence(pageSegment, awardSegment) &&
      sameFlightIdentity(pageSegment, awardSegment) &&
      sameDepartureTime(pageSegment, awardSegment)
    );
  });
}
