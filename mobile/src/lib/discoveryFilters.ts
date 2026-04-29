import { supabase } from './supabase/client';
import type { UserGender } from './types';

// Mirrors get_discovery_feed_v4 params and the profiles.discovery_filters
// JSONB shape. Optional everywhere — missing keys mean "no constraint".
export type DiscoveryFilters = {
  age_min?: number;
  age_max?: number;
  genders?: UserGender[];
  max_distance_km?: number;
  relationship_intents?: string[];
};

export const DEFAULT_FILTERS: DiscoveryFilters = {
  age_min: 18,
  age_max: 99,
};

export const AGE_BOUNDS = { min: 18, max: 99 } as const;
export const DISTANCE_BOUNDS = { min: 1, max: 100 } as const;

export async function loadFilters(userId: string): Promise<DiscoveryFilters> {
  const { data, error } = await supabase
    .from('profiles')
    .select('discovery_filters')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return { ...DEFAULT_FILTERS };
  }

  const stored = (data.discovery_filters as Partial<DiscoveryFilters>) || {};
  return { ...DEFAULT_FILTERS, ...stored };
}

export async function saveFilters(userId: string, filters: DiscoveryFilters): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ discovery_filters: filters })
    .eq('id', userId);
  if (error) {
    throw error;
  }
}

// Strips empty/default values before sending to the RPC so we don't
// over-constrain the server. Mirrors the SQL "NULL = no constraint" contract.
export function toRpcParams(filters: DiscoveryFilters): {
  p_age_min: number | null;
  p_age_max: number | null;
  p_genders: string[] | null;
  p_max_distance_km: number | null;
  p_relationship_intents: string[] | null;
} {
  return {
    p_age_min: filters.age_min != null && filters.age_min > AGE_BOUNDS.min ? filters.age_min : null,
    p_age_max: filters.age_max != null && filters.age_max < AGE_BOUNDS.max ? filters.age_max : null,
    p_genders: filters.genders && filters.genders.length > 0 ? (filters.genders as string[]) : null,
    p_max_distance_km: filters.max_distance_km ?? null,
    p_relationship_intents:
      filters.relationship_intents && filters.relationship_intents.length > 0
        ? filters.relationship_intents
        : null,
  };
}
