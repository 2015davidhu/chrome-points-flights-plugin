import { TRANSFER_GRAPH } from "@/lib/domain/transfer-graph";
import type {
  FundingPath,
  NormalizedAward,
  TransferGraphEdge,
  TransferSpeedBucket,
  WalletBalances,
  WalletCurrency,
  WalletValuations,
} from "@/lib/domain/types";

const SPEED_BUCKET_ORDER: TransferSpeedBucket[] = [
  "instant",
  "same_day",
  "one_to_two_days",
  "multi_day",
];

function roundUpTransferAmount(requiredUnits: number, edge: TransferGraphEdge) {
  if (requiredUnits <= 0) {
    return 0;
  }

  const rawAmount = Math.ceil((requiredUnits * edge.ratioNum) / edge.ratioDen);
  return Math.ceil(rawAmount / edge.minIncrement) * edge.minIncrement;
}

function destinationUnitsFromAmount(amount: number, edge: TransferGraphEdge) {
  return Math.floor((amount * edge.ratioDen) / edge.ratioNum);
}

function pathCostUsd(parts: FundingPath["parts"], walletValuations: WalletValuations) {
  return parts.reduce(
    (sum, part) => sum + (part.amount * walletValuations[part.currency]) / 100,
    0,
  );
}

function maxSpeedBucket(
  first: TransferSpeedBucket,
  second: TransferSpeedBucket,
): TransferSpeedBucket {
  return SPEED_BUCKET_ORDER[Math.max(SPEED_BUCKET_ORDER.indexOf(first), SPEED_BUCKET_ORDER.indexOf(second))];
}

function sortWalletPreference(
  a: FundingPath,
  b: FundingPath,
  walletValuations: WalletValuations,
) {
  const valuationOrder = Object.entries(walletValuations)
    .sort(([, firstValue], [, secondValue]) => secondValue - firstValue)
    .map(([currency]) => currency as WalletCurrency);

  for (const currency of valuationOrder) {
    const firstSpend = a.parts.find((part) => part.currency === currency)?.amount ?? 0;
    const secondSpend = b.parts.find((part) => part.currency === currency)?.amount ?? 0;

    if (firstSpend !== secondSpend) {
      return firstSpend - secondSpend;
    }
  }

  return 0;
}

function dedupePaths(paths: FundingPath[]) {
  const seen = new Set<string>();

  return paths.filter((path) => {
    const key = path.parts
      .map((part) => `${part.currency}:${part.amount}`)
      .sort()
      .join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildSingleWalletPath(
  award: NormalizedAward,
  walletBalances: WalletBalances,
  walletValuations: WalletValuations,
  edge: TransferGraphEdge,
) {
  const requiredAmount = roundUpTransferAmount(award.milesPrice, edge);

  if (requiredAmount > walletBalances[edge.fromCurrency]) {
    return null;
  }

  const parts = [{ currency: edge.fromCurrency, amount: requiredAmount }] as const;

  return {
    sourceProgram: award.sourceProgram,
    destinationUnits: award.milesPrice,
    parts: [...parts],
    transferSpeedBucket: edge.transferSpeedBucket,
    walletCostUsd: pathCostUsd([...parts], walletValuations),
  } satisfies FundingPath;
}

function buildMixedWalletPaths(
  award: NormalizedAward,
  walletBalances: WalletBalances,
  walletValuations: WalletValuations,
  firstEdge: TransferGraphEdge,
  secondEdge: TransferGraphEdge,
) {
  const paths: FundingPath[] = [];
  const soloAmount = roundUpTransferAmount(award.milesPrice, firstEdge);
  const upperBound = Math.min(walletBalances[firstEdge.fromCurrency], soloAmount);

  for (
    let firstAmount = firstEdge.minIncrement;
    firstAmount < upperBound;
    firstAmount += firstEdge.minIncrement
  ) {
    const firstUnits = destinationUnitsFromAmount(firstAmount, firstEdge);

    if (firstUnits <= 0 || firstUnits >= award.milesPrice) {
      continue;
    }

    const remainingUnits = award.milesPrice - firstUnits;
    const secondAmount = roundUpTransferAmount(remainingUnits, secondEdge);

    if (secondAmount > walletBalances[secondEdge.fromCurrency]) {
      continue;
    }

    const parts = [
      { currency: firstEdge.fromCurrency, amount: firstAmount },
      { currency: secondEdge.fromCurrency, amount: secondAmount },
    ] as const;

    paths.push({
      sourceProgram: award.sourceProgram,
      destinationUnits: award.milesPrice,
      parts: [...parts].sort((left, right) => left.currency.localeCompare(right.currency)),
      transferSpeedBucket: maxSpeedBucket(
        firstEdge.transferSpeedBucket,
        secondEdge.transferSpeedBucket,
      ),
      walletCostUsd: pathCostUsd([...parts], walletValuations),
    });
  }

  return paths;
}

function comparePaths(
  a: FundingPath,
  b: FundingPath,
  _award: NormalizedAward,
  walletValuations: WalletValuations,
) {
  if (a.walletCostUsd !== b.walletCostUsd) {
    return a.walletCostUsd - b.walletCostUsd;
  }

  if (a.parts.length !== b.parts.length) {
    return a.parts.length - b.parts.length;
  }

  const preserveComparison = sortWalletPreference(a, b, walletValuations);

  if (preserveComparison !== 0) {
    return preserveComparison;
  }

  return SPEED_BUCKET_ORDER.indexOf(a.transferSpeedBucket) - SPEED_BUCKET_ORDER.indexOf(b.transferSpeedBucket);
}

export function generateFundingPaths(
  award: NormalizedAward,
  walletBalances: WalletBalances,
  walletValuations: WalletValuations,
) {
  const matchingEdges = TRANSFER_GRAPH.filter((edge) => edge.toProgram === award.sourceProgram);
  const singlePaths = matchingEdges
    .map((edge) => buildSingleWalletPath(award, walletBalances, walletValuations, edge))
    .filter((path): path is FundingPath => path !== null);
  const mixedPaths: FundingPath[] = [];

  if (matchingEdges.length >= 2 && matchingEdges.every((edge) => edge.supportsMixedWalletFunding)) {
    for (let index = 0; index < matchingEdges.length; index += 1) {
      for (let inner = index + 1; inner < matchingEdges.length; inner += 1) {
        mixedPaths.push(
          ...buildMixedWalletPaths(
            award,
            walletBalances,
            walletValuations,
            matchingEdges[index],
            matchingEdges[inner],
          ),
          ...buildMixedWalletPaths(
            award,
            walletBalances,
            walletValuations,
            matchingEdges[inner],
            matchingEdges[index],
          ),
        );
      }
    }
  }

  return dedupePaths([...singlePaths, ...mixedPaths]).sort((first, second) =>
    comparePaths(first, second, award, walletValuations),
  );
}
