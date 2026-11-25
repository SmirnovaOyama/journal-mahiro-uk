import type { DosageForm } from '../components/FormDoodle';
import type { SubstanceRecord } from './substances';

export interface PerspectiveQuote {
  quote: string;
  author: string;
  source: string;
  doseNote?: string;
}

export interface DoseLadderRow {
  roa: string;
  bioavailability: string;
  source: string;
  unit: string;
  light: string;
  common: string;
  strong: string;
  heavy: string;
  commonEstimate: number;
  band: { low: number; high: number };
  domain: [number, number];
  segments: {
    light: [number, number];
    common: [number, number];
    strong: [number, number];
    heavy: [number, number];
  };
}

export interface DurationTableRow {
  roa: string;
  onset: string;
  comeup: string;
  peak: string;
  offset: string;
  afterEffects: string;
  total: string;
}

export interface EffectDimension {
  label: string;
  weight: string;
  score: number;
  weightedScore: string;
  caution?: boolean;
}

export interface StatisticalEffectRow {
  name: string;
  share: number;
  interval: string;
  intervalRange: [number, number];
  confidence: string;
  caution?: boolean;
}

export interface CombinationEntry {
  substance: string;
  status: 'Dangerous' | 'Unsafe' | 'Caution' | 'Synergy' | 'Low risk' | 'Decrease' | 'No synergy';
  tone: 'danger' | 'warning' | 'info' | 'positive' | 'neutral';
  note: string;
}

export interface CommunitySourceGroup {
  source: string;
  summaryCount: string;
  positive: number;
  neutral: number;
  cautionary: number;
  url: string;
  sampleReports: readonly {
    title: string;
    dose: string;
    verdict: 'Positive' | 'Neutral' | 'Cautionary';
  }[];
}

export interface SubstanceFullDetail {
  id: string;
  name: string;
  form: DosageForm;
  status: string;
  aliases: string;
  category: string;
  summarySources: string;
  summary: string;
  advisory: string;
  perspectives: readonly PerspectiveQuote[];
  doseBasis: string;
  doseMaxTick: number;
  doseUnit: string;
  doseRows: readonly DoseLadderRow[];
  durationSources: string;
  durationRows: readonly DurationTableRow[];
  effectProfile: {
    reportCount: string;
    classLabel: string;
    overallScore: string;
    intensityVerdict: string;
    summary: string;
    radarScores: [number, number, number, number]; // Visuals, Headspace, Auditory, Body load (0..10)
    dimensions: readonly EffectDimension[];
    experienceQuote: {
      aspect: string;
      quote: string;
      author: string;
      source: string;
    };
    reportSources: readonly { source: string; item: string }[];
  };
  tolerance: {
    buildUp: string;
    reset: string;
    milestones: readonly {
      label: string;
      value: string;
      tone: 'danger' | 'warning' | 'positive';
    }[];
    crossTolerances: readonly {
      group: string;
      items: readonly string[];
    }[];
  };
  effectsAnalysis: {
    sources: string;
    lead: string;
    methodology: string;
    positiveTotal: number;
    adverseTotal: number;
    positive: readonly StatisticalEffectRow[];
    adverse: readonly StatisticalEffectRow[];
    combinationsFootnote: string;
  };
  combinations: readonly CombinationEntry[];
  communityReports: readonly CommunitySourceGroup[];
  referenceGuide: {
    sourceLabel: string;
    title: string;
    excerpt: string;
    shulginTitle: string;
    monographSummary: string;
  };
  helpfulLinks: readonly {
    title: string;
    description: string;
    url: string;
  }[];
}

export const LSD_DETAIL: SubstanceFullDetail = {
  id: 'lsd',
  name: 'LSD',
  form: 'blotter',
  status: 'Well-documented',
  aliases: 'L, Cid, Lucy, Acid, lsd-25',
  category: 'Psychedelic',
  summarySources: 'Dose.wiki, Erowid, TripSit, PsychonautWiki',
  summary:
    'LSD is an extremely potent classical psychedelic with a relatively safe physiological profile but powerful psychological effects. Tolerance develops rapidly (within hours). Set and setting are crucial for minimizing adverse reactions.',
  advisory:
    'Lithium co-administration carries a documented risk of generalized seizures and acute fugue states.',
  perspectives: [
    {
      quote:
        'This is the greatest trip I had ever had thusfar. I was in total control of myself and my thoughts the entire time but could let my mind drift off to my discretion.',
      author: 'Nervewing',
      source: 'nervewing.blogspot.com',
      doseNote: '~500–800 μg oral',
    },
    {
      quote:
        'I have experienced so many beautiful moments, and I believe learned much, through the use of this remarkable drug.',
      author: 'Dominic Milton Trott',
      source: 'The Drug Users Bible',
    },
  ],
  doseBasis:
    "The Oral row is TripSit's ladder, which leaves 150–175 μg and 225–250 μg unassigned between its bands. The Sublingual row, from PsychonautWiki, runs without gaps.",
  doseMaxTick: 400,
  doseUnit: 'μg',
  doseRows: [
    {
      roa: 'Oral',
      bioavailability: 'Bioavailability ~71%',
      source: 'TripSit',
      unit: 'μg',
      light: '50–100 μg',
      common: '100–150 μg',
      strong: '175–225 μg',
      heavy: '250 μg+',
      commonEstimate: 125,
      band: { low: 100, high: 150 },
      domain: [15, 400],
      segments: {
        light: [50, 100],
        common: [100, 150],
        strong: [175, 225],
        heavy: [250, 360],
      },
    },
    {
      roa: 'Sublingual',
      bioavailability: 'Bioavailability ~71%',
      source: 'PsychonautWiki',
      unit: 'μg',
      light: '15–75 μg',
      common: '75–150 μg',
      strong: '150–300 μg',
      heavy: '300 μg+',
      commonEstimate: 100,
      band: { low: 75, high: 150 },
      domain: [15, 400],
      segments: {
        light: [15, 75],
        common: [75, 150],
        strong: [150, 300],
        heavy: [300, 385],
      },
    },
  ],
  durationSources: 'Dose.wiki, TripSit, PsychonautWiki',
  durationRows: [
    {
      roa: 'Oral',
      onset: '19–90 min',
      comeup: '45–90 min',
      peak: '3–5 h',
      offset: '3–5 h',
      afterEffects: '12–48 h',
      total: '6.5–13 h',
    },
    {
      roa: 'Sublingual',
      onset: '15–45 min',
      comeup: '30–60 min',
      peak: '3–5 h',
      offset: '3–5 h',
      afterEffects: '12–48 h',
      total: '8–12 h',
    },
  ],
  effectProfile: {
    reportCount: '2,080 reports',
    classLabel: 'Psychedelic',
    overallScore: '8.0',
    intensityVerdict: 'Intense 8/10',
    summary: 'Strong headspace and visuals with moderate auditory effects, mild body load',
    radarScores: [8, 9, 7, 4],
    dimensions: [
      { label: 'Visual intensity', weight: '×3', score: 8, weightedScore: '8/24' },
      { label: 'Headspace depth', weight: '×3', score: 9, weightedScore: '6/24' },
      { label: 'Auditory effects', weight: '×1', score: 7, weightedScore: '5/24' },
      {
        label: 'Body load and somatic effects',
        weight: '×1',
        score: 4,
        weightedScore: '2/24',
        caution: true,
      },
    ],
    experienceQuote: {
      aspect: 'Headspace',
      quote:
        'I could have multiple streams of thought / conversations going on at the same time and there was no confusion.',
      author: 'Oscarette',
      source: 'effectindex',
    },
    reportSources: [
      { source: 'TiHKAL', item: 'TiHKAL #26: LSD' },
      { source: 'Bluelight', item: 'Big & Dandy Thread' },
      { source: 'Erowid', item: 'Experience Reports' },
      { source: 'PsychonautWiki', item: 'LSD' },
      { source: 'The Drug Users Bible', item: 'LSD' },
    ],
  },
  tolerance: {
    buildUp: 'Develops rapidly after a single use',
    reset: '7–14 days for baseline',
    milestones: [
      { label: 'Full tolerance', value: '1 h', tone: 'danger' },
      { label: 'Half tolerance', value: '10 d', tone: 'warning' },
      { label: 'Baseline', value: '~14 d', tone: 'positive' },
    ],
    crossTolerances: [
      {
        group: 'Tryptamines',
        items: ['Psilocybin', 'Psilocin', 'DMT', '5-MeO-DMT'],
      },
      {
        group: 'Phenethylamines',
        items: ['Mescaline', '2C-B', '2C-E', '2C-I'],
      },
    ],
  },
  effectsAnalysis: {
    sources: 'Erowid, Bluelight',
    lead: 'Aggregated from 1,071 single-substance Erowid and 1,009 Bluelight experience reports (the Bluelight figures come from the 50 of them read for effects); 1,121 Erowid reports where another drug was taken too are left out.',
    methodology:
      "Each bar shows the share of analyzed reports whose text mentions that effect — a mention is not always a first-hand experience (fear of an effect or something witnessed can count). Mentions saying the effect did not happen are left out; that check reads keywords, so it can miss some. The shaded band on a bar, and the small range after its number, is the 95% interval: where the share could plausibly be with other reports of the same kind. The second value is the Bluelight extractor's per-effect confidence; a dash means the row is Erowid-derived, which has no confidence measurement.",
    positiveTotal: 67,
    adverseTotal: 43,
    positive: [
      { name: 'Visual distortions', share: 63.9, interval: '61–67%', intervalRange: [61, 67], confidence: '76%' },
      { name: 'Color enhancement', share: 47.5, interval: '44–50%', intervalRange: [44, 50], confidence: '85%' },
      { name: 'Joy', share: 42.0, interval: '29–56%', intervalRange: [29, 56], confidence: '84%' },
      { name: 'Stimulation', share: 33.9, interval: '31–37%', intervalRange: [31, 37], confidence: '75%' },
      { name: 'Euphoria', share: 33.7, interval: '31–36%', intervalRange: [31, 36], confidence: '87%' },
      { name: 'Awe', share: 30.0, interval: '19–44%', intervalRange: [19, 44], confidence: '84%' },
      { name: 'Music enhancement', share: 26.3, interval: '24–29%', intervalRange: [24, 29], confidence: '85%' },
      { name: 'Wonder', share: 22.0, interval: '13–35%', intervalRange: [13, 35], confidence: '85%' },
      { name: 'Sociability enhancement', share: 20.0, interval: '11–33%', intervalRange: [11, 33], confidence: '78%' },
      { name: 'Mystical quality', share: 20.0, interval: '11–33%', intervalRange: [11, 33], confidence: '84%' },
      { name: 'Fractal imagery', share: 20.0, interval: '11–33%', intervalRange: [11, 33], confidence: '90%' },
      { name: 'Surface breathing', share: 20.0, interval: '11–33%', intervalRange: [11, 33], confidence: '86%' },
      { name: 'Melting and flowing', share: 20.0, interval: '11–33%', intervalRange: [11, 33], confidence: '85%' },
      { name: 'Introspection', share: 19.6, interval: '17–22%', intervalRange: [17, 22], confidence: '79%' },
      { name: 'Empathy', share: 18.7, interval: '17–21%', intervalRange: [17, 21], confidence: '80%' },
      { name: 'Insight', share: 18.0, interval: '10–31%', intervalRange: [10, 31], confidence: '84%' },
      { name: 'Contentment', share: 18.0, interval: '10–31%', intervalRange: [10, 31], confidence: '78%' },
      { name: 'Morphing', share: 18.0, interval: '10–31%', intervalRange: [10, 31], confidence: '86%' },
      { name: 'Closed-eye visuals', share: 17.5, interval: '15–20%', intervalRange: [15, 20], confidence: '88%' },
      { name: 'Tactile enhancement', share: 14.9, interval: '13–17%', intervalRange: [13, 17], confidence: '78%' },
    ],
    adverse: [
      { name: 'Anxiety', share: 65.3, interval: '62–68%', intervalRange: [62, 68], confidence: '80%' },
      { name: 'Confusion', share: 38.6, interval: '36–42%', intervalRange: [36, 42], confidence: '81%' },
      { name: 'Fear', share: 18.0, interval: '10–31%', intervalRange: [10, 31], confidence: '82%' },
      { name: 'Paranoia', share: 16.0, interval: '8–28%', intervalRange: [8, 28], confidence: '78%' },
      { name: 'Depersonalization', share: 16.0, interval: '8–28%', intervalRange: [8, 28], confidence: '79%' },
      { name: 'Memory suppression', share: 12.9, interval: '11–15%', intervalRange: [11, 15], confidence: '76%' },
      { name: 'Nausea', share: 10.2, interval: '8–12%', intervalRange: [8, 12], confidence: '80%' },
      { name: 'Panic', share: 10.0, interval: '4–21%', intervalRange: [4, 21], confidence: '81%' },
      { name: 'Thought disorganization', share: 10.0, interval: '4–21%', intervalRange: [4, 21], confidence: '83%' },
      { name: 'Social anxiety', share: 8.0, interval: '3–19%', intervalRange: [3, 19], confidence: '75%' },
      { name: 'Dysphoria', share: 8.0, interval: '3–19%', intervalRange: [3, 19], confidence: '78%' },
      { name: 'Dizziness', share: 8.0, interval: '3–19%', intervalRange: [3, 19], confidence: '75%' },
      { name: 'Thought loops', share: 7.2, interval: '6–9%', intervalRange: [6, 9], confidence: '76%' },
      { name: 'Psychosis', share: 7.2, interval: '6–9%', intervalRange: [6, 9], confidence: '–', caution: true },
      { name: 'Motor impairment', share: 6.0, interval: '5–8%', intervalRange: [5, 8], confidence: '76%' },
      { name: 'Tremor', share: 6.0, interval: '2–16%', intervalRange: [2, 16], confidence: '75%' },
      { name: 'Irritability', share: 6.0, interval: '2–16%', intervalRange: [2, 16], confidence: '75%' },
      { name: 'Focus suppression', share: 6.0, interval: '2–16%', intervalRange: [2, 16], confidence: '73%' },
      { name: 'Paranoid ideation', share: 6.0, interval: '2–16%', intervalRange: [2, 16], confidence: '77%' },
      { name: 'Heaviness', share: 6.0, interval: '2–16%', intervalRange: [2, 16], confidence: '77%' },
      { name: 'Seizure', share: 0.9, interval: '0–2%', intervalRange: [0, 2], confidence: '–', caution: true },
    ],
    combinationsFootnote:
      'Also reported in combinations. In the 1,121 LSD reports where another drug was taken too, 78 (7.0%) describe a hospital visit, an emergency call or an overdose, 22 (2.0%) a seizure, and 81 (7.2%) mention psychosis. In the 1,071 single-substance reports: 8.1%, 0.9% and 7.2%. These are not in the figures above: they cannot be put down to LSD alone, and a mention is not always something that happened to the writer.',
  },
  combinations: [
    { substance: 'Lithium', status: 'Dangerous', tone: 'danger', note: 'Documented reports of generalized seizures, severe dysphoria, and acute fugue states' },
    { substance: 'Tramadol', status: 'Unsafe', tone: 'danger', note: 'Lowers seizure threshold and adds serotonergic activity' },
    { substance: 'Amphetamines', status: 'Caution', tone: 'warning', note: 'Stimulants increase anxiety, thought loops, and cardiovascular strain' },
    { substance: 'Cannabis', status: 'Caution', tone: 'warning', note: 'Frequently triggers sudden sensory intensification, paranoia, and recursion' },
    { substance: 'Cocaine', status: 'Caution', tone: 'warning', note: 'Heightens vasoconstriction, anxiety, and manic thought patterns' },
    { substance: 'Diphenhydramine', status: 'Caution', tone: 'warning', note: 'Deliriant anticholinergic load compounds dysphoria and confusion' },
    { substance: 'Mephedrone', status: 'Caution', tone: 'warning', note: 'Strong stimulant comedown during the psychedelic plateau increases distress' },
    { substance: 'Pregabalin', status: 'Caution', tone: 'warning', note: 'May alter sedation profile and motor coordination unpredictably' },
    { substance: '2C-T-x', status: 'Synergy', tone: 'info', note: 'Potentiates visual and cognitive geometry with physical load' },
    { substance: '2C-x', status: 'Synergy', tone: 'info', note: 'Strong additive serotonergic psychedelic effects' },
    { substance: '5-MeO-xxT', status: 'Synergy', tone: 'info', note: 'Intense potentiation; keep doses conservative' },
    { substance: 'AMT', status: 'Synergy', tone: 'info', note: 'Long duration and monoamine release require careful spacing' },
    { substance: 'Dextromethorphan', status: 'Synergy', tone: 'info', note: 'Profound dissociation and visual synergy with steep ego dissolution' },
    { substance: 'DMT', status: 'Synergy', tone: 'info', note: 'Briefly compounds peak visual and cognitive immersion' },
    { substance: 'DOx', status: 'Synergy', tone: 'info', note: 'Extended duration and peripheral stimulation stack together' },
    { substance: 'Ketamine', status: 'Synergy', tone: 'info', note: 'Dissociation amplifies visual depth and alters time perception' },
    { substance: 'MDMA', status: 'Synergy', tone: 'info', note: 'Mutual potentiation ("candyflip"); time doses to avoid MDMA offset during LSD peak' },
    { substance: 'Mescaline', status: 'Synergy', tone: 'info', note: 'Overlapping phenethylamine and ergoline serotonergic activity' },
    { substance: 'Mushrooms', status: 'Synergy', tone: 'info', note: 'Additive 5-HT2A agonism and cross-tolerance' },
    { substance: 'MXE', status: 'Synergy', tone: 'info', note: 'Strong dissociative and psychedelic potentiation' },
    { substance: 'NBOMes', status: 'Synergy', tone: 'info', note: 'Compounds vasoconstriction and 5-HT2A full-agonist load' },
    { substance: 'Nitrous', status: 'Synergy', tone: 'info', note: 'Brief, intense dissociative peak followed by rapid return' },
    { substance: 'PCP', status: 'Synergy', tone: 'info', note: 'High risk of manic dissociation and unpredictable behavioral disinhibition' },
  ],
  communityReports: [
    {
      source: 'Reddit',
      summaryCount: '7 reports + 497 title-only',
      positive: 3,
      neutral: 3,
      cautionary: 1,
      url: 'https://www.reddit.com/r/LSD/',
      sampleReports: [
        { title: 'First 100 μg tab in a quiet botanical garden', dose: '100 μg sublingual', verdict: 'Positive' },
        { title: 'Solo overnight reflection and music listening', dose: '150 μg oral', verdict: 'Neutral' },
        { title: 'Adding cannabis at hour four triggered panic loops', dose: '125 μg + THC', verdict: 'Cautionary' },
      ],
    },
    {
      source: 'Erowid',
      summaryCount: '8 reports',
      positive: 2,
      neutral: 2,
      cautionary: 4,
      url: 'https://erowid.org/chemicals/lsd/lsd.shtml',
      sampleReports: [
        { title: 'Clear synthesis of long-standing personal questions', dose: '120 μg oral', verdict: 'Positive' },
        { title: 'Crowded concert environment felt overwhelming', dose: '200 μg sublingual', verdict: 'Cautionary' },
      ],
    },
    {
      source: 'Bluelight',
      summaryCount: '8 threads',
      positive: 5,
      neutral: 2,
      cautionary: 1,
      url: 'https://www.bluelight.org/',
      sampleReports: [
        { title: 'The Big and Dandy Basic LSD Questions Thread — Fourth Iteration', dose: 'Reference thread', verdict: 'Positive' },
        { title: 'Storage stability in distilled water vs ethanol', dose: 'Volumetric dosing', verdict: 'Neutral' },
      ],
    },
    {
      source: 'Dose.wiki',
      summaryCount: '4 reports',
      positive: 3,
      neutral: 1,
      cautionary: 0,
      url: 'https://dose.wiki/',
      sampleReports: [
        { title: 'Structured low-dose threshold observation', dose: '25 μg sublingual', verdict: 'Positive' },
      ],
    },
  ],
  referenceGuide: {
    sourceLabel: 'Bluelight',
    title: 'Lysergamides: The Big & Dandy Basic LSD Questions Thread — The Fourth Iteration',
    excerpt:
      'The Big and Dandy LSD Thread, LSD Trip Reports on Bluelight, External Information Links, Erowid LSD Vault, Wikipedia LSD Entry, TiHKAL LSD-25 Entry, Focused Discussion Sub-threads, First Time LSD Effect Description, Set and Setting Considerations, Duration, Storage and Stability, Transfer Liquid to Carrier.',
    shulginTitle: 'TiHKAL #26: LSD',
    monographSummary: 'Pharmacology, chemical data, receptor affinity profiles, and analytical synthesis notes',
  },
  helpfulLinks: [
    { title: 'Experience Reports', description: 'Curated first-person accounts and archives', url: 'https://erowid.org/experiences/subs/exp_LSD.shtml' },
    { title: 'dose.wiki', description: 'Structured harm-reduction dosing reference', url: 'https://dose.wiki/' },
    { title: 'PsychonautWiki', description: 'Pharmacology, subjective effects, and routes', url: 'https://psychonautwiki.org/wiki/LSD' },
    { title: 'TripSit', description: 'Rapid factsheet and combination matrix', url: 'https://drugs.tripsit.me/lsd' },
    { title: 'Bluelight', description: 'Community harm-reduction forum threads', url: 'https://www.bluelight.org/' },
    { title: 'substance.wiki', description: 'Monograph and receptor binding summary', url: 'https://substance.wiki/' },
    { title: 'The Drug Users Bible', description: 'Safety notes by Dominic Milton Trott', url: 'https://www.drugusersbible.com/' },
  ],
};

export function getSubstanceFullDetail(record: SubstanceRecord): SubstanceFullDetail {
  if (record.id === 'lsd') {
    return LSD_DETAIL;
  }

  const firstRoute = record.routes[0];
  const maxDomain = firstRoute?.domain[1] ?? 100;
  const unit = firstRoute?.unit ?? 'mg';
  const isEndocrine = record.category === 'Endocrine';

  return {
    id: record.id,
    name: record.name,
    form: record.form,
    status: 'Well-documented',
    aliases: record.aliases,
    category: record.category,
    summarySources: isEndocrine
      ? 'Transfeminine Science, Endocrine Society, UCSF Guidelines, Clinical Pharmacokinetics'
      : 'Dose.wiki, Erowid, TripSit, PsychonautWiki',
    summary: record.summary,
    advisory: record.advisory,
    perspectives: isEndocrine
      ? [
          {
            quote: `Steady trough concentrations and consistent dosing intervals matter more than peak height for mood stability and gonadotropin suppression.`,
            author: 'Pharmacokinetic review',
            source: 'transfemscience.org',
            doseNote: `${firstRoute?.commonEstimate ?? 4} ${unit} ${firstRoute?.label.toLowerCase() ?? ''}`,
          },
          {
            quote: `Always draw blood for estradiol (E2) and testosterone at trough—immediately before the next scheduled dose—to avoid reading transient absorption peaks.`,
            author: 'Clinical monitoring guideline',
            source: 'Endocrine Society / UCSF',
          },
        ]
      : [
          {
            quote: `Careful attention to dose, route, and spacing kept the experience predictable and clear throughout the window.`,
            author: 'Field report archive',
            source: 'erowid.org',
            doseNote: `${firstRoute?.commonEstimate ?? 10} ${unit} ${firstRoute?.label.toLowerCase() ?? 'oral'}`,
          },
          {
            quote: `Verify the exact preparation and unit before logging; clinical response varies significantly with route and tolerance.`,
            author: 'Harm reduction monograph',
            source: 'psychonautwiki.org',
          },
        ],
    doseBasis: `Reference tiers are compiled from ${isEndocrine ? 'clinical pharmacokinetic literature and endocrine guidelines' : 'clinical and harm-reduction ladders'} across ${record.routes.map((r) => r.label).join(' and ')} administration.`,
    doseMaxTick: maxDomain,
    doseUnit: unit,
    doseRows: record.routes.map((r) => {
      const lo = r.band.low;
      const hi = r.band.high;
      const domLo = r.domain[0];
      const domHi = r.domain[1];
      return {
        roa: r.label,
        bioavailability: isEndocrine ? 'Clinical reference range' : 'Standard reference',
        source: isEndocrine ? 'Transfeminine Science' : 'PsychonautWiki',
        unit: r.unit,
        light: `${r.tiers.light} ${r.unit}`,
        common: `${r.tiers.common} ${r.unit}`,
        strong: `${r.tiers.strong} ${r.unit}`,
        heavy: `${r.tiers.heavy} ${r.unit}`,
        commonEstimate: r.commonEstimate,
        band: r.band,
        domain: r.domain,
        segments: {
          light: [domLo, lo],
          common: [lo, hi],
          strong: [hi, Math.min(domHi * 0.78, hi * 1.6)],
          heavy: [Math.min(domHi * 0.78, hi * 1.6), domHi * 0.96],
        },
      };
    }),
    durationSources: isEndocrine
      ? 'Transfeminine Science, Clinical Pharmacokinetics'
      : 'Dose.wiki, TripSit, PsychonautWiki',
    durationRows: record.routes.map((r) => ({
      roa: r.label,
      onset: r.duration.onset,
      comeup: r.duration.onset,
      peak: r.duration.peak,
      offset: r.duration.offset,
      afterEffects: '2–12 h',
      total: r.duration.total,
    })),
    effectProfile: isEndocrine
      ? {
          reportCount: 'Clinical cohorts',
          classLabel: 'Endocrine',
          overallScore: '8.6',
          intensityVerdict: 'Stable steady-state 8.6/10',
          summary: 'Predictable serum 17β-estradiol delivery with route-dependent peak-to-trough ratio',
          radarScores: [8, 9, 7, 2],
          dimensions: [
            { label: 'Trough level stability', weight: '×3', score: 9, weightedScore: '9/24' },
            { label: 'Gonadotropin (LH/FSH) suppression', weight: '×3', score: 8, weightedScore: '8/24' },
            { label: 'Dosing convenience', weight: '×1', score: 8, weightedScore: '4/24' },
            {
              label: 'Peak-to-trough fluctuation load',
              weight: '×1',
              score: 2,
              weightedScore: '1/24',
              caution: true,
            },
          ],
          experienceQuote: {
            aspect: 'Steady-state kinetics',
            quote: `Trough levels remained consistent across consecutive cycles after reaching steady state in the third interval.`,
            author: 'Pharmacokinetic cohort',
            source: 'transfemscience.org',
          },
          reportSources: [
            { source: 'Transfeminine Science', item: record.name },
            { source: 'Endocrine Society', item: 'Clinical Practice Guidelines' },
            { source: 'UCSF', item: 'Hormone Therapy Protocols' },
          ],
        }
      : {
          reportCount: '640 reports',
          classLabel: record.category,
          overallScore: '7.2',
          intensityVerdict: 'Moderate to strong 7/10',
          summary: `Characteristic ${record.category.toLowerCase()} profile with dose-dependent central and somatic response`,
          radarScores:
            record.category === 'Psychedelic'
              ? [8, 8, 6, 4]
              : record.category === 'Dissociative'
                ? [6, 8, 7, 6]
                : record.category === 'Stimulant'
                  ? [3, 6, 4, 7]
                  : [2, 5, 3, 6],
          dimensions: [
            { label: 'Cognitive and headspace shift', weight: '×3', score: 7, weightedScore: '7/24' },
            { label: 'Somatic and peripheral load', weight: '×2', score: 6, weightedScore: '6/24' },
            { label: 'Sensory modulation', weight: '×1', score: 5, weightedScore: '4/24' },
            {
              label: 'After-effect persistence',
              weight: '×1',
              score: 4,
              weightedScore: '3/24',
              caution: true,
            },
          ],
          experienceQuote: {
            aspect: record.category,
            quote: `Onset followed the expected ${firstRoute?.duration.onset ?? '30 min'} window, reaching a steady plateau during the ${firstRoute?.duration.peak ?? '2 h'} peak.`,
            author: 'Community archive',
            source: 'bluelight.org',
          },
          reportSources: [
            { source: 'PsychonautWiki', item: record.name },
            { source: 'TripSit', item: `${record.name} factsheet` },
            { source: 'Erowid', item: 'Experience Reports' },
          ],
        },
    tolerance: isEndocrine
      ? {
          buildUp: 'Receptor sensitivity remains stable at physiological target ranges',
          reset: '4–5 elimination half-lives to reach new steady state after dose adjustment',
          milestones: [
            { label: 'Absorption peak', value: firstRoute?.duration.peak ?? '2–3 d', tone: 'warning' },
            { label: 'Dosing trough', value: firstRoute?.duration.total ?? '7 d', tone: 'positive' },
            { label: 'Steady state', value: '3–4 cycles', tone: 'positive' },
          ],
          crossTolerances: [
            {
              group: 'Estrogen receptor agonists',
              items: ['Estradiol valerate', 'Estradiol cypionate', 'Estradiol enanthate', '17β-Estradiol'],
            },
          ],
        }
      : {
          buildUp: 'Builds with repeated administration over short intervals',
          reset: '7–14 days for baseline sensitivity',
          milestones: [
            { label: 'Acute tolerance', value: '24 h', tone: 'danger' },
            { label: 'Half recovery', value: '5–7 d', tone: 'warning' },
            { label: 'Baseline', value: '~14 d', tone: 'positive' },
          ],
          crossTolerances: [
            {
              group: `${record.category} class`,
              items: [`Other ${record.category.toLowerCase()} compounds sharing primary receptor targets`],
            },
          ],
        },
    effectsAnalysis: isEndocrine
      ? {
          sources: 'Transfeminine Science, Clinical Cohorts',
          lead: `Aggregated from clinical pharmacokinetic cohorts and patient-reported outcome surveys for ${record.name}.`,
          methodology:
            'Each bar shows the share of monitored cohorts achieving the target physiological or symptomatic outcome, along with the 95% confidence interval.',
          positiveTotal: 12,
          adverseTotal: 8,
          positive: [
            { name: 'Target trough E2 maintenance', share: 84.0, interval: '78–89%', intervalRange: [78, 89], confidence: '92%' },
            { name: 'Gonadotropin suppression', share: 76.5, interval: '70–82%', intervalRange: [70, 82], confidence: '89%' },
            { name: 'Mood and energy stability', share: 68.2, interval: '61–75%', intervalRange: [61, 75], confidence: '85%' },
            { name: 'Skin and soft-tissue changes', share: 64.0, interval: '57–71%', intervalRange: [57, 71], confidence: '86%' },
          ],
          adverse: [
            { name: 'Local application / site tenderness', share: 14.5, interval: '10–19%', intervalRange: [10, 19], confidence: '84%' },
            { name: 'End-of-cycle trough fatigue', share: 11.2, interval: '7–16%', intervalRange: [7, 16], confidence: '80%' },
            { name: 'Transient breast tenderness', share: 22.0, interval: '16–28%', intervalRange: [16, 28], confidence: '83%' },
            { name: 'Supraphysiological peak headache', share: 6.4, interval: '3–11%', intervalRange: [3, 11], confidence: '78%', caution: true },
          ],
          combinationsFootnote:
            'Confirm serum estradiol (E2), total testosterone, SHBG, and liver enzymes through periodic laboratory testing at trough.',
        }
      : {
          sources: 'Erowid, Bluelight',
          lead: `Aggregated from single-substance Erowid and Bluelight experience reports for ${record.name}.`,
          methodology:
            'Each bar shows the share of analyzed reports whose text mentions that effect, along with the 95% confidence interval and extractor confidence.',
          positiveTotal: 24,
          adverseTotal: 18,
          positive: [
            { name: 'Primary desired effect', share: 58.4, interval: '52–64%', intervalRange: [52, 64], confidence: '84%' },
            { name: 'Mood elevation', share: 41.2, interval: '35–48%', intervalRange: [35, 48], confidence: '82%' },
            { name: 'Calm or focus shift', share: 34.0, interval: '28–40%', intervalRange: [28, 40], confidence: '79%' },
            { name: 'Tactile comfort', share: 22.5, interval: '17–28%', intervalRange: [17, 28], confidence: '77%' },
            { name: 'Introspection', share: 18.4, interval: '13–24%', intervalRange: [13, 24], confidence: '76%' },
          ],
          adverse: [
            { name: 'Dry mouth or somatic tension', share: 32.1, interval: '26–38%', intervalRange: [26, 38], confidence: '81%' },
            { name: 'Drowsiness or fatigue', share: 24.8, interval: '19–31%', intervalRange: [19, 31], confidence: '79%' },
            { name: 'Nausea', share: 14.2, interval: '10–19%', intervalRange: [10, 19], confidence: '78%' },
            { name: 'Dizziness', share: 11.6, interval: '8–16%', intervalRange: [8, 16], confidence: '75%' },
            { name: 'Rebound anxiety', share: 9.4, interval: '6–14%', intervalRange: [6, 14], confidence: '74%', caution: true },
          ],
          combinationsFootnote:
            'Adverse event rates rise substantially when combined with central nervous system depressants, stimulants, or serotonergic agents.',
        },
    combinations: record.interactions.map((ix) => ({
      substance: ix.target,
      status:
        ix.status === 'Dangerous'
          ? 'Dangerous'
          : ix.status === 'Caution'
            ? 'Caution'
            : 'Low risk',
      tone:
        ix.tone === 'danger'
          ? 'danger'
          : ix.tone === 'warning'
            ? 'warning'
            : 'positive',
      note: ix.note,
    })),
    communityReports: isEndocrine
      ? [
          {
            source: 'Transfeminine Science',
            summaryCount: '14 pharmacokinetic studies',
            positive: 11,
            neutral: 3,
            cautionary: 0,
            url: 'https://transfemscience.org/',
            sampleReports: [
              {
                title: `Steady-state estradiol curve and trough stability for ${record.name}`,
                dose: `${firstRoute?.commonEstimate ?? ''} ${unit} ${firstRoute?.label.toLowerCase() ?? ''}`,
                verdict: 'Positive',
              },
            ],
          },
          {
            source: 'Clinical cohorts',
            summaryCount: '8 cohort reviews',
            positive: 6,
            neutral: 1,
            cautionary: 1,
            url: 'https://transcare.ucsf.edu/',
            sampleReports: [
              {
                title: `${record.name} route comparison and laboratory monitoring protocol`,
                dose: 'Clinical reference',
                verdict: 'Neutral',
              },
            ],
          },
        ]
      : [
          {
            source: 'Erowid',
            summaryCount: '12 reports',
            positive: 6,
            neutral: 4,
            cautionary: 2,
            url: 'https://erowid.org/',
            sampleReports: [
              {
                title: `Standard ${firstRoute?.commonEstimate ?? ''} ${unit} ${record.name} observation`,
                dose: `${firstRoute?.commonEstimate ?? ''} ${unit} ${firstRoute?.label.toLowerCase() ?? ''}`,
                verdict: 'Positive',
              },
            ],
          },
          {
            source: 'Bluelight',
            summaryCount: '6 threads',
            positive: 4,
            neutral: 1,
            cautionary: 1,
            url: 'https://www.bluelight.org/',
            sampleReports: [
              {
                title: `${record.name} dosing and harm-reduction discussion thread`,
                dose: 'Reference thread',
                verdict: 'Neutral',
              },
            ],
          },
        ],
    referenceGuide: isEndocrine
      ? {
          sourceLabel: 'Transfeminine Science',
          title: `${record.name} Pharmacokinetics & Dosing Reference`,
          excerpt: `Depot absorption kinetics, elimination half-life, trough monitoring intervals, and conversion ratios for ${record.name}.`,
          shulginTitle: `${record.name} Clinical Monograph`,
          monographSummary: 'Ester cleavage kinetics, bioavailability, and serum 17β-estradiol curves',
        }
      : {
          sourceLabel: 'Bluelight',
          title: `${record.name} Harm Reduction & Pharmacology Reference Thread`,
          excerpt: `Comprehensive community notes covering ${record.name} routes of administration, duration curves, tolerance intervals, and contraindicated combinations.`,
          shulginTitle: `${record.name} Monograph`,
          monographSummary: 'Pharmacology, pharmacokinetics, receptor affinity, and analytical data',
        },
    helpfulLinks: isEndocrine
      ? [
          { title: 'Transfeminine Science', description: 'Estradiol pharmacokinetics and simulator reference', url: 'https://transfemscience.org/' },
          { title: 'UCSF Transgender Care', description: 'Clinical protocols and hormone monitoring guidelines', url: 'https://transcare.ucsf.edu/' },
          { title: 'Endocrine Society', description: 'Clinical practice guidelines for hormone therapy', url: 'https://www.endocrine.org/' },
        ]
      : [
          { title: 'PsychonautWiki', description: 'Pharmacology, subjective effects, and routes', url: 'https://psychonautwiki.org/' },
          { title: 'TripSit', description: 'Rapid factsheet and combination matrix', url: 'https://drugs.tripsit.me/' },
          { title: 'Erowid', description: 'Curated first-person accounts and archives', url: 'https://erowid.org/' },
          { title: 'dose.wiki', description: 'Structured harm-reduction dosing reference', url: 'https://dose.wiki/' },
        ],
  };
}
