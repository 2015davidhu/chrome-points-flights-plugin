import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FlightDealApp } from "@/components/flight-deal-app";
import type { AwardSearchResponse } from "@/lib/domain/types";

const mockResponse: AwardSearchResponse = {
  results: [
    {
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
      operatingCarriers: ["ANA"],
      bookablePrograms: [
        {
          rawLabel: "Book via Air Canada Aeroplan",
          normalizedProgram: "aeroplan",
          displayLabel: "Aeroplan",
          primary: true,
        },
        {
          rawLabel: "Book via Virgin Atlantic Flying Club",
          normalizedProgram: "virgin_atlantic",
          displayLabel: "Virgin Atlantic",
          primary: false,
        },
      ],
      partnerBookingType: "alt_programs_observed",
      freshness: "cached",
      reachable: true,
      bestFundingPath: {
        sourceProgram: "aeroplan",
        destinationUnits: 70000,
        parts: [
          { currency: "amex_mr", amount: 35000 },
          { currency: "chase_ur", amount: 35000 },
        ],
        transferSpeedBucket: "instant",
        walletCostUsd: 1155,
      },
      alternativeFundingPaths: [],
      pathCostUsd: 1241,
      rankScore: 84,
      explanations: ["Nonstop itinerary. Low fees."],
      warnings: ["Indexed availability from Seats.aero, not confirmed live inventory."],
    },
    {
      tripId: "trip-2",
      origin: "JFK",
      destination: "ZRH",
      departureDate: "2026-06-04",
      carrier: "UA",
      marketingCarriersLabel: "UA",
      cabin: "business",
      sourceProgram: "united_mileageplus",
      pricingProgramDisplay: "United MileagePlus",
      milesPrice: 80000,
      taxesUsd: 6,
      stops: 0,
      durationMinutes: 485,
      remainingSeats: 1,
      operatingCarriers: ["UA"],
      bookablePrograms: [
        {
          rawLabel: "Book via United MileagePlus",
          normalizedProgram: "united_mileageplus",
          displayLabel: "United MileagePlus",
          primary: true,
        },
      ],
      partnerBookingType: "same_program_same_metal",
      freshness: "cached",
      reachable: false,
      bestFundingPath: null,
      alternativeFundingPaths: [],
      pathCostUsd: null,
      rankScore: 12,
      explanations: ["Not fundable with current balances."],
      warnings: [
        "Indexed availability from Seats.aero, not confirmed live inventory.",
        "Current balances do not cover the required transfer amount.",
      ],
    },
  ],
  meta: {
    cachedSearchUsed: false,
    tripHydrationCount: 2,
    generatedAt: "2026-03-14T21:50:00.000Z",
    warnings: [],
  },
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }),
  );
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FlightDealApp", () => {
  it("validates the form before searching", async () => {
    render(<FlightDealApp />);
    const user = userEvent.setup();

    const originInput = screen.getByLabelText("Origin");
    await user.clear(originInput);
    await user.type(originInput, "J");
    fireEvent.click(screen.getByRole("button", { name: "Search awards" }));

    expect(
      await screen.findByText("Origin must be a 3-letter IATA airport code."),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("persists wallet settings in localStorage", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<FlightDealApp />);

    const amexInput = screen.getByLabelText("Amex MR balance");
    await user.clear(amexInput);
    await user.type(amexInput, "12345");

    unmount();
    render(<FlightDealApp />);

    expect(screen.getByLabelText("Amex MR balance")).toHaveValue(12345);
  });

  it("shows unreachable options when reachable-only is turned off", async () => {
    render(<FlightDealApp />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Start date"));
    await user.type(screen.getByLabelText("Start date"), "2026-06-01");
    await user.clear(screen.getByLabelText("End date"));
    await user.type(screen.getByLabelText("End date"), "2026-06-15");
    await user.click(screen.getByLabelText("Reachable only"));
    await user.click(screen.getByRole("button", { name: "Search awards" }));

    expect(await screen.findByText("Show 1 unreachable option(s)")).toBeInTheDocument();
  });

  it("renders explanation and freshness copy after search", async () => {
    render(<FlightDealApp />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Start date"));
    await user.type(screen.getByLabelText("Start date"), "2026-06-01");
    await user.clear(screen.getByLabelText("End date"));
    await user.type(screen.getByLabelText("End date"), "2026-06-15");
    await user.click(screen.getByRole("button", { name: "Search awards" }));

    await waitFor(() => {
      expect(screen.getByText("Nonstop itinerary. Low fees.")).toBeInTheDocument();
      expect(
        screen.getByText("Indexed availability from Seats.aero (cached)"),
      ).toBeInTheDocument();
    });
  });

  it("renders operating carrier and alternate booking program hints", async () => {
    render(<FlightDealApp />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Start date"));
    await user.type(screen.getByLabelText("Start date"), "2026-06-01");
    await user.clear(screen.getByLabelText("End date"));
    await user.type(screen.getByLabelText("End date"), "2026-06-15");
    await user.click(screen.getByRole("button", { name: "Search awards" }));

    await waitFor(() => {
      expect(screen.getByText("Flight operated by")).toBeInTheDocument();
      expect(screen.getByText("ANA")).toBeInTheDocument();
      expect(screen.getByText("Also bookable via")).toBeInTheDocument();
      expect(screen.getByText("Virgin Atlantic")).toBeInTheDocument();
    });
  });
});
