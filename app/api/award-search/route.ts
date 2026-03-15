import { NextResponse } from "next/server";
import { z } from "zod";

import {
  DEFAULT_WALLET_VALUATIONS,
  SEARCH_REQUEST_SCHEMA,
  type AwardSearchRequest,
} from "@/lib/domain/types";
import { AwardSearchService } from "@/lib/server/award-search-service";
import { SqliteCacheStore } from "@/lib/server/cache-store";
import { SeatsAeroAwardSearchProvider } from "@/lib/server/providers/seats-aero";

const requestSchema = SEARCH_REQUEST_SCHEMA.extend({
  walletValuations: z
    .object({
      amex_mr: z.number().min(0).max(10).optional(),
      chase_ur: z.number().min(0).max(10).optional(),
    })
    .optional(),
});

function buildService() {
  return new AwardSearchService({
    provider: new SeatsAeroAwardSearchProvider(),
    cacheStore: new SqliteCacheStore(),
  });
}

function mergeValuations(input: AwardSearchRequest) {
  return {
    ...DEFAULT_WALLET_VALUATIONS,
    ...input.walletValuations,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid search request.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const service = buildService();
    const payload = parsed.data;
    const result = await service.search({
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
