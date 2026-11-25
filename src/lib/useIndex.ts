import { useEffect, useMemo, useState } from 'react';
import { loadDetail, loadIndex, type Detail, type IndexEntry } from './data';

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
  const byId = useMemo(() => new Map((index ?? []).map((e) => [e.id, e])), [index]);
  return { index, byId, failed };
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
