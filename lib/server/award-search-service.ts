import { rankAwards } from "@/lib/engine/ranking";
import type { AwardSearchRequest, AwardSearchResponse } from "@/lib/domain/types";
import type { CacheStore } from "@/lib/server/cache-store";
import { AwardDiscoveryService } from "@/lib/server/award-discovery-service";
import type { AwardSearchProvider } from "@/lib/server/providers/types";

type AwardSearchServiceOptions = {
  provider: AwardSearchProvider;
  cacheStore: CacheStore;
};

export class AwardSearchService {
  private readonly discoveryService: AwardDiscoveryService;

  constructor({ provider, cacheStore }: AwardSearchServiceOptions) {
    this.discoveryService = new AwardDiscoveryService({
      provider,
      cacheStore,
    });
  }

  async search(input: AwardSearchRequest): Promise<AwardSearchResponse> {
    const discovery = await this.discoveryService.discover(input);
    const results = rankAwards(
      discovery.awards,
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
        cachedSearchUsed: discovery.cachedSearchUsed,
        tripHydrationCount: discovery.tripHydrationCount,
        generatedAt: new Date().toISOString(),
        warnings: discovery.warnings,
      },
    };
  }
}
