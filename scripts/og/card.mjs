// The 1200 by 630 card shown when a link is shared, as an SVG: render.mjs
// has resvg draw it. No browser: every line is measured from the fonts
// themselves (type.mjs), so a card comes out the same on a Mac and on
// Cloudflare's build machine, which is where they are drawn for the site.
//
// Colours are hrt.mahiro.uk's (src/styles/oyama-tokens.css, light), laid
// out as its own card is (Oyama's design/og/og.html): the white page, the
// host at the foot beside the logo, the drawing in terracotta. The type is
// Inter and Source Han Sans, which may be kept in a repository and used
// anywhere; the site itself is set in the reader's system face.

import { FACE, advance, anywhere, balanced, baseline, chemical, facesFor, greedy, line, round, words } from './type.mjs';

/* ── colour ──────────────────────────────────────────────────────────── */

/** oklch() as the tokens write it, in the #rrggbb an SVG renderer reads. */
export function hex(l, c, h) {
    const a = c * Math.cos((h * Math.PI) / 180),
        b = c * Math.sin((h * Math.PI) / 180);
    const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
        m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
        s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const to = v => {
        const s = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
        return Math.round(Math.min(1, Math.max(0, s)) * 255)
            .toString(16)
            .padStart(2, '0');
    };
    return `#${to(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_)}${to(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_)}${to(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_)}`;
}
/** Every oklch(…) in a piece of markup, and a var(--token, oklch(…)) with it. */
const inHex = markup =>
    markup
        .replace(/var\(\s*--[\w-]+\s*,\s*(oklch\([^)]*\))\s*\)/g, '$1')
        .replace(/oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/g, (_m, l, c, h) => hex(l / 100, +c, +h));

export const INK = {
    bg: '#ffffff',
    text: hex(0.205, 0.006, 90),
    muted: hex(0.517, 0.013, 90),
    surface: hex(0.973, 0.004, 90),
    brand: hex(0.658, 0.1131, 39.15),
    danger: hex(0.53, 0.19, 27),
    warning: hex(0.53, 0.13, 55),
    info: hex(0.52, 0.17, 255),
    positive: hex(0.52, 0.11, 162),
};

/* ── the parts every card has ────────────────────────────────────────── */

const W = 1200,
    H = 630,
    LEFT = 80;
/** The molecule's box: the right of the card, nearly its full height. */
const MOL = { right: 36, top: 36, w: 700, h: 558 };
/** The widest a line runs across the card. */
const ACROSS = 1040;

let ids = 0;
const page = body =>
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="${INK.bg}"/>${body}</svg>`;

/** A picture with round corners. `fit` is "slice" to fill its box, "meet" to sit inside it. */
function picture(href, x, y, w, h, radius, fit = 'slice') {
    const id = `clip${++ids}`;
    return (
        `<clipPath id="${id}"><rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${radius}"/></clipPath>` +
        `<image x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" preserveAspectRatio="xMidYMid ${fit}" clip-path="url(#${id})" xlink:href="${href}"/>`
    );
}

/** The logo and the host, at the foot: the logo's bottom edge `bottom` above the card's. */
function foot(d, left = LEFT, bottom = 44) {
    const top = H - bottom - 40;
    return (
        picture(d.logo, left, top, 40, 40, 9) +
        // Centred on the logo, as a row of the two is.
        line(d.host, { x: left + 54, y: top + 20 - 12 + baseline(24, 1), face: FACE.text, size: 24, fill: INK.muted })
    );
}

/** Lines of text one under the other from `top`; returns their markup and where they end. */
function block(lines, { x, top, size, leading, ...rest }) {
    const out = lines.map((text, i) => line(text, { x, y: top + i * leading * size + baseline(size, leading), size, ...rest }));
    return { svg: out.join(''), bottom: top + lines.length * leading * size };
}

/** A paragraph, each line filled as far as `width` lets it. */
const paragraph = (text, width, size, face, lang) =>
    [].concat(text).flatMap(t => greedy(words(t), width, s => advance(s, face, 0, lang) * size));

/* A skeletal formula from the site's own renderer (src/lib/molsvg.ts, run
   by render.mjs), framed on what was drawn, labels included, as on the site
   (src/components/Molecule.tsx), in the box given. */
function molecule(markup, x, y, boxW, boxH) {
    const view = markup.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/)?.slice(1).map(Number);
    if (!view) return '';
    // The renderer frames what it drew with a margin of its own (0.3 of a bond).
    const pad = 9;
    const b = { x: view[0] + pad, y: view[1] + pad, width: view[2] - 2 * pad, height: view[3] - 2 * pad };
    const m = Math.max(2, Math.max(b.width, b.height) * 0.03);
    // Never framed tighter than a mid-sized molecule in the box's own shape,
    // so N₂O isn't blown up to fill the card while LSD and caffeine come
    // out at one scale.
    const w = Math.max(b.width + 2 * m, 260),
        h = Math.max(b.height + 2 * m, 260 * (boxH / boxW));
    const scale = Math.min(boxW / w, boxH / h);
    /* Bonds are 3.4 wide on the card whatever the molecule's scale; but a
       peptide of three hundred atoms is drawn small, and its lines thin with
       it, so its rings stay open instead of filling in. */
    const stroke = Math.max(1, Math.min(3.4, 8.5 * scale)) / scale;
    const inner = markup
        .replace(/^<svg[^>]*>/, '')
        .replace(/<\/svg>\s*$/, '')
        .replace(/stroke-width="[\d.]+"/, `stroke-width="${round(stroke)}"`)
        .replace(/font-family='[^']*'/, `font-family="${FACE.label.family}" font-weight="${FACE.label.weight}"`);
    return (
        `<svg x="${round(x)}" y="${round(y)}" width="${boxW}" height="${round(boxH)}" color="${INK.brand}" ` +
        `viewBox="${round(b.x + b.width / 2 - w / 2)} ${round(b.y + b.height / 2 - h / 2)} ${round(w)} ${round(h)}">${inner}</svg>`
    );
}

/** One of the site's doodles (a dosage form), its markup from React, in a box. */
const doodle = (markup, x, y, side) =>
    inHex(markup)
        .replace(/ (?:style|class|aria-hidden|focusable)="[^"]*"/g, '')
        .replace(/^<svg /, `<svg x="${round(x)}" y="${round(y)}" width="${round(side)}" height="${round(side)}" `);

/* ── a substance ─────────────────────────────────────────────────────── */

/* A substance's name, set so that every one of them reads, from LSD to a
   systematic name a hundred letters long. In order of preference:
     beside     one line beside the drawing, as large as fits;
     stacked    two or three lines beside it, broken between words (a name
                that is several words);
     across     one line across the card, the drawing moved below it;
     lines      up to three lines across the card, broken where a chemical
                name is broken: after a hyphen, around a bracket, never
                inside a word;
     cut        the same at the smallest size, broken anywhere and cut short
                with an ellipsis. No name in the catalogue needs it; a card
                that does is listed by render.mjs.
   `col` is the width beside the drawing. A line's width goes with its size,
   so each is measured once, at a size of 1. */
const NAME_TRACKING = -0.03;
function setName(name, col, lang) {
    const measure = s => advance(s, FACE.title, NAME_TRACKING, lang);
    /** The largest even size from `most` down to `least` at which a line `wide` (at size 1) fits in `room`. */
    const sizeFor = (wide, room, most, least) => {
        const size = Math.min(most, Math.floor(room / wide / 2) * 2);
        return size >= least ? size : 0;
    };
    const whole = measure(name);
    let size = sizeFor(whole, col, 112, 76);
    if (size) return { mode: 'beside', size, lines: [name] };

    /** The fewest lines, up to three, the pieces go on within `room`, as large as fits, evenly broken. */
    const several = (pieces, room, most, least) => {
        const three = balanced(pieces, Math.min(3, pieces.length), measure);
        const size = sizeFor(three.widest, room, most, least);
        if (!size) return null;
        for (let count = 1; count <= 3; count++) {
            const set = balanced(pieces, Math.min(count, pieces.length), measure);
            if (set.widest * size <= room) return { size, lines: set.lines };
        }
        return null;
    };
    // Between words, and after a hyphen that joins two of them, as a browser breaks a line.
    if (/\s/.test(name)) {
        const set = several(words(name), col, 84, 60);
        if (set) return { mode: 'stacked', ...set };
    }
    size = sizeFor(whole, ACROSS, 96, 56);
    if (size) return { mode: 'across', size, lines: [name] };
    const set = several(chemical(name), ACROSS, 64, 40);
    if (set) return { mode: 'lines', ...set };
    const all = greedy(anywhere(name), ACROSS, s => measure(s) * 40);
    const lines = all.slice(0, 3);
    if (all.length > 3) {
        let last = lines[2];
        while (last && measure(`${last}…`) * 40 > ACROSS) last = last.slice(0, -1);
        lines[2] = `${last}…`;
    }
    return { mode: 'cut', size: 40, lines };
}

/* A substance: its name, what kind of drug it is, and on the right what the
   site draws for it: its structure, or the doodle of the form it comes in
   where it has none (a kind of drug, a lone atom), or its picture (寻寻).
   The drawing has the right of the card to itself, from under the name when
   the name runs across the card.

   d: host, logo, name, kind (a line, or lines), molecule | doodle | picture,
   drawn (what the structure is of, when it isn't the substance), lang. */
export function substance(d) {
    const art = d.molecule ? 'molecule' : d.picture ? 'picture' : 'doodle';
    // The widest a picture or a tile is drawn, centred in the molecule's box.
    const most = art === 'picture' ? 480 : 400;
    const col = art === 'molecule' ? W - MOL.w - MOL.right - LEFT - 24 : W - MOL.right - MOL.w / 2 - most / 2 - LEFT - 40;
    const set = setName(d.name, col, d.lang);
    const beside = set.mode === 'beside' || set.mode === 'stacked';
    const leading = set.lines.length > 1 ? 1.1 : 1.02;
    const name = block(set.lines, { x: LEFT, top: 72, size: set.size, leading, face: FACE.title, fill: INK.text, tracking: NAME_TRACKING, lang: d.lang });

    // Where the drawing goes: the whole box, or what is left of it under the name.
    const top = beside ? MOL.top : Math.round(name.bottom + 20);
    const room = MOL.top + MOL.h - top;
    const boxH = d.drawn ? room - 52 : room;
    const boxX = W - MOL.right - MOL.w;
    let drawing = '';
    let footBottom = 44;
    if (art === 'molecule') {
        drawing = molecule(d.molecule, boxX, top, MOL.w, boxH);
        if (d.drawn)
            drawing += line(d.drawn, { x: boxX + MOL.w / 2, y: top + boxH + 8 + baseline(24, 1.2), face: FACE.text, size: 24, fill: INK.muted, anchor: 'middle' });
    } else {
        const side = Math.min(most, boxH - (beside ? 40 : 0));
        const x = boxX + (MOL.w - side) / 2,
            y = top + (boxH - side) / 2,
            radius = Math.round(side * 0.18);
        if (art === 'picture') {
            drawing = picture(d.picture, x, y, side, side, radius);
            /* Beside a picture the logo and the host stand on the picture's
               bottom edge, as on a report's card, not below it. */
            footBottom = Math.max(44, H - Math.round(y + side));
        } else {
            drawing =
                `<rect x="${round(x)}" y="${round(y)}" width="${round(side)}" height="${round(side)}" rx="${radius}" fill="${INK.surface}"/>` +
                doodle(d.doodle, x + side * 0.125, y + side * 0.125, side * 0.75);
        }
    }

    // The line under the name; a long one under a tall name gives way before it reaches the foot.
    const floor = H - footBottom - 40 - 20;
    let kind = { svg: '', bottom: name.bottom };
    let kindLines = [];
    for (let size = 30; d.kind && size >= 22; size -= 2) {
        kindLines = paragraph(d.kind, col, size, FACE.text, d.lang);
        kind = block(kindLines, { x: LEFT, top: name.bottom + 24, size, leading: 1.32, face: FACE.text, fill: INK.muted, lang: d.lang });
        if (kind.bottom <= floor) break;
    }

    const texts = [...set.lines.map(l => [l, FACE.title]), ...kindLines.map(l => [l, FACE.text]), [d.host, FACE.text], ...(d.drawn ? [[d.drawn, FACE.text]] : [])];
    return {
        svg: page(name.svg + kind.svg + drawing + foot(d, LEFT, footBottom)),
        fonts: facesFor(texts, [FACE.title, FACE.text, ...(art === 'molecule' ? [FACE.label] : [])], d.lang),
        /* What render.mjs checks of every card: that the name was not cut
           and nothing runs past its place. */
        set: {
            mode: set.mode,
            size: set.size,
            lines: set.lines.length,
            ok:
                set.mode !== 'cut' &&
                Math.max(...set.lines.map(l => advance(l, FACE.title, NAME_TRACKING, d.lang) * set.size)) <= (beside ? col : ACROSS) + 0.5 &&
                kind.bottom <= floor + 1 &&
                boxH >= 240,
        },
    };
}

/* ── the site ────────────────────────────────────────────────────────── */

/* The site's card: its name and its line beside LSD drawn large, as a
   substance's card is. d: host, logo, name, kind, molecule. */
export function site(d) {
    const col = W - MOL.w - MOL.right - LEFT - 24;
    const measure = s => advance(s, FACE.title, NAME_TRACKING);
    // On one line if it fits there as a short substance's name does; else
    // word under word at 56, as the site's card has always had it.
    let size = Math.min(100, Math.floor(col / measure(d.name) / 2) * 2);
    let lines = [d.name];
    if (size < 76) {
        size = 56;
        lines = greedy(words(d.name), col, s => measure(s) * size);
    }
    const name = block(lines, { x: LEFT, top: 72, size, leading: lines.length > 1 ? 1.08 : 1.02, face: FACE.title, fill: INK.text, tracking: NAME_TRACKING });
    const kindLines = paragraph(d.kind, col, 30, FACE.text);
    const kind = block(kindLines, { x: LEFT, top: name.bottom + 24, size: 30, leading: 1.32, face: FACE.text, fill: INK.muted });
    return {
        svg: page(name.svg + kind.svg + molecule(d.molecule, W - MOL.right - MOL.w, MOL.top, MOL.w, MOL.h) + foot(d)),
        fonts: facesFor([], [FACE.title, FACE.text, FACE.label]),
    };
}

/* ── an answer of the mix checker ────────────────────────────────────── */

/* The verdict in its colour, large, and what it means. d: host, logo, word,
   meaning, color, clover (the glyph's strokes, for a low-risk answer). */
export function mix(d) {
    const TRACKING = -0.035;
    const room = d.clover ? 860 : ACROSS;
    const wide = advance(d.word, FACE.figure, TRACKING);
    const size = Math.max(96, Math.min(160, Math.floor(room / wide / 2) * 2));
    // The clover and the word in a row, centred on one another.
    const rowH = Math.max(d.clover ? 150 : 0, size);
    const mid = 150 + rowH / 2;
    const clover = d.clover
        ? `<svg x="${LEFT}" y="${round(mid - 75)}" width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="${INK.positive}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" color="${INK.positive}">${d.clover}</svg>`
        : '';
    const word = line(d.word, { x: LEFT + (d.clover ? 180 : 0), y: mid - size / 2 + baseline(size, 1), face: FACE.figure, size, fill: d.color, tracking: TRACKING });
    const meaning = block(paragraph(d.meaning, ACROSS, 36, FACE.text), { x: LEFT, top: 372, size: 36, leading: 1.4, face: FACE.text, fill: INK.text });
    return {
        svg: page(
            line('Can these be mixed?', { x: LEFT, y: 76 + baseline(34, 1.2), face: FACE.text, size: 34, fill: INK.muted }) + clover + word + meaning.svg + foot(d),
        ),
        fonts: facesFor([], [FACE.figure, FACE.text]),
    };
}

/* ── a report that closes on a wish ──────────────────────────────────── */

/* Its picture on the left, the wish beside it, in the language it was
   written in and then in English. The report's own picture is line art, so
   it is drawn in the doodles' ink as it is on the page (the picture is the
   mask), cut square about its middle; a report with only a closing picture
   shows that as it is. The logo and the host sit on the picture's bottom
   edge. d: host, logo, picture, line, wish (lines), verse (lines), lang. */
export function report(d) {
    const X = 588,
        ROOM = 564,
        lang = d.lang ?? 'zh-Hans';
    const id = `mask${++ids}`;
    const art = d.line
        ? `<mask id="${id}" mask-type="alpha"><image x="44" y="63" width="504" height="504" preserveAspectRatio="xMidYMid slice" xlink:href="${d.picture}"/></mask>` +
          `<rect x="44" y="63" width="504" height="504" fill="${INK.brand}" mask="url(#${id})"/>`
        : `<image x="44" y="63" width="504" height="504" preserveAspectRatio="xMidYMid meet" xlink:href="${d.picture}"/>`;
    /** The largest size from `most` down at which every line fits the column. */
    const fit = (lines, most, tracking) => {
        const widest = Math.max(...lines.map(l => advance(l, FACE.text, tracking, lang)));
        return Math.max(16, Math.min(most, Math.floor(ROOM / widest)));
    };
    const wishSize = fit(d.wish, 40, 0.01);
    const verseSize = d.verse.length ? fit(d.verse, 24, 0) : 0;
    // The two together, centred in the height above the foot.
    const wishH = d.wish.length * 1.42 * wishSize;
    const verseH = d.verse.length ? 26 + d.verse.length * 1.5 * verseSize : 0;
    const top = (524 - wishH - verseH) / 2;
    const wish = block(d.wish, { x: X, top, size: wishSize, leading: 1.42, face: FACE.text, fill: INK.text, tracking: 0.01, lang });
    const verse = d.verse.length ? block(d.verse, { x: X, top: wish.bottom + 26, size: verseSize, leading: 1.5, face: FACE.text, fill: INK.muted, lang }) : { svg: '' };
    return {
        svg: page(art + wish.svg + verse.svg + foot(d, X, 63)),
        fonts: facesFor([...d.wish, ...d.verse, d.host].map(l => [l, FACE.text]), [FACE.text], lang),
    };
}
