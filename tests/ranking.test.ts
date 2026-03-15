import { describe, expect, it } from "vitest";

import { rankAwards } from "@/lib/engine/ranking";
import type { NormalizedAward, WalletBalances, WalletValuations } from "@/lib/domain/types";

const walletBalances: WalletBalances = {
  amex_mr: 80000,
  chase_ur: 80000,
};

const walletValuations: WalletValuations = {
  amex_mr: 1.7,
  chase_ur: 1.6,
};

function award(overrides: Partial<NormalizedAward> = {}): NormalizedAward {
  return {
    tripId: `trip-${Math.random()}`,
    origin: "JFK",
    destination: "ZRH",
    departureDate: "2026-06-03",
    carrier: "LX",
    marketingCarriersLabel: "LX",
    cabin: "business",
    sourceProgram: "aeroplan",
    pricingProgramDisplay: "Aeroplan",
    milesPrice: 70000,
    taxesUsd: 86,
    stops: 0,
    durationMinutes: 470,
    remainingSeats: 2,
    operatingCarriers: ["AC"],
    bookablePrograms: [
      {
        rawLabel: "Book via Air Canada Aeroplan",
        normalizedProgram: "aeroplan",
        displayLabel: "Aeroplan",
        primary: true,
      },
    ],
    partnerBookingType: "same_program_same_metal",
    freshness: "cached",
    ...overrides,
  };
}

describe("rankAwards", () => {
  it("orders reachable awards ahead of unreachable awards", () => {
    const results = rankAwards(
      [
        award({ tripId: "reachable" }),
        award({ tripId: "unreachable", milesPrice: 120000 }),
      ],
      walletBalances,
      walletValuations,
      "best_overall",
    );

    expect(results[0].tripId).toBe("reachable");
    expect(results[1].tripId).toBe("unreachable");
  });

  it("prefers a nonstop itinerary when costs are close", () => {
    const results = rankAwards(
      [
        award({ tripId: "nonstop", stops: 0, taxesUsd: 100 }),
        award({ tripId: "onestop", stops: 1, taxesUsd: 95 }),
      ],
      walletBalances,
      walletValuations,
      "best_overall",
    );

    expect(results[0].tripId).toBe("nonstop");
  });

  it("prefers lower taxes when path costs are similar", () => {
    const results = rankAwards(
      [
        award({ tripId: "low-fees", taxesUsd: 40 }),
        award({ tripId: "high-fees", taxesUsd: 250 }),
      ],
      walletBalances,
      walletValuations,
      "best_overall",
    );

    expect(results[0].tripId).toBe("low-fees");
  });

  it("penalizes slower transfer buckets without marking the award unreachable", () => {
    const results = rankAwards(
      [
        award({ tripId: "fast", sourceProgram: "aeroplan" }),
        award({ tripId: "slow", sourceProgram: "singapore_krisflyer" }),
      ],
      walletBalances,
      walletValuations,
      "best_overall",
    );

    expect(results[0].tripId).toBe("fast");
    expect(results[1].reachable).toBe(true);
  });

  it("includes partner-booking explanation text when priced via partner program", () => {
    const results = rankAwards(
      [
        award({
          tripId: "partner",
          sourceProgram: "virgin_atlantic",
          pricingProgramDisplay: "Virgin Atlantic",
          operatingCarriers: ["NH"],
          taxesUsd: 220,
          bookablePrograms: [
            {
              rawLabel: "Book via Virgin Atlantic Flying Club",
              normalizedProgram: "virgin_atlantic",
              displayLabel: "Virgin Atlantic",
              primary: true,
            },
          ],
          partnerBookingType: "same_program_partner_metal",
        }),
      ],
      walletBalances,
      walletValuations,
      "best_overall",
    );

    expect(results[0].explanations[0]).toContain("Priced via partner program.");
  });
});
