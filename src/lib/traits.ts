import type { IndexEntry } from './data';

/* What a substance does in the body that matters when it meets another one,
   for the pairs no source covers (lib/mix.ts, `inferred`). Many prescription
   medicines have no combination list anywhere the sync reads, so a mix like
   amantadine with pregabalin read "Not documented" though a pharmacist would
   say at once that both make you dizzy.

   A substance's traits come from what kind of drug it is, and for the
   medicines below from a list Claude (Anthropic's AI) wrote on 2026-11-28
   from what is well known of each one. A substance on that list takes its
   traits from the list alone, because its kind can mislead (guanfacine and
   prazosin are filed as stimulants, bromocriptine as an antipsychotic).
   Whatever these traits lead to is always shown as AI's estimate. */

export type Trait =
    /** Makes you drowsy and slows you down. */
    | 'sedating'
    /** Can slow breathing in itself, at a high enough dose. */
    | 'breathing'
    /** Raises serotonin. */
    | 'serotonin'
    /** Blocks the enzyme that clears serotonin, dopamine and noradrenaline. */
    | 'maoi'
    /** Pushes heart rate, blood pressure and body temperature up. */
    | 'stimulant'
    /** Blocks acetylcholine: dry mouth, heat, confusion. */
    | 'anticholinergic'
    /** Raises dopamine or acts like it. */
    | 'dopamine'
    /** Blocks dopamine. */
    | 'antidopamine'
    /** Can make you dizzy, unsteady or muddled without being a sedative. */
    | 'dizzy'
    /** Stretches the heart's QT interval. */
    | 'qt'
    /** Makes a seizure more likely. */
    | 'seizure'
    /** Lowers blood pressure. */
    | 'lowbp'
    /** A nitrate, which widens blood vessels at once (poppers, nitroglycerin). */
    | 'nitrate'
    /** Sildenafil and the like. */
    | 'pde5'
    /** Makes bleeding more likely. */
    | 'bleeding'
    /** An NSAID, which keeps lithium in the body. */
    | 'nsaid'
    | 'lithium'
    /** Makes alcohol poisonous (disulfiram). */
    | 'antabuse'
    /** Alcohol itself. */
    | 'ethanol'
    /** Hard on the liver. */
    | 'liver'
    /** What kind of drug it is, for the pairs nothing above covers. */
    | 'psychedelic'
    | 'dissociative'
    | 'cannabinoid';

const T = (s: string) => s.split(' ') as Trait[];

/** Written by Claude (AI), 2026-11-28. Ids as the catalogue has them. */
export const AI_TRAITS: Record<string, Trait[]> = {
    // SSRIs and SNRIs
    citalopram: T('serotonin qt bleeding'),
    escitalopram: T('serotonin qt bleeding'),
    fluoxetine: T('serotonin bleeding'),
    fluvoxamine: T('serotonin bleeding'),
    paroxetine: T('serotonin bleeding anticholinergic'),
    sertraline: T('serotonin bleeding'),
    vilazodone: T('serotonin bleeding'),
    vortioxetine: T('serotonin bleeding'),
    dapoxetine: T('serotonin dizzy'),
    venlafaxine: T('serotonin bleeding seizure'),
    desvenlafaxine: T('serotonin bleeding'),
    duloxetine: T('serotonin bleeding liver'),
    milnacipran: T('serotonin bleeding'),
    // Tricyclics
    amitriptyline: T('serotonin anticholinergic sedating qt seizure lowbp'),
    nortriptyline: T('serotonin anticholinergic qt seizure lowbp'),
    imipramine: T('serotonin anticholinergic qt seizure lowbp'),
    desipramine: T('anticholinergic qt seizure'),
    clomipramine: T('serotonin anticholinergic sedating qt seizure lowbp'),
    trimipramine: T('serotonin anticholinergic sedating qt seizure lowbp'),
    protriptyline: T('serotonin anticholinergic qt seizure'),
    dothiepin: T('serotonin anticholinergic sedating qt seizure'),
    lofepramine: T('serotonin anticholinergic qt'),
    // Other antidepressants
    mirtazapine: T('sedating dizzy'),
    trazodone: T('serotonin sedating qt lowbp'),
    bupropion: T('stimulant seizure'),
    agomelatine: T('liver'),
    buspirone: T('serotonin dizzy'),
    lithium: T('lithium serotonin'),
    'lithium-carbonate': T('lithium serotonin'),
    '5-htp': T('serotonin'),
    // MAOIs the catalogue gives no group
    moclobemide: T('maoi'),
    safinamide: T('maoi dopamine'),
    // Antipsychotics
    haloperidol: T('antidopamine qt'),
    quetiapine: T('sedating anticholinergic qt lowbp'),
    ziprasidone: T('antidopamine qt'),
    thioridazine: T('antidopamine anticholinergic sedating qt lowbp'),
    pimozide: T('antidopamine qt'),
    chlorpromazine: T('antidopamine anticholinergic sedating qt lowbp seizure'),
    sertindole: T('antidopamine qt'),
    iloperidone: T('antidopamine qt lowbp'),
    droperidol: T('antidopamine sedating qt'),
    clozapine: T('antidopamine anticholinergic sedating seizure lowbp'),
    olanzapine: T('antidopamine anticholinergic sedating'),
    risperidone: T('antidopamine lowbp'),
    aripiprazole: T('antidopamine'),
    lurasidone: T('antidopamine sedating'),
    amisulpride: T('antidopamine qt'),
    prochlorperazine: T('antidopamine sedating'),
    promazine: T('antidopamine anticholinergic sedating lowbp'),
    levomepromazine: T('antidopamine anticholinergic sedating lowbp'),
    fluphenazine: T('antidopamine'),
    perphenazine: T('antidopamine sedating'),
    ondansetron: T('serotonin qt'),
    quinidine: T('qt'),
    // Parkinson's medicines and the dopamine agonists
    amantadine: T('dopamine anticholinergic dizzy'),
    levodopa: T('dopamine lowbp dizzy'),
    melevodopa: T('dopamine lowbp dizzy'),
    bromocriptine: T('dopamine lowbp dizzy'),
    cabergoline: T('dopamine lowbp dizzy'),
    pramipexole: T('dopamine sedating lowbp'),
    ropinirol: T('dopamine sedating lowbp'),
    '6s-rotigotine': T('dopamine sedating lowbp'),
    piribedil: T('dopamine sedating lowbp'),
    apomorphine: T('dopamine lowbp'),
    trihexyphenidyl: T('anticholinergic dizzy'),
    biperiden: T('anticholinergic dizzy'),
    procyclidine: T('anticholinergic dizzy'),
    // Antihistamines and muscle relaxers
    diphenhydramine: T('anticholinergic sedating'),
    hydroxyzine: T('anticholinergic sedating qt'),
    promethazine: T('anticholinergic sedating antidopamine'),
    doxylamine: T('anticholinergic sedating'),
    cyclobenzaprine: T('anticholinergic sedating serotonin'),
    orphenadrine: T('anticholinergic sedating'),
    tizanidine: T('sedating lowbp'),
    // Opioids with something more
    tramadol: T('sedating breathing serotonin seizure'),
    tapentadol: T('sedating breathing serotonin seizure'),
    methadone: T('sedating breathing qt'),
    fentanyl: T('sedating breathing serotonin'),
    loperamide: T('qt'),
    dextromethorphan: T('serotonin dizzy'),
    // Stimulants
    yohimbine: T('stimulant'),
    epinephrine: T('stimulant'),
    guanfacine: T('sedating lowbp'),
    prazosin: T('lowbp dizzy'),
    atomoxetine: T('stimulant'),
    // The heart
    amiodarone: T('qt'),
    propranolol: T('lowbp dizzy'),
    clonidine: T('sedating lowbp'),
    ibogaine: T('qt'),
    viagra: T('pde5 lowbp'),
    cialis: T('pde5 lowbp'),
    poppers: T('nitrate lowbp'),
    // Pain
    aspirin: T('bleeding nsaid'),
    ibuprofen: T('bleeding nsaid'),
    naproxen: T('bleeding nsaid'),
    diclofenac: T('bleeding nsaid'),
    apap: T('liver'),
    // Alcohol's own
    alcohol: T('ethanol sedating breathing liver'),
    disulfiram: T('antabuse'),
    cyanamide: T('antabuse'),
    // Anticonvulsants filed as depressants
    lamotrigine: T('dizzy'),
    topiramate: T('dizzy sedating'),
    'valproic-acid': T('sedating liver bleeding'),
};

const RESPIRATORY = /benzodiazepine|thienodiazepine|barbiturate|gabapentinoid/i;

/** What one substance does that a mix can run into. */
export function traitsOf(e: IndexEntry): Set<Trait> {
    const listed = AI_TRAITS[e.id];
    if (listed) return new Set(listed);
    const out = new Set<Trait>();
    const groups = e.groups ?? [];
    switch (e.category) {
        case 'Opioid':
            out.add('sedating').add('breathing');
            break;
        case 'Depressant':
            out.add('sedating');
            if (RESPIRATORY.test(e.chemicalClass) || groups.includes('benzodiazepines') || groups.includes('barbiturates') || ['ghb', 'gbl', '1-4-butanediol'].includes(e.id))
                out.add('breathing');
            break;
        case 'Stimulant':
            out.add('stimulant');
            break;
        case 'Empathogen':
            out.add('stimulant').add('serotonin');
            break;
        case 'Deliriant':
            out.add('anticholinergic').add('sedating');
            break;
        case 'Dissociative':
            out.add('dizzy').add('dissociative');
            break;
        case 'Psychedelic':
            out.add('psychedelic');
            break;
        case 'Cannabinoid':
            out.add('cannabinoid');
            break;
    }
    if (groups.includes('maois') || /MAOI/.test(e.chemicalClass)) out.add('maoi');
    if (/SSRI/.test(e.chemicalClass)) out.add('serotonin').add('bleeding');
    if (/Tricyclic/.test(e.chemicalClass)) out.add('serotonin').add('anticholinergic').add('qt').add('seizure');
    if (/Phenothiazine/.test(e.chemicalClass)) out.add('antidopamine').add('sedating');
    return out;
}
