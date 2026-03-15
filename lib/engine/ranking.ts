import { generateFundingPaths } from "@/lib/engine/funding";
import type {
  NormalizedAward,
  RankedAwardResult,
  SortMode,
  TransferSpeedBucket,
  WalletBalances,
  WalletValuations,
} from "@/lib/domain/types";

const SPEED_PENALTIES: Record<TransferSpeedBucket, number> = {
  instant: 0,
  same_day: 2,
  one_to_two_days: 5,
  multi_day: 10,
};

function buildExplanations(result: RankedAwardResult) {
  const details: string[] = [];

  if (!result.reachable) {
    details.push("Not fundable with current balances.");
    return details;
  }

  if (result.stops === 0) {
    details.push("Nonstop itinerary.");
  } else if (result.stops === 1) {
    details.push("One stop, still relatively clean.");
  } else {
    details.push(`${result.stops} stops drags down convenience.`);
  }

  if (result.taxesUsd <= 100) {
    details.push("Low fees.");
  } else if (result.taxesUsd >= 300) {
    details.push("Higher surcharges than nearby options.");
  }

  if (result.partnerBookingType === "same_program_partner_metal") {
    details.push("Priced via partner program.");
  } else if (result.partnerBookingType === "alt_programs_observed") {
    details.push("Multiple observed booking programs for this itinerary.");
  }

  if (result.bestFundingPath?.parts.length === 1) {
    details.push("Only one wallet required.");
  } else if (result.bestFundingPath) {
    details.push("Uses both wallets to bridge the gap.");
  }

  if (result.bestFundingPath && SPEED_PENALTIES[result.bestFundingPath.transferSpeedBucket] >= 5) {
    details.push("Transfer timing may affect practical bookability.");
  }

  return details.length > 0
    ? [details.slice(0, 2).join(" ")]
    : ["Ranked on funding cost, fees, and itinerary quality."];
}

function buildWarnings(result: RankedAwardResult) {
  const warnings = [
    "Indexed availability from Seats.aero, not confirmed live inventory.",
  ];

  if (!result.reachable) {
    warnings.push("Current balances do not cover the required transfer amount.");
  } else if (
    result.bestFundingPath &&
    SPEED_PENALTIES[result.bestFundingPath.transferSpeedBucket] >= 5
  ) {
    warnings.push("Transfer timing may affect practical bookability.");
  }

  if (result.bookablePrograms.length > 1) {
    warnings.push("Alternate booking programs are observed hints, not separately priced options.");
  }

  return warnings;
}

function computeRankScore(result: RankedAwardResult) {
  if (!result.reachable || !result.bestFundingPath || result.pathCostUsd === null) {
    const shortfallPenalty = Math.max(0, result.milesPrice / 2000);
    return 15 - shortfallPenalty - result.stops * 4;
  }

  const nonstopBonus = result.stops === 0 ? 14 : Math.max(2, 10 - result.stops * 4);
  const durationPenalty = result.durationMinutes / 85;
  const feePenalty = result.taxesUsd / 35;
  const pathPenalty = result.pathCostUsd / 45;
  const seatBonus =
    result.remainingSeats === null ? 0 : Math.min(result.remainingSeats, 4) * 1.5;
  const speedPenalty = SPEED_PENALTIES[result.bestFundingPath.transferSpeedBucket];

  return 100 + nonstopBonus + seatBonus - durationPenalty - feePenalty - pathPenalty - speedPenalty;
}

function compareRankedResults(a: RankedAwardResult, b: RankedAwardResult, sort: SortMode) {
  if (a.reachable !== b.reachable) {
    return a.reachable ? -1 : 1;
  }

  if (sort === "fewest_points") {
    if (a.milesPrice !== b.milesPrice) {
      return a.milesPrice - b.milesPrice;
    }

    return a.taxesUsd - b.taxesUsd;
  }

  if (sort === "lowest_fees") {
    if (a.taxesUsd !== b.taxesUsd) {
      return a.taxesUsd - b.taxesUsd;
    }

    return a.milesPrice - b.milesPrice;
  }

  if (a.rankScore !== b.rankScore) {
    return b.rankScore - a.rankScore;
  }

  if ((a.pathCostUsd ?? Infinity) !== (b.pathCostUsd ?? Infinity)) {
    return (a.pathCostUsd ?? Infinity) - (b.pathCostUsd ?? Infinity);
  }

  if (a.partnerBookingType !== b.partnerBookingType) {
    const weight = {
      same_program_same_metal: 0,
      same_program_partner_metal: 1,
      alt_programs_observed: 2,
    } as const;

    return weight[a.partnerBookingType] - weight[b.partnerBookingType];
  }

  return a.departureDate.localeCompare(b.departureDate);
}

export function rankAwards(
  awards: NormalizedAward[],
  walletBalances: WalletBalances,
  walletValuations: WalletValuations,
  sort: SortMode,
) {
  const results = awards.map((award) => {
    const fundingPaths = generateFundingPaths(award, walletBalances, walletValuations);
    const bestFundingPath = fundingPaths[0] ?? null;
    const pathCostUsd =
      bestFundingPath === null ? null : bestFundingPath.walletCostUsd + award.taxesUsd;

    const result: RankedAwardResult = {
      ...award,
      reachable: bestFundingPath !== null,
      bestFundingPath,
      alternativeFundingPaths: fundingPaths.slice(1),
      pathCostUsd,
      rankScore: 0,
      explanations: [],
      warnings: [],
    };

    result.rankScore = computeRankScore(result);
    result.explanations = buildExplanations(result);
    result.warnings = buildWarnings(result);

    return result;
  });

  return results.sort((first, second) => compareRankedResults(first, second, sort));
}
