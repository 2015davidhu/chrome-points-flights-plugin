import { z } from "zod";

export const WALLET_CURRENCIES = ["amex_mr", "chase_ur"] as const;
export const CABINS = ["economy", "premium_economy", "business", "first"] as const;
export const TRANSFER_SPEED_BUCKETS = [
  "instant",
  "same_day",
  "one_to_two_days",
  "multi_day",
] as const;
export const SORT_MODES = ["best_overall", "fewest_points", "lowest_fees"] as const;
export const SOURCE_PROGRAMS = [
  "aeroplan",
  "aeromexico_rewards",
  "aer_lingus_aerclub",
  "british_airways",
  "delta_skymiles",
  "emirates_skywards",
  "etihad_guest",
  "flying_blue",
  "iberia_plus",
  "jetblue_trueblue",
  "qantas_frequent_flyer",
  "singapore_krisflyer",
  "southwest_rapid_rewards",
  "united_mileageplus",
  "virgin_atlantic",
  "hawaiianmiles",
] as const;
export const PARTNER_BOOKING_TYPES = [
  "same_program_same_metal",
  "same_program_partner_metal",
  "alt_programs_observed",
] as const;
export const EXTENSION_MATCH_STATUSES = [
  "matched",
  "no_match",
  "insufficient_identity",
  "unsupported",
] as const;

export type WalletCurrency = (typeof WALLET_CURRENCIES)[number];
export type Cabin = (typeof CABINS)[number];
export type TransferSpeedBucket = (typeof TRANSFER_SPEED_BUCKETS)[number];
export type SortMode = (typeof SORT_MODES)[number];
export type SupportedSourceProgram = (typeof SOURCE_PROGRAMS)[number];
export type PartnerBookingType = (typeof PARTNER_BOOKING_TYPES)[number];
export type ExtensionMatchStatus = (typeof EXTENSION_MATCH_STATUSES)[number];
export type WalletBalances = Record<WalletCurrency, number>;
export type WalletValuations = Record<WalletCurrency, number>;

export type BookableProgramHint = {
  rawLabel: string;
  normalizedProgram?: SupportedSourceProgram;
  displayLabel: string;
  primary: boolean;
};

export type AwardSearchRequest = {
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  cabin: Cabin;
  walletBalances: WalletBalances;
  walletValuations?: Partial<WalletValuations>;
  reachableOnly: boolean;
  sort: SortMode;
};

export type SearchCandidate = {
  tripId: string;
};

export type FlightSegmentFingerprint = {
  marketingCarrier: string;
  operatingCarrier?: string | null;
  flightNumber: string;
  originAirport: string;
  destinationAirport: string;
  departureTime: string;
  arrivalTime?: string | null;
};

export type PageItineraryFingerprint = {
  segmentCount: number;
  stopCount: number;
  segments: FlightSegmentFingerprint[];
};

export type AwardItineraryFingerprint = PageItineraryFingerprint & {
  tripId: string;
};

export type ExtensionSearchContext = {
  origin: string;
  destination: string;
  departureDate: string;
  cabin?: Cabin;
};

export type ExtensionMatchRequest = {
  searchContext: ExtensionSearchContext;
  itineraryFingerprint: PageItineraryFingerprint;
  walletBalances: WalletBalances;
  walletValuations?: Partial<WalletValuations>;
};

export type ProviderTripRecord = {
  tripId: string;
  origin: string;
  destination: string;
  departureDate: string;
  carrier: string;
  marketingCarriersLabel?: string;
  cabin: string;
  sourceProgramRaw: string;
  pricingProgramDisplay?: string;
  milesPrice: number;
  taxesUsd: number;
  stops: number;
  durationMinutes: number;
  remainingSeats: number | null;
  segments: FlightSegmentFingerprint[];
  operatingCarriers: string[];
  bookablePrograms: BookableProgramHint[];
  freshness: "cached";
  warnings?: string[];
};

export type TransferGraphEdge = {
  fromCurrency: WalletCurrency;
  toProgram: SupportedSourceProgram;
  ratioNum: number;
  ratioDen: number;
  minIncrement: number;
  transferSpeedBucket: TransferSpeedBucket;
  notes: string;
  supportsMixedWalletFunding: boolean;
};

export type NormalizedAward = {
  tripId: string;
  origin: string;
  destination: string;
  departureDate: string;
  carrier: string;
  marketingCarriersLabel?: string;
  cabin: Cabin;
  sourceProgram: SupportedSourceProgram;
  pricingProgramDisplay?: string;
  milesPrice: number;
  taxesUsd: number;
  stops: number;
  durationMinutes: number;
  remainingSeats: number | null;
  itineraryFingerprint: AwardItineraryFingerprint;
  operatingCarriers: string[];
  bookablePrograms: BookableProgramHint[];
  partnerBookingType: PartnerBookingType;
  freshness: "cached";
};

export type FundingPathPart = {
  currency: WalletCurrency;
  amount: number;
};

export type FundingPath = {
  sourceProgram: SupportedSourceProgram;
  destinationUnits: number;
  parts: FundingPathPart[];
  transferSpeedBucket: TransferSpeedBucket;
  walletCostUsd: number;
};

export type RankedAwardResult = NormalizedAward & {
  reachable: boolean;
  bestFundingPath: FundingPath | null;
  alternativeFundingPaths: FundingPath[];
  pathCostUsd: number | null;
  rankScore: number;
  explanations: string[];
  warnings: string[];
};

export type SearchMeta = {
  cachedSearchUsed: boolean;
  tripHydrationCount: number;
  generatedAt: string;
  warnings: string[];
};

export type AwardSearchResponse = {
  results: RankedAwardResult[];
  meta: SearchMeta;
};

export type ExtensionMatchResponse = {
  matchStatus: ExtensionMatchStatus;
  matchedAwards: RankedAwardResult[];
  meta: SearchMeta;
};

export const DEFAULT_WALLET_BALANCES: WalletBalances = {
  amex_mr: 40000,
  chase_ur: 35000,
};

export const DEFAULT_WALLET_VALUATIONS: WalletValuations = {
  amex_mr: 1.7,
  chase_ur: 1.6,
};

export const SEARCH_REQUEST_SCHEMA = z.object({
  origin: z.string().trim().length(3).regex(/^[A-Z]{3}$/),
  destination: z.string().trim().length(3).regex(/^[A-Z]{3}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cabin: z.enum(CABINS),
  walletBalances: z.object({
    amex_mr: z.number().int().min(0),
    chase_ur: z.number().int().min(0),
  }),
  reachableOnly: z.boolean(),
  sort: z.enum(SORT_MODES),
});

const FLIGHT_SEGMENT_FINGERPRINT_SCHEMA = z.object({
  marketingCarrier: z.string().trim().min(1),
  operatingCarrier: z.string().trim().min(1).nullable().optional(),
  flightNumber: z.string().trim().min(1),
  originAirport: z.string().trim().length(3).regex(/^[A-Z]{3}$/),
  destinationAirport: z.string().trim().length(3).regex(/^[A-Z]{3}$/),
  departureTime: z.string().trim().min(1),
  arrivalTime: z.string().trim().min(1).nullable().optional(),
});

export const EXTENSION_MATCH_REQUEST_SCHEMA = z.object({
  searchContext: z.object({
    origin: z.string().trim().length(3).regex(/^[A-Z]{3}$/),
    destination: z.string().trim().length(3).regex(/^[A-Z]{3}$/),
    departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    cabin: z.enum(CABINS).optional(),
  }),
  itineraryFingerprint: z.object({
    segmentCount: z.number().int().min(1),
    stopCount: z.number().int().min(0),
    segments: z.array(FLIGHT_SEGMENT_FINGERPRINT_SCHEMA).min(1),
  }),
  walletBalances: z.object({
    amex_mr: z.number().int().min(0),
    chase_ur: z.number().int().min(0),
  }),
  walletValuations: z
    .object({
      amex_mr: z.number().min(0).max(10).optional(),
      chase_ur: z.number().min(0).max(10).optional(),
    })
    .optional(),
});
