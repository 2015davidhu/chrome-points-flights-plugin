import "server-only";

import type {
  AwardSearchRequest,
  BookableProgramHint,
  Cabin,
  ProviderTripRecord,
  SupportedSourceProgram,
  SearchCandidate,
} from "@/lib/domain/types";
import type { AwardSearchProvider } from "@/lib/server/providers/types";

const DEFAULT_BASE_URL = "https://seats.aero/partnerapi";

function expectObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function readNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

function readArray(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function normalizeCabinName(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, "_");
}

const BOOKING_PROGRAM_LABELS = new Map<string, { normalizedProgram?: SupportedSourceProgram; displayLabel: string }>([
  ["air canada aeroplan", { normalizedProgram: "aeroplan", displayLabel: "Aeroplan" }],
  ["aeroplan", { normalizedProgram: "aeroplan", displayLabel: "Aeroplan" }],
  ["united mileageplus", { normalizedProgram: "united_mileageplus", displayLabel: "United MileagePlus" }],
  ["united", { normalizedProgram: "united_mileageplus", displayLabel: "United MileagePlus" }],
  ["virgin atlantic", { normalizedProgram: "virgin_atlantic", displayLabel: "Virgin Atlantic" }],
  ["virgin atlantic flying club", { normalizedProgram: "virgin_atlantic", displayLabel: "Virgin Atlantic" }],
  ["iberia plus", { normalizedProgram: "iberia_plus", displayLabel: "Iberia Plus" }],
  ["british airways", { normalizedProgram: "british_airways", displayLabel: "British Airways" }],
  ["delta skymiles", { normalizedProgram: "delta_skymiles", displayLabel: "Delta SkyMiles" }],
  ["flying blue", { normalizedProgram: "flying_blue", displayLabel: "Flying Blue" }],
  ["emirates skywards", { normalizedProgram: "emirates_skywards", displayLabel: "Emirates Skywards" }],
  ["etihad guest", { normalizedProgram: "etihad_guest", displayLabel: "Etihad Guest" }],
  ["singapore krisflyer", { normalizedProgram: "singapore_krisflyer", displayLabel: "KrisFlyer" }],
  ["southwest rapid rewards", { normalizedProgram: "southwest_rapid_rewards", displayLabel: "Southwest Rapid Rewards" }],
  ["jetblue trueblue", { normalizedProgram: "jetblue_trueblue", displayLabel: "JetBlue TrueBlue" }],
  ["qantas frequent flyer", { normalizedProgram: "qantas_frequent_flyer", displayLabel: "Qantas Frequent Flyer" }],
  ["aeromexico rewards", { normalizedProgram: "aeromexico_rewards", displayLabel: "Aeromexico Rewards" }],
  ["aer lingus aerclub", { normalizedProgram: "aer_lingus_aerclub", displayLabel: "AerClub" }],
  ["hawaiianmiles", { normalizedProgram: "hawaiianmiles", displayLabel: "HawaiianMiles" }],
  ["copa connectmiles", { displayLabel: "Copa ConnectMiles" }],
  ["miles & more", { displayLabel: "Miles & More" }],
]);

function candidateIdsFromSearchPayload(payload: unknown) {
  const record = expectObject(payload);

  if (!record) {
    return [];
  }

  return readArray(record, "data")
    .map((entry) => expectObject(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => readString(entry, ["ID"]))
    .filter((id): id is string => Boolean(id));
}

function normalizeBookingLinkLabel(rawLabel: string): BookableProgramHint {
  const label = rawLabel.replace(/^Book via\s+/i, "").trim();
  const normalizedKey = label.toLowerCase();
  const mapping = BOOKING_PROGRAM_LABELS.get(normalizedKey);

  return {
    rawLabel,
    normalizedProgram: mapping?.normalizedProgram,
    displayLabel: mapping?.displayLabel ?? label,
    primary: false,
  };
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function extractOperatingCarriers(entry: Record<string, unknown>) {
  const segments = readArray(entry, "AvailabilitySegments")
    .map((segment) => expectObject(segment))
    .filter((segment): segment is Record<string, unknown> => segment !== null);
  const carriersFromSegments = segments
    .map((segment) => readString(segment, ["FlightNumber"]))
    .filter((value): value is string => Boolean(value))
    .map((flightNumber) => flightNumber.split(/\s+/)[0]?.replace(/[0-9].*$/, "") ?? "")
    .map((carrier) => carrier.trim())
    .filter(Boolean);

  if (carriersFromSegments.length > 0) {
    return uniqueStrings(carriersFromSegments);
  }

  return uniqueStrings(
    (readString(entry, ["Carriers"]) ?? "")
      .split(",")
      .map((carrier) => carrier.trim()),
  );
}

function extractBookingProgramHints(payload: Record<string, unknown>) {
  return readArray(payload, "booking_links")
    .map((link) => expectObject(link))
    .filter((link): link is Record<string, unknown> => link !== null)
    .map((link) => {
      const hint = normalizeBookingLinkLabel(readString(link, ["label"]) ?? "Unknown booking option");

      return {
        ...hint,
        primary: Boolean(link.primary),
      };
    });
}

function minorUnitsToUsd(amount: number, currency: string) {
  const fxToUsd: Record<string, number> = {
    USD: 1,
    EUR: 1.09,
    GBP: 1.28,
    CAD: 0.74,
    CHF: 1.13,
    AUD: 0.66,
    NZD: 0.61,
    JPY: 0.0067,
  };

  const majorUnits = amount / 100;
  const rate = fxToUsd[currency.toUpperCase()] ?? 1;

  return Number((majorUnits * rate).toFixed(2));
}

function tripWarnings(currency: string) {
  if (currency.toUpperCase() === "USD") {
    return [];
  }

  return [`Taxes converted from ${currency.toUpperCase()} to USD using a static FX estimate.`];
}

export class SeatsAeroAwardSearchProvider implements AwardSearchProvider {
  private readonly apiKey: string;

  private readonly baseUrl: string;

  constructor({
    apiKey = process.env.SEATS_AERO_API_KEY,
    baseUrl = process.env.SEATS_AERO_BASE_URL ?? DEFAULT_BASE_URL,
  }: {
    apiKey?: string;
    baseUrl?: string;
  } = {}) {
    if (!apiKey) {
      throw new Error("SEATS_AERO_API_KEY is required for award search.");
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request(path: string, params?: URLSearchParams) {
    const url = new URL(`${this.baseUrl}${path}`);

    if (params) {
      url.search = params.toString();
    }

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Partner-Authorization": this.apiKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Seats.aero request failed with status ${response.status}.`);
    }

    return response.json();
  }

  async searchCandidates(input: AwardSearchRequest): Promise<SearchCandidate[]> {
    const params = new URLSearchParams({
      origin_airport: input.origin,
      destination_airport: input.destination,
      start_date: input.startDate,
      end_date: input.endDate,
      cabin: input.cabin,
    });
    const data = await this.request("/search", params);
    const tripIds = candidateIdsFromSearchPayload(data);

    return tripIds.map((tripId) => ({ tripId }));
  }

  async getTrip(tripId: string, cabin: Cabin): Promise<ProviderTripRecord[]> {
    const data = await this.request(`/trips/${tripId}`);
    const payload = expectObject(data);

    if (!payload) {
      return [];
    }

    const bookablePrograms = extractBookingProgramHints(payload);

    return readArray(payload, "data")
      .map((entry) => expectObject(entry))
      .filter((entry): entry is Record<string, unknown> => entry !== null)
      .filter((entry) => normalizeCabinName(readString(entry, ["Cabin"]) ?? "") === cabin)
      .map((entry) => {
        const taxesCurrency = readString(entry, ["TaxesCurrency"]) ?? "USD";
        const operatingCarriers = extractOperatingCarriers(entry);

        return {
          tripId: readString(entry, ["ID"]) ?? tripId,
          origin: readString(entry, ["OriginAirport"]) ?? "",
          destination: readString(entry, ["DestinationAirport"]) ?? "",
          departureDate: readString(entry, ["DepartsAt", "Date"]) ?? "",
          carrier: readString(entry, ["Carriers", "FlightNumbers"]) ?? "Unknown carrier",
          marketingCarriersLabel: readString(entry, ["Carriers"]) ?? undefined,
          cabin: readString(entry, ["Cabin"]) ?? cabin,
          sourceProgramRaw: readString(entry, ["Source"]) ?? "unknown",
          pricingProgramDisplay: bookablePrograms.find((program) => program.primary)?.displayLabel,
          milesPrice: readNumber(entry, ["MileageCost"]) ?? 0,
          taxesUsd: minorUnitsToUsd(readNumber(entry, ["TotalTaxes"]) ?? 0, taxesCurrency),
          stops: readNumber(entry, ["Stops"]) ?? 0,
          durationMinutes: readNumber(entry, ["TotalDuration"]) ?? 0,
          remainingSeats: readNumber(entry, ["RemainingSeats"]) ?? null,
          operatingCarriers,
          bookablePrograms,
          freshness: "cached" as const,
          warnings: tripWarnings(taxesCurrency),
        };
      });
  }
}
