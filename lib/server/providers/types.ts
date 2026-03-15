import type {
  AwardSearchRequest,
  Cabin,
  ProviderTripRecord,
  SearchCandidate,
} from "@/lib/domain/types";

export interface AwardSearchProvider {
  searchCandidates(input: AwardSearchRequest): Promise<SearchCandidate[]>;
  getTrip(tripId: string, cabin: Cabin): Promise<ProviderTripRecord[]>;
}
