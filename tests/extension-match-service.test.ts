// @vitest-environment node

import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import type {
  ExtensionMatchRequest,
  ProviderTripRecord,
  SearchCandidate,
} from "@/lib/domain/types";
import { SqliteCacheStore } from "@/lib/server/cache-store";
import { ExtensionMatchService } from "@/lib/server/extension-match-service";
import type { AwardSearchProvider } from "@/lib/server/providers/types";

class FakeProvider implements AwardSearchProvider {
  constructor(
    private readonly candidates: SearchCandidate[],
    private readonly trips: Record<string, ProviderTripRecord[]>,
  ) {}

  async searchCandidates() {
    return this.candidates;
  }

  async getTrip(tripId: string) {
    return this.trips[tripId] ?? [];
  }
}

const cleanupPaths: string[] = [];

afterEach(() => {
  for (const target of cleanupPaths.splice(0)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

function createStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flightdeal-ext-"));
  cleanupPaths.push(dir);
  return new SqliteCacheStore(path.join(dir, "flightdeal.sqlite"));
}

function request(overrides: Partial<ExtensionMatchRequest> = {}): ExtensionMatchRequest {
  return {
    searchContext: {
      origin: "EWR",
      destination: "SFO",
      departureDate: "2026-04-01",
      cabin: "economy",
    },
    itineraryFingerprint: {
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
    },
    walletBalances: {
      amex_mr: 40000,
      chase_ur: 35000,
    },
    walletValuations: {
      amex_mr: 1.7,
      chase_ur: 1.6,
    },
    ...overrides,
  };
}

function trip(tripId: string, flightNumber: string): ProviderTripRecord {
  return {
    tripId,
    origin: "EWR",
    destination: "SFO",
    departureDate: "2026-04-01T08:00:00Z",
    carrier: "UA",
    marketingCarriersLabel: "UA",
    cabin: "economy",
    sourceProgramRaw: "Aeroplan",
    pricingProgramDisplay: "Aeroplan",
    milesPrice: 15000,
    taxesUsd: 34.48,
    stops: 0,
    durationMinutes: 380,
    remainingSeats: 2,
    segments: [
      {
        marketingCarrier: "UA",
        operatingCarrier: "UA",
        flightNumber,
        originAirport: "EWR",
        destinationAirport: "SFO",
        departureTime: "2026-04-01T08:00:00Z",
        arrivalTime: "2026-04-01T11:15:00Z",
      },
    ],
    operatingCarriers: ["UA"],
    bookablePrograms: [
      {
        rawLabel: "Book via Air Canada Aeroplan",
        normalizedProgram: "aeroplan",
        displayLabel: "Aeroplan",
        primary: true,
      },
    ],
    freshness: "cached",
  };
}

describe("ExtensionMatchService", () => {
  it("returns matched awards only for exact itinerary matches", async () => {
    const service = new ExtensionMatchService({
      provider: new FakeProvider(
        [{ tripId: "trip-1" }, { tripId: "trip-2" }],
        {
          "trip-1": [trip("trip-1", "123")],
          "trip-2": [trip("trip-2", "999")],
        },
      ),
      cacheStore: createStore(),
    });

    const result = await service.match(request());

    expect(result.matchStatus).toBe("matched");
    expect(result.matchedAwards).toHaveLength(1);
    expect(result.matchedAwards[0].tripId).toBe("trip-1");
  });

  it("returns no_match when no exact itinerary is found", async () => {
    const service = new ExtensionMatchService({
      provider: new FakeProvider([{ tripId: "trip-1" }], {
        "trip-1": [trip("trip-1", "999")],
      }),
      cacheStore: createStore(),
    });

    const result = await service.match(request());

    expect(result.matchStatus).toBe("no_match");
    expect(result.matchedAwards).toHaveLength(0);
  });

  it("returns insufficient_identity when the page fingerprint is incomplete", async () => {
    const service = new ExtensionMatchService({
      provider: new FakeProvider([], {}),
      cacheStore: createStore(),
    });

    const result = await service.match(
      request({
        itineraryFingerprint: {
          segmentCount: 1,
          stopCount: 0,
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
        },
      }),
    );

    expect(result.matchStatus).toBe("insufficient_identity");
  });
});
