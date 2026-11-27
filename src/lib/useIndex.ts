import { useEffect, useMemo, useState } from 'react';
import { loadDetail, loadIndex, type Detail, type IndexEntry } from './data';
import { xunxunEntry } from './xunxun';

export function useIndex() {
  const [index, setIndex] = useState<IndexEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadIndex()
      .then((x) => live && setIndex(x))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);
  // 寻寻 is found by id (Saved, "Looked at lately") without being in the list.
  const byId = useMemo(() => new Map([...(index ?? []), xunxunEntry()].map((e) => [e.id, e])), [index]);
  return { index, byId, failed };
}

/** The pages of several substances, as they load: the ones that have. */
export function useDetails(ids: string[]): Record<string, Detail> {
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const key = ids.join('|');
  useEffect(() => {
    for (const id of ids)
      if (!details[id])
        loadDetail(id)
          .then((d) => setDetails((p) => (p[d.id] ? p : { ...p, [d.id]: d })))
          .catch(() => {});
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return details;
}

export function useDetail(id: string | null) {
  const [state, setState] = useState<{ id: string; detail?: Detail; failed?: boolean } | null>(null);
  useEffect(() => {
    if (!id) return;
    let live = true;
    setState({ id });
    loadDetail(id)
      .then((detail) => live && setState({ id, detail }))
      .catch(() => live && setState({ id, failed: true }));
    return () => {
      live = false;
    };
  }, [id]);
  if (!id || state?.id !== id) return { loading: Boolean(id) };
  return { detail: state.detail, failed: state.failed, loading: !state.detail && !state.failed };
}
