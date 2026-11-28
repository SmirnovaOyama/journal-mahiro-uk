import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'data');
const SUB_DIR = path.join(OUT_DIR, 'substances');

const TRIPSIT_DRUGS_URL = 'https://raw.githubusercontent.com/TripSit/drugs/main/drugs.json';
const TRIPSIT_COMBOS_URL = 'https://raw.githubusercontent.com/TripSit/drugs/main/combos.json';
const PW_GRAPHQL_URL = 'https://api.psychonautwiki.org/';

const PW_QUERY = `{
  substances(limit: 1000) {
    name
    url
    toxicity
    addictionPotential
    class {
      chemical
      psychoactive
    }
    tolerance {
      full
      half
      zero
    }
    crossTolerances
    roas {
      name
      dose {
        units
        threshold
        light { min max }
        common { min max }
        strong { min max }
        heavy
      }
      duration {
        onset { min max units }
        comeup { min max units }
        peak { min max units }
        offset { min max units }
        afterglow { min max units }
        total { min max units }
      }
      bioavailability { min max }
    }
    uncertainInteractions { name }
    unsafeInteractions { name }
    dangerousInteractions { name }
  }
}`;

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normKey(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatNum(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(2)));
}

function formatUnit(u) {
  if (!u) return 'mg';
  const low = u.toLowerCase().trim();
  if (low === 'ug' || low === 'µg' || low === 'μg' || low === 'mcg') return 'μg';
  if (low === 'mg') return 'mg';
  if (low === 'g' || low === 'grams') return 'g';
  if (low === 'ml') return 'mL';
  return u;
}

function formatDurationRange(range) {
  if (!range) return null;
  const { min, max, units } = range;
  if (min == null && max == null) return null;
  const unitMap = {
    seconds: 's',
    second: 's',
    minutes: 'min',
    minute: 'min',
    hours: 'h',
    hour: 'h',
    days: 'd',
    day: 'd',
  };
  const u = unitMap[(units || '').toLowerCase()] || units || '';
  if (min != null && max != null && min !== max) {
    return `${formatNum(min)}–${formatNum(max)} ${u}`.trim();
  }
  const val = min != null ? min : max;
  return `${formatNum(val)} ${u}`.trim();
}

function capitalizeRoa(name) {
  const map = {
    oral: 'Oral',
    sublingual: 'Sublingual',
    buccal: 'Buccal',
    insufflated: 'Insufflated',
    intranasal: 'Insufflated',
    inhaled: 'Inhaled',
    smoked: 'Smoked',
    vaporized: 'Vaporized',
    rectal: 'Rectal',
    intramuscular: 'Intramuscular',
    im: 'Intramuscular',
    intravenous: 'Intravenous',
    iv: 'Intravenous',
    subcutaneous: 'Subcutaneous',
    transdermal: 'Transdermal',
  };
  const low = String(name || 'oral').toLowerCase().trim();
  return map[low] || name.charAt(0).toUpperCase() + name.slice(1);
}

function parseRangeNumbers(str) {
  if (!str) return null;
  const clean = String(str).replace(/,/g, '');
  const nums = clean.match(/\d+(\.\d+)?/g);
  if (!nums || nums.length === 0) return null;
  const a = parseFloat(nums[0]);
  const b = nums.length > 1 ? parseFloat(nums[1]) : a;
  const unitMatch = clean.match(/(µg|μg|ug|mcg|mg|ml|g)\b/i);
  const unit = unitMatch ? formatUnit(unitMatch[1]) : null;
  return { low: Math.min(a, b), high: Math.max(a, b), unit };
}

function mapCategory(pwClasses = [], tsCategories = []) {
  const all = [...pwClasses, ...tsCategories].map((c) => String(c).toLowerCase());
  const has = (kw) => all.some((x) => x.includes(kw));

  if (has('endocrine') || has('hormone')) return 'Endocrine';
  // A sleeping pill that can make one see things (zolpidem, zopiclone,
  // eszopiclone, gaboxadol: "Hallucinogens, Depressant") is a depressant
  // first. Filed as a psychedelic, the mix checker didn't count it among the
  // depressants, and zolpidem with alcohol read "Not documented".
  if (has('hallucinogen') && !has('psychedelic') && !has('lysergamide') && (has('depressant') || has('hypnotic') || has('sedative')))
    return 'Depressant';
  if (has('psychedelic') || has('hallucinogen') || has('lysergamide')) return 'Psychedelic';
  if (has('dissociative')) return 'Dissociative';
  if (has('empathogen') || has('entactogen')) return 'Empathogen';
  if (has('opioid') || has('opiate')) return 'Opioid';
  if (has('depressant') || has('benzodiazepine') || has('barbiturate') || has('sedative') || has('gabapentinoid') || has('gaba')) {
    return 'Depressant';
  }
  if (has('stimulant') || has('amphetamine') || has('cathinone') || has('phenidate') || has('eugeroic')) {
    return 'Stimulant';
  }
  if (has('cannabinoid')) return 'Cannabinoid';
  if (has('nootropic') || has('racetam')) return 'Nootropic';
  if (has('deliriant') || has('anticholinergic')) return 'Deliriant';
  return 'Other';
}

function formatDoseText(str) {
  if (!str) return '';
  return String(str)
    .replace(/µg|ug|mcg/gi, 'μg')
    .replace(/(\d)(μg|mg|ml|g)\b/gi, '$1 $2')
    .replace(/\s*-\s*/g, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

function niceCeiling(val) {
  if (!Number.isFinite(val) || val <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(val)));
  const frac = val / exp;
  let nice;
  if (frac <= 1) nice = 1;
  else if (frac <= 1.2) nice = 1.2;
  else if (frac <= 1.5) nice = 1.5;
  else if (frac <= 2) nice = 2;
  else if (frac <= 2.5) nice = 2.5;
  else if (frac <= 3) nice = 3;
  else if (frac <= 4) nice = 4;
  else if (frac <= 5) nice = 5;
  else if (frac <= 6) nice = 6;
  else if (frac <= 8) nice = 8;
  else nice = 10;
  return Number((nice * exp).toFixed(2));
}

function roaPriority(roaName, preferSublingual = false) {
  const r = String(roaName || '').toLowerCase();
  if (preferSublingual && r.includes('sublingual')) return 0;
  if (r.includes('oral')) return 1;
  if (r.includes('sublingual')) return 2;
  if (r.includes('buccal')) return 3;
  if (r.includes('transdermal')) return 4;
  if (r.includes('insufflat') || r.includes('intranasal')) return 5;
  if (r.includes('vaporiz') || r.includes('inhal') || r.includes('smok')) return 6;
  if (r.includes('rectal')) return 7;
  if (r.includes('intramuscular') || r.includes('subcutaneous')) return 8;
  if (r.includes('intravenous')) return 9;
  return 10;
}

function formatAdvisory(avoid, doseNote, toxicity) {
  if (avoid) {
    const clean = String(avoid).trim();
    if (/^(avoid|do not|never|caution|warning|be careful|combining|mixing)/i.test(clean)) {
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    return `Avoid: ${clean}`;
  }
  if (doseNote) {
    const clean = String(doseNote).trim().replace(/^note:\s*/i, '');
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  if (Array.isArray(toxicity)) {
    const serious = toxicity.find((t) =>
      /(fatal|lethal|overdose|seizure|cardiotoxic|neurotoxic|hepatotoxic|nephrotoxic|vasoconstriction|serotonin|respiratory|high toxicity|dangerous)/i.test(
        String(t)
      )
    );
    if (serious) {
      const clean = String(serious).trim();
      const s = clean.charAt(0).toUpperCase() + clean.slice(1);
      return s.endsWith('.') ? s : `${s}.`;
    }
  }
  return undefined;
}

function inferForm(id, name, category, roas, pwChem = []) {
  const lowName = `${id} ${name}`.toLowerCase();
  const chem = pwChem.map((c) => c.toLowerCase()).join(' ');
  const roaNames = roas.map((r) => r.roa.toLowerCase());
  const firstUnit = roas[0]?.unit || '';

  if (lowName.includes('gel')) return 'gel';
  if (lowName.includes('patch') || roaNames[0] === 'transdermal') return 'patch';
  if (
    lowName.includes('enanthate') ||
    lowName.includes('cypionate') ||
    lowName.includes('undecylate') ||
    lowName.includes('morphine') ||
    lowName.includes('heroin') ||
    roaNames[0] === 'intramuscular' ||
    roaNames[0] === 'intravenous'
  ) {
    return 'injection';
  }
  if (
    chem.includes('lysergamide') ||
    lowName.includes('lsd') ||
    lowName.includes('-lad') ||
    lowName.includes('nbome') ||
    lowName.includes('nboh') ||
    /\bdo[mbcie]\b/.test(lowName) ||
    (category === 'Psychedelic' && firstUnit === 'μg')
  ) {
    return 'blotter';
  }
  if (
    lowName.includes('spray') ||
    lowName.includes('naloxone') ||
    lowName.includes('ketamine') ||
    lowName.includes('nitrous') ||
    lowName.includes('dmt') ||
    lowName.includes('poppers') ||
    lowName.includes('amyl') ||
    roaNames[0] === 'insufflated' ||
    roaNames[0] === 'inhaled' ||
    roaNames[0] === 'vaporized' ||
    roaNames[0] === 'smoked'
  ) {
    return 'spray';
  }
  if (
    lowName.includes('ghb') ||
    lowName.includes('gbl') ||
    lowName.includes('butanediol') ||
    lowName.includes('alcohol') ||
    lowName.includes('ethanol') ||
    lowName.includes('dextromethorphan') ||
    lowName.includes('dxm') ||
    lowName.includes('ayahuasca') ||
    lowName.includes('kava') ||
    lowName.includes('tincture') ||
    firstUnit === 'mL'
  ) {
    return 'dropper';
  }
  if (
    category === 'Depressant' ||
    category === 'Opioid' ||
    category === 'Endocrine' ||
    chem.includes('benzodiazepine') ||
    lowName.includes('2c-b') ||
    lowName.includes('caffeine') ||
    lowName.includes('modafinil') ||
    lowName.includes('methylphenidate')
  ) {
    return 'tablet';
  }
  return 'capsule';
}

function buildDoseRowFromPW(roa) {
  const d = roa.dose;
  if (!d || !d.units) return null;
  const unit = formatUnit(d.units);
  const commonMin = d.common?.min ?? d.light?.max ?? d.threshold;
  const commonMax = d.common?.max ?? d.strong?.min ?? (commonMin ? commonMin * 1.5 : null);
  if (commonMin == null && commonMax == null) return null;

  const lo = commonMin ?? commonMax * 0.7;
  const hi = commonMax ?? commonMin * 1.5;
  const commonEst = Number(((lo + hi) / 2).toFixed(lo < 5 ? 2 : 0));

  const lightMin = d.light?.min ?? d.threshold ?? Math.max(0.1, lo * 0.4);
  const lightMax = d.light?.max ?? lo;
  const strongMin = d.strong?.min ?? hi;
  const strongMax = d.strong?.max ?? d.heavy ?? hi * 1.75;
  const heavyMin = d.heavy ?? strongMax;
  const domainMin = Math.max(0.05, Math.min(d.threshold ?? lightMin, lightMin) * 0.8);
  const domainMax = Math.max(heavyMin * 1.35, hi * 2.2);

  const bio = roa.bioavailability;
  const bioavailability =
    bio && (bio.min != null || bio.max != null)
      ? bio.min === bio.max || bio.max == null
        ? `Bioavailability ~${formatNum(bio.min)}%`
        : `Bioavailability ${formatNum(bio.min)}–${formatNum(bio.max)}%`
      : 'PsychonautWiki ladder';

  return {
    roa: capitalizeRoa(roa.name),
    bioavailability,
    source: 'PsychonautWiki',
    unit,
    threshold: d.threshold != null ? `${formatNum(d.threshold)} ${unit}` : undefined,
    light: `${formatNum(lightMin)}–${formatNum(lightMax)} ${unit}`,
    common: `${formatNum(lo)}–${formatNum(hi)} ${unit}`,
    strong: `${formatNum(strongMin)}–${formatNum(strongMax)} ${unit}`,
    heavy: `${formatNum(heavyMin)} ${unit}+`,
    commonEstimate: commonEst,
    band: { low: Number(formatNum(lo)), high: Number(formatNum(hi)) },
    domain: [Number(formatNum(domainMin)), Number(formatNum(domainMax))],
    segments: {
      light: [Number(formatNum(lightMin)), Number(formatNum(lightMax))],
      common: [Number(formatNum(lo)), Number(formatNum(hi))],
      strong: [Number(formatNum(strongMin)), Number(formatNum(strongMax))],
      heavy: [Number(formatNum(heavyMin)), Number(formatNum(domainMax * 0.96))],
    },
  };
}

function buildDoseRowsFromTripSit(formattedDose) {
  if (!formattedDose || typeof formattedDose !== 'object') return [];
  const rows = [];
  for (const [roaRaw, tiers] of Object.entries(formattedDose)) {
    if (!tiers || typeof tiers !== 'object') continue;
    const commonP = parseRangeNumbers(tiers.Common);
    const lightP = parseRangeNumbers(tiers.Light);
    const strongP = parseRangeNumbers(tiers.Strong);
    const heavyP = parseRangeNumbers(tiers.Heavy);
    const threshP = parseRangeNumbers(tiers.Threshold);

    const unit = commonP?.unit || lightP?.unit || strongP?.unit || heavyP?.unit || 'mg';
    if (!commonP && !lightP) continue;

    const lo = commonP?.low ?? lightP?.high ?? 10;
    const hi = commonP?.high ?? strongP?.low ?? lo * 1.5;
    const lightLo = lightP?.low ?? threshP?.low ?? Math.max(0.1, lo * 0.4);
    const lightHi = lightP?.high ?? lo;
    const strongLo = strongP?.low ?? hi;
    const strongHi = strongP?.high ?? heavyP?.low ?? hi * 1.6;
    const heavyLo = heavyP?.low ?? strongHi;
    const domainMin = Math.max(0.05, Math.min(threshP?.low ?? lightLo, lightLo) * 0.8);
    const domainMax = Math.max(heavyLo * 1.35, hi * 2.2);
    const commonEst = Number(((lo + hi) / 2).toFixed(lo < 5 ? 2 : 0));

    rows.push({
      roa: capitalizeRoa(roaRaw),
      bioavailability: 'TripSit reference',
      source: 'TripSit',
      unit,
      threshold: tiers.Threshold ? formatDoseText(tiers.Threshold) : undefined,
      light: tiers.Light ? formatDoseText(tiers.Light) : `${formatNum(lightLo)}–${formatNum(lightHi)} ${unit}`,
      common: tiers.Common ? formatDoseText(tiers.Common) : `${formatNum(lo)}–${formatNum(hi)} ${unit}`,
      strong: tiers.Strong ? formatDoseText(tiers.Strong) : `${formatNum(strongLo)}–${formatNum(strongHi)} ${unit}`,
      heavy: tiers.Heavy ? formatDoseText(tiers.Heavy) : `${formatNum(heavyLo)} ${unit}+`,
      commonEstimate: commonEst,
      band: { low: Number(formatNum(lo)), high: Number(formatNum(hi)) },
      domain: [Number(formatNum(domainMin)), Number(formatNum(domainMax))],
      segments: {
        light: [Number(formatNum(lightLo)), Number(formatNum(lightHi))],
        common: [Number(formatNum(lo)), Number(formatNum(hi))],
        strong: [Number(formatNum(strongLo)), Number(formatNum(strongHi))],
        heavy: [Number(formatNum(heavyLo)), Number(formatNum(domainMax * 0.96))],
      },
    });
  }
  return rows;
}

function buildDurationRowsFromPW(roas = []) {
  const rows = [];
  for (const r of roas) {
    const dur = r.duration;
    if (!dur) continue;
    const onset = formatDurationRange(dur.onset);
    const comeup = formatDurationRange(dur.comeup);
    const peak = formatDurationRange(dur.peak);
    const offset = formatDurationRange(dur.offset);
    const afterEffects = formatDurationRange(dur.afterglow);
    const total = formatDurationRange(dur.total);
    if (!onset && !peak && !total) continue;
    rows.push({
      roa: capitalizeRoa(r.name),
      onset: onset || '—',
      comeup: comeup || '—',
      peak: peak || '—',
      offset: offset || '—',
      afterEffects: afterEffects || '—',
      total: total || '—',
    });
  }
  return rows;
}

function buildDurationRowsFromTripSit(ts) {
  const onsetObj = ts.formatted_onset;
  const durObj = ts.formatted_duration;
  const afterObj = ts.formatted_aftereffects;
  if (!onsetObj && !durObj && !afterObj) return [];

  const fmt = (obj, key) => {
    if (!obj) return null;
    const raw = obj[key] ?? obj.value;
    if (!raw) return null;
    const unit = obj._unit || '';
    const shortU = unit === 'hours' ? 'h' : unit === 'minutes' ? 'min' : unit;
    return `${String(raw).replace('-', '–')} ${shortU}`.trim();
  };

  const keys = new Set([
    ...Object.keys(onsetObj || {}),
    ...Object.keys(durObj || {}),
    ...Object.keys(afterObj || {}),
  ]);
  keys.delete('_unit');

  if (keys.size === 0) return [];
  const rows = [];
  for (const k of keys) {
    const roa = k === 'value' ? 'General' : capitalizeRoa(k);
    const onset = fmt(onsetObj, k) || '—';
    const total = fmt(durObj, k) || '—';
    const afterEffects = fmt(afterObj, k) || '—';
    if (onset === '—' && total === '—' && afterEffects === '—') continue;
    rows.push({
      roa,
      onset,
      comeup: '—',
      peak: '—',
      offset: '—',
      afterEffects,
      total,
    });
  }
  return rows;
}

function mapTripSitComboStatus(statusRaw) {
  const s = String(statusRaw || '').toLowerCase();
  if (s.includes('dangerous')) return { status: 'Dangerous', tone: 'danger' };
  if (s.includes('unsafe')) return { status: 'Unsafe', tone: 'danger' };
  if (s.includes('caution')) return { status: 'Caution', tone: 'warning' };
  if (s.includes('synergy') && !s.includes('no synergy')) return { status: 'Synergy', tone: 'info' };
  if (s.includes('decrease')) return { status: 'Decrease', tone: 'neutral' };
  return { status: 'Low risk', tone: 'positive' };
}

function parseCitation(line) {
  const urlMatch = String(line).match(/https?:\/\/\S+/);
  const url = urlMatch ? urlMatch[0].replace(/[.,;)]+$/, '') : undefined;
  const title = String(line)
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\s\-–]+$/, '')
    .trim();
  return { title: title || url || line, url };
}

function prettyLabel(key) {
  const special = {
    '2c-t-x': '2C-T-x',
    '2c-x': '2C-x',
    '5-meo-xxt': '5-MeO-xxT',
    amt: 'AMT',
    dmt: 'DMT',
    dox: 'DOx',
    'ghb/gbl': 'GHB / GBL',
    lsd: 'LSD',
    maois: 'MAOIs',
    mdma: 'MDMA',
    mxe: 'MXE',
    nbomes: 'NBOMes',
    pcp: 'PCP',
    ssris: 'SSRIs',
  };
  const low = String(key).toLowerCase();
  if (special[low]) return special[low];
  return low.charAt(0).toUpperCase() + low.slice(1);
}

// Curated clinical Endocrine / HRT entries to keep alongside TripSit + PsychonautWiki
const ENDOCRINE_ENTRIES = [
  {
    id: 'estradiol-valerate',
    name: 'Estradiol valerate',
    aliases: 'Progynova, Delestrogen, EV',
    category: 'Endocrine',
    form: 'tablet',
    chemicalClass: 'Estrogen ester (17β-estradiol 17-valerate)',
    psychoactiveClass: 'Endocrine / Hormone therapy',
    halfLife: '12–20 h (oral) · 4–5 d (IM depot)',
    summarySources: 'Transfeminine Science, Endocrine Society, UCSF Guidelines',
    summary:
      'Prodrug ester cleaved rapidly into bioidentical 17β-estradiol in plasma and liver, used widely in oral, sublingual, and injectable depot hormone therapy.',
    advisory:
      'Estimates are reference ranges only; confirm serum estradiol (E2) and testosterone at trough with laboratory blood work.',
    doseBasis:
      'Oral dosing undergoes extensive hepatic first-pass conversion to estrone (E1). Sublingual administration bypasses initial first-pass metabolism, yielding higher transient E2 peaks and a shorter half-life.',
    doseMaxTick: 10,
    doseUnit: 'mg',
    doseRows: [
      {
        roa: 'Oral',
        bioavailability: 'Bioavailability ~3–5%',
        source: 'Clinical Pharmacokinetics',
        unit: 'mg',
        light: '1–2 mg',
        common: '2–6 mg',
        strong: '6–8 mg',
        heavy: '8 mg+',
        commonEstimate: 4,
        band: { low: 2, high: 6 },
        domain: [0.5, 10],
        segments: { light: [1, 2], common: [2, 6], strong: [6, 8], heavy: [8, 9.6] },
      },
      {
        roa: 'Sublingual',
        bioavailability: 'Bioavailability ~15–25%',
        source: 'Transfeminine Science',
        unit: 'mg',
        light: '0.5–1 mg',
        common: '1–4 mg',
        strong: '4–6 mg',
        heavy: '6 mg+',
        commonEstimate: 2,
        band: { low: 1, high: 4 },
        domain: [0.25, 8],
        segments: { light: [0.5, 1], common: [1, 4], strong: [4, 6], heavy: [6, 7.6] },
      },
    ],
    durationSources: 'Transfeminine Science, Clinical Pharmacokinetics',
    durationRows: [
      { roa: 'Oral', onset: '1–2 h', comeup: '1–3 h', peak: '3–6 h', offset: '8–14 h', afterEffects: '—', total: '12–24 h' },
      { roa: 'Sublingual', onset: '15–30 min', comeup: '30–60 min', peak: '1–2 h', offset: '4–8 h', afterEffects: '—', total: '6–12 h' },
    ],
    combinations: [
      { substance: 'Cyproterone acetate', status: 'Low risk', tone: 'positive', note: 'Commonly paired at 5–12.5 mg/day for synergistic gonadotropin suppression.' },
      { substance: 'CYP3A4 inducers (Rifampicin, Carbamazepine, Modafinil)', status: 'Caution', tone: 'warning', note: 'Accelerates hepatic clearance and lowers steady-state serum estradiol.' },
    ],
    helpfulLinks: [
      { title: 'Transfeminine Science', description: 'Estradiol pharmacokinetics and injectable simulator', url: 'https://transfemscience.org/' },
      { title: 'UCSF Transgender Care', description: 'Clinical hormone monitoring protocols', url: 'https://transcare.ucsf.edu/' },
    ],
  },
  {
    id: 'estradiol-enanthate',
    name: 'Estradiol enanthate',
    aliases: 'EEn, Perlutan, Estradiol heptanoate',
    category: 'Endocrine',
    form: 'injection',
    chemicalClass: 'Estrogen ester (17β-estradiol 17-enanthate)',
    psychoactiveClass: 'Endocrine / Injectable depot',
    halfLife: '5.5–7 days (in oil depot)',
    summarySources: 'Transfeminine Science, Clinical Pharmacokinetics',
    summary:
      'Long-acting lipophilic estradiol ester formulated in oil for intramuscular or subcutaneous depot injection, offering notably flat serum curves on 7- to 10-day cycles.',
    advisory:
      'Inspect vial for particulate matter; rotate injection sites and confirm steady-state trough E2 levels after 4–5 cycles.',
    doseBasis:
      'Weekly 3.5–5 mg subcutaneous or intramuscular dosing typically maintains steady-state trough 17β-estradiol in the monotherapy range without sharp peak-to-trough swings.',
    doseMaxTick: 10,
    doseUnit: 'mg',
    doseRows: [
      {
        roa: 'Intramuscular / SubQ',
        bioavailability: 'Bioavailability ~100% (depot)',
        source: 'Transfeminine Science',
        unit: 'mg',
        light: '2–3 mg',
        common: '3.5–5 mg',
        strong: '5–7 mg',
        heavy: '7 mg+',
        commonEstimate: 4,
        band: { low: 3.5, high: 5 },
        domain: [1, 10],
        segments: { light: [2, 3], common: [3.5, 5], strong: [5, 7], heavy: [7, 9.5] },
      },
    ],
    durationSources: 'Transfeminine Science, Clinical Pharmacokinetics',
    durationRows: [
      { roa: 'Intramuscular / SubQ', onset: '12–24 h', comeup: '1–2 d', peak: '2–3 d', offset: '4–7 d', afterEffects: '—', total: '7–10 d' },
    ],
    combinations: [
      { substance: 'CYP3A4 inducers', status: 'Caution', tone: 'warning', note: 'May increase systemic clearance of cleaved 17β-estradiol.' },
    ],
    helpfulLinks: [
      { title: 'Transfeminine Science Injectable Simulator', description: 'Compartmental PK model for estradiol esters', url: 'https://transfemscience.org/misc/injectable-e2-simulator/' },
    ],
  },
  {
    id: 'estradiol-cypionate',
    name: 'Estradiol cypionate',
    aliases: 'Depo-Estradiol, EC',
    category: 'Endocrine',
    form: 'injection',
    chemicalClass: 'Estrogen ester (17β-estradiol 17-cypionate)',
    psychoactiveClass: 'Endocrine / Injectable depot',
    halfLife: '5–7 days (in oil depot)',
    summarySources: 'Transfeminine Science, FDA Prescribing Information',
    summary:
      'Intermediate-to-long-acting injectable estradiol ester providing smoother serum levels than estradiol valerate injections.',
    advisory:
      'Draw blood at trough immediately before the next scheduled weekly injection to evaluate steady-state levels.',
    doseMaxTick: 10,
    doseUnit: 'mg',
    doseRows: [
      {
        roa: 'Intramuscular / SubQ',
        bioavailability: 'Bioavailability ~100% (depot)',
        source: 'Transfeminine Science',
        unit: 'mg',
        light: '1.5–2.5 mg',
        common: '2.5–5 mg',
        strong: '5–7 mg',
        heavy: '7 mg+',
        commonEstimate: 4,
        band: { low: 2.5, high: 5 },
        domain: [1, 10],
        segments: { light: [1.5, 2.5], common: [2.5, 5], strong: [5, 7], heavy: [7, 9.5] },
      },
    ],
    durationSources: 'Transfeminine Science, Clinical Pharmacokinetics',
    durationRows: [
      { roa: 'Intramuscular / SubQ', onset: '8–18 h', comeup: '1–1.5 d', peak: '1.5–2.5 d', offset: '4–6 d', afterEffects: '—', total: '7–8 d' },
    ],
    combinations: [
      { substance: 'CYP3A4 inducers', status: 'Caution', tone: 'warning', note: 'Accelerates 17β-estradiol metabolism and lowers trough concentrations.' },
    ],
    helpfulLinks: [
      { title: 'Transfeminine Science', description: 'Estradiol ester pharmacokinetic comparisons', url: 'https://transfemscience.org/' },
    ],
  },
  {
    id: 'estradiol-gel',
    name: 'Estradiol transdermal gel',
    aliases: 'Estrogel, Oestrogel, Divigel, Sandrena',
    category: 'Endocrine',
    form: 'gel',
    chemicalClass: 'Bioidentical 17β-estradiol (hydroalcoholic gel)',
    psychoactiveClass: 'Endocrine / Transdermal',
    halfLife: '24–36 h (stratum corneum reservoir)',
    summarySources: 'Transfeminine Science, EMA SmPC',
    summary:
      'Hydroalcoholic 0.06% or 0.1% 17β-estradiol gel forming a skin depot that bypasses hepatic first-pass metabolism and minimizes coagulation factor shifts.',
    advisory:
      'Allow gel to dry 5 minutes before dressing; avoid skin-to-skin transfer and never apply directly to breast tissue.',
    doseMaxTick: 6,
    doseUnit: 'mg',
    doseRows: [
      {
        roa: 'Transdermal',
        bioavailability: 'Bioavailability ~5–10% (site dependent)',
        source: 'Clinical Pharmacokinetics',
        unit: 'mg',
        light: '0.75–1.5 mg',
        common: '1.5–3 mg',
        strong: '3–4.5 mg',
        heavy: '4.5 mg+',
        commonEstimate: 2.25,
        band: { low: 1.5, high: 3 },
        domain: [0.5, 6],
        segments: { light: [0.75, 1.5], common: [1.5, 3], strong: [3, 4.5], heavy: [4.5, 5.8] },
      },
    ],
    durationSources: 'Clinical Pharmacokinetics',
    durationRows: [
      { roa: 'Transdermal', onset: '2–4 h', comeup: '2–6 h', peak: '6–10 h', offset: '12–18 h', afterEffects: '—', total: '24 h' },
    ],
    combinations: [
      { substance: 'Alcohol-based sunscreens', status: 'Caution', tone: 'warning', note: 'Applying over the same skin area within 1 hour alters transdermal flux.' },
    ],
    helpfulLinks: [
      { title: 'Transfeminine Science', description: 'Transdermal estradiol absorption review', url: 'https://transfemscience.org/' },
    ],
  },
  {
    id: 'estradiol-patch',
    name: 'Estradiol transdermal patch',
    aliases: 'Estradot, Vivelle-Dot, Climara',
    category: 'Endocrine',
    form: 'patch',
    chemicalClass: 'Bioidentical 17β-estradiol (transdermal matrix)',
    psychoactiveClass: 'Endocrine / Transdermal',
    halfLife: 'Zero-order release across 3.5–7 days',
    summarySources: 'Endocrine Society, UCSF Guidelines',
    summary:
      'Matrix transdermal system delivering continuous zero-order 17β-estradiol across 3.5- or 7-day wear intervals without hepatic first-pass effects.',
    advisory:
      'Rotate application sites on lower abdomen or upper buttock; direct heat (saunas, heating pads) transiently accelerates release.',
    doseMaxTick: 300,
    doseUnit: 'μg',
    doseRows: [
      {
        roa: 'Transdermal (μg/day)',
        bioavailability: 'Continuous matrix release',
        source: 'Endocrine Society',
        unit: 'μg',
        light: '37.5–50 μg',
        common: '75–200 μg',
        strong: '200–250 μg',
        heavy: '300 μg+',
        commonEstimate: 100,
        band: { low: 75, high: 200 },
        domain: [25, 300],
        segments: { light: [37.5, 50], common: [75, 200], strong: [200, 250], heavy: [250, 290] },
      },
    ],
    durationSources: 'Endocrine Society',
    durationRows: [
      { roa: 'Transdermal', onset: '4–8 h', comeup: '8–24 h', peak: '24–48 h', offset: '12–24 h', afterEffects: '—', total: '84–168 h' },
    ],
    combinations: [
      { substance: 'Direct heat sources', status: 'Caution', tone: 'warning', note: 'Saunas or heating pads over the patch accelerate dermal absorption.' },
    ],
    helpfulLinks: [
      { title: 'UCSF Transgender Care', description: 'Transdermal patch dosing guidelines', url: 'https://transcare.ucsf.edu/' },
    ],
  },
  {
    id: 'estradiol-spray',
    name: 'Estradiol transdermal spray',
    aliases: 'Lenzetto, Evamist',
    category: 'Endocrine',
    form: 'spray',
    chemicalClass: 'Bioidentical 17β-estradiol (metered dermal spray)',
    psychoactiveClass: 'Endocrine / Transdermal',
    halfLife: '24 h (dermal reservoir)',
    summarySources: 'EMA SmPC, Transfeminine Science',
    summary:
      'Metered transdermal spray delivering 1.53 mg 17β-estradiol per actuation with octisalate penetration enhancer.',
    advisory:
      'Apply to dry inner forearm skin without overlapping sprays; allow 2 minutes to dry completely.',
    doseMaxTick: 8,
    doseUnit: 'mg',
    doseRows: [
      {
        roa: 'Transdermal spray',
        bioavailability: 'Metered 1.53 mg / spray',
        source: 'EMA SmPC',
        unit: 'mg',
        light: '1.53 mg',
        common: '3.06–4.59 mg',
        strong: '4.59–6.12 mg',
        heavy: '6.12 mg+',
        commonEstimate: 3.06,
        band: { low: 1.53, high: 4.59 },
        domain: [0.75, 7.65],
        segments: { light: [0.75, 1.53], common: [1.53, 4.59], strong: [4.59, 6.12], heavy: [6.12, 7.4] },
      },
    ],
    durationSources: 'EMA SmPC',
    durationRows: [
      { roa: 'Transdermal spray', onset: '1–3 h', comeup: '2–4 h', peak: '4–8 h', offset: '12–18 h', afterEffects: '—', total: '24 h' },
    ],
    combinations: [],
    helpfulLinks: [
      { title: 'Transfeminine Science', description: 'Transdermal estradiol pharmacokinetics', url: 'https://transfemscience.org/' },
    ],
  },
  {
    id: 'cyproterone-acetate',
    name: 'Cyproterone acetate',
    aliases: 'Androcur, Cyprostat, CPA',
    category: 'Endocrine',
    form: 'tablet',
    chemicalClass: 'Steroidal progestogen / antiandrogen',
    psychoactiveClass: 'Endocrine / Antigonadotropin',
    halfLife: '38–96 h (terminal)',
    summarySources: 'Transfeminine Science, EMA PRAC',
    summary:
      'Potent steroidal progestogen and antiandrogen achieving maximal LH/FSH and testosterone suppression at low doses (5–12.5 mg/day) when combined with estradiol.',
    advisory:
      'Keep chronic daily doses at or below 10–12.5 mg; high cumulative lifetime exposure increases meningioma and hyperprolactinemia risk.',
    doseMaxTick: 50,
    doseUnit: 'mg',
    doseRows: [
      {
        roa: 'Oral',
        bioavailability: 'Bioavailability ~88%',
        source: 'Clinical Pharmacokinetics',
        unit: 'mg',
        light: '5–6.25 mg',
        common: '6.25–12.5 mg',
        strong: '12.5–25 mg',
        heavy: '25 mg+',
        commonEstimate: 10,
        band: { low: 5, high: 12.5 },
        domain: [2.5, 50],
        segments: { light: [2.5, 6.25], common: [6.25, 12.5], strong: [12.5, 25], heavy: [25, 48] },
      },
    ],
    durationSources: 'Clinical Pharmacokinetics',
    durationRows: [
      { roa: 'Oral', onset: '1–2 h', comeup: '1–3 h', peak: '3–4 h', offset: '36–48 h', afterEffects: '—', total: '24–48 h' },
    ],
    combinations: [
      { substance: 'Estradiol', status: 'Low risk', tone: 'positive', note: 'Synergistic antigonadotropic action suppresses testosterone at 5–12.5 mg/day.' },
    ],
    helpfulLinks: [
      { title: 'Transfeminine Science (CPA Review)', description: 'Low-dose cyproterone acetate efficacy and meningioma safety review', url: 'https://transfemscience.org/articles/cpa-dosage/' },
    ],
  },
  {
    id: 'progesterone',
    name: 'Progesterone (micronized)',
    aliases: 'Prometrium, Utrogestan, P4',
    category: 'Endocrine',
    form: 'capsule',
    chemicalClass: 'Bioidentical pregnane steroid',
    psychoactiveClass: 'Endocrine / Neurosteroid precursor',
    halfLife: '16–18 h (oral) · 12–24 h (rectal)',
    summarySources: 'Transfeminine Science, Clinical Pharmacokinetics',
    summary:
      'Micronized bioidentical progesterone in oil capsules; oral intake converts heavily into sedative GABA-A neurosteroids (allopregnanolone), while rectal administration yields higher unmetabolized serum P4.',
    advisory:
      'Oral administration induces drowsiness via neurosteroid metabolites; administer immediately before sleep.',
    doseMaxTick: 300,
    doseUnit: 'mg',
    doseRows: [
      {
        roa: 'Oral',
        bioavailability: 'Bioavailability <5% (high first-pass)',
        source: 'Clinical Pharmacokinetics',
        unit: 'mg',
        light: '50–100 mg',
        common: '100–200 mg',
        strong: '200–300 mg',
        heavy: '300 mg+',
        commonEstimate: 100,
        band: { low: 100, high: 200 },
        domain: [50, 300],
        segments: { light: [50, 100], common: [100, 200], strong: [200, 280], heavy: [280, 295] },
      },
      {
        roa: 'Rectal',
        bioavailability: 'Higher unmetabolized serum P4',
        source: 'Transfeminine Science',
        unit: 'mg',
        light: '50–100 mg',
        common: '100–200 mg',
        strong: '200–300 mg',
        heavy: '300 mg+',
        commonEstimate: 100,
        band: { low: 100, high: 200 },
        domain: [50, 300],
        segments: { light: [50, 100], common: [100, 200], strong: [200, 280], heavy: [280, 295] },
      },
    ],
    durationSources: 'Clinical Pharmacokinetics',
    durationRows: [
      { roa: 'Oral', onset: '1–2 h', comeup: '1–2 h', peak: '2–3 h', offset: '8–12 h', afterEffects: '—', total: '10–18 h' },
      { roa: 'Rectal', onset: '1–3 h', comeup: '2–4 h', peak: '4–8 h', offset: '12–18 h', afterEffects: '—', total: '12–24 h' },
    ],
    combinations: [
      { substance: 'CNS depressants & Benzodiazepines', status: 'Caution', tone: 'warning', note: 'Oral allopregnanolone metabolites add to GABA-A sedation.' },
    ],
    helpfulLinks: [
      { title: 'Transfeminine Science', description: 'Oral vs rectal progesterone pharmacokinetics', url: 'https://transfemscience.org/' },
    ],
  },
];

// Water, written by hand: what it is, how much the body can handle in an
// hour, and the one way it harms, for a journal that logs a night's water
// beside what else was taken. Its words in 正體中文 and 简体中文 are in
// src/lib/zh-Hant-data.ts and src/lib/zh-Hans-data.ts, under `passages`.
const OTHER_ENTRIES = [
  {
    id: 'water',
    name: 'Water',
    aliases: 'H2O, aqua, drinking water',
    category: 'Other',
    form: 'dropper',
    status: 'Documented',
    summarySources: 'EFSA, FRANK',
    summary:
      'Water is what most of the body is made of: about 60% of an adult’s weight. It carries what the blood carries, keeps body temperature steady through sweat, and leaves mostly as urine. An adult needs about 2 to 2.5 litres a day from everything drunk and eaten, food giving about a fifth of it, and more in heat, with exercise or with a fever.',
    advisory:
      'Too much water, too fast, dilutes the sodium in the blood (hyponatremia, or water intoxication). It starts with a headache, nausea, vomiting and confusion, can go on to seizures and coma, and can kill. MDMA makes the body hold on to water: sip no more than about 500 mL an hour while dancing, less while resting. Someone who is confused or vomiting after drinking a lot of water needs an ambulance, not more water.',
    doseBasis:
      'Amounts are for one hour. Healthy kidneys pass about 0.8 to 1 litre an hour at most, so drinking more than that, hour after hour, waters down the blood.',
    doseMaxTick: 1500,
    doseUnit: 'mL',
    doseRows: [
      {
        roa: 'Oral',
        source: 'EFSA, FRANK',
        unit: 'mL',
        light: '100–250 mL',
        common: '250–500 mL',
        strong: '500–1000 mL',
        heavy: '1000 mL+',
        commonEstimate: 375,
        band: { low: 250, high: 500 },
        domain: [80, 1350],
        segments: { light: [100, 250], common: [250, 500], strong: [500, 1000], heavy: [1000, 1296] },
      },
    ],
    // How long a glass takes: in the blood within minutes, the blood at its
    // thinnest after about half an hour, and the kidneys done with it in two
    // or three hours.
    durationRows: [
      { roa: 'Oral', onset: '5–15 min', comeup: '10–20 min', peak: '20–40 min', offset: '1–2 h', afterEffects: '—', total: '2–3 h' },
    ],
    combinations: [],
    formula: 'H2O',
    molarMass: 18.02,
    helpfulLinks: [
      { title: 'Wikipedia', description: 'Encyclopedia article', url: 'https://en.wikipedia.org/wiki/Water' },
      { title: 'Wikipedia: Water intoxication', description: 'Encyclopedia article', url: 'https://en.wikipedia.org/wiki/Water_intoxication' },
    ],
  },
  // Oxygen and air, written by hand to be read about, not logged (`learn`):
  // the page has no doses, no curve and no mixing, and the journal's forms
  // don't offer them. Their words in Chinese are in the same `passages`.
  {
    id: 'oxygen',
    name: 'Oxygen',
    aliases: 'O2, dioxygen, medical oxygen, canned oxygen, oxygen bar',
    category: 'Other',
    form: 'spray',
    status: 'Documented',
    learn: true,
    summarySources: 'NHS',
    summary:
      'Oxygen (O₂) is the gas the body runs on, about 21% of the air. The lungs pass it into the blood, where haemoglobin carries it to every cell to release the energy in food, and without it the brain is harmed within minutes. It has no colour, smell or taste. A healthy person’s blood is already 95 to 100% full of it on ordinary air, so breathing extra oxygen does nothing for them.',
    uses: {
      text: 'Medical oxygen, from a cylinder or a concentrator and measured in litres a minute, is given when the blood is short of it: in pneumonia, COPD and severe asthma, after a heart attack or near drowning, and for carbon monoxide poisoning. In hospitals and ambulances nitrous oxide is given mixed with it (Entonox is half and half), so the gas never leaves the lungs short of oxygen. Climbers above about 8,000 m breathe it because the thin air holds too little, and divers breathe air with extra oxygen in it (nitrox), within a depth limit. Canned oxygen and oxygen bars, sold for energy, hangovers or recovery, give a few breaths that are gone from the blood a minute later: there’s no good evidence they do anything for a healthy person.',
      source: 'NHS, BOC',
    },
    advisory:
      'Nitrous oxide breathed straight from a balloon takes the place of oxygen in the lungs. Breathing it again and again with no air in between, from a bag or a mask over the face, or in a car or a small closed room can starve the brain of oxygen: people have passed out and died this way. Sit down, take a few normal breaths of air between balloons, and never put anything over the face. Medical nitrous is never given with less than 30% oxygen for this reason.',
    warnings: [
      {
        text: 'Too much, for too long, harms. Near pure oxygen breathed for more than about a day can inflame the lungs, and under pressure, in a dive deeper than the gas allows or a hyperbaric chamber, it can bring on a seizure with no warning. Some people with COPD breathe less on high-flow oxygen and build up carbon dioxide, so oxygen at home is breathed at the rate it’s prescribed, not more.',
        source: 'From the NHS.',
        url: 'https://www.nhs.uk/conditions/home-oxygen/',
      },
      {
        text: 'Oxygen doesn’t burn, but everything burns faster and hotter in it, and hair, clothes and bedding soaked in it catch fire easily. No smoking, vaping, candles or gas cookers near a cylinder or concentrator, no oil or grease on its fittings, and water-based creams instead of petroleum jelly under a mask.',
        source: 'From the NHS.',
        url: 'https://www.nhs.uk/conditions/home-oxygen/#safety',
      },
    ],
    doseUnit: '',
    doseRows: [],
    durationRows: [],
    combinations: [],
    formula: 'O2',
    molarMass: 32.0,
    helpfulLinks: [
      { title: 'Wikipedia', description: 'Encyclopedia article', url: 'https://en.wikipedia.org/wiki/Oxygen' },
      { title: 'Wikipedia: Oxygen toxicity', description: 'Encyclopedia article', url: 'https://en.wikipedia.org/wiki/Oxygen_toxicity' },
      { title: 'NHS: Home oxygen', description: 'Health service guide', url: 'https://www.nhs.uk/conditions/home-oxygen/' },
    ],
  },
  {
    id: 'air',
    name: 'Air',
    aliases: 'atmosphere, atmospheric air, fresh air',
    category: 'Other',
    form: 'spray',
    status: 'Documented',
    learn: true,
    summarySources: 'NOAA, NHS',
    summary:
      'Air is the mixture of gases around the Earth. Dry air is about 78% nitrogen, 21% oxygen, 0.93% argon and 0.04% carbon dioxide, with traces of neon, helium, methane and others, and it holds up to about 4% water vapour as well, depending on the weather. Of all of it the body uses only the oxygen: a resting adult breathes 6 to 8 litres a minute, keeps about a quarter of the oxygen in each breath and breathes out a little carbon dioxide in its place.',
    // A mixture has no one structure: what dry air is made of, by volume.
    parts: [
      { name: 'Nitrogen', zh: '氮氣', zhHans: '氮气', formula: 'N2', share: 78.08 },
      { id: 'oxygen', name: 'Oxygen', zh: '氧氣', zhHans: '氧气', formula: 'O2', share: 20.95 },
      { name: 'Argon', zh: '氬氣', zhHans: '氩气', formula: 'Ar', share: 0.93 },
      { name: 'Carbon dioxide', zh: '二氧化碳', zhHans: '二氧化碳', formula: 'CO2', share: 0.04 },
    ],
    advisory:
      'Any gas breathed in place of air leaves less oxygen in each breath: nitrous from a balloon, helium, butane, aerosols or solvents. Breathe air between hits, never with a bag over the head or a mask over the face, and get anyone who faints out to fresh air at once. Canned “compressed air” for dusting keyboards isn’t air: it’s a liquefied gas such as difluoroethane, and breathing it in can stop the heart, even the first time.',
    warnings: [
      {
        text: 'Up a mountain the air is still 21% oxygen, but thinner: at 2,500 m each breath carries about a quarter less of it, and at 5,500 m half. Above about 2,500 m altitude sickness can start, with a headache, nausea and poor sleep, and going higher with it can lead to fluid on the lungs or the brain. Climb slowly, skip alcohol and sleeping pills up there, and go down if it gets worse.',
        source: 'From the NHS.',
        url: 'https://www.nhs.uk/conditions/altitude-sickness/',
      },
      {
        text: 'Carbon monoxide, from a faulty boiler or heater, a car engine, or a barbecue or charcoal burning indoors, has no colour or smell and can kill in a closed room. A headache, dizziness and nausea that ease outside are the sign: get out into fresh air and call for help.',
        source: 'From the NHS.',
        url: 'https://www.nhs.uk/conditions/carbon-monoxide-poisoning/',
      },
    ],
    doseUnit: '',
    doseRows: [],
    durationRows: [],
    combinations: [],
    helpfulLinks: [
      { title: 'Wikipedia', description: 'Encyclopedia article', url: 'https://en.wikipedia.org/wiki/Atmosphere_of_Earth' },
      { title: 'FRANK: Solvents and gases', description: 'Drug information', url: 'https://www.talktofrank.com/drug/solvents' },
    ],
  },
  // Metformin, written by hand: a medicine taken every day, for diabetes
  // and PCOS, that nothing the sync reads covers. Its doses and timings are
  // from the NHS and the US label, by tablet (immediate or extended
  // release), and its words in Chinese are in the same `passages`. What it
  // does with other things is AI's (src/lib/traits.ts, `lactic`).
  {
    id: 'metformin',
    name: 'Metformin',
    aliases: 'Glucophage, Glucophage XR, Glumetza, Fortamet, Riomet, metformin hydrochloride, metformin ER, metformin XR, metformin SR, dimethylbiguanide',
    category: 'Other',
    form: 'tablet',
    status: 'Well-documented',
    chemicalClass: 'Biguanide',
    psychoactiveClass: 'Antidiabetic',
    halfLife: 'About 6 h in the blood, about 18 h in red blood cells',
    summarySources: 'NHS, FDA label',
    summary:
      'Metformin is the medicine most often prescribed for type 2 diabetes, and the first one tried for it. It lowers blood sugar by making the liver release less glucose and the body more sensitive to its own insulin, and on its own it seldom pushes blood sugar too low. It’s also prescribed for polycystic ovary syndrome (PCOS), to hold off diabetes in people at high risk, and for the weight gain antipsychotics can cause. It does nothing to mood or the mind: a dose isn’t felt.',
    pharmacology: {
      text: 'How it works isn’t fully settled. In the liver it slows the making of new glucose, in part by acting on the cells’ mitochondria and switching on an enzyme called AMPK; in the gut it changes how sugar is taken up and raises the hormone GLP-1; and muscle takes up more glucose for the same insulin. It doesn’t make the pancreas release insulin, which is why it rarely causes low blood sugar by itself.',
      source: 'FDA label, Wikipedia',
      kind: 'Biguanide',
      body: [
        { what: 'absorbed', says: 'About 50–60% of a dose, less with food' },
        { what: 'halfLife', says: 'About 6 h in the blood, about 18 h in red blood cells' },
        { what: 'brokenDown', says: 'Not broken down at all' },
        { what: 'leaves', says: 'Through the kidneys, unchanged, in urine' },
      ],
    },
    uses: {
      text: 'Type 2 diabetes, on its own or with other medicines and insulin. It’s started low, at 500 mg once or twice a day with meals, and raised week by week to keep the stomach settled; blood sugar falls over the first days and the full effect takes about two weeks. It’s also used for polycystic ovary syndrome, where it can bring periods back and help with ovulation, for diabetes in pregnancy, to delay diabetes in people with prediabetes, and to limit the weight gain antipsychotics can cause. It has been studied for ageing and cancer, but there’s no proof it lengthens life in people without diabetes.',
      source: 'NHS, FDA label',
      brands: 'Glucophage, Glucophage XR, Glumetza, Fortamet, Riomet',
      routes: 'Oral',
    },
    sideEffects: {
      text: 'Most side effects are in the gut: feeling sick, diarrhoea, stomach ache, wind and bloating, a metallic taste and a smaller appetite. They’re worst in the first weeks and after the dose goes up, and usually settle. Taking it with food, raising the dose slowly or changing to extended release helps. Some people lose a little weight on it.',
      source: 'NHS, FDA label',
    },
    advisory:
      'Rarely, metformin builds up and causes lactic acidosis, which can kill. It’s most likely when the kidneys fail or the body is short of oxygen or water: severe dehydration, vomiting or diarrhoea that won’t stop, a serious infection, heart failure, heavy drinking, or an overdose. The signs are feeling very unwell with vomiting, stomach pain, muscle pain or cramps, fast deep breathing, feeling cold, a slow or uneven heartbeat, and drowsiness. Anyone who takes metformin and has these needs an ambulance.',
    warnings: [
      {
        text: 'Alcohol makes lactic acidosis more likely, and a lot of it, on an empty stomach, can drop blood sugar too, more so with other diabetes medicines. A drink or two with food is usually fine; a binge, or drinking day after day, is not. If you’ve been sick from drinking, skip metformin until you’re eating and drinking again.',
        source: 'From the NHS.',
        url: 'https://www.nhs.uk/medicines/metformin/',
      },
      {
        text: 'When you’re ill with vomiting, diarrhoea, a fever or sweats, or can’t eat or drink, stop metformin and start again once you’ve been eating and drinking normally for 24 to 48 hours: it’s called the sick day rule. A long night dancing in the heat, on MDMA or another stimulant above all, dries the body out the same way, so eat, and sip water steadily, no more than about 500 mL an hour.',
        source: 'From the NHS.',
        url: 'https://www.nhs.uk/medicines/metformin/',
      },
      {
        text: 'Metformin leaves the body only through the kidneys, so how much is safe depends on how well they work: the dose is lowered when kidney function (eGFR) falls below 45 and it’s stopped below 30. A blood test checks them before it’s started and at least once a year.',
        source: 'From the NHS.',
        url: 'https://www.nhs.uk/medicines/metformin/',
      },
      {
        text: 'Before a CT scan or X-ray with an iodine contrast dye, an angiogram, or an operation under general anaesthetic, tell the team you take metformin. It’s often paused on the day and for 48 hours after, until a blood test shows the kidneys are fine.',
        source: 'From the NHS.',
        url: 'https://www.nhs.uk/medicines/metformin/',
      },
      {
        text: 'Taken for years, metformin can lower vitamin B12. Too little B12 causes tiredness, anaemia, a sore tongue, and numbness or tingling in the hands and feet, so it’s worth a blood test every year or two, and sooner with any of these.',
        source: 'From the MHRA.',
        url: 'https://www.gov.uk/drug-safety-update/metformin-and-reduced-vitamin-b12-levels-new-advice-for-monitoring-patients-at-risk',
      },
      {
        text: 'On its own metformin rarely causes low blood sugar. With insulin or a sulfonylurea such as gliclazide, after hard exercise, or after drinking without eating, it can: shaking, sweating, hunger, a racing heart and confusion. Eat or drink something sugary at once, then something starchy.',
        source: 'From the NHS.',
        url: 'https://www.nhs.uk/medicines/metformin/',
      },
    ],
    doseBasis:
      'Amounts are for one dose, taken with or just after a meal. Immediate release is taken two or three times a day, up to 2,000 to 3,000 mg a day in all depending on the country (2,550 mg in the US); extended release once a day with the evening meal, usually up to 2,000 mg. Take it as it’s prescribed: more doesn’t do more that you’d notice, and a large overdose can cause lactic acidosis.',
    doseUnit: 'mg',
    doseRows: [
      {
        roa: 'Oral',
        source: 'NHS, FDA label',
        unit: 'mg',
        absorbed: { min: 50, max: 60, source: 'FDA label' },
        light: '250–500 mg',
        common: '500–1000 mg',
        strong: '1000–1500 mg',
        heavy: '1500 mg+',
        commonEstimate: 750,
        band: { low: 500, high: 1000 },
        domain: [200, 2200],
        segments: { light: [250, 500], common: [500, 1000], strong: [1000, 1500], heavy: [1500, 2112] },
      },
      {
        roa: 'Oral (extended release)',
        source: 'NHS, FDA label',
        unit: 'mg',
        absorbed: { min: 50, max: 60, source: 'FDA label' },
        light: '500–1000 mg',
        common: '1000–2000 mg',
        strong: '2000–2500 mg',
        heavy: '2500 mg+',
        commonEstimate: 1500,
        band: { low: 1000, high: 2000 },
        domain: [400, 4400],
        segments: { light: [500, 1000], common: [1000, 2000], strong: [2000, 2500], heavy: [2500, 4224] },
      },
    ],
    // In the blood: immediate release at its highest after 2 to 3 hours,
    // extended release after 4 to 8, as long as a day for one taken once.
    durationSources: 'FDA label',
    durationRows: [
      { roa: 'Oral', onset: '30–60 min', comeup: '1–2 h', peak: '2–3 h', offset: '4–6 h', afterEffects: '—', total: '8–12 h' },
      { roa: 'Oral (extended release)', onset: '1–2 h', comeup: '2–4 h', peak: '4–8 h', offset: '8–14 h', afterEffects: '—', total: '16–24 h' },
    ],
    subjectiveEffects: [
      { name: 'Nausea' },
      { name: 'Diarrhea' },
      { name: 'Stomach discomfort' },
      { name: 'Stomach bloating' },
      { name: 'Metallic taste' },
      { name: 'Appetite suppression' },
      { name: 'Weight loss' },
    ],
    combinations: [],
    formula: 'C4H11N5',
    molarMass: 129.16,
    helpfulLinks: [
      { title: 'NHS: Metformin', description: 'Health service guide', url: 'https://www.nhs.uk/medicines/metformin/' },
      { title: 'Wikipedia', description: 'Encyclopedia article', url: 'https://en.wikipedia.org/wiki/Metformin' },
      { title: 'Wikipedia: Lactic acidosis', description: 'Encyclopedia article', url: 'https://en.wikipedia.org/wiki/Lactic_acidosis' },
      { title: '維基百科', description: 'zh:Encyclopedia article', url: 'https://zh.wikipedia.org/zh-tw/%E4%BA%8C%E7%94%B2%E9%9B%99%E8%83%8D' },
      { title: '维基百科', description: 'zh:Encyclopedia article', url: 'https://zh.wikipedia.org/zh-cn/%E4%BA%8C%E7%94%B2%E5%8F%8C%E8%83%8D' },
    ],
  },
];

async function main() {
  console.log('Fetching TripSit drugs.json, combos.json, and PsychonautWiki GraphQL...');
  const [tsDrugsRes, tsCombosRes, pwRes] = await Promise.all([
    fetch(TRIPSIT_DRUGS_URL),
    fetch(TRIPSIT_COMBOS_URL),
    fetch(PW_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: PW_QUERY }),
    }),
  ]);

  if (!tsDrugsRes.ok) throw new Error(`TripSit drugs fetch failed: ${tsDrugsRes.status}`);
  if (!tsCombosRes.ok) throw new Error(`TripSit combos fetch failed: ${tsCombosRes.status}`);
  if (!pwRes.ok) throw new Error(`PsychonautWiki fetch failed: ${pwRes.status}`);

  const tsDrugs = await tsDrugsRes.json();
  const tsCombos = await tsCombosRes.json();
  const pwJson = await pwRes.json();
  const pwList = pwJson?.data?.substances ?? [];

  console.log(`Loaded TripSit: ${Object.keys(tsDrugs).length}, PsychonautWiki: ${pwList.length}`);

  // Build alias/key lookup for PsychonautWiki
  const pwByKey = new Map();
  for (const s of pwList) {
    if (!s?.name) continue;
    pwByKey.set(normKey(s.name), s);
  }

  const matchedPwKeys = new Set();
  const mergedMap = new Map(); // id -> full detail object

  // 1. Merge TripSit entries + matching PsychonautWiki data
  for (const [tsKey, ts] of Object.entries(tsDrugs)) {
    const rawName = ts.pretty_name || ts.name || tsKey;
    const id = slugify(ts.name || rawName);
    if (!id) continue;

    // Match PW by name, tsKey, or any alias
    let pw = pwByKey.get(normKey(rawName)) || pwByKey.get(normKey(tsKey));
    if (!pw && Array.isArray(ts.aliases)) {
      for (const al of ts.aliases) {
        const hit = pwByKey.get(normKey(al));
        if (hit) {
          pw = hit;
          break;
        }
      }
    }
    if (pw) matchedPwKeys.add(normKey(pw.name));

    const pwDoseRows = (pw?.roas || []).map(buildDoseRowFromPW).filter(Boolean);
    const tsDoseRows = buildDoseRowsFromTripSit(ts.formatted_dose);

    // Combine doseRows without duplicating same ROA + source
    const doseRows = [...pwDoseRows];
    for (const tr of tsDoseRows) {
      const sameRoa = doseRows.find((r) => r.roa.toLowerCase() === tr.roa.toLowerCase());
      if (!sameRoa) {
        doseRows.push(tr);
      } else if (id === 'lsd') {
        doseRows.push(tr);
      }
    }

    const preferSub = /lsd|-lad|nbome|nboh/i.test(`${id} ${rawName}`);
    doseRows.sort((a, b) => roaPriority(a.roa, preferSub) - roaPriority(b.roa, preferSub));

    const pwDurRows = buildDurationRowsFromPW(pw?.roas || []);
    const tsDurRows = buildDurationRowsFromTripSit(ts);
    const durationRows = (pwDurRows.length > 0 ? pwDurRows : tsDurRows).sort(
      (a, b) => roaPriority(a.roa, preferSub) - roaPriority(b.roa, preferSub)
    );

    const category = mapCategory(pw?.class?.psychoactive || [], ts.categories || []);
    const form = inferForm(id, rawName, category, doseRows, pw?.class?.chemical || []);

    const sources = [];
    if (pw) sources.push('PsychonautWiki');
    sources.push('TripSit');

    // Real subjective effects (TripSit pweffects with URLs + formatted_effects)
    const effMap = new Map();
    if (ts.pweffects && typeof ts.pweffects === 'object') {
      for (const [eName, eUrl] of Object.entries(ts.pweffects)) {
        effMap.set(eName.toLowerCase(), { name: eName, url: eUrl });
      }
    }
    if (Array.isArray(ts.formatted_effects)) {
      for (const eName of ts.formatted_effects) {
        const clean = String(eName).trim();
        if (!clean) continue;
        const cap = clean.charAt(0).toUpperCase() + clean.slice(1);
        if (!effMap.has(cap.toLowerCase())) {
          effMap.set(cap.toLowerCase(), { name: cap });
        }
      }
    }
    const subjectiveEffects = Array.from(effMap.values());

    // Real combinations (PW + TripSit)
    const comboMap = new Map();
    const addCombo = (subName, status, tone, note) => {
      const k = normKey(subName);
      if (!k) return;
      const existing = comboMap.get(k);
      const rank = { danger: 4, warning: 3, info: 2, neutral: 1, positive: 0 };
      if (!existing || rank[tone] > rank[existing.tone] || (!existing.note && note)) {
        comboMap.set(k, {
          substance: prettyLabel(subName),
          status,
          tone,
          note: note || existing?.note || '',
        });
      }
    };

    if (pw) {
      for (const c of pw.dangerousInteractions || []) {
        addCombo(c.name, 'Dangerous', 'danger', 'Documented dangerous interaction on PsychonautWiki.');
      }
      for (const c of pw.unsafeInteractions || []) {
        addCombo(c.name, 'Unsafe', 'danger', 'Documented unsafe interaction on PsychonautWiki.');
      }
      for (const c of pw.uncertainInteractions || []) {
        addCombo(c.name, 'Caution', 'warning', 'Uncertain or unpredictable interaction on PsychonautWiki.');
      }
    }
    if (ts.combos && typeof ts.combos === 'object') {
      for (const [cKey, cVal] of Object.entries(ts.combos)) {
        const mapped = mapTripSitComboStatus(cVal.status);
        addCombo(
          prettyLabel(cKey),
          mapped.status,
          mapped.tone,
          cVal.note || `TripSit classification: ${cVal.status}.`
        );
      }
    }
    const toneOrder = { danger: 0, warning: 1, info: 2, positive: 3, neutral: 4 };
    const combinations = Array.from(comboMap.values()).sort(
      (a, b) => (toneOrder[a.tone] ?? 9) - (toneOrder[b.tone] ?? 9) || a.substance.localeCompare(b.substance)
    );

    // Real tolerance from PW
    let tolerance = undefined;
    const pwTol = pw?.tolerance;
    const pwCross = (pw?.crossTolerances || []).filter(Boolean);
    if (pwTol && (pwTol.full || pwTol.half || pwTol.zero || pwCross.length > 0)) {
      const milestones = [];
      if (pwTol.full) milestones.push({ label: 'Full tolerance', value: pwTol.full, tone: 'danger' });
      if (pwTol.half) milestones.push({ label: 'Half tolerance', value: pwTol.half, tone: 'warning' });
      if (pwTol.zero) milestones.push({ label: 'Baseline', value: pwTol.zero, tone: 'positive' });
      tolerance = {
        buildUp: pwTol.full || 'Tolerance builds with repeated administration',
        reset: pwTol.zero || 'Varies by dose and frequency',
        milestones,
        crossTolerances:
          pwCross.length > 0
            ? [{ group: 'Cross-tolerance', items: pwCross.map((x) => x.charAt(0).toUpperCase() + x.slice(1)) }]
            : [],
      };
    }

    // Citations from TripSit sources._general
    const citations = Array.isArray(ts.sources?._general)
      ? ts.sources._general.map(parseCitation).filter((c) => c.title)
      : [];

    // Links
    const helpfulLinks = [];
    if (pw?.url) {
      helpfulLinks.push({
        title: 'PsychonautWiki',
        description: 'Pharmacology, subjective effects, and dosage reference',
        url: pw.url,
      });
    }
    helpfulLinks.push({
      title: 'TripSit Factsheet',
      description: 'Rapid harm-reduction summary and combination data',
      url: `https://drugs.tripsit.me/${encodeURIComponent(ts.name || id)}`,
    });
    if (ts.links?.experiences) {
      helpfulLinks.push({
        title: 'Erowid Experience Vaults',
        description: 'First-person experience reports and archives',
        url: ts.links.experiences,
      });
    }
    if (ts.links?.tihkal) {
      helpfulLinks.push({
        title: 'TiHKAL Entry',
        description: 'Alexander & Ann Shulgin tryptamine monograph',
        url: ts.links.tihkal,
      });
    }
    if (ts.links?.pihkal) {
      helpfulLinks.push({
        title: 'PiHKAL Entry',
        description: 'Alexander & Ann Shulgin phenethylamine monograph',
        url: ts.links.pihkal,
      });
    }

    const aliasesArr = Array.from(
      new Set([...(Array.isArray(ts.aliases) ? ts.aliases : []), ...(pw && pw.name !== rawName ? [pw.name] : [])])
    ).filter((a) => a && a.toLowerCase() !== rawName.toLowerCase());

    const summary =
      ts.properties?.summary ||
      (pw?.class?.chemical?.length
        ? `${rawName} is a ${category.toLowerCase()} compound of the ${pw.class.chemical.join(', ')} chemical class.`
        : `${rawName} is a documented ${category.toLowerCase()} substance.`);

    const advisory = formatAdvisory(ts.properties?.avoid, ts.dose_note, pw?.toxicity);

    const primaryUnit = doseRows[0]?.unit || 'mg';
    const sameUnitRows = doseRows.filter((r) => r.unit === primaryUnit);
    const maxTick =
      sameUnitRows.length > 0
        ? niceCeiling(Math.max(...sameUnitRows.map((r) => r.domain[1])))
        : 100;

    // Richness score for sensible ordering in directory
    const richness =
      (pw ? 4 : 0) +
      (doseRows.length > 0 ? 4 : 0) +
      (durationRows.length > 0 ? 3 : 0) +
      (combinations.length >= 5 ? 3 : combinations.length > 0 ? 1 : 0) +
      (subjectiveEffects.length >= 10 ? 3 : subjectiveEffects.length > 0 ? 1 : 0) +
      (ts.categories?.includes('common') ? 5 : 0);

    const status =
      richness >= 14 ? 'Well-documented' : richness >= 7 ? 'Documented' : 'Limited data';

    mergedMap.set(id, {
      id,
      name: rawName,
      form,
      status,
      aliases: aliasesArr.join(', '),
      category,
      chemicalClass: pw?.class?.chemical?.join(', ') || undefined,
      psychoactiveClass: pw?.class?.psychoactive?.join(', ') || undefined,
      halfLife: ts.properties?.['half-life'] || undefined,
      marquis: ts.properties?.marquis || undefined,
      addictionPotential: pw?.addictionPotential || undefined,
      toxicity: Array.isArray(pw?.toxicity) && pw.toxicity.length > 0 ? pw.toxicity : undefined,
      summarySources: sources.join(', '),
      summary,
      advisory: advisory || undefined,
      doseBasis: ts.dose_note ? ts.dose_note.trim() : undefined,
      doseMaxTick: Number(formatNum(maxTick)),
      doseUnit: doseRows[0]?.unit || 'mg',
      doseRows,
      durationSources: durationRows.length > 0 ? sources.join(', ') : undefined,
      durationRows,
      tolerance,
      subjectiveEffects,
      combinations,
      citations,
      helpfulLinks,
      _richness: richness,
    });
  }

  // 2. Add PsychonautWiki-only substances that weren't in TripSit
  for (const pw of pwList) {
    if (!pw?.name) continue;
    if (matchedPwKeys.has(normKey(pw.name))) continue;
    const id = slugify(pw.name);
    if (!id || mergedMap.has(id)) continue;

    const preferSub = /lsd|-lad|nbome|nboh/i.test(`${id} ${pw.name}`);
    const doseRows = (pw.roas || [])
      .map(buildDoseRowFromPW)
      .filter(Boolean)
      .sort((a, b) => roaPriority(a.roa, preferSub) - roaPriority(b.roa, preferSub));
    const durationRows = buildDurationRowsFromPW(pw.roas || []).sort(
      (a, b) => roaPriority(a.roa, preferSub) - roaPriority(b.roa, preferSub)
    );
    const category = mapCategory(pw.class?.psychoactive || [], []);
    const form = inferForm(id, pw.name, category, doseRows, pw.class?.chemical || []);

    const combinations = [];
    for (const c of pw.dangerousInteractions || []) {
      combinations.push({
        substance: c.name,
        status: 'Dangerous',
        tone: 'danger',
        note: 'Documented dangerous interaction on PsychonautWiki.',
      });
    }
    for (const c of pw.unsafeInteractions || []) {
      combinations.push({
        substance: c.name,
        status: 'Unsafe',
        tone: 'danger',
        note: 'Documented unsafe interaction on PsychonautWiki.',
      });
    }
    for (const c of pw.uncertainInteractions || []) {
      combinations.push({
        substance: c.name,
        status: 'Caution',
        tone: 'warning',
        note: 'Uncertain or unpredictable interaction on PsychonautWiki.',
      });
    }

    let tolerance = undefined;
    const pwTol = pw.tolerance;
    const pwCross = (pw.crossTolerances || []).filter(Boolean);
    if (pwTol && (pwTol.full || pwTol.half || pwTol.zero || pwCross.length > 0)) {
      const milestones = [];
      if (pwTol.full) milestones.push({ label: 'Full tolerance', value: pwTol.full, tone: 'danger' });
      if (pwTol.half) milestones.push({ label: 'Half tolerance', value: pwTol.half, tone: 'warning' });
      if (pwTol.zero) milestones.push({ label: 'Baseline', value: pwTol.zero, tone: 'positive' });
      tolerance = {
        buildUp: pwTol.full || 'Tolerance builds with repeated use',
        reset: pwTol.zero || 'Varies by dose and frequency',
        milestones,
        crossTolerances:
          pwCross.length > 0
            ? [{ group: 'Cross-tolerance', items: pwCross.map((x) => x.charAt(0).toUpperCase() + x.slice(1)) }]
            : [],
      };
    }

    const primaryUnit = doseRows[0]?.unit || 'mg';
    const sameUnitRows = doseRows.filter((r) => r.unit === primaryUnit);
    const maxTick =
      sameUnitRows.length > 0
        ? niceCeiling(Math.max(...sameUnitRows.map((r) => r.domain[1])))
        : 100;
    const richness =
      4 +
      (doseRows.length > 0 ? 4 : 0) +
      (durationRows.length > 0 ? 3 : 0) +
      (combinations.length > 0 ? 2 : 0);

    mergedMap.set(id, {
      id,
      name: pw.name,
      form,
      status: richness >= 11 ? 'Well-documented' : 'Documented',
      aliases: '',
      category,
      chemicalClass: pw.class?.chemical?.join(', ') || undefined,
      psychoactiveClass: pw.class?.psychoactive?.join(', ') || undefined,
      addictionPotential: pw.addictionPotential || undefined,
      toxicity: Array.isArray(pw.toxicity) && pw.toxicity.length > 0 ? pw.toxicity : undefined,
      summarySources: 'PsychonautWiki',
      summary: pw.class?.chemical?.length
        ? `${pw.name} is a ${category.toLowerCase()} substance belonging to the ${pw.class.chemical.join(', ')} chemical class.`
        : `${pw.name} is a documented ${category.toLowerCase()} compound on PsychonautWiki.`,
      advisory: formatAdvisory(undefined, undefined, pw.toxicity),
      doseMaxTick: Number(formatNum(maxTick)),
      doseUnit: doseRows[0]?.unit || 'mg',
      doseRows,
      durationSources: durationRows.length > 0 ? 'PsychonautWiki' : undefined,
      durationRows,
      tolerance,
      subjectiveEffects: [],
      combinations,
      citations: [],
      helpfulLinks: pw.url
        ? [{ title: 'PsychonautWiki', description: 'Pharmacology, subjective effects, and routes', url: pw.url }]
        : [],
      _richness: richness,
    });
  }

  // 3. Add curated clinical Endocrine / HRT entries
  for (const endo of ENDOCRINE_ENTRIES) {
    mergedMap.set(endo.id, {
      ...endo,
      status: 'Well-documented',
      subjectiveEffects: [],
      citations: [],
      _richness: 18,
    });
  }

  // 4. And the hand-written ones that fit no group (water, oxygen, air, metformin)
  for (const entry of OTHER_ENTRIES) {
    mergedMap.set(entry.id, { ...entry, subjectiveEffects: entry.subjectiveEffects ?? [], citations: [], _richness: 10 });
  }

  // Write files
  await fs.rm(SUB_DIR, { recursive: true, force: true });
  await fs.mkdir(SUB_DIR, { recursive: true });

  const allEntries = Array.from(mergedMap.values()).sort((a, b) => {
    if (b._richness !== a._richness) return b._richness - a._richness;
    return a.name.localeCompare(b.name);
  });

  const indexEntries = [];

  for (const entry of allEntries) {
    const { _richness, ...clean } = entry;
    await fs.writeFile(
      path.join(SUB_DIR, `${clean.id}.json`),
      JSON.stringify(clean),
      'utf8'
    );

    const primaryDose = clean.doseRows[0];
    const primaryDur = clean.durationRows[0];
    indexEntries.push({
      id: clean.id,
      name: clean.name,
      aliases: clean.aliases,
      category: clean.category,
      form: clean.form,
      status: clean.status,
      chemicalClass: clean.chemicalClass || '',
      primaryBand: primaryDose
        ? {
            low: primaryDose.band.low,
            high: primaryDose.band.high,
            unit: primaryDose.unit,
            roa: primaryDose.roa,
          }
        : null,
      primaryDuration: primaryDur
        ? {
            onset: primaryDur.onset,
            peak: primaryDur.peak,
            offset: primaryDur.offset,
            total: primaryDur.total,
          }
        : null,
      richness: _richness,
      // To read about, not to log (oxygen, air).
      ...(clean.learn ? { learn: true } : {}),
    });
  }

  await fs.writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify(indexEntries), 'utf8');
  await fs.writeFile(path.join(OUT_DIR, 'combos.json'), JSON.stringify(tsCombos), 'utf8');

  // Print category breakdown
  const byCat = {};
  for (const x of indexEntries) {
    byCat[x.category] = (byCat[x.category] || 0) + 1;
  }
  console.log(`Generated ${indexEntries.length} substance detail JSON files in public/data/substances/`);
  console.log('Category counts:', byCat);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
