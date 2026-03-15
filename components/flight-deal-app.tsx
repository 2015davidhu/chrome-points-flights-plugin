"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  CABINS,
  DEFAULT_WALLET_BALANCES,
  DEFAULT_WALLET_VALUATIONS,
  SORT_MODES,
  type AwardSearchRequest,
  type AwardSearchResponse,
  type RankedAwardResult,
  type SortMode,
  type WalletBalances,
  type WalletCurrency,
  type WalletValuations,
} from "@/lib/domain/types";
import {
  formatDate,
  formatDuration,
  formatMoney,
  formatPoints,
  formatProgram,
} from "@/lib/utils/format";

import styles from "./flight-deal-app.module.css";

const STORAGE_KEY = "flightdeal.wallet-settings";

type SearchFormState = {
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  cabin: AwardSearchRequest["cabin"];
  walletBalances: WalletBalances;
  walletValuations: WalletValuations;
  reachableOnly: boolean;
  sort: SortMode;
};

const defaultState: SearchFormState = {
  origin: "JFK",
  destination: "ZRH",
  startDate: "",
  endDate: "",
  cabin: "business",
  walletBalances: DEFAULT_WALLET_BALANCES,
  walletValuations: DEFAULT_WALLET_VALUATIONS,
  reachableOnly: true,
  sort: "best_overall",
};

type SearchStatus = "idle" | "loading" | "ready" | "error";

function validateForm(state: SearchFormState): string | null {
  const airportCode = /^[A-Z]{3}$/;

  if (!airportCode.test(state.origin.trim().toUpperCase())) {
    return "Origin must be a 3-letter IATA airport code.";
  }

  if (!airportCode.test(state.destination.trim().toUpperCase())) {
    return "Destination must be a 3-letter IATA airport code.";
  }

  if (!state.startDate || !state.endDate) {
    return "Choose a start and end date.";
  }

  if (state.startDate > state.endDate) {
    return "Start date must be on or before end date.";
  }

  if (
    Object.values(state.walletBalances).some((value) => Number.isNaN(value) || value < 0)
  ) {
    return "Wallet balances must be zero or greater.";
  }

  if (
    Object.values(state.walletValuations).some(
      (value) => Number.isNaN(value) || value < 0 || value > 10,
    )
  ) {
    return "Wallet valuations must stay between 0 and 10 cents per point.";
  }

  return null;
}

function readStoredWallets() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Pick<
      SearchFormState,
      "walletBalances" | "walletValuations"
    >;

    return parsed;
  } catch {
    return null;
  }
}

function writeStoredWallets(
  walletBalances: WalletBalances,
  walletValuations: WalletValuations,
) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ walletBalances, walletValuations }),
  );
}

function pathSegmentWidth(result: RankedAwardResult, currency: WalletCurrency) {
  const total = result.bestFundingPath?.parts.reduce((sum, part) => sum + part.amount, 0) ?? 0;
  const segment =
    result.bestFundingPath?.parts.find((part) => part.currency === currency)?.amount ?? 0;

  return total === 0 ? 0 : (segment / total) * 100;
}

function renderFundingPath(result: RankedAwardResult) {
  if (!result.bestFundingPath) {
    return "Not fundable with current balances";
  }

  return result.bestFundingPath.parts
    .map((part) => `${formatPoints(part.amount)} ${part.currency === "amex_mr" ? "Amex" : "Chase"}`)
    .join(" + ");
}

function renderOperatingCarriers(result: RankedAwardResult) {
  if (result.operatingCarriers.length === 0) {
    return "Operating carrier unavailable";
  }

  return result.operatingCarriers.join(", ");
}

function renderBookablePrograms(result: RankedAwardResult) {
  const alternatePrograms = result.bookablePrograms.filter(
    (program) => !program.primary && program.displayLabel,
  );

  if (alternatePrograms.length === 0) {
    return "No additional observed booking programs";
  }

  return alternatePrograms.map((program) => program.displayLabel).join(", ");
}

function renderQualitySummary(result: RankedAwardResult) {
  const qualityParts = [
    result.stops === 0 ? "Nonstop" : `${result.stops} stop${result.stops > 1 ? "s" : ""}`,
    formatDuration(result.durationMinutes),
    result.remainingSeats
      ? `${result.remainingSeats} seat${result.remainingSeats > 1 ? "s" : ""}`
      : "Seat count unknown",
  ];

  return qualityParts.join(" · ");
}

function ResultCard({ result, muted = false }: { result: RankedAwardResult; muted?: boolean }) {
  return (
    <article className={`${styles.card} ${muted ? styles.cardMuted : ""}`}>
      <div className={styles.cardTop}>
        <div>
          <div className={styles.cardEyebrow}>
            Priced via {result.pricingProgramDisplay ?? formatProgram(result.sourceProgram)}
          </div>
          <h3 className={styles.cardTitle}>
            {result.carrier} {result.origin} → {result.destination}
          </h3>
          <p className={styles.cardSub}>
            {formatDate(result.departureDate)} · {result.cabin}
          </p>
        </div>
        <span
          className={`${styles.badge} ${
            result.reachable ? styles.badgeReachable : styles.badgeUnreachable
          }`}
        >
          {result.reachable ? "Reachable" : "Unreachable"}
        </span>
      </div>

      <div className={styles.price}>
        {formatPoints(result.milesPrice)} {formatProgram(result.sourceProgram)} +{" "}
        {formatMoney(result.taxesUsd)}
      </div>
      <div className={styles.primaryDecision}>
        <div className={styles.fundingSummary}>
          <div className={styles.fundingLabel}>Best funding path</div>
          <div className={styles.fundingValue}>{renderFundingPath(result)}</div>
        </div>
        <div className={styles.explanationBox}>
          <div className={styles.explanationLabel}>Why this ranks here</div>
          <div className={styles.explanationValue}>
            {result.explanations[0] ?? "Ranked on cost, routing quality, and reachability."}
          </div>
        </div>
      </div>

      <div className={styles.detailGrid}>
        <div className={styles.detailCard}>
          <div className={styles.detailLabel}>Flight operated by</div>
          <div className={styles.detailValue}>{renderOperatingCarriers(result)}</div>
        </div>
        {result.bookablePrograms.length > 1 ? (
          <div className={styles.detailCard}>
            <div className={styles.detailLabel}>Also bookable via</div>
            <div className={styles.detailValue}>{renderBookablePrograms(result)}</div>
          </div>
        ) : null}
        <div className={styles.detailCard}>
          <div className={styles.detailLabel}>Trip quality</div>
          <div className={styles.detailValue}>{renderQualitySummary(result)}</div>
        </div>
        <div className={styles.detailCard}>
          <div className={styles.detailLabel}>Freshness</div>
          <div className={styles.detailValue}>
            Indexed availability from Seats.aero ({result.freshness})
          </div>
        </div>
      </div>

      {result.bestFundingPath ? (
        <div className={styles.fundingBar} aria-label="Funding bar">
          <div
            className={styles.fundingSegmentAmex}
            style={{ width: `${pathSegmentWidth(result, "amex_mr")}%` }}
          />
          <div
            className={styles.fundingSegmentChase}
            style={{ width: `${pathSegmentWidth(result, "chase_ur")}%` }}
          />
        </div>
      ) : null}

      <div className={styles.notes}>
        {result.warnings.map((warning) => (
          <div className={styles.note} key={warning}>
            {warning}
          </div>
        ))}
      </div>
    </article>
  );
}

export function FlightDealApp() {
  const [state, setState] = useState<SearchFormState>(defaultState);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AwardSearchResponse | null>(null);

  useEffect(() => {
    const stored = readStoredWallets();

    if (!stored) {
      return;
    }

    setState((current) => ({
      ...current,
      walletBalances: {
        ...current.walletBalances,
        ...stored.walletBalances,
      },
      walletValuations: {
        ...current.walletValuations,
        ...stored.walletValuations,
      },
    }));
  }, []);

  useEffect(() => {
    writeStoredWallets(state.walletBalances, state.walletValuations);
  }, [state.walletBalances, state.walletValuations]);

  const reachableResults = useMemo(
    () => response?.results.filter((result) => result.reachable) ?? [],
    [response],
  );
  const unreachableResults = useMemo(
    () => response?.results.filter((result) => !result.reachable) ?? [],
    [response],
  );

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm(state);

    if (validationError) {
      setError(validationError);
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const requestBody: AwardSearchRequest = {
        origin: state.origin.trim().toUpperCase(),
        destination: state.destination.trim().toUpperCase(),
        startDate: state.startDate,
        endDate: state.endDate,
        cabin: state.cabin,
        walletBalances: state.walletBalances,
        walletValuations: state.walletValuations,
        reachableOnly: state.reachableOnly,
        sort: state.sort,
      };

      const apiResponse = await fetch("/api/award-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = (await apiResponse.json()) as AwardSearchResponse | { error: string };

      if (!apiResponse.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Search failed.");
      }

      setResponse(data);
      setStatus("ready");
    } catch (requestError) {
      setStatus("error");
      setError(
        requestError instanceof Error ? requestError.message : "Search request failed.",
      );
    }
  }

  return (
    <div className={styles.frame}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>FlightDeal · Indexed award funding optimizer</div>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>Find the award options your balances can actually fund.</h1>
          </div>
          <div className={styles.heroAside}>
            <p className={styles.lede}>
              FlightDeal is a lightweight decision layer on top of Seats.aero. Search a
              one-way trip, plug in your Amex MR and Chase UR balances, and rank indexed
              award options by funding path, taxes, and itinerary quality.
            </p>
            <div className={styles.heroMemo}>
              Search on the left. Decide on the right. The app should feel like a sharp
              shortlist, not a travel dashboard.
            </div>
          </div>
        </div>
        <div className={styles.facts}>
          <div className={styles.fact}>Indexed availability from Seats.aero</div>
          <div className={styles.fact}>Funding path based on your current balances</div>
          <div className={styles.fact}>Transfer timing may affect practical bookability</div>
        </div>
      </section>

      <div className={styles.grid}>
        <form className={styles.panel} onSubmit={handleSearch}>
          <h2 className={styles.panelTitle}>Search trip</h2>
          <p className={styles.panelCopy}>
            Search one-way award availability and rank only the options you can fund right
            now with your transferable points.
          </p>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.label}>Origin</span>
              <input
                className={styles.input}
                name="origin"
                maxLength={3}
                value={state.origin}
                onChange={(event) =>
                  setState((current) => ({ ...current, origin: event.target.value.toUpperCase() }))
                }
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Destination</span>
              <input
                className={styles.input}
                name="destination"
                maxLength={3}
                value={state.destination}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    destination: event.target.value.toUpperCase(),
                  }))
                }
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Start date</span>
              <input
                className={styles.input}
                type="date"
                value={state.startDate}
                onChange={(event) =>
                  setState((current) => ({ ...current, startDate: event.target.value }))
                }
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>End date</span>
              <input
                className={styles.input}
                type="date"
                value={state.endDate}
                onChange={(event) =>
                  setState((current) => ({ ...current, endDate: event.target.value }))
                }
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Cabin</span>
              <select
                className={styles.select}
                value={state.cabin}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    cabin: event.target.value as SearchFormState["cabin"],
                  }))
                }
              >
                {CABINS.map((cabin) => (
                  <option key={cabin} value={cabin}>
                    {cabin}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Sort</span>
              <select
                className={styles.select}
                value={state.sort}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    sort: event.target.value as SortMode,
                  }))
                }
              >
                {SORT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.subsection}>
            <h3 className={styles.panelTitle}>Wallets</h3>
            <div className={styles.compactGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Amex MR balance</span>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  value={state.walletBalances.amex_mr}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      walletBalances: {
                        ...current.walletBalances,
                        amex_mr: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Chase UR balance</span>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  value={state.walletBalances.chase_ur}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      walletBalances: {
                        ...current.walletBalances,
                        chase_ur: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Amex MR value (cents)</span>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="0.1"
                  value={state.walletValuations.amex_mr}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      walletValuations: {
                        ...current.walletValuations,
                        amex_mr: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Chase UR value (cents)</span>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="0.1"
                  value={state.walletValuations.chase_ur}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      walletValuations: {
                        ...current.walletValuations,
                        chase_ur: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
            </div>
          </div>

          <div className={styles.inlineActions}>
            <button className={styles.button} type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Ranking options..." : "Search awards"}
            </button>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={state.reachableOnly}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    reachableOnly: event.target.checked,
                  }))
                }
              />
              Reachable only
            </label>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}
        </form>

        <section className={styles.panel}>
          <div className={styles.resultsHeader}>
            <div>
              <h2 className={styles.panelTitle}>Ranked results</h2>
              <p className={styles.panelCopy}>
                Transparent ranking that weighs funding cost, taxes, routing quality, and
                transfer practicality.
              </p>
            </div>
            {response ? (
              <div className={styles.meta}>
                <span className={styles.metaValue}>{reachableResults.length}</span>
                <span>reachable</span>
                <span>{response.meta.tripHydrationCount} hydrated</span>
                <span>{formatDate(response.meta.generatedAt, true)}</span>
              </div>
            ) : null}
          </div>

          {response ? (
            <>
              {response.meta.warnings.length > 0 ? (
                <div className={styles.statusStrip}>
                  {response.meta.warnings.map((warning) => (
                    <div className={styles.statusItem} key={warning}>
                      {warning}
                    </div>
                  ))}
                </div>
              ) : null}
              {reachableResults.length > 0 ? (
                <div className={styles.cards}>
                  {reachableResults.map((result) => (
                    <ResultCard key={`${result.tripId}-${result.sourceProgram}`} result={result} />
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>
                  No reachable awards for this search. Try widening the date range or
                  lowering the cabin target.
                </div>
              )}
              {!state.reachableOnly && unreachableResults.length > 0 ? (
                <details className={styles.unreachableBlock}>
                  <summary className={styles.summary}>
                    Show {unreachableResults.length} unreachable option(s)
                  </summary>
                  <div className={styles.cards}>
                    {unreachableResults.map((result) => (
                      <ResultCard
                        key={`${result.tripId}-${result.sourceProgram}`}
                        result={result}
                        muted
                      />
                    ))}
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            <div className={styles.empty}>
              Search a route, add your wallet balances, and FlightDeal will rank indexed
              award options with the best funding path first.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
