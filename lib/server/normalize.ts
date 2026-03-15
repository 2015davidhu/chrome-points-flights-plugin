import type {
  BookableProgramHint,
  Cabin,
  NormalizedAward,
  PartnerBookingType,
  ProviderTripRecord,
  SupportedSourceProgram,
} from "@/lib/domain/types";

const PROGRAM_ALIASES = new Map<string, SupportedSourceProgram>([
  ["aer lingus aerclub", "aer_lingus_aerclub"],
  ["aer lingus", "aer_lingus_aerclub"],
  ["aeromexico rewards", "aeromexico_rewards"],
  ["aeromexico", "aeromexico_rewards"],
  ["aeroplan", "aeroplan"],
  ["air canada aeroplan", "aeroplan"],
  ["aircanada", "aeroplan"],
  ["air canada", "aeroplan"],
  ["aer club", "aer_lingus_aerclub"],
  ["aerlingus", "aer_lingus_aerclub"],
  ["british airways", "british_airways"],
  ["british airways executive club", "british_airways"],
  ["britishairways", "british_airways"],
  ["delta", "delta_skymiles"],
  ["delta skymiles", "delta_skymiles"],
  ["flyingblue", "flying_blue"],
  ["emirates", "emirates_skywards"],
  ["emirates skywards", "emirates_skywards"],
  ["emiratesskywards", "emirates_skywards"],
  ["etihad", "etihad_guest"],
  ["etihad guest", "etihad_guest"],
  ["etihadguest", "etihad_guest"],
  ["flying blue", "flying_blue"],
  ["hawaiianmiles", "hawaiianmiles"],
  ["iberia plus", "iberia_plus"],
  ["iberia", "iberia_plus"],
  ["iberiaplus", "iberia_plus"],
  ["jetblue", "jetblue_trueblue"],
  ["jetblue trueblue", "jetblue_trueblue"],
  ["trueblue", "jetblue_trueblue"],
  ["qantas frequent flyer", "qantas_frequent_flyer"],
  ["qantas", "qantas_frequent_flyer"],
  ["qantasfrequentflyer", "qantas_frequent_flyer"],
  ["singapore krisflyer", "singapore_krisflyer"],
  ["krisflyer", "singapore_krisflyer"],
  ["singapore", "singapore_krisflyer"],
  ["singaporeairlines", "singapore_krisflyer"],
  ["southwest", "southwest_rapid_rewards"],
  ["southwest rapid rewards", "southwest_rapid_rewards"],
  ["southwestrapidrewards", "southwest_rapid_rewards"],
  ["united", "united_mileageplus"],
  ["united mileageplus", "united_mileageplus"],
  ["mileageplus", "united_mileageplus"],
  ["virgin atlantic", "virgin_atlantic"],
  ["virgin atlantic flying club", "virgin_atlantic"],
  ["virginatlantic", "virgin_atlantic"],
]);

function normalizeProgram(value: string) {
  const normalized = value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return PROGRAM_ALIASES.get(normalized) ?? null;
}

function normalizeCabin(value: string): Cabin | null {
  const normalized = value.toLowerCase().trim().replace(/\s+/g, "_");

  if (normalized === "premiumeconomy") {
    return "premium_economy";
  }

  if (
    normalized === "economy" ||
    normalized === "premium_economy" ||
    normalized === "business" ||
    normalized === "first"
  ) {
    return normalized;
  }

  return null;
}

function normalizeCarrierName(value: string) {
  return value.trim().toUpperCase();
}

function inferPartnerBookingType(
  sourceProgram: SupportedSourceProgram,
  operatingCarriers: string[],
  bookablePrograms: BookableProgramHint[],
): PartnerBookingType {
  const normalizedCarriers = operatingCarriers.map(normalizeCarrierName);
  const primaryBookableProgram =
    bookablePrograms.find((program) => program.primary)?.normalizedProgram ?? sourceProgram;
  const hasAlternateBookableProgram = bookablePrograms.some(
    (program) => program.normalizedProgram && program.normalizedProgram !== sourceProgram,
  );
  const carrierMatchesProgram = normalizedCarriers.some((carrier) => {
    if (sourceProgram === "virgin_atlantic") {
      return carrier.includes("VS");
    }

    if (sourceProgram === "united_mileageplus") {
      return carrier.includes("UA");
    }

    if (sourceProgram === "aeroplan") {
      return carrier.includes("AC");
    }

    if (sourceProgram === "delta_skymiles") {
      return carrier.includes("DL");
    }

    return false;
  });

  if (hasAlternateBookableProgram || primaryBookableProgram !== sourceProgram) {
    return "alt_programs_observed";
  }

  if (!carrierMatchesProgram) {
    return "same_program_partner_metal";
  }

  return "same_program_same_metal";
}

export function normalizeTripRecord(record: ProviderTripRecord): NormalizedAward | null {
  const sourceProgram = normalizeProgram(record.sourceProgramRaw);
  const cabin = normalizeCabin(record.cabin);

  if (!sourceProgram || !cabin) {
    return null;
  }

  return {
    tripId: record.tripId,
    origin: record.origin,
    destination: record.destination,
    departureDate: record.departureDate,
    carrier: record.carrier,
    marketingCarriersLabel: record.marketingCarriersLabel,
    cabin,
    sourceProgram,
    pricingProgramDisplay: record.pricingProgramDisplay,
    milesPrice: record.milesPrice,
    taxesUsd: record.taxesUsd,
    stops: record.stops,
    durationMinutes: record.durationMinutes,
    remainingSeats: record.remainingSeats,
    operatingCarriers: record.operatingCarriers ?? [],
    bookablePrograms: record.bookablePrograms ?? [],
    partnerBookingType: inferPartnerBookingType(
      sourceProgram,
      record.operatingCarriers ?? [],
      record.bookablePrograms ?? [],
    ),
    freshness: record.freshness,
  };
}
