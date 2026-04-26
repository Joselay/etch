import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/tauri";

const PAGE_SIZE = 300;

export function useReflog(path: string | null) {
  const q = useInfiniteQuery({
    queryKey: ["reflog", path, PAGE_SIZE],
    enabled: !!path,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.reflog(path as string, PAGE_SIZE, pageParam),
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
    refetch: q.refetch,
  };
}
