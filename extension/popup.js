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

async function loadSettings() {
  const stored = await chrome.storage.local.get("flightdealSettings");
  return {
    ...DEFAULT_SETTINGS,
    ...(stored.flightdealSettings ?? {}),
    walletBalances: {
      ...DEFAULT_SETTINGS.walletBalances,
      ...(stored.flightdealSettings?.walletBalances ?? {}),
    },
    walletValuations: {
      ...DEFAULT_SETTINGS.walletValuations,
      ...(stored.flightdealSettings?.walletValuations ?? {}),
    },
  };
}

function fillForm(form, settings) {
  form.apiBaseUrl.value = settings.apiBaseUrl;
  form.amexBalance.value = settings.walletBalances.amex_mr;
  form.chaseBalance.value = settings.walletBalances.chase_ur;
  form.amexValue.value = settings.walletValuations.amex_mr;
  form.chaseValue.value = settings.walletValuations.chase_ur;
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("settings-form");
  const status = document.getElementById("status");
  const settings = await loadSettings();

  fillForm(form, settings);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    await chrome.storage.local.set({
      flightdealSettings: {
        apiBaseUrl: form.apiBaseUrl.value || DEFAULT_SETTINGS.apiBaseUrl,
        walletBalances: {
          amex_mr: Number(form.amexBalance.value || DEFAULT_SETTINGS.walletBalances.amex_mr),
          chase_ur: Number(form.chaseBalance.value || DEFAULT_SETTINGS.walletBalances.chase_ur),
        },
        walletValuations: {
          amex_mr: Number(form.amexValue.value || DEFAULT_SETTINGS.walletValuations.amex_mr),
          chase_ur: Number(form.chaseValue.value || DEFAULT_SETTINGS.walletValuations.chase_ur),
        },
      },
    });

    status.textContent = "Saved.";
  });
});
