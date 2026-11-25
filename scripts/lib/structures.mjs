// The drawings, kept as one small file per first letter of the substance's
// id (public/data/structures/a.json…), so a page loads only the letters it
// shows rather than three thousand drawings at once. src/components/Molecule.tsx
// reads them the same way.
import fs from 'node:fs/promises';
import path from 'node:path';

export const shardOf = id => (/^[a-z0-9]/.test(id) ? id[0] : '_');

export async function readStructures(root) {
    const dir = path.join(root, 'public/data/structures');
    const out = {};
    try {
        for (const f of await fs.readdir(dir)) if (f.endsWith('.json')) Object.assign(out, JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')));
    } catch {
        /* none yet */
    }
    // Before the shards: one file.
    try {
        const old = JSON.parse(await fs.readFile(path.join(root, 'public/data/structures.json'), 'utf8'));
        for (const [k, v] of Object.entries(old)) if (!(k in out)) out[k] = v;
    } catch {
        /* gone */
    }
    return out;
}

export async function writeStructures(root, all) {
    const dir = path.join(root, 'public/data/structures');
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    const shards = {};
    for (const [id, s] of Object.entries(all)) (shards[shardOf(id)] ??= {})[id] = s;
    for (const [k, v] of Object.entries(shards)) await fs.writeFile(path.join(dir, `${k}.json`), JSON.stringify(v));
    await fs.rm(path.join(root, 'public/data/structures.json'), { force: true });
}
