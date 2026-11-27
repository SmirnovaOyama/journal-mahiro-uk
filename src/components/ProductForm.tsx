import { useMemo, useState } from 'react';
import { PARACETAMOL, PARACETAMOL_DAY_MG, PARACETAMOL_SOURCE, paracetamolMg } from '../lib/advice';
import { convertAmount, fmtAmount, nameOf, search, type IndexEntry } from '../lib/data';
import { tr } from '../lib/i18n';
import { newId, useJournal, type Ingestion } from '../lib/journal';
import { productsOf, usePerson, type Product, type ProductPart } from '../lib/person';
import { useNavHeldAway } from './BottomNav';
import Choice from './Choice';
import { Alert, Close } from './icons';
import { gramsText } from './JournalNotes';
import { Link } from './Link';
import { Molecule } from './Molecule';
import { SearchField } from './SearchField';

/* Logging a product with more than one ingredient: a cold medicine, taken
   for one thing in it, that carries others with it. Its ingredients are
   read off the box once and kept (lib/person.ts); after that, so many
   tablets are logged as so much of each ingredient, each as a dose of its
   own, so the journal's warnings and paracetamol's running total see what
   was really taken.

   No product comes filled in: what is in a box differs by country and by
   year, and only the box in hand says. */

const PERS = ['tablet', 'capsule', 'mL', 'sachet', 'piece'] as const;
const PART_UNITS = ['mg', 'μg', 'g'];

interface Draft {
    id: string;
    name: string;
    per: string;
    parts: (Omit<ProductPart, 'amount'> & { amount: string })[];
}

function toLocalInput(t: number) {
    const d = new Date(t);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const num = (s: string) => Number(s.replace(',', '.'));
const amountText = (v: number, unit: string) => `${fmtAmount(v)} ${unit}`;

export function ProductForm({
    index,
    byId,
    onLog,
    onCancel,
}: {
    index: IndexEntry[] | null;
    byId: Map<string, IndexEntry>;
    onLog: (doses: Omit<Ingestion, 'id'>[]) => void;
    onCancel: () => void;
}) {
    const { data } = useJournal();
    const { person, saveProduct, removeProduct } = usePerson();
    const products = useMemo(() => productsOf(person), [person]);
    useNavHeldAway();

    const [chosen, setChosen] = useState<string | null>(products.length === 1 ? products[0].id : null);
    const [draft, setDraft] = useState<Draft | null>(products.length ? null : { id: newId(), name: '', per: 'tablet', parts: [] });
    const [q, setQ] = useState('');
    const [countText, setCountText] = useState('');
    const [time, setTime] = useState(Date.now());

    const product = chosen ? person.products[chosen] : undefined;
    const hits = useMemo(() => (index && q.trim() ? search(index, q, 5) : []), [index, q]);
    const label = 'block text-xs font-medium text-[var(--text-muted)] mb-1.5';
    const chip = (active: boolean) =>
        `chip ${active ? 'bg-[var(--accent-subtle)] text-[var(--accent-ink)]' : 'chip-static text-[var(--text-muted)] hover:text-[var(--text)]'}`;
    const partName = (p: { substance: string; name: string }) => (byId.get(p.substance) ? nameOf(byId.get(p.substance)!) : p.name);
    /** An ingredient as the site shows any substance: its structure drawn, then its name. */
    const part = (p: { substance: string; name: string }, cls = '') => {
        const e = byId.get(p.substance);
        return (
            <span className={`flex min-w-0 items-center gap-2 ${cls}`}>
                {e && <Molecule id={e.id} form={e.form} size="xs" />}
                <span className="min-w-0 [overflow-wrap:anywhere]">{partName(p)}</span>
            </span>
        );
    };

    /* ── a product being written down ── */
    if (draft) {
        const valid = draft.parts.filter(p => Number.isFinite(num(p.amount)) && num(p.amount) > 0);
        const canSave = !!draft.name.trim() && valid.length > 0 && valid.length === draft.parts.length;
        const addPart = (substance: string, name: string) => {
            if (!draft.parts.some(p => p.substance === substance)) setDraft({ ...draft, parts: [...draft.parts, { substance, name, amount: '', unit: 'mg' }] });
            setQ('');
        };
        const setPart = (k: number, patch: Partial<Draft['parts'][number]>) => setDraft({ ...draft, parts: draft.parts.map((p, i) => (i === k ? { ...p, ...patch } : p)) });
        return (
            <form
                className="flex flex-col gap-5"
                onSubmit={e => {
                    e.preventDefault();
                    if (!canSave) return;
                    const saved: Omit<Product, 'at'> = { id: draft.id, name: draft.name.trim(), per: draft.per, parts: draft.parts.map(p => ({ ...p, amount: num(p.amount) })) };
                    saveProduct(saved);
                    setChosen(saved.id);
                    setDraft(null);
                }}
            >
                <div>
                    <label className={label} htmlFor="product-name">
                        {tr('Product')}
                    </label>
                    <input
                        id="product-name"
                        className={`input-base w-full ${draft.name ? 'is-inked' : ''}`}
                        placeholder={tr('Its name, as on the box')}
                        autoComplete="off"
                        autoFocus
                        value={draft.name}
                        onChange={e => setDraft({ ...draft, name: e.target.value })}
                    />
                </div>
                <div>
                    <span className={label}>{tr('One of it is a')}</span>
                    <div className="flex flex-wrap gap-2">
                        {PERS.map(p => (
                            <button type="button" key={p} className={chip(draft.per === p)} aria-pressed={draft.per === p} onClick={() => setDraft({ ...draft, per: p })}>
                                {tr(p, undefined, 'per')}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <span className={label}>{tr('In one {0}', { 0: tr(draft.per, undefined, 'per') })}</span>
                    {draft.parts.map((p, k) => (
                        <div key={p.substance} className="mb-3">
                            <div className="flex items-center justify-between gap-2">
                                {part(p, 'text-sm font-medium text-[var(--text)]')}
                                <button
                                    type="button"
                                    className="btn-ghost !size-8 !p-0"
                                    aria-label={tr('Take {0} off', { 0: partName(p) })}
                                    onClick={() => setDraft({ ...draft, parts: draft.parts.filter((_, i) => i !== k) })}
                                >
                                    <Close size={16} />
                                </button>
                            </div>
                            <div className="flex flex-wrap items-end gap-x-3">
                                <input
                                    className={`input-base min-w-0 flex-1 tabular-nums ${p.amount ? 'is-inked' : ''}`}
                                    inputMode="decimal"
                                    autoComplete="off"
                                    aria-label={tr('Amount of {0}', { 0: partName(p) })}
                                    placeholder={tr('Amount')}
                                    value={p.amount}
                                    onChange={e => setPart(k, { amount: e.target.value })}
                                />
                                <Choice className="w-24 shrink-0" options={PART_UNITS.map(u => ({ id: u, label: u }))} value={p.unit} onChange={u => setPart(k, { unit: u })} label={tr('Unit')} />
                            </div>
                        </div>
                    ))}
                    <SearchField value={q} onChange={setQ} label={tr('Add an ingredient')} placeholder={draft.parts.length ? tr('Add another ingredient') : tr('Add an ingredient')} />
                    {q.trim() && (
                        <div className="mt-2 flex flex-col">
                            {hits.map(h => (
                                <button
                                    type="button"
                                    key={h.entry.id}
                                    className="flex items-center gap-3 py-2 text-start text-sm text-[var(--text)] rounded-[var(--radius-md)] hover:bg-[var(--surface-hover)] -mx-2 px-2"
                                    onClick={() => addPart(h.entry.id, h.entry.name)}
                                >
                                    <Molecule id={h.entry.id} form={h.entry.form} size="xs" />
                                    <span className="min-w-0 flex-1">{nameOf(h.entry)}</span>
                                </button>
                            ))}
                            <button
                                type="button"
                                className="py-2 text-start text-sm text-[var(--text-muted)] rounded-[var(--radius-md)] hover:bg-[var(--surface-hover)] -mx-2 px-2"
                                onClick={() => addPart(q.trim(), q.trim())}
                            >
                                {tr('Add “{0}” as written', { 0: q.trim() })}
                            </button>
                        </div>
                    )}
                    <p className="mt-3 text-xs text-[var(--text-muted)]">
                        {tr('Each active ingredient and its amount are on the box or the leaflet. What’s in a product differs from one country to the next, so none comes filled in.')}
                    </p>
                </div>
                <div className="flex items-center gap-3 pt-1">
                    <button type="submit" className="btn-primary" disabled={!canSave}>
                        {tr('Save')}
                    </button>
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                            if (products.length) setDraft(null);
                            else onCancel();
                        }}
                    >
                        {tr('Cancel')}
                    </button>
                </div>
            </form>
        );
    }

    /* ── so many of one that's kept ── */
    const count = countText.trim() === '' ? null : num(countText);
    const countOk = count != null && Number.isFinite(count) && count > 0;
    const taken = product && countOk ? product.parts.map(p => ({ ...p, total: p.amount * count! })) : [];
    const apap = taken.find(p => p.substance === PARACETAMOL);
    const apapMine = apap ? convertAmount(apap.total, apap.unit, 'mg') : null;
    const apapTotal = apapMine != null ? paracetamolMg(data.ingestions, time).mg + apapMine : null;
    const mixIds = product ? product.parts.map(p => p.substance).filter(id => byId.has(id)) : [];

    return (
        <form
            className="flex flex-col gap-5"
            onSubmit={e => {
                e.preventDefault();
                if (!product || !countOk) return;
                const note = `${fmtAmount(count!)} × ${product.name}`;
                onLog(
                    taken.map(p => ({
                        substance: p.substance,
                        name: byId.get(p.substance)?.name ?? p.name,
                        route: 'Oral',
                        dose: Number(p.total.toPrecision(6)),
                        unit: p.unit,
                        estimate: false,
                        time,
                        note,
                    })),
                );
            }}
        >
            <div>
                <span className={label}>{tr('Product')}</span>
                <div className="flex flex-wrap gap-2">
                    {products.map(p => (
                        <button type="button" key={p.id} className={chip(chosen === p.id)} aria-pressed={chosen === p.id} onClick={() => setChosen(p.id)}>
                            {p.name}
                        </button>
                    ))}
                    <button type="button" className={chip(false)} onClick={() => setDraft({ id: newId(), name: '', per: 'tablet', parts: [] })}>
                        {tr('New product')}
                    </button>
                </div>
            </div>

            {product && (
                <>
                    <div>
                        <span className={label}>{tr('In one {0}', { 0: tr(product.per, undefined, 'per') })}</span>
                        <p className="text-sm text-[var(--text)]">{product.parts.map(p => `${partName(p)} ${amountText(p.amount, p.unit)}`).join(tr(', '))}</p>
                        <p className="mt-1.5 flex gap-4 text-xs">
                            <button
                                type="button"
                                className="link-button !text-[var(--text-muted)]"
                                onClick={() => setDraft({ id: product.id, name: product.name, per: product.per, parts: product.parts.map(p => ({ ...p, amount: String(p.amount) })) })}
                            >
                                {tr('Edit')}
                            </button>
                            <button
                                type="button"
                                className="link-button !text-[var(--text-muted)]"
                                onClick={() => {
                                    removeProduct(product.id);
                                    setChosen(null);
                                }}
                            >
                                {tr('Delete')}
                            </button>
                        </p>
                    </div>
                    <div>
                        <label className={label} htmlFor="product-count">
                            {tr('How many')}
                        </label>
                        <input
                            id="product-count"
                            className={`input-base w-full text-lg tabular-nums ${countText ? 'is-inked' : ''}`}
                            inputMode="decimal"
                            autoComplete="off"
                            value={countText}
                            onChange={e => setCountText(e.target.value)}
                            aria-invalid={countText.trim() !== '' && !countOk}
                        />
                        {taken.length > 0 && (
                            <div className="settings-section mt-3">
                                {taken.map(p => (
                                    <div key={p.substance} className="flex min-h-10 items-center justify-between gap-3 py-2 text-sm">
                                        {part(p, 'text-[var(--text)]')}
                                        <span className="tabular-nums font-medium text-[var(--text)]">{amountText(p.total, p.unit)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className={label} htmlFor="product-time">
                            {tr('Taken at')}
                        </label>
                        <div className="flex items-end gap-3">
                            <input
                                id="product-time"
                                type="datetime-local"
                                className="input-base flex-1 tabular-nums is-inked"
                                value={toLocalInput(time)}
                                onChange={e => {
                                    const t = new Date(e.target.value).getTime();
                                    if (Number.isFinite(t)) setTime(t);
                                }}
                            />
                            <button
                                type="button"
                                className="inline-flex h-8 items-center px-2.5 text-sm font-medium rounded-full text-[var(--accent-ink)] hover:bg-[var(--accent-subtle)]"
                                onClick={() => setTime(Date.now())}
                            >
                                {tr('Now')}
                            </button>
                        </div>
                    </div>

                    {apapTotal != null && (
                        <p className={`flex gap-2 text-sm leading-relaxed ${apapTotal > PARACETAMOL_DAY_MG ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`} role="status">
                            {apapTotal > PARACETAMOL_DAY_MG && <Alert size={16} className="mt-0.5 shrink-0" />}
                            <span>
                                {apapTotal > PARACETAMOL_DAY_MG
                                    ? tr('With this dose, {0} of paracetamol in 24 hours: more than the 4 g an adult should take. Too much can damage the liver: get medical advice now.', { 0: gramsText(apapTotal) })
                                    : tr('With this dose, {0} of paracetamol in 24 hours. The limit for an adult is 4 g.', { 0: gramsText(apapTotal) })}{' '}
                                <a href={PARACETAMOL_SOURCE.href} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-[3px]">
                                    {PARACETAMOL_SOURCE.name}
                                </a>
                            </span>
                        </p>
                    )}
                    {mixIds.length > 1 && (
                        <p className="text-xs text-[var(--text-muted)]">
                            <Link to={{ page: 'mix', ids: mixIds }} className="underline underline-offset-[3px]">
                                {tr('See how its ingredients mix')}
                            </Link>
                        </p>
                    )}
                </>
            )}

            <div className="flex items-center gap-3 pt-1">
                <button type="submit" className="btn-primary" disabled={!product || !countOk}>
                    {tr('Log it')}
                </button>
                <button type="button" className="btn-secondary" onClick={onCancel}>
                    {tr('Cancel')}
                </button>
            </div>
        </form>
    );
}
