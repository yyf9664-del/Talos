"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API, queryKeys } from "@/lib/constants";
import type {
  DailyReview,
  DailyReviewGenerateRequest,
  DailyReviewListItem,
} from "@/types/daily-review";

export function useDailyReviews() {
  return useQuery({
    queryKey: queryKeys.dailyReviews.all,
    queryFn: () => api.get<DailyReviewListItem[]>(API.DAILY_REVIEWS.LIST),
  });
}

export function useDailyReview(id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.dailyReviews.detail(id) : ["dailyReviews", "empty"],
    queryFn: () => api.get<DailyReview>(API.DAILY_REVIEWS.DETAIL(id as string)),
    enabled: !!id,
  });
}

export function useGenerateDailyReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DailyReviewGenerateRequest) =>
      api.post<DailyReview>(API.DAILY_REVIEWS.GENERATE, data, {
        timeoutMs: 300_000,
      }),
    onSuccess: (review) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyReviews.all });
      queryClient.setQueryData(queryKeys.dailyReviews.detail(review.id), review);
    },
  });
}

export function useDeleteDailyReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean }>(API.DAILY_REVIEWS.DELETE(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyReviews.all });
    },
  });
}
