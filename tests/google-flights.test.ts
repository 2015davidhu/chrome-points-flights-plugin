// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  extractItineraryFingerprint,
  extractSearchContext,
  findGoogleFlightsResultCards,
} from "@/lib/extension/google-flights";

function renderFixture() {
  document.body.innerHTML = `
    <main>
      <section
        data-flightdeal-role="search-context"
        data-origin="EWR"
        data-destination="SFO"
        data-departure-date="2026-04-01"
        data-cabin="economy"
      ></section>
      <div data-flightdeal-role="result-card" data-flightdeal-detail-id="trip-1">
        <button type="button">United · nonstop</button>
      </div>
      <section data-flightdeal-detail="trip-1">
        <div
          data-flightdeal-role="segment"
          data-marketing-carrier="UA"
          data-operating-carrier="UA"
          data-flight-number="123"
          data-origin-airport="EWR"
          data-destination-airport="SFO"
          data-departure-time="2026-04-01T08:00:00Z"
          data-arrival-time="2026-04-01T11:15:00Z"
        ></div>
      </section>
    </main>
  `;
}

describe("Google Flights extension helpers", () => {
  it("finds candidate result cards", () => {
    renderFixture();

    expect(findGoogleFlightsResultCards(document)).toHaveLength(1);
  });

  it("extracts page search context", () => {
    renderFixture();

    expect(extractSearchContext(document)).toEqual({
      origin: "EWR",
      destination: "SFO",
      departureDate: "2026-04-01",
      cabin: "economy",
    });
  });

  it("extracts an itinerary fingerprint from a detail panel", () => {
    renderFixture();
    const card = document.querySelector<HTMLElement>("[data-flightdeal-role='result-card']");

    expect(card).not.toBeNull();
    expect(extractItineraryFingerprint(card!, document)).toEqual({
      segmentCount: 1,
      stopCount: 0,
      segments: [
        {
          marketingCarrier: "UA",
          operatingCarrier: "UA",
          flightNumber: "123",
          originAirport: "EWR",
          destinationAirport: "SFO",
          departureTime: "2026-04-01T08:00:00Z",
          arrivalTime: "2026-04-01T11:15:00Z",
        },
      ],
    });
  });
});
