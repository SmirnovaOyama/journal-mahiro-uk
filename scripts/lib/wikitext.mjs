// Wikipedia's wikitext as plain sentences, for the few lines the site quotes.
//
// The API gives rendered text one page a request, ten requests a minute;
// wikitext comes fifty pages at a time. So the text is read from the source,
// and read strictly: what can't be turned into words for sure (a template
// this doesn't know, a formula, a table) leaves a hole, and a sentence with a
// hole in it is never quoted. Fewer lines, none of them garbled.

/** Stands where something was that has no plain text. */
export const HOLE = '\uFFFC';
/** The templates that left a hole, and how often: the ones worth teaching it. */
export const unknownTemplates = new Map();

const norm = s => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

// Notes to editors and readers' aids that say nothing themselves: they go, and
// the sentence around them stands.
const DROP = new Set(
    `citation needed|cn|fact|medical citation needed|medcn|mcn|medical citation needed span|citation needed span|clarify|clarification needed|
    when|by whom|who|which|whom|dubious|better source needed|bsn|unreliable source?|unreliable source|unreliable medical source|unreliable medical source?|
    failed verification|fv|page needed|pn|pages needed|verify source|verification needed|full citation needed|full|update inline|update after|
    primary source inline|psi|primary-source inline|non-primary source needed|npsn|medrs|additional citation needed|original research inline|or|
    according to whom|vague|weasel inline|specify|where|why|explain|elucidate|example needed|quantify|how|how?|incomprehensible inline|
    time needed|year needed|date needed|needs update|obsolete source|self-published inline|sps|third-party inline|tertiary source inline|
    rp|r|refn|ref|notetag|efn|efn-la|efn-ua|efn-lr|sfn|sfnp|sfnm|sfnref|harv|harvnb|harvp|harvtxt|#tag:ref|ref label|note label|ref|note|
    use dmy dates|use mdy dates|short description|main|main article|see also|further|further information|details|for|about|hatnote|redirect|
    distinguish|other uses|toc limit|toclimit|toc right|toc left|anchor|vanchor|clear|-|clr|clear left|clear right|break|multiple image|
    annotated image|annotated image 4|image frame|wide image|stub|authority control|reflist|notelist|notelist-la|portal|portal bar|portal inline|
    commons category|commons|commons category-inline|wiktionary|wikiquote|citation|excerpt|transcluded section|expand section|empty section|
    more citations needed|more citations needed section|more medical citations needed|refimprove|refimprove section|unreferenced|unreferenced section|
    cleanup|cleanup section|update|update section|original research|original research section|pov|pov section|medref|technical|tone|globalize|
    missing information|lead too short|italic title|lowercase title|good article|featured article|engvarb|defaultsort|cs1 config|listen|quote box|
    side box|external media|medical resources|in lang|subscription required|open access|closed access|free access|registration required|
    dead link|webarchive|isbn|doi|pmid|pmc|issn|oclc|bibcode|arxiv|lccn|jstor|s2cid|hdl|ssrn|nlm|small ref|contradictory inline|
    disputed inline|irrelevant citation|relevance inline|undue weight inline|pov statement|opinion|speculation inline|page range too broad|
    birth date|death date|flagicon|flag icon|cref|cref2|cnote|notefoot|category handler|rquote|
    section link|slink|crossreference|crossref|see above|see below|self-reference|selfref|printworthy|nowrap begin|nowrap end|shy|zwsp|wbr|
    main list|broader|primary sources|primary sources section|one source|one source section|medical disclaimer|expert needed|unreliable sources|
    citation style|cleanup rewrite|copy edit|confusing|confusing section|incomplete|incomplete section|too technical|tone inline|update needed|
    outdated as of|better source|merge|merge to|merge from|split|split section|very long|importance section|importance inline|
    div col|div col end|colbegin|colend|col-begin|col-end|col-break|clear-left|more footnotes|editorializing|globalise|global|which?|why?|
    when?|who?|what|what?|relevance|outdated|typo help inline|jargon-inline|section citations needed|verification failed|fcn|
    refimprove science|notability|course assignment|primary source|promotional|promotional tone|sectstub|more science citations needed|
    dubious source|ai-generated|independent source inline|improper synthesis|unbalanced|additional citations needed|not in source|
    use pmid reference names|stdinchicite|fdacite|cascite|ebicite|drugbankcite|chemspidercite|keggcite|needs ipa|confused|by whom?`
        .split('|')
        .map(norm),
);
const DROP_RE = /^(expand |cite |citation|infobox|drugbox|chembox|navbox|taxobox|speciesbox|pp-|protection|use [a-z ]+ english|portal|wikidata|coord|.* stub$|.* sidebar$|.* footer$|.* navbox$|#invoke|#if|#switch|#ifeq|#expr|defaultsort|displaytitle|sfn|harv|efn|multiple issues|refn)/;

// A short name that stands for itself: {{Ki}} reads "Ki".
const SELF = new Map(
    Object.entries({
        ki: 'Ki', kd: 'Kd', kb: 'Kb', ka: 'Ka', ic50: 'IC50', ec50: 'EC50', ed50: 'ED50', ld50: 'LD50', td50: 'TD50', emax: 'Emax', cmax: 'Cmax',
        tmax: 'Tmax', 't1/2': 't1/2', inn: 'INN', usan: 'USAN', ban: 'BAN', jan: 'JAN', dcf: 'DCF', dcit: 'DCIT', aan: 'AAN', innm: 'INNM', banm: 'BANM',
        usp: 'USP', pka: 'pKa', nbsp: ' ', nbs: ' ', hsp: ' ', tsp: ' ', space: ' ', spaces: ' ', 'thin space': ' ', thinsp: ' ', 'hair space': ' ', px2: ' ',
        emdash: '—', endash: '–', '--': '—', aka: 'a.k.a.',
        snd: ' – ', spnd: ' – ', 'spaced ndash': ' – ', 'spaced en dash': ' – ', ndash: '–', 'en dash': '–', nd: '–', '–': '–', dash: '–',
        mdash: '—', 'em dash': '—', '—': '—', 'spaced mdash': ' — ', 'spaced em dash': ' — ', '·': '·', bull: '·', '!': '|', '=': '=', "'": "'", "'s": "'s",
        '-"': '"', '"-': '"', pi: 'π', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', mu: 'μ', kappa: 'κ', sigma: 'σ',
    }),
);
// The first thing it's given is what's read: {{abbr|IV|intravenous}} reads "IV".
const FIRST = new Set(
    `abbr|abbrlink|abbrv|abbreviation|tooltip|tt|nowrap|nobr|nobreak|nowr|small|smaller|big|large|larger|em|strong|mono|var|sub|sup|su|nowraplinks|
    noitalic|normal|plain text|keypress|code|samp|kbd|nobold|bold|italic|i|b|u|smallcaps|sc|small caps|allcaps|nocaps|chem2|visible anchor|
    medical citation needed span|dfn|term|defn|angbr|linktext|lt|wikt-lang|no wrap|raise|lower|resize|font|color|font color|text|hover title|
    hovertext|h:title|abbrlinkno|abbr link|ill|interlanguage link|illm|sic|linktext|sm|trim|smallcaps all|mvar|chem name|clarify span`
        .split('|')
        .map(norm),
);
// The last: {{lang|fr|eau de vie}} reads "eau de vie".
const LAST = new Set(['lang', 'transl', 'transliteration', 'script', 'ipa link', 'not a typo', 'proper name', 'as written', 'typo']);

/** A template's name and what it's given, in order, without the named ones. */
function parts(inner) {
    const bits = inner.split('|');
    const name = norm(bits[0]);
    const pos = [];
    const named = {};
    for (const b of bits.slice(1)) {
        const m = /^\s*([A-Za-z0-9_ -]+?)\s*=([\s\S]*)$/.exec(b);
        if (m && !/^\d+$/.test(m[1])) named[m[1].toLowerCase()] = m[2].trim();
        else if (m) pos[Number(m[1]) - 1] = m[2].trim();
        else pos.push(b.trim());
    }
    return { name, pos, named };
}

const NUMBER = /^[−-]?[\d,.]+$/;

function template(inner) {
    const { name, pos, named } = parts(inner);
    if (SELF.has(name) && pos.length <= 1) return SELF.get(name);
    if (DROP.has(name) || DROP_RE.test(name)) return '';
    if (FIRST.has(name)) return pos[0] ?? '';
    if (LAST.has(name)) return pos[pos.length - 1] ?? '';
    if (name === 'as of') {
        if (named.alt) return named.alt;
        const year = pos[0];
        if (!/^\d{4}$/.test(year ?? '')) return HOLE;
        const month = pos[1] && /^\d{1,2}$/.test(pos[1]) ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(pos[1]) - 1] : pos[1];
        const word = named.since ? 'Since' : 'As of';
        const text = `${word} ${month ? `${month} ` : ''}${year}`;
        return named.lc ? text.charAt(0).toLowerCase() + text.slice(1) : text;
    }
    if (name === 'circa' || name === 'c.' || name === 'ca.') return pos[0] ? `c. ${pos[0]}` : 'c.';
    if (name === 'frac' || name === 'sfrac' || name === 'fraction') return pos.length === 2 ? `${pos[0]}/${pos[1]}` : pos.length === 3 ? `${pos[0]} ${pos[1]}/${pos[2]}` : HOLE;
    if (name === 'chem') return pos.join('');
    if (name === 'val') {
        // {{val|5.2|u=nM}}, {{val|5.2|0.3|u=nM}}; a power of ten isn't spelled out here.
        if (!pos[0] || !NUMBER.test(pos[0]) || named.e) return HOLE;
        const unit = (named.u ?? named.ul ?? '').replace(/^\s*%\s*$/, '%');
        // {{val|20|-|100|u=hour}}: a range, as some infoboxes write one.
        const range = /^[-–]$/.test(pos[1] ?? '') && NUMBER.test(pos[2] ?? '') && !pos[3];
        const spread = range ? `–${pos[2]}` : pos[1] && NUMBER.test(pos[1]) && !pos[2] ? ` ± ${pos[1]}` : '';
        if (pos[1] && !spread) return HOLE;
        // "50 hour" as the template is given it; "50 hours" as it's read.
        const units = /^(?:hour|minute|second|day|week|month|year)$/.test(unit) && !(pos[0] === '1' && !spread) ? `${unit}s` : unit;
        return `${named.p ?? ''}${pos[0]}${spread}${units ? (units === '%' ? '%' : ` ${units}`) : ''}${named.s ?? ''}`;
    }
    if (name === 'convert' || name === 'cvt') {
        // {{convert|5|mg|gr}} reads "5 mg"; {{convert|5|to|10|mg}} "5 to 10 mg".
        if (!pos[0] || !NUMBER.test(pos[0])) return HOLE;
        const join = { '-': '–', '–': '–', to: ' to ', and: ' and ', or: ' or ', 'to(-)': ' to ', '+/-': ' ± ', x: ' × ', by: ' by ' };
        if (pos[1] in join && pos[2] && NUMBER.test(pos[2]) && pos[3]) return `${pos[0]}${join[pos[1]]}${pos[2]} ${pos[3]}`;
        return pos[1] && !NUMBER.test(pos[1]) ? `${pos[0]} ${pos[1]}` : HOLE;
    }
    if (name === 'ipac-en' || name === 'ipa' || name === 'ipa-en' || name === 'respell' || name === 'pronunciation' || name === 'audio' || /^ipa[c-]/.test(name)) return '\u2063';
    unknownTemplates.set(name, (unknownTemplates.get(name) ?? 0) + 1);
    return HOLE;
}

const ENTITIES = {
    nbsp: ' ', ndash: '–', mdash: '—', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", minus: '−', times: '×', plusmn: '±', deg: '°', micro: 'µ',
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', kappa: 'κ', lambda: 'λ', mu: 'μ', sigma: 'σ', omega: 'ω', Delta: 'Δ', thinsp: ' ',
    ensp: ' ', emsp: ' ', hellip: '…', rarr: '→', larr: '←', harr: '↔', le: '≤', ge: '≥', asymp: '≈', ne: '≠', middot: '·', bull: '•', prime: '′',
    lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', sup2: '²', sup3: '³', frac12: '½', eacute: 'é', egrave: 'è', ouml: 'ö', uuml: 'ü', auml: 'ä',
    zwj: '', zwnj: '', shy: '', lrm: '', rlm: '', dagger: '†', Dagger: '‡', sect: '§', tau: 'τ', theta: 'θ', pi: 'π', rho: 'ρ', phi: 'φ', psi: 'ψ',
};

/** Wikitext as plain text: paragraphs apart by a blank line, list and table
 *  lines gone, a HOLE wherever something couldn't be read. */
export function plainText(raw) {
    let t = raw.replace(/\r/g, '');
    t = t.replace(/<!--[\s\S]*?-->/g, '');
    t = t.replace(/<ref\b[^>]*\/\s*>/gi, '').replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, '');
    t = t.replace(/<(gallery|imagemap|timeline|score|syntaxhighlight|source|pre|templatestyles|mapframe|graph|hiero|poem|section)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '\n');
    t = t.replace(/<(math|chem|ce|blockquote|code)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, HOLE);
    t = t.replace(/<includeonly>[\s\S]*?<\/includeonly>/gi, '').replace(/<\/?(?:noinclude|onlyinclude)>/gi, '');
    t = t.replace(/<nowiki\s*\/>/gi, '').replace(/<nowiki>([\s\S]*?)<\/nowiki>/gi, (_, x) => x.replace(/[[\]{}|]/g, ''));
    // Tables, from the inside out.
    for (let k = 0; k < 12; k++) {
        const next = t.replace(/\{\|(?:(?!\{\||\|\})[\s\S])*\|\}/g, '\n');
        if (next === t) break;
        t = next;
    }
    // Links, templates and pictures hold one another; each pass opens the innermost.
    for (let k = 0; k < 24; k++) {
        const before = t;
        t = t.replace(/\[\[(?!\s*(?:File|Image|Media|Category)\s*:)\s*:?([^[\]|{}]*?)(?:\|((?:[^[\]{}]|\[[^[\]{}]*\])*?))?\]\]/gi, (_, target, label) => {
            if (label != null) return label;
            // [[Morphine#Pharmacology]] reads "Morphine"; [[wikt:word]] "word".
            return target.replace(/#.*$/, '').replace(/^(?:w|wikt|wiktionary|s|q|commons|[a-z]{2,3}):/i, '');
        });
        t = t.replace(/\{\{((?:(?!\{\{|\}\}|\[\[)[\s\S])*?)\}\}/g, (_, inner) => template(inner));
        t = t.replace(/\[\[\s*(?:File|Image|Media|Category)\s*:(?:(?!\[\[|\]\])[\s\S])*\]\]/gi, '');
        if (t === before) break;
    }
    t = t.replace(/\[(?:https?:)?\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1').replace(/\[(?:https?:)?\/\/[^\s\]]+\]/g, '');
    t = t.replace(/<br\s*\/?>/gi, ' ');
    t = t.replace(/<\/?(?:sub|sup|small|big|span|div|center|i|b|u|s|em|strong|abbr|cite|var|tt|font|ins|del|mark|bdi|wbr|nobr|p|dfn|q|kbd|samp)\b[^>]*>/gi, m => (/^<\/?p\b/i.test(m) ? '\n\n' : ''));
    t = t.replace(/<[^>\n]{0,200}>/g, HOLE);
    t = t.replace(/'{2,5}/g, '');
    t = t.replace(/__[A-Z]+__/g, '');
    t = t.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
    t = t.replace(/&([A-Za-z0-9]+);/g, (_, n) => (n in ENTITIES ? ENTITIES[n] : HOLE));
    t = t.replace(/[\u00a0\u2009\u200a\u202f]/g, ' ').replace(/[\u200b\u200e\u200f\u00ad]/g, '');
    const paras = [];
    let cur = [];
    const flush = () => {
        if (cur.length) paras.push(cur.join(' '));
        cur = [];
    };
    for (const line of t.split('\n')) {
        const s = line.trim();
        if (!s) flush();
        // Lists, definitions, table rows and rules aren't prose; neither is a
        // line with nothing left in it but what couldn't be read.
        else if (/^[*#:;|!]|^-{4,}|^=+.*=+$|^\{\||^\|\}/.test(s)) flush();
        else if (!s.replace(new RegExp(`[${HOLE}\u2063\\s.,;:()]`, 'g'), '')) flush();
        else cur.push(s);
    }
    flush();
    return paras.map(tidy).filter(Boolean);
}

/** What's left where a pronunciation or a note came out: "( ; )", "( , born…". */
function tidy(p) {
    // A name in another script, in brackets ("Erispan (エリスパン)"), isn't read.
    let s = p.replace(/\s+/g, ' ').replace(/\s*\([^()]*[\u3000-\u9fff\uff00-\uffef][^()]*\)/g, '');
    for (let k = 0; k < 4; k++)
        s = s
            .replace(/\(\s*(?:[,;:]?\s*\u2063\s*)+[,;:]?\s*\)/g, '')
            .replace(/\(\s*(?:\u2063\s*[,;:]?\s*)+/g, '(')
            .replace(/(?:[,;:]?\s*\u2063)+\s*\)/g, ')')
            .replace(/\u2063/g, '')
            .replace(/\(\s*[,;:]\s*/g, '(')
            .replace(/\s*[,;:]\s*\)/g, ')')
            .replace(/\(\s*\)/g, '')
            .replace(/\[\s*\]/g, '');
    return s
        .replace(/\s+([,.;:!?)\]])/g, '$1')
        .replace(/([([])\s+/g, '$1')
        .replace(/,(?:\s*,)+/g, ',')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

// Lists written as templates: {{ubl|a|b}}, {{plainlist|* a * b}}.
const LISTS = new Set(['plainlist', 'plain list', 'ubl', 'ubli', 'unbulleted list', 'hlist', 'flatlist', 'bulleted list', 'cslist', 'collapsible list', 'indented plainlist', 'unordered list']);

/** An infobox field as its items ("Adults: 3–7 hours", "Infants: 8 hours"):
 *  one for each line, bullet or list entry. An item that can't be read as
 *  plain words is left out. */
export function fieldItems(raw) {
    let t = raw.replace(/<!--[\s\S]*?-->/g, '');
    t = t.replace(/<ref\b[^>]*\/\s*>/gi, '').replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, '').replace(/<ref\b[\s\S]*$/i, '');
    // Links and templates are set aside whole, so that a list template can be
    // taken apart at its own bars and not at theirs.
    const aside = [];
    const set = x => `\u0001${aside.push(x) - 1}\u0002`;
    for (let k = 0; k < 12; k++) {
        const before = t;
        t = t.replace(/\[\[(?:(?!\[\[|\]\])[\s\S])*\]\]/g, set);
        t = t.replace(/\{\{((?:(?!\{\{|\}\})[\s\S])*)\}\}/g, (whole, inner) => {
            const bits = inner.split('|');
            if (!LISTS.has(norm(bits[0]))) return set(whole);
            return `\n${bits.slice(1).filter(b => !/^\s*(?:title|class|style|list_style|item_style|indent|expand|framestyle|titlestyle|liststyle|bullets)\s*=/i.test(b)).join('\n')}\n`;
        });
        if (t === before) break;
    }
    // A list left open where the field was cut short.
    t = t.replace(/\{\{\s*([A-Za-z ]+?)\s*\|/g, (whole, name) => (LISTS.has(norm(name)) ? '\n' : whole));
    const back = x => {
        for (let k = 0; k < 12 && x.includes('\u0001'); k++) x = x.replace(/\u0001(\d+)\u0002/g, (_, i) => aside[Number(i)]);
        return x;
    };
    return t
        .split(/<br\s*\/?>|\n|•/i)
        .map(x => back(x).replace(/^\s*[*#:;]+\s*/, ''))
        .map(x => plainText(x).join(' '))
        // A heading for what follows ("IR dosing:") keeps its colon.
        .map(x => x.replace(/[\s,;]+$/, '').replace(/^[\s,;:]+/, ''))
        .filter(x => x && !x.includes(HOLE) && !/[{}[\]|<>]|\u0001/.test(x) && (x.match(/\(/g) ?? []).length === (x.match(/\)/g) ?? []).length);
}

// A full stop after one of these doesn't end the sentence.
const ABBREV = /(?:\b(?:e\.g|i\.e|vs|etc|approx|ca|cf|c|Dr|Prof|St|Mr|Mrs|Ms|No|Nos|Inc|Ltd|Co|Corp|Fig|Figs|sp|spp|var|subsp|al|resp|viz|incl|esp|est|Jr|Sr|U\.S|U\.K|U\.N|E\.U|a\.k\.a|p\.o|i\.v|i\.m|s\.c|i\.p)|\b[A-Z]|\s[a-z])$/;

/** A paragraph as sentences. */
export function sentences(para) {
    const out = [];
    let start = 0;
    const re = /[.!?]["”’)\]]*(?=\s+["“‘([]?[A-Z0-9α-ωΑ-Ω(]|\s*$)/g;
    let m;
    while ((m = re.exec(para))) {
        const end = m.index + m[0].length;
        const piece = para.slice(start, end);
        if (para[m.index] === '.' && ABBREV.test(para.slice(start, m.index)) && end < para.length) continue;
        // A decimal point, or a stop inside brackets still open, isn't an end.
        if ((piece.match(/\(/g) ?? []).length > (piece.match(/\)/g) ?? []).length && end < para.length) continue;
        out.push(piece.trim());
        start = end;
    }
    const rest = para.slice(start).trim();
    if (rest) out.push(rest);
    return out;
}

/** A sentence that can be quoted as it stands. */
export function sound(s) {
    if (s.includes(HOLE)) return false;
    // Square brackets are a chemist's (pyrrolo[2,3-b]pyridine); doubled, or unpaired, they're a link's.
    if (/[{}|<>]|\[\[|\]\]|https?:|\bwww\.|''/.test(s)) return false;
    if ((s.match(/\[/g) ?? []).length !== (s.match(/\]/g) ?? []).length) return false;
    // A capital, a figure, a Greek letter, or a prefix in small letters (l-DOPA, para-Methoxyamphetamine).
    if (!/^["“‘(]?(?:[A-Z0-9α-ωΑ-Ω]|[a-z]{1,8}-[A-Za-z0-9α-ω(])/.test(s)) return false;
    if (!/[.!?]["”’)]*$/.test(s)) return false;
    if ((s.match(/\(/g) ?? []).length !== (s.match(/\)/g) ?? []).length) return false;
    if ((s.match(/[“"]/g) ?? []).length % 2 && !/[”]/.test(s)) return false;
    if (/[\u3000-\u9fff\uff00-\uffef]/.test(s)) return false;
    // Something fell out mid-sentence: "a of 5 nM", "with and", "( , ".
    if (/\b(?:a|an|the) (?:of|and|with|or|is|are|was|at|by|than)\b/.test(s)) return false;
    if (/\b(?:of|at|by|from) (?:and|or|is|are|was|of)\b|\bwith (?:and|is|are|was|of)\b/.test(s)) return false;
    if (/\b(?:a|an|the|its)[,.;:)]|\b(?:of|than|and|or)[.;:)]/.test(s)) return false;
    if (/\(\s*[,;]|[,;]\s*\)|\s[,;.]|,,|\.\.(?!\.)|:\./.test(s)) return false;
    // Two sentences the article ran together ("…than etonitazene itself It is an analogue…").
    if (/[a-z)] (?:It|This|These) (?:is|was|has|can|may|also|acts?|shows?|produces?|are|were|have)\b/.test(s)) return false;
    // "…by Suchocki et al." is where a sentence was cut, not where it ends.
    if (/\bet al\.$/.test(s)) return false;
    if (s.length < 25) return false;
    return true;
}

/** A page's sections: [{ level, title, text }], the lead first (level 1, no title). */
export function sectionsOf(wikitext) {
    const t = wikitext.replace(/<!--[\s\S]*?-->/g, '');
    const out = [];
    const re = /^(={2,6})[ \t]*(.+?)[ \t]*\1[ \t]*$/gm;
    let last = 0;
    let head = { level: 1, title: '' };
    let m;
    while ((m = re.exec(t))) {
        out.push({ ...head, text: t.slice(last, m.index) });
        head = { level: m[1].length, title: m[2].replace(/'{2,}/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/<[^>]+>/g, '').trim() };
        last = m.index + m[0].length;
    }
    out.push({ ...head, text: t.slice(last) });
    return out;
}
