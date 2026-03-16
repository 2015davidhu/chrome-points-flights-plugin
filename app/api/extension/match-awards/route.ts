import { NextResponse } from "next/server";

import {
  DEFAULT_WALLET_VALUATIONS,
  EXTENSION_MATCH_REQUEST_SCHEMA,
  type ExtensionMatchRequest,
} from "@/lib/domain/types";
import { SqliteCacheStore } from "@/lib/server/cache-store";
import { ExtensionMatchService } from "@/lib/server/extension-match-service";
import { SeatsAeroAwardSearchProvider } from "@/lib/server/providers/seats-aero";

function buildService() {
  return new ExtensionMatchService({
    provider: new SeatsAeroAwardSearchProvider(),
    cacheStore: new SqliteCacheStore(),
  });
}

function mergeValuations(input: ExtensionMatchRequest) {
  return {
    ...DEFAULT_WALLET_VALUATIONS,
    ...input.walletValuations,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = EXTENSION_MATCH_REQUEST_SCHEMA.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid extension match request.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const result = await buildService().match({
      ...payload,
      walletValuations: mergeValuations(payload),
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
