"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { projectSocketUrl } from "@/lib/api";
import { queryKeys } from "@/hooks/use-gantt-mutations";

export function useProjectRealtime(projectId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId || typeof window === "undefined") return;
    const socket = new WebSocket(projectSocketUrl(projectId));

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type?.startsWith("TASK_")) {
          queryClient.invalidateQueries({ queryKey: queryKeys.gantt(projectId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.projects });
          queryClient.invalidateQueries({ queryKey: ["project-analysis", projectId] });
        }
      } catch {
        // Ignore malformed dev messages.
      }
    };

    return () => socket.close();
  }, [projectId, queryClient]);
}
