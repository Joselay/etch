import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/tauri";

const PAGE_SIZE = 200;

export function useCommitLog(
  path: string | null,
  query: string | null = null,
  allBranches = false,
) {
  const trimmed = query?.trim() ? query.trim() : null;
  const q = useInfiniteQuery({
    queryKey: ["commit-log", path, PAGE_SIZE, trimmed, allBranches],
    enabled: !!path,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.commitLog(path as string, PAGE_SIZE, pageParam, trimmed, allBranches),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.reduce((n, p) => n + p.length, 0),
    placeholderData: (prev) => prev,
  });

  const data = useMemo(() => q.data?.pages.flat(), [q.data]);

  return {
    data,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    error: q.error,
    hasNextPage: q.hasNextPage,
    isFetchingNextPage: q.isFetchingNextPage,
    fetchNextPage: q.fetchNextPage,
  };
}
