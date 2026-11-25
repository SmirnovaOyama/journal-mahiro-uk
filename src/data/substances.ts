import type { DosageForm } from '../components/FormDoodle';

export type SubstanceCategory =
  | 'Depressant'
  | 'Stimulant'
  | 'Psychedelic'
  | 'Dissociative'
  | 'Opioid'
  | 'Endocrine';

export interface RouteProfile {
  id: string;
  label: string;
  unit: 'mg' | 'μg' | 'g';
  commonEstimate: number;
  band: { low: number; high: number };
  domain: [number, number];
  tiers: {
    threshold: string;
    light: string;
    common: string;
    strong: string;
    heavy: string;
  };
  duration: {
    total: string;
    onset: string;
    peak: string;
    offset: string;
  };
}

export interface InteractionNote {
  target: string;
  status: 'Low risk' | 'Caution' | 'Dangerous';
  tone: 'positive' | 'warning' | 'danger';
  note: string;
}

export interface SubstanceRecord {
  id: string;
  name: string;
  aliases: string;
  category: SubstanceCategory;
  form: DosageForm;
  summary: string;
  advisory: string;
  routes: readonly RouteProfile[];
  interactions: readonly InteractionNote[];
}

export const CATEGORIES: readonly { id: 'All' | SubstanceCategory; label: string }[] = [
  { id: 'All', label: 'All' },
  { id: 'Endocrine', label: 'Endocrine' },
  { id: 'Psychedelic', label: 'Psychedelic' },
  { id: 'Dissociative', label: 'Dissociative' },
  { id: 'Stimulant', label: 'Stimulant' },
  { id: 'Depressant', label: 'Depressant' },
  { id: 'Opioid', label: 'Opioid' },
];

export const SUBSTANCES: readonly SubstanceRecord[] = [
  /* ------------------------------------------------------------------ */
  /* ENDOCRINE                                                          */
  /* ------------------------------------------------------------------ */
  {
    id: 'estradiol-valerate',
    name: 'Estradiol valerate',
    aliases: 'Progynova, Delestrogen, EV',
    category: 'Endocrine',
    form: 'tablet',
    summary: 'Prodrug ester cleaved rapidly into bioidentical 17β-estradiol in plasma and liver',
    advisory: 'Estimates are reference ranges only; confirm trough levels with a blood test and your clinician.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 4,
        band: { low: 2, high: 6 },
        domain: [0.5, 10],
        tiers: {
          threshold: '0.5',
          light: '1 – 2',
          common: '2 – 6',
          strong: '6 – 8',
          heavy: '8+',
        },
        duration: {
          total: '12 – 24 h',
          onset: '1 – 2 h',
          peak: '3 – 6 h',
          offset: '8 – 14 h',
        },
      },
      {
        id: 'sublingual',
        label: 'Sublingual',
        unit: 'mg',
        commonEstimate: 2,
        band: { low: 1, high: 4 },
        domain: [0.25, 8],
        tiers: {
          threshold: '0.25',
          light: '0.5 – 1',
          common: '1 – 4',
          strong: '4 – 6',
          heavy: '6+',
        },
        duration: {
          total: '6 – 12 h',
          onset: '15 – 30 min',
          peak: '1 – 2 h',
          offset: '4 – 8 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Cyproterone acetate',
        status: 'Low risk',
        tone: 'positive',
        note: 'Commonly paired in low doses (5–12.5 mg) for synergistic gonadotropin suppression',
      },
      {
        target: 'CYP3A4 inducers (Rifampicin, Carbamazepine, St. John’s Wort)',
        status: 'Caution',
        tone: 'warning',
        note: 'Accelerates hepatic clearance and lowers steady-state serum estradiol',
      },
    ],
  },
  {
    id: 'estradiol-enanthate',
    name: 'Estradiol enanthate',
    aliases: 'EEn, Perlutan, Estradiol heptanoate',
    category: 'Endocrine',
    form: 'injection',
    summary: 'Long-acting depot estradiol ester in oil solution for intramuscular or subcutaneous injection',
    advisory: 'Inspect vial for particulate matter; rotate injection sites and confirm steady-state trough levels with labs.',
    routes: [
      {
        id: 'intramuscular',
        label: 'Intramuscular / SubQ',
        unit: 'mg',
        commonEstimate: 4,
        band: { low: 3.5, high: 5 },
        domain: [1, 10],
        tiers: {
          threshold: '1',
          light: '2 – 3',
          common: '3.5 – 5',
          strong: '5 – 7',
          heavy: '7+',
        },
        duration: {
          total: '7 – 10 d',
          onset: '12 – 24 h',
          peak: '2 – 3 d',
          offset: '4 – 7 d',
        },
      },
    ],
    interactions: [
      {
        target: 'Benzyl benzoate / castor oil vehicle',
        status: 'Low risk',
        tone: 'positive',
        note: 'Slows depot absorption rate for stable 7-day or 10-day cycles',
      },
      {
        target: 'CYP3A4 inducers',
        status: 'Caution',
        tone: 'warning',
        note: 'May increase systemic clearance of cleaved 17β-estradiol',
      },
    ],
  },
  {
    id: 'estradiol-cypionate',
    name: 'Estradiol cypionate',
    aliases: 'Depo-Estradiol, EC, Estradiol cyclopentylpropionate',
    category: 'Endocrine',
    form: 'injection',
    summary: 'Intermediate-to-long-acting injectable estradiol ester providing smoother curves than valerate injections',
    advisory: 'Draw blood at trough immediately prior to the next weekly injection to evaluate steady-state levels.',
    routes: [
      {
        id: 'intramuscular',
        label: 'Intramuscular / SubQ',
        unit: 'mg',
        commonEstimate: 4,
        band: { low: 2.5, high: 5 },
        domain: [1, 10],
        tiers: {
          threshold: '1',
          light: '1.5 – 2.5',
          common: '2.5 – 5',
          strong: '5 – 7',
          heavy: '7+',
        },
        duration: {
          total: '7 – 8 d',
          onset: '8 – 18 h',
          peak: '1.5 – 2.5 d',
          offset: '4 – 6 d',
        },
      },
    ],
    interactions: [
      {
        target: 'GnRH agonists / Antiandrogens',
        status: 'Low risk',
        tone: 'positive',
        note: 'Often sufficient as monotherapy at trough levels above 200 pg/mL',
      },
      {
        target: 'CYP3A4 inducers',
        status: 'Caution',
        tone: 'warning',
        note: 'Accelerates 17β-estradiol metabolism and lowers trough concentrations',
      },
    ],
  },
  {
    id: 'estradiol-undecylate',
    name: 'Estradiol undecylate',
    aliases: 'Delestrec, Progynon Depot, EU',
    category: 'Endocrine',
    form: 'injection',
    summary: 'Ultra-long-acting lipophilic estradiol ester enabling biweekly to monthly depot dosing intervals',
    advisory: 'Very long elimination half-life (~2–3 weeks) requires 2–3 months to reach full steady state without a loading dose.',
    routes: [
      {
        id: 'intramuscular',
        label: 'Intramuscular / SubQ',
        unit: 'mg',
        commonEstimate: 15,
        band: { low: 10, high: 25 },
        domain: [4, 45],
        tiers: {
          threshold: '4',
          light: '6 – 10',
          common: '10 – 25',
          strong: '25 – 35',
          heavy: '35+',
        },
        duration: {
          total: '14 – 30 d',
          onset: '1 – 3 d',
          peak: '4 – 7 d',
          offset: '10 – 21 d',
        },
      },
    ],
    interactions: [
      {
        target: 'Castor oil depot vehicle',
        status: 'Low risk',
        tone: 'positive',
        note: 'Extends terminal half-life compared to MCT oil formulations',
      },
    ],
  },
  {
    id: 'estradiol-gel',
    name: 'Estradiol transdermal gel',
    aliases: 'Estrogel, Oestrogel, Divigel, Sandrena',
    category: 'Endocrine',
    form: 'gel',
    summary: 'Hydroalcoholic 0.06% 17β-estradiol gel forming a stratum corneum depot that bypasses first-pass metabolism',
    advisory: 'Allow gel to dry 5 minutes before dressing; avoid skin-to-skin transfer and never apply to breast tissue.',
    routes: [
      {
        id: 'transdermal',
        label: 'Transdermal',
        unit: 'mg',
        commonEstimate: 2.25,
        band: { low: 1.5, high: 3 },
        domain: [0.5, 6],
        tiers: {
          threshold: '0.5',
          light: '0.75 – 1.5',
          common: '1.5 – 3',
          strong: '3 – 4.5',
          heavy: '4.5+',
        },
        duration: {
          total: '24 h',
          onset: '2 – 4 h',
          peak: '6 – 10 h',
          offset: '12 – 18 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Alcohol-based sunscreens',
        status: 'Caution',
        tone: 'warning',
        note: 'Applying over the same skin area within 1 hour alters dermal flux',
      },
    ],
  },
  {
    id: 'estradiol-patch',
    name: 'Estradiol transdermal patch',
    aliases: 'Estradot, Vivelle-Dot, Climara',
    category: 'Endocrine',
    form: 'patch',
    summary: 'Matrix transdermal system delivering continuous zero-order 17β-estradiol across 3.5- or 7-day intervals',
    advisory: 'Rotate application sites on lower abdomen or upper buttock; heat baths can transiently spike release.',
    routes: [
      {
        id: 'patch',
        label: 'Transdermal (μg/day)',
        unit: 'μg',
        commonEstimate: 100,
        band: { low: 75, high: 200 },
        domain: [25, 300],
        tiers: {
          threshold: '25',
          light: '37.5 – 50',
          common: '75 – 200',
          strong: '200 – 250',
          heavy: '300+',
        },
        duration: {
          total: '84 – 168 h',
          onset: '4 – 8 h',
          peak: '24 – 48 h',
          offset: '12 – 24 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Direct heat sources',
        status: 'Caution',
        tone: 'warning',
        note: 'Saunas or heating pads over the patch accelerate transdermal absorption',
      },
    ],
  },
  {
    id: 'estradiol-spray',
    name: 'Estradiol transdermal spray',
    aliases: 'Lenzetto, Evamist',
    category: 'Endocrine',
    form: 'spray',
    summary: 'Metered transdermal spray delivering 1.53 mg 17β-estradiol with octisalate penetration enhancer per actuation',
    advisory: 'Apply to dry inner forearm skin without overlapping actuations; allow 2 minutes to dry.',
    routes: [
      {
        id: 'transdermal-spray',
        label: 'Transdermal spray',
        unit: 'mg',
        commonEstimate: 3.06,
        band: { low: 1.53, high: 4.59 },
        domain: [0.75, 7.65],
        tiers: {
          threshold: '0.75',
          light: '1.53 (1 spray)',
          common: '3.06 – 4.59',
          strong: '4.59 – 6.12',
          heavy: '6.12+',
        },
        duration: {
          total: '24 h',
          onset: '1 – 3 h',
          peak: '4 – 8 h',
          offset: '12 – 18 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Topical lotions on application site',
        status: 'Caution',
        tone: 'warning',
        note: 'Wash or wait at least 1 hour before applying moisturizers to sprayed skin',
      },
    ],
  },
  {
    id: 'cyproterone-acetate',
    name: 'Cyproterone acetate',
    aliases: 'Androcur, Cyprostat, CPA',
    category: 'Endocrine',
    form: 'tablet',
    summary: 'Potent steroidal progestogen and antiandrogen suppressing LH/FSH secretion at low milligram doses',
    advisory: 'Keep chronic daily doses at or below 10–12.5 mg; cumulative high-dose exposure increases meningioma and prolactin risk.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 10,
        band: { low: 5, high: 12.5 },
        domain: [2.5, 50],
        tiers: {
          threshold: '2.5',
          light: '5 – 6.25',
          common: '6.25 – 12.5',
          strong: '12.5 – 25',
          heavy: '25+',
        },
        duration: {
          total: '24 – 48 h',
          onset: '1 – 2 h',
          peak: '3 – 4 h',
          offset: '36 – 48 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Estradiol',
        status: 'Low risk',
        tone: 'positive',
        note: 'Synergistic antigonadotropic action suppresses testosterone to castrate range at 5–12.5 mg/day',
      },
      {
        target: 'Alcohol and hepatotoxic agents',
        status: 'Caution',
        tone: 'warning',
        note: 'Monitor liver transaminases and serum prolactin periodically',
      },
    ],
  },
  {
    id: 'spironolactone',
    name: 'Spironolactone',
    aliases: 'Aldactone, Spiro',
    category: 'Endocrine',
    form: 'tablet',
    summary: 'Potassium-sparing diuretic and competitive androgen receptor antagonist',
    advisory: 'Monitor serum potassium and blood pressure; take with meals to improve oral bioavailability.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 100,
        band: { low: 50, high: 200 },
        domain: [25, 300],
        tiers: {
          threshold: '25',
          light: '50 – 75',
          common: '100 – 200',
          strong: '200 – 250',
          heavy: '300+',
        },
        duration: {
          total: '12 – 24 h',
          onset: '1 – 2 h',
          peak: '2 – 4 h',
          offset: '12 – 20 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Potassium supplements / ACE inhibitors',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Elevated risk of clinically significant hyperkalemia',
      },
      {
        target: 'Estradiol',
        status: 'Low risk',
        tone: 'positive',
        note: 'Blocks peripheral androgen receptors while estradiol suppresses gonadal axis',
      },
    ],
  },
  {
    id: 'bicalutamide',
    name: 'Bicalutamide',
    aliases: 'Casodex, Bica',
    category: 'Endocrine',
    form: 'tablet',
    summary: 'Selective nonsteroidal peripheral androgen receptor antagonist with a ~6-day elimination half-life',
    advisory: 'Check baseline and periodic liver function tests (ALT/AST) during the first 6 months of therapy.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 25,
        band: { low: 25, high: 50 },
        domain: [10, 100],
        tiers: {
          threshold: '10',
          light: '12.5 – 25',
          common: '25 – 50',
          strong: '50 – 75',
          heavy: '75+',
        },
        duration: {
          total: '24 – 144 h',
          onset: '2 – 4 h',
          peak: '15 – 24 h',
          offset: '5 – 7 d',
        },
      },
    ],
    interactions: [
      {
        target: 'Warfarin and coumarin anticoagulants',
        status: 'Caution',
        tone: 'warning',
        note: 'Can displace protein-bound warfarin; monitor prothrombin time / INR',
      },
    ],
  },
  {
    id: 'progesterone',
    name: 'Progesterone (micronized)',
    aliases: 'Prometrium, Utrogestan, P4',
    category: 'Endocrine',
    form: 'capsule',
    summary: 'Bioidentical micronized progesterone suspended in oil, active at progesterone and neurosteroid GABA-A receptors',
    advisory: 'Oral administration undergoes extensive first-pass conversion to sedative allopregnanolone; take at bedtime.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 100,
        band: { low: 100, high: 200 },
        domain: [50, 300],
        tiers: {
          threshold: '50',
          light: '50 – 100',
          common: '100 – 200',
          strong: '200 – 300',
          heavy: '300+',
        },
        duration: {
          total: '10 – 18 h',
          onset: '1 – 2 h',
          peak: '2 – 3 h',
          offset: '8 – 12 h',
        },
      },
      {
        id: 'rectal',
        label: 'Rectal',
        unit: 'mg',
        commonEstimate: 100,
        band: { low: 100, high: 200 },
        domain: [50, 300],
        tiers: {
          threshold: '50',
          light: '50 – 100',
          common: '100 – 200',
          strong: '200 – 300',
          heavy: '300+',
        },
        duration: {
          total: '12 – 24 h',
          onset: '1 – 3 h',
          peak: '4 – 8 h',
          offset: '12 – 18 h',
        },
      },
    ],
    interactions: [
      {
        target: 'CNS depressants and hypnotics',
        status: 'Caution',
        tone: 'warning',
        note: 'Oral neurosteroid metabolites (allopregnanolone) add to GABA-A sedation',
      },
    ],
  },
  {
    id: 'finasteride',
    name: 'Finasteride',
    aliases: 'Propecia, Proscar',
    category: 'Endocrine',
    form: 'tablet',
    summary: 'Competitive inhibitor of type II and III 5α-reductase blocking conversion of testosterone to dihydrotestosterone (DHT)',
    advisory: 'Lowers serum and scalp DHT by ~65–70% even at microdoses of 0.25–1 mg daily.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 1,
        band: { low: 0.5, high: 1.25 },
        domain: [0.2, 5],
        tiers: {
          threshold: '0.2',
          light: '0.25 – 0.5',
          common: '0.5 – 1.25',
          strong: '1.25 – 2.5',
          heavy: '5+',
        },
        duration: {
          total: '24 h',
          onset: '1 – 2 h',
          peak: '2 – 6 h',
          offset: '18 – 24 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Dutasteride',
        status: 'Caution',
        tone: 'warning',
        note: 'Redundant 5α-reductase blockade; do not co-administer',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* PSYCHEDELIC                                                        */
  /* ------------------------------------------------------------------ */
  {
    id: 'lsd',
    name: 'LSD',
    aliases: 'Lysergic acid diethylamide, Acid, LSD-25',
    category: 'Psychedelic',
    form: 'blotter',
    summary: 'Ergoline serotonergic psychedelic active at 5-HT2A receptors in microgram quantities',
    advisory: 'Lithium co-administration carries a documented risk of seizures and acute fugue states.',
    routes: [
      {
        id: 'sublingual',
        label: 'Sublingual',
        unit: 'μg',
        commonEstimate: 100,
        band: { low: 75, high: 150 },
        domain: [15, 400],
        tiers: {
          threshold: '15',
          light: '25 – 75',
          common: '75 – 150',
          strong: '150 – 300',
          heavy: '300+',
        },
        duration: {
          total: '8 – 12 h',
          onset: '30 – 60 min',
          peak: '3 – 5 h',
          offset: '3 – 5 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Lithium',
        status: 'Dangerous',
        tone: 'danger',
        note: 'High incidence of generalized seizures and severe dysphoria',
      },
      {
        target: 'Cannabis',
        status: 'Caution',
        tone: 'warning',
        note: 'Can abruptly intensify sensory recursion and anxiety',
      },
    ],
  },
  {
    id: 'psilocybin',
    name: 'Psilocybin',
    aliases: '4-PO-DMT, Psilocin prodrug, Magic mushrooms',
    category: 'Psychedelic',
    form: 'capsule',
    summary: 'Tryptamine alkaloid dephosphorylated in vivo to psilocin, a partial agonist at 5-HT2A/2C receptors',
    advisory: 'Rapid acute tolerance develops within hours; avoid Lithium and Tramadol.',
    routes: [
      {
        id: 'oral',
        label: 'Oral (pure psilocybin)',
        unit: 'mg',
        commonEstimate: 20,
        band: { low: 12, high: 25 },
        domain: [3, 45],
        tiers: {
          threshold: '3',
          light: '6 – 12',
          common: '12 – 25',
          strong: '25 – 35',
          heavy: '35+',
        },
        duration: {
          total: '4 – 6 h',
          onset: '20 – 45 min',
          peak: '90 – 150 min',
          offset: '2 – 3 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Lithium',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Documented risk of seizures and acute psychotic reactions',
      },
      {
        target: 'Cannabis',
        status: 'Caution',
        tone: 'warning',
        note: 'Markedly amplifies visual intensity and potential thought loops',
      },
    ],
  },
  {
    id: '2c-b',
    name: '2C-B',
    aliases: '4-Bromo-2,5-dimethoxyphenethylamine, Nexus',
    category: 'Psychedelic',
    form: 'tablet',
    summary: 'Substituted phenethylamine psychedelic with a steep dose-response curve and tactile-visual profile',
    advisory: 'Dose curve is non-linear; a 4–6 mg increase near the common band noticeably shifts intensity.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 20,
        band: { low: 15, high: 25 },
        domain: [5, 45],
        tiers: {
          threshold: '5',
          light: '10 – 15',
          common: '15 – 25',
          strong: '25 – 35',
          heavy: '35+',
        },
        duration: {
          total: '4 – 8 h',
          onset: '45 – 75 min',
          peak: '2 – 4 h',
          offset: '1 – 2 h',
        },
      },
      {
        id: 'insufflated',
        label: 'Insufflated',
        unit: 'mg',
        commonEstimate: 10,
        band: { low: 7, high: 13 },
        domain: [2, 25],
        tiers: {
          threshold: '2',
          light: '4 – 7',
          common: '7 – 13',
          strong: '13 – 18',
          heavy: '18+',
        },
        duration: {
          total: '2 – 4 h',
          onset: '2 – 10 min',
          peak: '1 – 2 h',
          offset: '1 – 2 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Lithium and Tramadol',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Lowers seizure threshold and increases serotonergic toxicity risk',
      },
      {
        target: 'MDMA',
        status: 'Caution',
        tone: 'warning',
        note: 'Synergistic ("nexus flip"); keep 2C-B dose in the light-to-common tier',
      },
    ],
  },
  {
    id: 'dmt',
    name: 'DMT',
    aliases: 'N,N-Dimethyltryptamine, Dimitri',
    category: 'Psychedelic',
    form: 'spray',
    summary: 'Endogenous short-acting serotonergic tryptamine active rapidly when inhaled or paired with an MAOI',
    advisory: 'Remain seated or reclined prior to inhalation; onset occurs within 15–30 seconds.',
    routes: [
      {
        id: 'inhaled',
        label: 'Vaporized / Inhaled',
        unit: 'mg',
        commonEstimate: 25,
        band: { low: 15, high: 35 },
        domain: [5, 60],
        tiers: {
          threshold: '5',
          light: '10 – 15',
          common: '15 – 35',
          strong: '35 – 50',
          heavy: '50+',
        },
        duration: {
          total: '15 – 30 min',
          onset: '15 – 45 s',
          peak: '3 – 8 min',
          offset: '5 – 15 min',
        },
      },
    ],
    interactions: [
      {
        target: 'Lithium',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Severe seizure and acute delirium hazard',
      },
      {
        target: 'MAOIs (Harmala alkaloids)',
        status: 'Caution',
        tone: 'warning',
        note: 'Inhibits MAO-A deamination and extends duration to 3–6 hours (ayahuasca/pharmahuasca)',
      },
    ],
  },
  {
    id: 'mescaline',
    name: 'Mescaline',
    aliases: '3,4,5-Trimethoxyphenethylamine, Peyote alkaloid',
    category: 'Psychedelic',
    form: 'capsule',
    summary: 'Classical phenethylamine psychedelic with a slow onset, warm somatic character, and 10–14 hour duration',
    advisory: 'Nausea during the 60–120 minute comeup is common; splitting the dose across 30 minutes reduces GI load.',
    routes: [
      {
        id: 'oral',
        label: 'Oral (HCl salt)',
        unit: 'mg',
        commonEstimate: 250,
        band: { low: 200, high: 350 },
        domain: [50, 600],
        tiers: {
          threshold: '50',
          light: '100 – 200',
          common: '200 – 350',
          strong: '350 – 500',
          heavy: '500+',
        },
        duration: {
          total: '10 – 14 h',
          onset: '60 – 120 min',
          peak: '4 – 6 h',
          offset: '3 – 5 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Lithium and Tramadol',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Elevated seizure risk with serotonergic psychedelics',
      },
      {
        target: 'Stimulants',
        status: 'Caution',
        tone: 'warning',
        note: 'Compounds phenethylamine adrenergic tone and heart rate',
      },
    ],
  },
  {
    id: 'al-lad',
    name: 'AL-LAD',
    aliases: '6-Allyl-6-nor-LSD',
    category: 'Psychedelic',
    form: 'blotter',
    summary: 'Lysergamide analogue of LSD characterized by a slightly shorter duration and prominent visual geometry',
    advisory: 'Shares complete cross-tolerance with LSD and other serotonergic psychedelics.',
    routes: [
      {
        id: 'sublingual',
        label: 'Sublingual',
        unit: 'μg',
        commonEstimate: 150,
        band: { low: 100, high: 225 },
        domain: [25, 400],
        tiers: {
          threshold: '25',
          light: '50 – 100',
          common: '100 – 225',
          strong: '225 – 300',
          heavy: '300+',
        },
        duration: {
          total: '6 – 9 h',
          onset: '30 – 60 min',
          peak: '2.5 – 4 h',
          offset: '2 – 3 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Lithium',
        status: 'Dangerous',
        tone: 'danger',
        note: 'High seizure risk shared across lysergamides',
      },
      {
        target: 'Cannabis',
        status: 'Caution',
        tone: 'warning',
        note: 'Can trigger rapid cognitive and visual intensification',
      },
    ],
  },
  {
    id: '4-ho-met',
    name: '4-HO-MET',
    aliases: 'Metocin, Methylcybin, Colour',
    category: 'Psychedelic',
    form: 'capsule',
    summary: 'Synthetic 4-substituted tryptamine closely related to psilocin with vivid color and pattern enhancement',
    advisory: 'Use a milligram scale or volumetric solution; eyeball dosing of 10–25 mg powders is unreliable.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 18,
        band: { low: 12, high: 22 },
        domain: [3, 40],
        tiers: {
          threshold: '3',
          light: '6 – 12',
          common: '12 – 22',
          strong: '22 – 30',
          heavy: '30+',
        },
        duration: {
          total: '4 – 6 h',
          onset: '20 – 45 min',
          peak: '1.5 – 2.5 h',
          offset: '1.5 – 2.5 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Lithium',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Contraindicated with all serotonergic tryptamines',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* DISSOCIATIVE                                                       */
  /* ------------------------------------------------------------------ */
  {
    id: 'ketamine',
    name: 'Ketamine',
    aliases: 'Ketalar, Special K, Esketamine',
    category: 'Dissociative',
    form: 'spray',
    summary: 'Arylcyclohexylamine NMDA receptor antagonist producing dose-dependent analgesia and dissociation',
    advisory: 'Frequent use damages bladder urothelium; never use near water or combined with depressants.',
    routes: [
      {
        id: 'insufflated',
        label: 'Insufflated',
        unit: 'mg',
        commonEstimate: 45,
        band: { low: 30, high: 75 },
        domain: [10, 200],
        tiers: {
          threshold: '10',
          light: '15 – 30',
          common: '30 – 75',
          strong: '75 – 150',
          heavy: '150+',
        },
        duration: {
          total: '45 – 90 min',
          onset: '5 – 15 min',
          peak: '20 – 40 min',
          offset: '20 – 45 min',
        },
      },
      {
        id: 'sublingual',
        label: 'Sublingual',
        unit: 'mg',
        commonEstimate: 100,
        band: { low: 60, high: 160 },
        domain: [25, 350],
        tiers: {
          threshold: '25',
          light: '40 – 75',
          common: '75 – 160',
          strong: '160 – 250',
          heavy: '250+',
        },
        duration: {
          total: '90 – 150 min',
          onset: '15 – 25 min',
          peak: '35 – 60 min',
          offset: '45 – 75 min',
        },
      },
    ],
    interactions: [
      {
        target: 'Alcohol and GHB',
        status: 'Dangerous',
        tone: 'danger',
        note: 'High risk of unconsciousness, vomiting, and airway obstruction',
      },
      {
        target: 'Stimulants',
        status: 'Caution',
        tone: 'warning',
        note: 'Elevates blood pressure and myocardial oxygen demand',
      },
    ],
  },
  {
    id: 'dextromethorphan',
    name: 'Dextromethorphan',
    aliases: 'DXM, Robitussin',
    category: 'Dissociative',
    form: 'dropper',
    summary: 'Morphinan dissociative acting as an NMDA receptor antagonist and serotonin reuptake blocker',
    advisory: 'Never combine with SSRIs, SNRIs, MDMA, or MAOIs due to serotonin syndrome risk.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 220,
        band: { low: 150, high: 350 },
        domain: [45, 900],
        tiers: {
          threshold: '60',
          light: '100 – 200',
          common: '200 – 400',
          strong: '400 – 700',
          heavy: '700+',
        },
        duration: {
          total: '6 – 10 h',
          onset: '45 – 90 min',
          peak: '2 – 4 h',
          offset: '3 – 5 h',
        },
      },
    ],
    interactions: [
      {
        target: 'SSRIs and MDMA',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Potent SERT inhibition can trigger life-threatening serotonin toxicity',
      },
      {
        target: 'Alcohol',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Compounds central depression, nausea, and aspiration hazard',
      },
    ],
  },
  {
    id: '2-fdck',
    name: '2-FDCK',
    aliases: '2-Fluorodeschloroketamine, Fluoroketamine',
    category: 'Dissociative',
    form: 'capsule',
    summary: 'Fluorinated arylcyclohexylamine analogue of ketamine with higher oral bioavailability and slightly longer duration',
    advisory: 'Shares urothelial bladder toxicity profile with ketamine upon repeated or high-dose exposure.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 50,
        band: { low: 35, high: 75 },
        domain: [15, 160],
        tiers: {
          threshold: '15',
          light: '20 – 35',
          common: '35 – 75',
          strong: '75 – 120',
          heavy: '120+',
        },
        duration: {
          total: '2 – 4 h',
          onset: '15 – 30 min',
          peak: '45 – 90 min',
          offset: '60 – 90 min',
        },
      },
      {
        id: 'insufflated',
        label: 'Insufflated',
        unit: 'mg',
        commonEstimate: 40,
        band: { low: 25, high: 65 },
        domain: [10, 140],
        tiers: {
          threshold: '10',
          light: '15 – 25',
          common: '25 – 65',
          strong: '65 – 100',
          heavy: '100+',
        },
        duration: {
          total: '1.5 – 3 h',
          onset: '5 – 15 min',
          peak: '30 – 60 min',
          offset: '45 – 75 min',
        },
      },
    ],
    interactions: [
      {
        target: 'Alcohol, Opioids, and Benzodiazepines',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Severe sedation, loss of consciousness, and aspiration risk',
      },
    ],
  },
  {
    id: 'memantine',
    name: 'Memantine',
    aliases: 'Namenda, Ebixa',
    category: 'Dissociative',
    form: 'tablet',
    summary: 'Uncompetitive low-affinity NMDA receptor antagonist and D2 agonist with a 60–80 hour elimination half-life',
    advisory: 'Extremely long half-life means supratherapeutic doses cause multi-day dissociation and accumulation.',
    routes: [
      {
        id: 'oral',
        label: 'Oral (clinical / nootropic)',
        unit: 'mg',
        commonEstimate: 10,
        band: { low: 5, high: 20 },
        domain: [2.5, 60],
        tiers: {
          threshold: '2.5',
          light: '5 – 10',
          common: '10 – 20',
          strong: '20 – 40',
          heavy: '40+',
        },
        duration: {
          total: '24 – 72 h',
          onset: '2 – 4 h',
          peak: '4 – 10 h',
          offset: '24 – 48 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Dextromethorphan and Ketamine',
        status: 'Caution',
        tone: 'warning',
        note: 'Compounds and prolongs NMDA receptor blockade across days',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* STIMULANT                                                          */
  /* ------------------------------------------------------------------ */
  {
    id: 'amphetamine',
    name: 'Amphetamine',
    aliases: 'Adderall, Dexedrine, Speed',
    category: 'Stimulant',
    form: 'capsule',
    summary: 'Central nervous system catecholamine releasing agent affecting dopamine and norepinephrine',
    advisory: 'Avoid mixing with MAOIs; elevated heart rate and blood pressure scale with dose.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 20,
        band: { low: 15, high: 30 },
        domain: [5, 80],
        tiers: {
          threshold: '5',
          light: '7.5 – 15',
          common: '15 – 30',
          strong: '30 – 50',
          heavy: '50+',
        },
        duration: {
          total: '6 – 10 h',
          onset: '20 – 45 min',
          peak: '2 – 3 h',
          offset: '3 – 5 h',
        },
      },
      {
        id: 'insufflated',
        label: 'Insufflated',
        unit: 'mg',
        commonEstimate: 15,
        band: { low: 10, high: 25 },
        domain: [3, 60],
        tiers: {
          threshold: '5',
          light: '5 – 15',
          common: '15 – 25',
          strong: '25 – 40',
          heavy: '40+',
        },
        duration: {
          total: '3 – 6 h',
          onset: '2 – 10 min',
          peak: '45 – 90 min',
          offset: '2 – 3 h',
        },
      },
    ],
    interactions: [
      {
        target: 'MAOIs',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Risk of severe hypertensive crisis from excess catecholamines',
      },
      {
        target: 'Caffeine',
        status: 'Caution',
        tone: 'warning',
        note: 'Additive tachycardia, anxiety, and peripheral vasoconstriction',
      },
    ],
  },
  {
    id: 'methylphenidate',
    name: 'Methylphenidate',
    aliases: 'Ritalin, Concerta, Medikinet, MPH',
    category: 'Stimulant',
    form: 'tablet',
    summary: 'Dopamine and norepinephrine reuptake inhibitor (NDRI) blocking DAT and NET transporters',
    advisory: 'Co-administration with ethanol forms ethylphenidate in the liver and elevates cardiovascular strain.',
    routes: [
      {
        id: 'oral',
        label: 'Oral (immediate release)',
        unit: 'mg',
        commonEstimate: 15,
        band: { low: 10, high: 25 },
        domain: [2.5, 60],
        tiers: {
          threshold: '2.5',
          light: '5 – 10',
          common: '10 – 25',
          strong: '25 – 40',
          heavy: '40+',
        },
        duration: {
          total: '3 – 5 h',
          onset: '20 – 40 min',
          peak: '1 – 2 h',
          offset: '1.5 – 2.5 h',
        },
      },
    ],
    interactions: [
      {
        target: 'MAOIs',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Hypertensive crisis risk within 14 days of irreversible MAOI use',
      },
      {
        target: 'Alcohol',
        status: 'Caution',
        tone: 'warning',
        note: 'Hepatic transesterification produces ethylphenidate and masks intoxication',
      },
    ],
  },
  {
    id: 'lisdexamfetamine',
    name: 'Lisdexamfetamine',
    aliases: 'Vyvanse, Elvanse, LDX',
    category: 'Stimulant',
    form: 'capsule',
    summary: 'L-lysine prodrug hydrolyzed by red blood cell peptidases into dextroamphetamine for smooth 10–12 hour coverage',
    advisory: 'Rate-limited enzymatic cleavage prevents acute peak spikes; take early in the morning to avoid insomnia.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 40,
        band: { low: 30, high: 60 },
        domain: [10, 100],
        tiers: {
          threshold: '10',
          light: '20 – 30',
          common: '30 – 60',
          strong: '60 – 80',
          heavy: '80+',
        },
        duration: {
          total: '10 – 14 h',
          onset: '60 – 90 min',
          peak: '3 – 4.5 h',
          offset: '5 – 8 h',
        },
      },
    ],
    interactions: [
      {
        target: 'MAOIs',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Contraindicated due to severe hypertensive crisis risk',
      },
      {
        target: 'Sympathomimetics and Caffeine',
        status: 'Caution',
        tone: 'warning',
        note: 'Increases heart rate, blood pressure, and restlessness',
      },
    ],
  },
  {
    id: 'mdma',
    name: 'MDMA',
    aliases: '3,4-Methylenedioxymethamphetamine, Molly',
    category: 'Stimulant',
    form: 'capsule',
    summary: 'Entactogen releasing serotonin, norepinephrine, and dopamine via monoamine transporters',
    advisory: 'Monitor hydration and ambient temperature; never combine with MAOIs.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 100,
        band: { low: 80, high: 125 },
        domain: [30, 220],
        tiers: {
          threshold: '30',
          light: '45 – 75',
          common: '80 – 125',
          strong: '125 – 175',
          heavy: '175+',
        },
        duration: {
          total: '3 – 6 h',
          onset: '30 – 60 min',
          peak: '90 – 150 min',
          offset: '1 – 2 h',
        },
      },
    ],
    interactions: [
      {
        target: 'MAOIs',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Severe, potentially fatal hyperthermic serotonin syndrome',
      },
      {
        target: 'DXM and Tramadol',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Overlapping serotonergic load and lowered seizure threshold',
      },
    ],
  },
  {
    id: 'caffeine',
    name: 'Caffeine',
    aliases: '1,3,7-Trimethylxanthine',
    category: 'Stimulant',
    form: 'tablet',
    summary: 'Adenosine receptor antagonist promoting wakefulness and alertness',
    advisory: 'High single doses above 400 mg can provoke tremor, palpitations, and insomnia.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 120,
        band: { low: 75, high: 200 },
        domain: [20, 500],
        tiers: {
          threshold: '20',
          light: '40 – 75',
          common: '75 – 200',
          strong: '200 – 350',
          heavy: '400+',
        },
        duration: {
          total: '4 – 8 h',
          onset: '15 – 30 min',
          peak: '45 – 90 min',
          offset: '3 – 6 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Amphetamine',
        status: 'Caution',
        tone: 'warning',
        note: 'Increases cardiovascular strain and jitteriness',
      },
      {
        target: 'L-Theanine',
        status: 'Low risk',
        tone: 'positive',
        note: 'Smooths peak restlessness while preserving focus',
      },
    ],
  },
  {
    id: 'modafinil',
    name: 'Modafinil',
    aliases: 'Provigil, Modalert, Alertec',
    category: 'Stimulant',
    form: 'tablet',
    summary: 'Wakefulness-promoting eugeroic acting as a weak, selective dopamine reuptake inhibitor and orexin modulator',
    advisory: 'Induces CYP3A4 hepatic enzymes, which can accelerate clearance of oral contraceptives and oral estradiol.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 100,
        band: { low: 100, high: 200 },
        domain: [25, 400],
        tiers: {
          threshold: '25',
          light: '50 – 100',
          common: '100 – 200',
          strong: '200 – 300',
          heavy: '300+',
        },
        duration: {
          total: '10 – 15 h',
          onset: '45 – 90 min',
          peak: '2 – 4 h',
          offset: '6 – 10 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Oral Estradiol & Hormonal Contraceptives',
        status: 'Caution',
        tone: 'warning',
        note: 'CYP3A4 induction accelerates first-pass metabolism of oral steroids',
      },
    ],
  },
  {
    id: 'nicotine-patch',
    name: 'Nicotine transdermal',
    aliases: 'Nicoderm CQ, Nicorette Patch',
    category: 'Stimulant',
    form: 'patch',
    summary: 'Nicotinic acetylcholine receptor (nAChR) agonist delivered via 16- or 24-hour controlled transdermal matrix',
    advisory: 'Remove patch prior to sleep if vivid dreams or nocturnal tachycardia occur; never smoke while wearing a high-dose patch.',
    routes: [
      {
        id: 'transdermal',
        label: 'Transdermal (mg/24h)',
        unit: 'mg',
        commonEstimate: 14,
        band: { low: 7, high: 21 },
        domain: [3.5, 35],
        tiers: {
          threshold: '3.5',
          light: '7',
          common: '14 – 21',
          strong: '21 – 28',
          heavy: '28+',
        },
        duration: {
          total: '16 – 24 h',
          onset: '30 – 60 min',
          peak: '4 – 9 h',
          offset: '2 – 4 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Other stimulants',
        status: 'Caution',
        tone: 'warning',
        note: 'Additive blood pressure and heart rate elevation',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* DEPRESSANT                                                         */
  /* ------------------------------------------------------------------ */
  {
    id: 'alprazolam',
    name: 'Alprazolam',
    aliases: 'Xanax, Tafil',
    category: 'Depressant',
    form: 'tablet',
    summary: 'Fast-acting triazolobenzodiazepine that enhances GABA-A receptor chloride current',
    advisory: 'Combining with opioids or alcohol sharply increases respiratory depression risk.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 1,
        band: { low: 0.5, high: 1.5 },
        domain: [0.125, 4],
        tiers: {
          threshold: '0.25',
          light: '0.25 – 0.5',
          common: '0.5 – 1.5',
          strong: '1.5 – 2',
          heavy: '3+',
        },
        duration: {
          total: '5 – 8 h',
          onset: '20 – 40 min',
          peak: '1 – 2 h',
          offset: '2 – 4 h',
        },
      },
      {
        id: 'sublingual',
        label: 'Sublingual',
        unit: 'mg',
        commonEstimate: 0.75,
        band: { low: 0.5, high: 1.25 },
        domain: [0.125, 3],
        tiers: {
          threshold: '0.15',
          light: '0.25 – 0.5',
          common: '0.5 – 1.25',
          strong: '1.25 – 2',
          heavy: '2.5+',
        },
        duration: {
          total: '4 – 7 h',
          onset: '10 – 20 min',
          peak: '45 – 90 min',
          offset: '2 – 3 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Alcohol',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Potentiates sedation, amnesia, and airway compromise',
      },
      {
        target: 'Opioids',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Synergistic central respiratory depression',
      },
      {
        target: 'Caffeine',
        status: 'Low risk',
        tone: 'positive',
        note: 'May partially mask subjective drowsiness without restoring coordination',
      },
    ],
  },
  {
    id: 'diazepam',
    name: 'Diazepam',
    aliases: 'Valium, Stesolid',
    category: 'Depressant',
    form: 'tablet',
    summary: 'Long-acting benzodiazepine with active metabolites that sustain anxiolysis and muscle relaxation',
    advisory: 'Long elimination half-life causes accumulation across consecutive days.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 10,
        band: { low: 5, high: 15 },
        domain: [2, 40],
        tiers: {
          threshold: '2',
          light: '2.5 – 5',
          common: '5 – 15',
          strong: '15 – 30',
          heavy: '30+',
        },
        duration: {
          total: '6 – 14 h',
          onset: '15 – 40 min',
          peak: '1 – 2 h',
          offset: '4 – 8 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Opioids',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Markedly elevates fatal overdose and respiratory arrest risk',
      },
      {
        target: 'Alcohol',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Synergistic loss of motor control and airway protection',
      },
    ],
  },
  {
    id: 'clonazepam',
    name: 'Clonazepam',
    aliases: 'Klonopin, Rivotril',
    category: 'Depressant',
    form: 'tablet',
    summary: 'High-potency nitrobenzodiazepine with intermediate onset and 30–40 hour elimination half-life',
    advisory: 'Abrupt discontinuation after daily use risks rebound anxiety and withdrawal seizures.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 1,
        band: { low: 0.5, high: 1.5 },
        domain: [0.125, 4],
        tiers: {
          threshold: '0.15',
          light: '0.25 – 0.5',
          common: '0.5 – 1.5',
          strong: '1.5 – 2.5',
          heavy: '3+',
        },
        duration: {
          total: '8 – 12 h',
          onset: '30 – 60 min',
          peak: '1.5 – 3 h',
          offset: '4 – 8 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Opioids and Alcohol',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Severe respiratory depression and unconsciousness risk',
      },
    ],
  },
  {
    id: 'lorazepam',
    name: 'Lorazepam',
    aliases: 'Ativan, Tavor',
    category: 'Depressant',
    form: 'tablet',
    summary: 'Intermediate-duration 3-hydroxy benzodiazepine metabolized directly via glucuronidation without CYP450 active metabolites',
    advisory: 'Preferred benzodiazepine in hepatic impairment, but retains full additive CNS depression risk with opioids and alcohol.',
    routes: [
      {
        id: 'oral',
        label: 'Oral / Sublingual',
        unit: 'mg',
        commonEstimate: 1.5,
        band: { low: 1, high: 2.5 },
        domain: [0.25, 6],
        tiers: {
          threshold: '0.25',
          light: '0.5 – 1',
          common: '1 – 2.5',
          strong: '2.5 – 4',
          heavy: '4+',
        },
        duration: {
          total: '6 – 9 h',
          onset: '20 – 45 min',
          peak: '1.5 – 2.5 h',
          offset: '3 – 5 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Opioids and Alcohol',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Synergistic respiratory depression and anterograde amnesia',
      },
    ],
  },
  {
    id: 'pregabalin',
    name: 'Pregabalin',
    aliases: 'Lyrica',
    category: 'Depressant',
    form: 'capsule',
    summary: 'Gabapentinoid α2δ voltage-gated calcium channel ligand reducing excitatory neurotransmitter release',
    advisory: 'Potentiates opioid and benzodiazepine sedation; tolerance builds rapidly over consecutive days.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 150,
        band: { low: 75, high: 300 },
        domain: [25, 600],
        tiers: {
          threshold: '25',
          light: '50 – 100',
          common: '100 – 300',
          strong: '300 – 450',
          heavy: '450+',
        },
        duration: {
          total: '6 – 12 h',
          onset: '45 – 90 min',
          peak: '2 – 3.5 h',
          offset: '4 – 7 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Opioids and Benzodiazepines',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Substantially increases central respiratory depression risk',
      },
    ],
  },
  {
    id: 'zolpidem',
    name: 'Zolpidem',
    aliases: 'Ambien, Stilnox',
    category: 'Depressant',
    form: 'tablet',
    summary: 'Short-acting imidazopyridine nonbenzodiazepine (Z-drug) selective for the α1 subunit of GABA-A receptors',
    advisory: 'Administer only immediately before bed; remaining awake during peak increases amnesia and sleepwalking risk.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 10,
        band: { low: 5, high: 10 },
        domain: [2.5, 25],
        tiers: {
          threshold: '2.5',
          light: '5',
          common: '5 – 10',
          strong: '10 – 15',
          heavy: '20+',
        },
        duration: {
          total: '3 – 6 h',
          onset: '15 – 30 min',
          peak: '45 – 90 min',
          offset: '2 – 4 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Alcohol and Opioids',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Compounds respiratory depression and complex sleep-related behaviors',
      },
    ],
  },
  {
    id: 'ghb',
    name: 'GHB',
    aliases: 'Sodium oxybate, Xyrem, Gamma-hydroxybutyrate',
    category: 'Depressant',
    form: 'dropper',
    summary: 'Endogenous short-acting GABA-B and GHB receptor agonist with an exceptionally steep dose-response curve',
    advisory: 'Always measure liquid concentration precisely; a 0.5–1 g excess or any co-administration with alcohol can induce coma.',
    routes: [
      {
        id: 'oral',
        label: 'Oral (sodium salt equivalent)',
        unit: 'g',
        commonEstimate: 1.75,
        band: { low: 1.25, high: 2.25 },
        domain: [0.5, 4],
        tiers: {
          threshold: '0.5',
          light: '0.75 – 1.25',
          common: '1.25 – 2.25',
          strong: '2.25 – 3',
          heavy: '3+',
        },
        duration: {
          total: '2 – 4 h',
          onset: '15 – 30 min',
          peak: '45 – 90 min',
          offset: '45 – 90 min',
        },
      },
    ],
    interactions: [
      {
        target: 'Alcohol, Opioids, Benzodiazepines, and Ketamine',
        status: 'Dangerous',
        tone: 'danger',
        note: 'High risk of rapid respiratory arrest, vomiting while unconscious, and fatal overdose',
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* OPIOID                                                             */
  /* ------------------------------------------------------------------ */
  {
    id: 'oxycodone',
    name: 'Oxycodone',
    aliases: 'OxyContin, Roxicodone',
    category: 'Opioid',
    form: 'tablet',
    summary: 'Semi-synthetic mu-opioid agonist providing potent central analgesia and respiratory depression',
    advisory: 'Keep naloxone accessible; tablet supply frequently contains counterfeit fentanyl analogues.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 15,
        band: { low: 10, high: 25 },
        domain: [2.5, 60],
        tiers: {
          threshold: '2.5',
          light: '5 – 10',
          common: '10 – 25',
          strong: '25 – 40',
          heavy: '40+',
        },
        duration: {
          total: '4 – 6 h',
          onset: '15 – 30 min',
          peak: '1 – 2 h',
          offset: '2 – 3 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Benzodiazepines and Alcohol',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Primary driver of fatal respiratory arrest',
      },
      {
        target: 'Gabapentinoids',
        status: 'Caution',
        tone: 'warning',
        note: 'Potentiates sedation and hypoventilation in opioid-naive individuals',
      },
    ],
  },
  {
    id: 'morphine',
    name: 'Morphine',
    aliases: 'MS Contin, Oramorph, Morphine sulfate',
    category: 'Opioid',
    form: 'injection',
    summary: 'Prototypical phenanthrene mu-opioid receptor agonist subject to significant first-pass glucuronidation when taken orally',
    advisory: 'Parenteral bioavailability is ~3× higher than oral administration; never apply oral milligram doses to injection.',
    routes: [
      {
        id: 'oral',
        label: 'Oral (immediate release)',
        unit: 'mg',
        commonEstimate: 20,
        band: { low: 15, high: 30 },
        domain: [5, 75],
        tiers: {
          threshold: '5',
          light: '10 – 15',
          common: '15 – 30',
          strong: '30 – 45',
          heavy: '45+',
        },
        duration: {
          total: '4 – 6 h',
          onset: '20 – 40 min',
          peak: '60 – 90 min',
          offset: '2 – 3.5 h',
        },
      },
      {
        id: 'intramuscular',
        label: 'Intramuscular / SubQ',
        unit: 'mg',
        commonEstimate: 7.5,
        band: { low: 5, high: 10 },
        domain: [1.5, 25],
        tiers: {
          threshold: '1.5',
          light: '2.5 – 5',
          common: '5 – 10',
          strong: '10 – 15',
          heavy: '15+',
        },
        duration: {
          total: '3 – 5 h',
          onset: '10 – 20 min',
          peak: '30 – 60 min',
          offset: '2 – 3 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Benzodiazepines, Alcohol, and GHB',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Profound synergistic suppression of brainstem respiratory drive',
      },
    ],
  },
  {
    id: 'buprenorphine',
    name: 'Buprenorphine',
    aliases: 'Subutex, Suboxone, Butrans, Temgesic',
    category: 'Opioid',
    form: 'patch',
    summary: 'High-affinity partial mu-opioid agonist and kappa-opioid antagonist with a long receptor dissociation half-life',
    advisory: 'Administering while full opioid agonists occupy receptors precipitates acute withdrawal.',
    routes: [
      {
        id: 'sublingual',
        label: 'Sublingual (opioid-naive)',
        unit: 'mg',
        commonEstimate: 0.5,
        band: { low: 0.25, high: 1 },
        domain: [0.1, 4],
        tiers: {
          threshold: '0.1',
          light: '0.2 – 0.4',
          common: '0.4 – 1',
          strong: '1 – 2',
          heavy: '2+',
        },
        duration: {
          total: '12 – 24 h',
          onset: '30 – 60 min',
          peak: '2 – 4 h',
          offset: '8 – 16 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Benzodiazepines and Alcohol',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Bypasses partial-agonist respiratory ceiling and can cause fatal apnea',
      },
      {
        target: 'Full mu-opioid agonists (Morphine, Oxycodone)',
        status: 'Caution',
        tone: 'warning',
        note: 'Displaces full agonists and triggers precipitated withdrawal',
      },
    ],
  },
  {
    id: 'codeine',
    name: 'Codeine',
    aliases: '3-Methylmorphine, Tylenol #3',
    category: 'Opioid',
    form: 'tablet',
    summary: 'Weak opiate prodrug O-demethylated by hepatic CYP2D6 into active morphine (~10% conversion in normal metabolizers)',
    advisory: 'CYP2D6 ultra-rapid metabolizers convert excessive morphine; high single doses trigger mast-cell histamine release.',
    routes: [
      {
        id: 'oral',
        label: 'Oral',
        unit: 'mg',
        commonEstimate: 90,
        band: { low: 60, high: 120 },
        domain: [15, 250],
        tiers: {
          threshold: '15',
          light: '30 – 60',
          common: '60 – 120',
          strong: '120 – 180',
          heavy: '180+',
        },
        duration: {
          total: '3 – 6 h',
          onset: '20 – 45 min',
          peak: '1 – 2 h',
          offset: '2 – 3 h',
        },
      },
    ],
    interactions: [
      {
        target: 'Alcohol and Benzodiazepines',
        status: 'Dangerous',
        tone: 'danger',
        note: 'Additive central respiratory and sedative depression',
      },
      {
        target: 'CYP2D6 inhibitors (Fluoxetine, Paroxetine, Bupropion)',
        status: 'Caution',
        tone: 'warning',
        note: 'Blocks conversion to morphine and abolishes analgesic efficacy',
      },
    ],
  },
  {
    id: 'naloxone',
    name: 'Naloxone',
    aliases: 'Narcan, Nyxoid, Evzio',
    category: 'Opioid',
    form: 'spray',
    summary: 'Competitive mu-, kappa-, and delta-opioid receptor antagonist used for emergency reversal of opioid respiratory depression',
    advisory: 'Duration of action (30–90 min) is shorter than most opioids; monitor closely for recurrent sedation ("renarcotization").',
    routes: [
      {
        id: 'intranasal',
        label: 'Intranasal spray',
        unit: 'mg',
        commonEstimate: 4,
        band: { low: 2, high: 4 },
        domain: [0.4, 8],
        tiers: {
          threshold: '0.4',
          light: '1 – 2',
          common: '2 – 4',
          strong: '4 – 8',
          heavy: '8+',
        },
        duration: {
          total: '30 – 90 min',
          onset: '2 – 5 min',
          peak: '15 – 30 min',
          offset: '30 – 60 min',
        },
      },
    ],
    interactions: [
      {
        target: 'Opioid agonists',
        status: 'Caution',
        tone: 'warning',
        note: 'Reverses respiratory arrest immediately; precipitates acute withdrawal in opioid-dependent individuals',
      },
    ],
  },
];
