const DEFAULT_SETTINGS = {
  apiBaseUrl: "http://127.0.0.1:3000",
  walletBalances: {
    amex_mr: 40000,
    chase_ur: 35000,
  },
  walletValuations: {
    amex_mr: 1.7,
    chase_ur: 1.6,
  },
};

const pendingRequests = new Map();

async function getSettings() {
  const stored = await chrome.storage.local.get("flightdealSettings");
  const settings = stored.flightdealSettings ?? {};

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    walletBalances: {
      ...DEFAULT_SETTINGS.walletBalances,
      ...(settings.walletBalances ?? {}),
    },
    walletValuations: {
      ...DEFAULT_SETTINGS.walletValuations,
      ...(settings.walletValuations ?? {}),
    },
  };
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  await chrome.storage.local.set({ flightdealSettings: settings });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "flightdeal.match-awards") {
    return false;
  }

  const cacheKey = JSON.stringify(message.payload);

  if (!pendingRequests.has(cacheKey)) {
    pendingRequests.set(
      cacheKey,
      (async () => {
        const settings = await getSettings();
        const response = await fetch(`${settings.apiBaseUrl}/api/extension/match-awards`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...message.payload,
            walletBalances: settings.walletBalances,
            walletValuations: settings.walletValuations,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Extension match request failed.");
        }

        return data;
      })()
        .finally(() => {
          pendingRequests.delete(cacheKey);
        }),
    );
  }

  pendingRequests
    .get(cacheKey)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected extension error.",
      }),
    );

  return true;
});
