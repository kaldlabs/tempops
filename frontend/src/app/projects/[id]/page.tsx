"use client";

import { use } from "react";
import GanttWorkspace from "@/components/gantt/GanttWorkspace";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectGanttPage({ params }: ProjectPageProps) {
  const { id } = use(params);
  return <GanttWorkspace projectId={id} />;
}
