// @vitest-environment node

import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import type {
  AwardSearchRequest,
  ProviderTripRecord,
  SearchCandidate,
} from "@/lib/domain/types";
import { AwardSearchService } from "@/lib/server/award-search-service";
import { SqliteCacheStore } from "@/lib/server/cache-store";
import type { AwardSearchProvider } from "@/lib/server/providers/types";

class FakeProvider implements AwardSearchProvider {
  searchCalls = 0;

  tripCalls = 0;

  constructor(
    private readonly candidates: SearchCandidate[],
    private readonly trips: Record<string, ProviderTripRecord[]>,
  ) {}

  async searchCandidates() {
    this.searchCalls += 1;
    return this.candidates;
  }

  async getTrip(tripId: string) {
    this.tripCalls += 1;
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flightdeal-"));
  cleanupPaths.push(dir);
  return new SqliteCacheStore(path.join(dir, "flightdeal.sqlite"));
}

function baseRequest(overrides: Partial<AwardSearchRequest> = {}): AwardSearchRequest {
  return {
    origin: "JFK",
    destination: "ZRH",
    startDate: "2026-06-01",
    endDate: "2026-06-15",
    cabin: "business",
    walletBalances: {
      amex_mr: 40000,
      chase_ur: 35000,
    },
    walletValuations: {
      amex_mr: 1.7,
      chase_ur: 1.6,
    },
    reachableOnly: false,
    sort: "best_overall",
    ...overrides,
  };
}

function trip(tripId: string, sourceProgramRaw: string): ProviderTripRecord {
  return {
    tripId,
    origin: "JFK",
    destination: "ZRH",
    departureDate: "2026-06-03",
    carrier: "LX",
    marketingCarriersLabel: "LX",
    cabin: "business",
    sourceProgramRaw,
    pricingProgramDisplay: "Virgin Atlantic",
    milesPrice: 70000,
    taxesUsd: 86,
    stops: 0,
    durationMinutes: 470,
    remainingSeats: 2,
    segments: [
      {
        marketingCarrier: "LX",
        operatingCarrier: "LX",
        flightNumber: "18",
        originAirport: "JFK",
        destinationAirport: "ZRH",
        departureTime: "2026-06-03T19:30:00Z",
        arrivalTime: "2026-06-04T06:20:00Z",
      },
    ],
    operatingCarriers: ["LX"],
    bookablePrograms: [
      {
        rawLabel: "Book via Virgin Atlantic Flying Club",
        normalizedProgram: "virgin_atlantic",
        displayLabel: "Virgin Atlantic",
        primary: true,
      },
    ],
    freshness: "cached",
  };
}

describe("AwardSearchService", () => {
  it("normalizes provider trip data into ranked results", async () => {
    const provider = new FakeProvider([{ tripId: "trip-1" }], {
      "trip-1": [trip("trip-1", "Virgin Atlantic Flying Club")],
    });
    const service = new AwardSearchService({
      provider,
      cacheStore: createStore(),
    });

    const result = await service.search(baseRequest());

    expect(result.results).toHaveLength(1);
    expect(result.results[0].sourceProgram).toBe("virgin_atlantic");
    expect(result.results[0].reachable).toBe(true);
    expect(result.results[0].operatingCarriers).toEqual(["LX"]);
    expect(result.meta.tripHydrationCount).toBe(1);
  });

  it("hydrates at most 12 trips to protect the API budget", async () => {
    const candidates = Array.from({ length: 20 }, (_, index) => ({
      tripId: `trip-${index + 1}`,
    }));
    const trips = Object.fromEntries(
      candidates.map((candidate) => [candidate.tripId, [trip(candidate.tripId, "Aeroplan")]]),
    );
    const provider = new FakeProvider(candidates, trips);
    const service = new AwardSearchService({
      provider,
      cacheStore: createStore(),
    });

    const result = await service.search(baseRequest());

    expect(provider.tripCalls).toBe(12);
    expect(result.meta.tripHydrationCount).toBe(12);
    expect(result.meta.warnings.join(" ")).toContain("Hydrated the top 12 trip candidates");
  });

  it("reuses cached search and trip data on identical searches", async () => {
    const provider = new FakeProvider([{ tripId: "trip-1" }], {
      "trip-1": [trip("trip-1", "Aeroplan")],
    });
    const service = new AwardSearchService({
      provider,
      cacheStore: createStore(),
    });

    await service.search(baseRequest());
    await service.search(baseRequest());

    expect(provider.searchCalls).toBe(1);
    expect(provider.tripCalls).toBe(1);
  });
});
