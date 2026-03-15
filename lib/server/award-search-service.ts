import { createHash } from "crypto";

import { rankAwards } from "@/lib/engine/ranking";
import type {
  AwardSearchRequest,
  AwardSearchResponse,
  NormalizedAward,
  ProviderTripRecord,
  SearchCandidate,
} from "@/lib/domain/types";
import { normalizeTripRecord } from "@/lib/server/normalize";
import type { CacheStore } from "@/lib/server/cache-store";
import type { AwardSearchProvider } from "@/lib/server/providers/types";

const SEARCH_CACHE_TTL_MS = 1000 * 60 * 30;
const TRIP_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const HYDRATION_LIMIT = 12;
const CACHE_SCHEMA_VERSION = "v3";

type AwardSearchServiceOptions = {
  provider: AwardSearchProvider;
  cacheStore: CacheStore;
};

function queryKey(input: AwardSearchRequest) {
  const stable = JSON.stringify({
    version: CACHE_SCHEMA_VERSION,
    origin: input.origin,
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    cabin: input.cabin,
  });

  return createHash("sha256").update(stable).digest("hex");
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function tripCacheKey(tripId: string, cabin: AwardSearchRequest["cabin"]) {
  return `${CACHE_SCHEMA_VERSION}:${tripId}:${cabin}`;
}

export class AwardSearchService {
  private readonly provider: AwardSearchProvider;

  private readonly cacheStore: CacheStore;

  constructor({ provider, cacheStore }: AwardSearchServiceOptions) {
    this.provider = provider;
    this.cacheStore = cacheStore;
  }

  private async searchCandidates(input: AwardSearchRequest) {
    const key = queryKey(input);
    const cached = this.cacheStore.getSearchCache<SearchCandidate[]>(key);

    if (cached) {
      return {
        candidates: cached,
        cachedSearchUsed: true,
      };
    }

    const candidates = await this.provider.searchCandidates(input);
    this.cacheStore.setSearchCache(key, candidates, Date.now() + SEARCH_CACHE_TTL_MS);
    this.cacheStore.incrementUsage(utcDay());

    return {
      candidates,
      cachedSearchUsed: false,
    };
  }

  private async hydrateTripWithCabin(tripId: string, cabin: AwardSearchRequest["cabin"]) {
    const cacheKey = tripCacheKey(tripId, cabin);
    const cached = this.cacheStore.getTripCache<ProviderTripRecord[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const trip = await this.provider.getTrip(tripId, cabin);

    if (trip.length > 0) {
      this.cacheStore.setTripCache(cacheKey, trip, Date.now() + TRIP_CACHE_TTL_MS);
      this.cacheStore.incrementUsage(utcDay());
    }

    return trip;
  }

  async search(input: AwardSearchRequest): Promise<AwardSearchResponse> {
    const warnings: string[] = [];
    const unsupportedPrograms = new Map<string, number>();
    const { candidates, cachedSearchUsed } = await this.searchCandidates(input);
    const tripIds = [...new Set(candidates.map((candidate) => candidate.tripId))].slice(
      0,
      HYDRATION_LIMIT,
    );
    const normalizedAwards: NormalizedAward[] = [];

    for (const tripId of tripIds) {
      const trips = await this.hydrateTripWithCabin(tripId, input.cabin);

      if (trips.length === 0) {
        warnings.push(`Trip ${tripId} could not be hydrated from Seats.aero.`);
        continue;
      }

      for (const trip of trips) {
        const normalized = normalizeTripRecord(trip);

        if (!normalized) {
          const key = trip.sourceProgramRaw || "unknown";
          unsupportedPrograms.set(key, (unsupportedPrograms.get(key) ?? 0) + 1);
          continue;
        }

        normalizedAwards.push(normalized);

        if (trip.warnings) {
          warnings.push(...trip.warnings);
        }
      }
    }

    if (candidates.length > HYDRATION_LIMIT) {
      warnings.push(
        `Hydrated the top ${HYDRATION_LIMIT} trip candidates to stay within the daily API budget.`,
      );
    }

    for (const [program, count] of unsupportedPrograms.entries()) {
      warnings.push(
        `Skipped ${count} itinerary option(s) from unsupported source program "${program}".`,
      );
    }

    const results = rankAwards(
      normalizedAwards,
      input.walletBalances,
      {
        amex_mr: input.walletValuations?.amex_mr ?? 1.7,
        chase_ur: input.walletValuations?.chase_ur ?? 1.6,
      },
      input.sort,
    );

    return {
      results: input.reachableOnly ? results.filter((result) => result.reachable) : results,
      meta: {
        cachedSearchUsed,
        tripHydrationCount: tripIds.length,
        generatedAt: new Date().toISOString(),
        warnings: [...new Set(warnings)],
      },
    };
  }
}
