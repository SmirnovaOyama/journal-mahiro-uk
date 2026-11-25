import type { DosageForm } from '../components/FormDoodle';
import {
  LSD_DETAIL,
  type CombinationEntry,
  type CommunitySourceGroup,
  type DoseLadderRow,
  type DurationTableRow,
  type PerspectiveQuote,
  type SubstanceFullDetail,
} from './lsdDetail';

export type CatalogCategory =
  | 'Psychedelic'
  | 'Dissociative'
  | 'Stimulant'
  | 'Empathogen'
  | 'Depressant'
  | 'Opioid'
  | 'Endocrine'
  | 'Cannabinoid'
  | 'Nootropic'
  | 'Deliriant'
  | 'Other';

export const CATALOG_CATEGORIES: readonly { id: 'All' | CatalogCategory; label: string }[] = [
  { id: 'All', label: 'All' },
  { id: 'Psychedelic', label: 'Psychedelic' },
  { id: 'Dissociative', label: 'Dissociative' },
  { id: 'Stimulant', label: 'Stimulant' },
  { id: 'Empathogen', label: 'Empathogen' },
  { id: 'Depressant', label: 'Depressant' },
  { id: 'Opioid', label: 'Opioid' },
  { id: 'Endocrine', label: 'Endocrine' },
  { id: 'Cannabinoid', label: 'Cannabinoid' },
  { id: 'Nootropic', label: 'Nootropic' },
  { id: 'Deliriant', label: 'Deliriant' },
  { id: 'Other', label: 'Other' },
];

export interface SubstanceIndexEntry {
  id: string;
  name: string;
  aliases: string;
  category: CatalogCategory;
  form: DosageForm;
  status: string;
  chemicalClass: string;
  primaryBand: {
    low: number;
    high: number;
    unit: string;
    roa: string;
  } | null;
  primaryDuration: {
    onset: string;
    peak: string;
    offset: string;
    total: string;
  } | null;
  richness: number;
}

export interface SubjectiveEffectLink {
  name: string;
  url?: string;
}

export interface CitationEntry {
  title: string;
  url?: string;
}

export interface SubstanceDetailData {
  id: string;
  name: string;
  form: DosageForm;
  status: string;
  aliases: string;
  category: string;
  chemicalClass?: string;
  psychoactiveClass?: string;
  halfLife?: string;
  marquis?: string;
  addictionPotential?: string;
  toxicity?: readonly string[];
  summarySources: string;
  summary: string;
  advisory?: string;
  perspectives?: readonly PerspectiveQuote[];
  doseBasis?: string;
  doseMaxTick: number;
  doseUnit: string;
  doseRows: readonly (DoseLadderRow & { threshold?: string })[];
  durationSources?: string;
  durationRows: readonly DurationTableRow[];
  effectProfile?: SubstanceFullDetail['effectProfile'];
  tolerance?: SubstanceFullDetail['tolerance'];
  effectsAnalysis?: SubstanceFullDetail['effectsAnalysis'];
  subjectiveEffects?: readonly SubjectiveEffectLink[];
  combinations: readonly CombinationEntry[];
  communityReports?: readonly CommunitySourceGroup[];
  referenceGuide?: SubstanceFullDetail['referenceGuide'];
  citations?: readonly CitationEntry[];
  helpfulLinks: readonly {
    title: string;
    description: string;
    url: string;
  }[];
}

export type TripSitComboMatrix = Record<
  string,
  Record<string, { status: string; note?: string }>
>;

let cachedIndex: SubstanceIndexEntry[] | null = null;
let cachedCombos: TripSitComboMatrix | null = null;
const detailCache = new Map<string, SubstanceDetailData>();

export async function fetchSubstanceIndex(): Promise<SubstanceIndexEntry[]> {
  if (cachedIndex) return cachedIndex;
  const res = await fetch('/data/index.json');
  if (!res.ok) throw new Error(`Failed to load index.json (${res.status})`);
  const data = (await res.json()) as SubstanceIndexEntry[];
  cachedIndex = data;
  return data;
}

export async function fetchCombosMatrix(): Promise<TripSitComboMatrix> {
  if (cachedCombos) return cachedCombos;
  const res = await fetch('/data/combos.json');
  if (!res.ok) throw new Error(`Failed to load combos.json (${res.status})`);
  const data = (await res.json()) as TripSitComboMatrix;
  cachedCombos = data;
  return data;
}

export async function fetchSubstanceDetail(id: string): Promise<SubstanceDetailData> {
  const cached = detailCache.get(id);
  if (cached) return cached;

  const res = await fetch(`/data/substances/${encodeURIComponent(id)}.json`);
  if (!res.ok) {
    if (id === 'lsd') return LSD_DETAIL;
    throw new Error(`Failed to load substance detail for "${id}" (${res.status})`);
  }

  const raw = (await res.json()) as SubstanceDetailData;

  // Enrich LSD with the flagship deep monograph (Perspectives, 4-axis Radar, 41-row Effects Analysis, Community Reports)
  // while keeping the live PsychonautWiki subjective effects, pharmacology, and PubMed citations from the synced JSON.
  const detail: SubstanceDetailData =
    id === 'lsd'
      ? {
          ...LSD_DETAIL,
          chemicalClass: raw.chemicalClass,
          psychoactiveClass: raw.psychoactiveClass,
          halfLife: raw.halfLife,
          marquis: raw.marquis,
          addictionPotential: raw.addictionPotential,
          toxicity: raw.toxicity,
          subjectiveEffects: raw.subjectiveEffects,
          citations: raw.citations,
        }
      : raw;

  detailCache.set(id, detail);
  return detail;
}
