import { describe, expect, it } from "vitest";

import { generateFundingPaths } from "@/lib/engine/funding";
import type { NormalizedAward, WalletBalances, WalletValuations } from "@/lib/domain/types";

function award(overrides: Partial<NormalizedAward> = {}): NormalizedAward {
  return {
    tripId: "trip-1",
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

function valuations(overrides: Partial<WalletValuations> = {}): WalletValuations {
  return {
    amex_mr: 1.7,
    chase_ur: 1.6,
    ...overrides,
  };
}

function balances(overrides: Partial<WalletBalances> = {}): WalletBalances {
  return {
    amex_mr: 0,
    chase_ur: 0,
    ...overrides,
  };
}

describe("generateFundingPaths", () => {
  it("finds a single-wallet funding path when one wallet covers the award", () => {
    const paths = generateFundingPaths(
      award(),
      balances({ amex_mr: 80000 }),
      valuations(),
    );

    expect(paths[0].parts).toEqual([{ currency: "amex_mr", amount: 70000 }]);
  });

  it("finds a mixed-wallet funding path when neither wallet can cover the award alone", () => {
    const paths = generateFundingPaths(
      award(),
      balances({ amex_mr: 40000, chase_ur: 35000 }),
      valuations(),
    );

    expect(paths[0].parts).toEqual([
      { currency: "amex_mr", amount: 35000 },
      { currency: "chase_ur", amount: 35000 },
    ]);
  });

  it("returns no paths when balances are insufficient", () => {
    const paths = generateFundingPaths(
      award(),
      balances({ amex_mr: 20000, chase_ur: 20000 }),
      valuations(),
    );

    expect(paths).toHaveLength(0);
  });

  it("fails reachability when transfer increments force the transfer above balance", () => {
    const paths = generateFundingPaths(
      award({
        sourceProgram: "jetblue_trueblue",
        milesPrice: 900,
      }),
      balances({ amex_mr: 1000 }),
      valuations(),
    );

    expect(paths).toHaveLength(0);
  });
});
