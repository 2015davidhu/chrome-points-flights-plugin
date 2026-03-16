import { describe, expect, it } from "vitest";

import {
  hasSufficientItineraryIdentity,
  isExactItineraryMatch,
} from "@/lib/engine/itinerary-matching";
import type {
  AwardItineraryFingerprint,
  PageItineraryFingerprint,
} from "@/lib/domain/types";

function pageFingerprint(
  overrides: Partial<PageItineraryFingerprint> = {},
): PageItineraryFingerprint {
  return {
    segmentCount: 1,
    stopCount: 0,
    segments: [
      {
        marketingCarrier: "UA",
        operatingCarrier: "UA",
        flightNumber: "123",
        originAirport: "EWR",
        destinationAirport: "SFO",
        departureTime: "2026-04-01T08:00:00Z",
        arrivalTime: "2026-04-01T11:15:00Z",
      },
    ],
    ...overrides,
  };
}

function awardFingerprint(
  overrides: Partial<AwardItineraryFingerprint> = {},
): AwardItineraryFingerprint {
  return {
    tripId: "trip-1",
    ...pageFingerprint(),
    ...overrides,
  };
}

describe("itinerary matching", () => {
  it("accepts an exact single-segment match", () => {
    expect(isExactItineraryMatch(pageFingerprint(), awardFingerprint())).toBe(true);
  });

  it("accepts an exact multi-segment ordered match", () => {
    const segments = [
      {
        marketingCarrier: "UA",
        operatingCarrier: "UA",
        flightNumber: "123",
        originAirport: "EWR",
        destinationAirport: "ORD",
        departureTime: "2026-04-01T08:00:00Z",
        arrivalTime: "2026-04-01T09:45:00Z",
      },
      {
        marketingCarrier: "UA",
        operatingCarrier: "UA",
        flightNumber: "456",
        originAirport: "ORD",
        destinationAirport: "SFO",
        departureTime: "2026-04-01T10:45:00Z",
        arrivalTime: "2026-04-01T13:15:00Z",
      },
    ];

    expect(
      isExactItineraryMatch(
        pageFingerprint({
          segmentCount: 2,
          stopCount: 1,
          segments,
        }),
        awardFingerprint({
          segmentCount: 2,
          stopCount: 1,
          segments,
        }),
      ),
    ).toBe(true);
  });

  it("rejects a different flight number on the same route", () => {
    expect(
      isExactItineraryMatch(
        pageFingerprint(),
        awardFingerprint({
          segments: [
            {
              marketingCarrier: "UA",
              operatingCarrier: "UA",
              flightNumber: "999",
              originAirport: "EWR",
              destinationAirport: "SFO",
              departureTime: "2026-04-01T08:00:00Z",
              arrivalTime: "2026-04-01T11:15:00Z",
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("rejects materially different departure times", () => {
    expect(
      isExactItineraryMatch(
        pageFingerprint(),
        awardFingerprint({
          segments: [
            {
              marketingCarrier: "UA",
              operatingCarrier: "UA",
              flightNumber: "123",
              originAirport: "EWR",
              destinationAirport: "SFO",
              departureTime: "2026-04-01T10:00:00Z",
              arrivalTime: "2026-04-01T13:15:00Z",
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("treats incomplete fingerprints as insufficient identity", () => {
    expect(
      hasSufficientItineraryIdentity(
        pageFingerprint({
          segments: [
            {
              marketingCarrier: "",
              operatingCarrier: "UA",
              flightNumber: "123",
              originAirport: "EWR",
              destinationAirport: "SFO",
              departureTime: "2026-04-01T08:00:00Z",
              arrivalTime: "2026-04-01T11:15:00Z",
            },
          ],
        }),
      ),
    ).toBe(false);
  });
});
