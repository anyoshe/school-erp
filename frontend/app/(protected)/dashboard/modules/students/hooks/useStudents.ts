"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Student } from "../types/student";
import { studentService } from "../services/studentService";

const PAGE_SIZE = 50;

export function useStudents(initialSearch = "") {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const loadPage = useCallback(
    async (opts: {
      page: number;
      search: string;
      append: boolean;
      background?: boolean;
    }) => {
      const { page: p, search: q, append, background } = opts;
      if (background) setIsRefreshing(true);
      else if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setIsError(false);

      try {
        const data = await studentService.getPage({
          page: p,
          pageSize: PAGE_SIZE,
          search: q,
        });
        if (!mounted.current) return;
        setTotalCount(data.count);
        setHasMore(Boolean(data.next) || data.results.length >= PAGE_SIZE && (p * PAGE_SIZE) < data.count);
        setPage(p);
        setStudents((prev) => {
          if (!append) return data.results as Student[];
          const seen = new Set(prev.map((s) => s.id));
          const merged = [...prev];
          for (const row of data.results as Student[]) {
            if (!seen.has(row.id)) merged.push(row);
          }
          return merged;
        });
      } catch (err) {
        console.error("[useStudents] Failed to fetch students:", err);
        if (mounted.current) setIsError(true);
      } finally {
        if (mounted.current) {
          setIsLoading(false);
          setIsRefreshing(false);
          setIsLoadingMore(false);
        }
      }
    },
    []
  );

  // Initial + cache paint
  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const cached = await studentService.getCached?.();
        if (Array.isArray(cached) && cached.length > 0 && !search) {
          setStudents(cached as Student[]);
          setIsLoading(false);
          await loadPage({ page: 1, search: "", append: false, background: true });
          return;
        }
      } catch {
        /* ignore */
      }
      await loadPage({ page: 1, search: "", append: false });
    })();
    return () => {
      mounted.current = false;
    };
  }, [loadPage]);

  const setSearchDebounced = useCallback(
    (value: string) => {
      setSearch(value);
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
      searchDebounce.current = setTimeout(() => {
        void loadPage({ page: 1, search: value, append: false });
      }, 350);
    },
    [loadPage]
  );

  const loadMore = useCallback(() => {
    if (isLoadingMore || isLoading || !hasMore) return;
    void loadPage({ page: page + 1, search, append: true });
  }, [hasMore, isLoading, isLoadingMore, loadPage, page, search]);

  const refetch = useCallback(() => {
    return loadPage({
      page: 1,
      search,
      append: false,
      background: students.length > 0,
    });
  }, [loadPage, search, students.length]);

  return {
    students,
    isLoading,
    isRefreshing,
    isLoadingMore,
    isError,
    search,
    setSearch: setSearchDebounced,
    totalCount,
    hasMore,
    loadMore,
    refetch,
  };
}
