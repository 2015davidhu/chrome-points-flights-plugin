import type { SupportedSourceProgram, TransferGraphEdge } from "@/lib/domain/types";

type EdgeSeed = Omit<TransferGraphEdge, "supportsMixedWalletFunding">;

const BASE_EDGES: EdgeSeed[] = [
  {
    fromCurrency: "amex_mr",
    toProgram: "aeroplan",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "instant",
    notes: "Direct 1:1 transfer partner.",
  },
  {
    fromCurrency: "chase_ur",
    toProgram: "aeroplan",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "instant",
    notes: "Direct 1:1 transfer partner.",
  },
  {
    fromCurrency: "amex_mr",
    toProgram: "flying_blue",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "same_day",
    notes: "Direct 1:1 transfer partner.",
  },
  {
    fromCurrency: "chase_ur",
    toProgram: "flying_blue",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "same_day",
    notes: "Direct 1:1 transfer partner.",
  },
  {
    fromCurrency: "amex_mr",
    toProgram: "virgin_atlantic",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "instant",
    notes: "Direct 1:1 transfer partner.",
  },
  {
    fromCurrency: "chase_ur",
    toProgram: "virgin_atlantic",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "instant",
    notes: "Direct 1:1 transfer partner.",
  },
  {
    fromCurrency: "amex_mr",
    toProgram: "british_airways",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "same_day",
    notes: "Direct 1:1 transfer partner.",
  },
  {
    fromCurrency: "chase_ur",
    toProgram: "british_airways",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "same_day",
    notes: "Direct 1:1 transfer partner.",
  },
  {
    fromCurrency: "amex_mr",
    toProgram: "emirates_skywards",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "one_to_two_days",
    notes: "Direct 1:1 transfer partner.",
  },
  {
    fromCurrency: "chase_ur",
    toProgram: "emirates_skywards",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "one_to_two_days",
    notes: "Direct 1:1 transfer partner.",
  },
  {
    fromCurrency: "amex_mr",
    toProgram: "singapore_krisflyer",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "one_to_two_days",
    notes: "Direct 1:1 transfer partner.",
  },
  {
    fromCurrency: "chase_ur",
    toProgram: "singapore_krisflyer",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "one_to_two_days",
    notes: "Direct 1:1 transfer partner.",
  },
  {
    fromCurrency: "amex_mr",
    toProgram: "delta_skymiles",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "instant",
    notes: "Amex-only direct transfer partner.",
  },
  {
    fromCurrency: "amex_mr",
    toProgram: "etihad_guest",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "same_day",
    notes: "Direct 1:1 transfer partner.",
  },
  {
    fromCurrency: "chase_ur",
    toProgram: "etihad_guest",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "same_day",
    notes: "Direct 1:1 transfer partner.",
  },
  {
    fromCurrency: "amex_mr",
    toProgram: "jetblue_trueblue",
    ratioNum: 250,
    ratioDen: 200,
    minIncrement: 1000,
    transferSpeedBucket: "instant",
    notes: "Amex transfers at 250:200.",
  },
  {
    fromCurrency: "chase_ur",
    toProgram: "jetblue_trueblue",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "same_day",
    notes: "Chase transfers at 1:1.",
  },
  {
    fromCurrency: "amex_mr",
    toProgram: "qantas_frequent_flyer",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "same_day",
    notes: "Direct 1:1 transfer partner.",
  },
  {
    fromCurrency: "amex_mr",
    toProgram: "aeromexico_rewards",
    ratioNum: 1,
    ratioDen: 1.6,
    minIncrement: 1000,
    transferSpeedBucket: "one_to_two_days",
    notes: "Amex transfers at 1:1.6.",
  },
  {
    fromCurrency: "chase_ur",
    toProgram: "united_mileageplus",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "instant",
    notes: "Chase-only direct transfer partner.",
  },
  {
    fromCurrency: "chase_ur",
    toProgram: "iberia_plus",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "same_day",
    notes: "Chase-only direct transfer partner.",
  },
  {
    fromCurrency: "chase_ur",
    toProgram: "southwest_rapid_rewards",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "instant",
    notes: "Chase-only direct transfer partner.",
  },
  {
    fromCurrency: "chase_ur",
    toProgram: "aer_lingus_aerclub",
    ratioNum: 1,
    ratioDen: 1,
    minIncrement: 1000,
    transferSpeedBucket: "same_day",
    notes: "Chase-only direct transfer partner.",
  },
];

function sharedPrograms(edges: EdgeSeed[]): Set<SupportedSourceProgram> {
  const counts = new Map<SupportedSourceProgram, Set<string>>();

  for (const edge of edges) {
    const currencies = counts.get(edge.toProgram) ?? new Set<string>();
    currencies.add(edge.fromCurrency);
    counts.set(edge.toProgram, currencies);
  }

  return new Set(
    [...counts.entries()]
      .filter(([, currencies]) => currencies.size > 1)
      .map(([program]) => program),
  );
}

const mixedFundingPrograms = sharedPrograms(BASE_EDGES);

export const TRANSFER_GRAPH: TransferGraphEdge[] = BASE_EDGES.map((edge) => ({
  ...edge,
  supportsMixedWalletFunding: mixedFundingPrograms.has(edge.toProgram),
}));
