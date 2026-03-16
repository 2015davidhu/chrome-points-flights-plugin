import { isExactItineraryMatch, hasSufficientItineraryIdentity } from "@/lib/engine/itinerary-matching";
import { rankAwards } from "@/lib/engine/ranking";
import type {
  ExtensionMatchRequest,
  ExtensionMatchResponse,
} from "@/lib/domain/types";
import type { CacheStore } from "@/lib/server/cache-store";
import { AwardDiscoveryService } from "@/lib/server/award-discovery-service";
import type { AwardSearchProvider } from "@/lib/server/providers/types";

type ExtensionMatchServiceOptions = {
  provider: AwardSearchProvider;
  cacheStore: CacheStore;
};

export class ExtensionMatchService {
  private readonly discoveryService: AwardDiscoveryService;

  constructor({ provider, cacheStore }: ExtensionMatchServiceOptions) {
    this.discoveryService = new AwardDiscoveryService({
      provider,
      cacheStore,
    });
  }

  async match(input: ExtensionMatchRequest): Promise<ExtensionMatchResponse> {
    if (!input.searchContext.cabin || !hasSufficientItineraryIdentity(input.itineraryFingerprint)) {
      return {
        matchStatus: "insufficient_identity",
        matchedAwards: [],
        meta: {
          cachedSearchUsed: true,
          tripHydrationCount: 0,
          generatedAt: new Date().toISOString(),
          warnings: [
            "Flight identity was incomplete. Open the Google Flights itinerary details to resolve an exact match.",
          ],
        },
      };
    }

    const discovery = await this.discoveryService.discover({
      origin: input.searchContext.origin,
      destination: input.searchContext.destination,
      startDate: input.searchContext.departureDate,
      endDate: input.searchContext.departureDate,
      cabin: input.searchContext.cabin,
    });
    const exactAwards = discovery.awards.filter((award) =>
      isExactItineraryMatch(input.itineraryFingerprint, award.itineraryFingerprint),
    );

    if (exactAwards.length === 0) {
      return {
        matchStatus: "no_match",
        matchedAwards: [],
        meta: {
          cachedSearchUsed: discovery.cachedSearchUsed,
          tripHydrationCount: discovery.tripHydrationCount,
          generatedAt: new Date().toISOString(),
          warnings: [
            ...discovery.warnings,
            "No exact award match found for this Google Flights itinerary.",
          ],
        },
      };
    }

    return {
      matchStatus: "matched",
      matchedAwards: rankAwards(
        exactAwards,
        input.walletBalances,
        {
          amex_mr: input.walletValuations?.amex_mr ?? 1.7,
          chase_ur: input.walletValuations?.chase_ur ?? 1.6,
        },
        "best_overall",
      ),
      meta: {
        cachedSearchUsed: discovery.cachedSearchUsed,
        tripHydrationCount: discovery.tripHydrationCount,
        generatedAt: new Date().toISOString(),
        warnings: discovery.warnings,
      },
    };
  }
}
