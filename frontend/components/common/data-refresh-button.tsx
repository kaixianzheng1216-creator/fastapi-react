"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  dataRefreshReadCurrentRefresh,
  dataRefreshStartDataRefresh,
  type RefreshSource,
} from "@/lib/client";

type DataRefreshButtonProps = {
  source: RefreshSource;
  queryKey: QueryKey;
  disabled?: boolean;
};

export function DataRefreshButton({
  source,
  queryKey,
  disabled = false,
}: DataRefreshButtonProps) {
  const queryClient = useQueryClient();
  const statusKey = ["data-refresh", source];
  const observedJob = useRef<string | null>(null);
  const handledJob = useRef<string | null>(null);

  const mutation = useMutation({
    onMutate: () => queryClient.cancelQueries({ queryKey: statusKey }),
    mutationFn: async () => {
      const { data } = await dataRefreshStartDataRefresh({
        path: { source },
        throwOnError: true,
      });

      return data;
    },
    onSuccess: (data) => {
      observedJob.current = data.job_id;
      queryClient.setQueryData(statusKey, { ...data, status: "pending" });
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "刷新请求失败，请重试")),
  });

  const statusQuery = useQuery({
    queryKey: statusKey,
    refetchOnMount: "always",
    queryFn: async ({ signal }) => {
      const { data } = await dataRefreshReadCurrentRefresh({
        path: { source },
        signal,
        throwOnError: true,
      });

      return data;
    },
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 2000 : false,
  });

  const job = statusQuery.data;

  useEffect(() => {
    if (!job?.job_id) return;

    if (job.status === "pending") {
      observedJob.current = job.job_id;
      return;
    }

    if (handledJob.current === job.job_id) return;
    handledJob.current = job.job_id;

    if (job.status === "succeeded") {
      void queryClient.invalidateQueries({ queryKey });
      if (observedJob.current === job.job_id) toast.success("数据已刷新");
    } else if (job.status === "failed" && observedJob.current === job.job_id) {
      toast.error("刷新失败，请稍后重试");
    }
  }, [job, queryClient, queryKey]);

  const busy = mutation.isPending || job?.status === "pending";
  const label = busy ? "刷新中…" : "刷新数据";

  return (
    <Button
      aria-label={label}
      disabled={disabled || busy || statusQuery.isPending}
      onClick={() => mutation.mutate()}
      aria-busy={busy}
      title={disabled ? "该平台暂未接入" : undefined}
    >
      <RefreshCwIcon
        data-icon="inline-start"
        aria-hidden="true"
        className={busy ? "animate-spin motion-reduce:animate-none" : undefined}
      />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
