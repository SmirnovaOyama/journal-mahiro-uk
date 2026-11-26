import { useEffect, useRef, useState } from 'react';
import { molToSvg, type Mol } from '../lib/molsvg';
import { FormDoodle, type DosageForm } from './doodles';
import { PICTURES } from '../lib/xunxun';

/* A substance drawn as its skeletal formula, laid out as PubChem lays it
   out (the standard depiction, as in textbooks and on Wikipedia) and drawn
   in one ink like everything else on the page (lib/molsvg.ts). The drawing
   is of the substance itself, or for a plant or a mixture its main active
   compound, or for a chemical family its parent structure; useStructure()
   says which. A substance without one (a kind of drug rather than one
   chemical) keeps its dosage-form drawing.

   Each drawing is made once per substance, when it scrolls near the screen,
   one per frame, and kept as markup for every size. */

export type StructureRole = 'self' | 'active' | 'core' | 'example';

interface Structure extends Mol {
    cid: number;
    /** what to call the compound drawn, in English and, where settled, Chinese */
    name: string;role: StructureRole;
}

type Structures = Record<string, Structure | null>;

export interface StructureInfo {
    name: string;role: StructureRole;
    cid: number;
}

/* The drawings come in one small file per first letter of the id
   (scripts/lib/structures.mjs), so a page loads only the letters it shows. */
const shards = new Map<string, Promise<Structures>>();
const shardOf = (id: string) => (/^[a-z0-9]/.test(id) ? id[0] : '_');
function loadStructure(id: string): Promise<Structure | null> {
    const k = shardOf(id);
    let p = shards.get(k);
    if (!p) {
        p = fetch(`/data/structures/${k}.json`)
            .then(r => (r.ok ? (r.json() as Promise<Structures>) : {}))
            .catch(() => ({}));
        shards.set(k, p);
    }
    return p.then(all => all[id] ?? null);
}

/** What a substance's drawing is of, once the structures have loaded. */
export function useStructure(id: string): StructureInfo | null {
    const [info, setInfo] = useState<StructureInfo | null>(null);
    useEffect(() => {
        let live = true;
        loadStructure(id).then(s => {
            if (live) setInfo(s ? { name: s.name, role: s.role, cid: s.cid } : null);
        });
        return () => {
            live = false;
        };
    }, [id]);
    return info;
}

const drawn = new Map<string, string | null>();

/* Drawings wait their turn, one per frame, so a long list stays smooth. */
const queue: (() => void)[] = [];
let pumping = false;
function schedule(job: () => void) {
    queue.push(job);
    if (pumping) return;
    pumping = true;
    const pump = () => {
        const next = queue.shift();
        if (!next) {
            pumping = false;
            return;
        }
        next();
        requestAnimationFrame(pump);
    };
    requestAnimationFrame(pump);
}

/** In the renderer's units, where a bond is 30: four bonds. */
const MIN_FRAME = 120;

/** Frames the drawing on what was actually drawn, measured off-screen with
 *  the styles the page will draw it with, so no label is ever cut off at an
 *  edge. The renderer's own frame is an estimate of the labels' widths. */
function fitToContent(markup: string): string {
    const host = document.createElement('div');
    host.className = 'molecule-ink';
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
        'position:absolute;left:-10000px;top:0;width:240px;height:240px;overflow:hidden;visibility:hidden;pointer-events:none';
    host.innerHTML = markup;
    document.body.appendChild(host);
    const svg = host.querySelector('svg');
    try {
        const b = svg?.getBBox();
        if (svg && b && b.width > 0 && b.height > 0) {
            const m = Math.max(2, Math.max(b.width, b.height) * 0.04);
            // Never framed tighter than a mid-sized molecule (caffeine), so a
            // small one (N₂O, ethanol) is drawn at the same scale, not blown up.
            const w = Math.max(b.width + 2 * m, MIN_FRAME),
                h = Math.max(b.height + 2 * m, MIN_FRAME);
            svg.setAttribute('viewBox', `${b.x + b.width / 2 - w / 2} ${b.y + b.height / 2 - h / 2} ${w} ${h}`);
        }
    } catch {
        /* keep the renderer's frame */
    }
    const out = svg ? svg.outerHTML : markup;
    host.remove();
    return out;
}

/** Draws one substance's structure as markup (cached). Exported for checks. */
export async function drawMolecule(id: string): Promise<string | null> {
    if (drawn.has(id)) return drawn.get(id)!;
    const s = await loadStructure(id);
    if (!s) {
        drawn.set(id, null);
        return null;
    }
    return new Promise(resolve => {
        schedule(() => {
            if (drawn.has(id)) return resolve(drawn.get(id)!);
            let markup: string | null = null;
            try {
                const raw = molToSvg(s);
                // A lone atom (lithium) is one big letter, not a structure:
                // leave it to the dosage-form drawing.
                markup = /<line|<polygon/.test(raw) ? fitToContent(raw) : null;
            } catch {
                markup = null;
            }
            drawn.set(id, markup);
            resolve(markup);
        });
    });
}

export function Molecule({ id, form, size = 'sm' }: { id: string; form: DosageForm; size?: 'xs' | 'sm' | 'lg' }) {
    const box = useRef<HTMLSpanElement>(null);
    const [markup, setMarkup] = useState<string | null | undefined>(() => drawn.get(id));

    useEffect(() => {
        if (PICTURES[id]) return;
        if (drawn.has(id)) {
            setMarkup(drawn.get(id));
            return;
        }
        const el = box.current;
        if (!el) return;
        let live = true;
        const io = new IntersectionObserver(
            ([e]) => {
                if (!e.isIntersecting) return;
                io.disconnect();
                drawMolecule(id).then(m => live && setMarkup(m));
            },
            { rootMargin: '300px' },
        );
        io.observe(el);
        return () => {
            live = false;
            io.disconnect();
        };
    }, [id]);

    const doodle = { xs: 1.1, sm: 1.75, lg: 3.25 }[size];
    return (
        <span ref={box} className={`molecule molecule-${size}`} aria-hidden="true">
            {PICTURES[id] ? (
                // A picture where a structure would be drawn (lib/xunxun.ts).
                <img src={PICTURES[id]} alt="" decoding="async" draggable={false} className="block size-full rounded-[22%] object-cover" />
            ) : markup ? (
                <span className="molecule-ink" dangerouslySetInnerHTML={{ __html: markup }} />
            ) : markup === null ? (
                <FormDoodle form={form} size={doodle} />
            ) : null}
        </span>
    );
}
