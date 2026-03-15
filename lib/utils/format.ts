import type { SupportedSourceProgram } from "@/lib/domain/types";

const programLabels: Record<SupportedSourceProgram, string> = {
  aeroplan: "Aeroplan",
  aeromexico_rewards: "Aeromexico Rewards",
  aer_lingus_aerclub: "AerClub",
  british_airways: "British Airways",
  delta_skymiles: "Delta SkyMiles",
  emirates_skywards: "Emirates Skywards",
  etihad_guest: "Etihad Guest",
  flying_blue: "Flying Blue",
  hawaiianmiles: "HawaiianMiles",
  iberia_plus: "Iberia Plus",
  jetblue_trueblue: "JetBlue TrueBlue",
  qantas_frequent_flyer: "Qantas Frequent Flyer",
  singapore_krisflyer: "KrisFlyer",
  southwest_rapid_rewards: "Southwest",
  united_mileageplus: "United",
  virgin_atlantic: "Virgin Atlantic",
};

export function formatProgram(program: SupportedSourceProgram) {
  return programLabels[program];
}

export function formatPoints(value: number) {
  if (value >= 1000) {
    const compact = value / 1000;
    const digits = Number.isInteger(compact) ? 0 : 1;
    return `${compact.toFixed(digits)}k`;
  }

  return Math.round(value).toLocaleString();
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}

export function formatDate(value: string, includeTime = false) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "numeric",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}
