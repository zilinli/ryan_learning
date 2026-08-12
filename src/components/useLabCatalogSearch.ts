"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ListSource = "loading" | "live" | "curated-fallback";

type LabSearchOpts<T> = {
  apiPath: string;
  resultKey: "clips" | "videos" | "articles";
  localSearch: (query: string, topic?: string) => T[];
  topic: string;
  grade?: number | null;
};

export function useLabCatalogSearch<T>({
  apiPath,
  resultKey,
  localSearch,
  topic,
  grade,
}: LabSearchOpts<T>) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<T[]>(() => localSearch("", undefined).slice(0, 18));
  const [listBusy, setListBusy] = useState(false);
  const [listSource, setListSource] = useState<ListSource>("curated-fallback");
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [nbPages, setNbPages] = useState(() => Math.max(1, Math.ceil(localSearch("", undefined).length / 18)));
  const [nbHits, setNbHits] = useState(() => localSearch("", undefined).length);
  const [hasNextPage, setHasNextPage] = useState(() => localSearch("", undefined).length > 18);
  const [cursor, setCursor] = useState<string | null>(null);

  const searchAbortRef = useRef<AbortController | null>(null);
  const searchGenRef = useRef(0);
  const skipDebouncedSearchRef = useRef(false);
  const mountedRef = useRef(false);

  const runSearch = useCallback(
    async (opts?: { page?: number; append?: boolean }) => {
      const nextPage = opts?.page ?? 0;
      const append = opts?.append === true;
      searchAbortRef.current?.abort();
      const ac = new AbortController();
      searchAbortRef.current = ac;
      const gen = ++searchGenRef.current;
      setListBusy(true);
      if (!append) setListSource("loading");
      try {
        const params = new URLSearchParams({
          mode: "search",
          q: query.trim(),
          topic,
          page: String(nextPage),
          pageSize: "18",
        });
        if (typeof grade === "number" && Number.isFinite(grade)) {
          params.set("grade", String(grade));
        }
        const res = await fetch(`${apiPath}?${params}`, { signal: ac.signal });
        const data = (await res.json()) as Record<string, unknown> & {
          ok?: boolean;
          source?: string;
          error?: string;
        };
        if (gen !== searchGenRef.current) return;
        const batch = data[resultKey] as T[] | undefined;
        if (!res.ok || !data.ok || !batch) {
          throw new Error(String(data.error || "Search failed"));
        }
        setItems((prev) => (append ? [...prev, ...batch] : batch));
        setPage(Number(data.page ?? nextPage));
        setNbPages(Math.max(1, Number(data.nbPages ?? 1)));
        setNbHits(Number(data.nbHits ?? batch.length));
        setListSource(
          data.source === "curated-fallback" ? "curated-fallback" : "live",
        );
        setCursor((data.cursor as string | null) ?? null);
        setHasNextPage(Boolean(data.hasNextPage));
        setError("");
      } catch (e) {
        if (ac.signal.aborted) return;
        if (gen !== searchGenRef.current) return;
        const local = localSearch(
          query,
          topic === "all" ? undefined : topic,
        );
        setItems(local.slice(0, 18));
        setPage(0);
        setNbPages(Math.max(1, Math.ceil(local.length / 18)));
        setNbHits(local.length);
        setListSource("curated-fallback");
        setHasNextPage(local.length > 18);
        setError(
          e instanceof Error
            ? `${e.message} — showing curated picks`
            : "Search unavailable — curated picks",
        );
      } finally {
        if (gen === searchGenRef.current) setListBusy(false);
      }
    },
    [apiPath, resultKey, query, topic, grade, localSearch],
  );

  const refreshBatch = useCallback(async () => {
    searchAbortRef.current?.abort();
    const ac = new AbortController();
    searchAbortRef.current = ac;
    const gen = ++searchGenRef.current;
    setListBusy(true);
    setListSource("loading");
    if (query.trim()) {
      skipDebouncedSearchRef.current = true;
      setQuery("");
    }
    try {
      const params = new URLSearchParams({
        mode: "refresh",
        topic,
        pageSize: "18",
      });
      if (typeof grade === "number" && Number.isFinite(grade)) {
        params.set("grade", String(grade));
      }
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`${apiPath}?${params}`, { signal: ac.signal });
      const data = (await res.json()) as Record<string, unknown> & {
        ok?: boolean;
        error?: string;
      };
      if (gen !== searchGenRef.current) return;
      const batch = data[resultKey] as T[] | undefined;
      if (!res.ok || !data.ok || !batch?.length) {
        throw new Error(String(data.error || "Refresh failed"));
      }
      setItems(batch);
      setPage(0);
      setNbPages(Number(data.hasNextPage) ? 2 : 1);
      setNbHits(batch.length);
      setCursor((data.cursor as string | null) ?? null);
      setHasNextPage(Boolean(data.hasNextPage));
      setListSource(
        data.source === "curated-fallback" ? "curated-fallback" : "live",
      );
      setError("");
    } catch (e) {
      if (ac.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Refresh failed");
      setListSource("curated-fallback");
    } finally {
      if (gen === searchGenRef.current) setListBusy(false);
    }
  }, [apiPath, resultKey, cursor, query, topic, grade]);

  useEffect(() => {
    if (skipDebouncedSearchRef.current) {
      skipDebouncedSearchRef.current = false;
      return;
    }
    // Skip auto-search on initial mount — items already populated from localSearch
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      void runSearch({ page: 0, append: false });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, topic, runSearch]);

  useEffect(() => {
    return () => searchAbortRef.current?.abort();
  }, []);

  return {
    query,
    setQuery,
    items,
    listBusy,
    listSource,
    error,
    page,
    nbPages,
    nbHits,
    hasNextPage,
    runSearch,
    refreshBatch,
  };
}
