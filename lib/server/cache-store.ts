import Database from "better-sqlite3";
import path from "path";

type CachedRecord<T> = {
  payload: string;
  expires_at: number;
};

export interface CacheStore {
  getSearchCache<T>(key: string): T | null;
  setSearchCache(key: string, payload: unknown, expiresAt: number): void;
  getTripCache<T>(tripId: string): T | null;
  setTripCache(tripId: string, payload: unknown, expiresAt: number): void;
  incrementUsage(day: string): void;
  getUsage(day: string): number;
}

function defaultDbPath() {
  return process.env.FLIGHTDEAL_DB_PATH ?? path.join(process.cwd(), "flightdeal.sqlite");
}

function parseRecord<T>(value: string | undefined, expiresAt: number) {
  if (!value) {
    return null;
  }

  if (expiresAt <= Date.now()) {
    return null;
  }

  return JSON.parse(value) as T;
}

export class SqliteCacheStore implements CacheStore {
  private readonly db: Database.Database;

  constructor(filename = defaultDbPath()) {
    this.db = new Database(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_cache (
        key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS trip_cache (
        trip_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS api_usage (
        day TEXT PRIMARY KEY,
        call_count INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  getSearchCache<T>(key: string) {
    const row = this.db
      .prepare("SELECT payload, expires_at FROM search_cache WHERE key = ?")
      .get(key) as CachedRecord<T> | undefined;

    return parseRecord<T>(row?.payload, row?.expires_at ?? 0);
  }

  setSearchCache(key: string, payload: unknown, expiresAt: number) {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO search_cache (key, payload, expires_at) VALUES (?, ?, ?)",
      )
      .run(key, JSON.stringify(payload), expiresAt);
  }

  getTripCache<T>(tripId: string) {
    const row = this.db
      .prepare("SELECT payload, expires_at FROM trip_cache WHERE trip_id = ?")
      .get(tripId) as CachedRecord<T> | undefined;

    return parseRecord<T>(row?.payload, row?.expires_at ?? 0);
  }

  setTripCache(tripId: string, payload: unknown, expiresAt: number) {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO trip_cache (trip_id, payload, expires_at) VALUES (?, ?, ?)",
      )
      .run(tripId, JSON.stringify(payload), expiresAt);
  }

  incrementUsage(day: string) {
    this.db
      .prepare(
        `
          INSERT INTO api_usage (day, call_count)
          VALUES (?, 1)
          ON CONFLICT(day) DO UPDATE SET call_count = call_count + 1
        `,
      )
      .run(day);
  }

  getUsage(day: string) {
    const row = this.db
      .prepare("SELECT call_count FROM api_usage WHERE day = ?")
      .get(day) as { call_count: number } | undefined;

    return row?.call_count ?? 0;
  }
}
