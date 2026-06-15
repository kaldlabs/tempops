"use client";

import { useMemo } from "react";
import { daysBetween, formatDate, priorityLabel, statusLabel } from "@/lib/utils";
import type { Dependency, FlatTask, ProjectMLAnalysis, TaskPriority, TaskStatus } from "@/types";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from "recharts";

interface GanttAnalyticsPanelProps {
  tasks: FlatTask[];
  dependencies: Dependency[];
  analysis?: ProjectMLAnalysis;
  mode?: "analytics" | "dependencies";
  locale: "en" | "vi";
  onOpenTask?: (taskId: string) => void;
}

interface ChartTooltipEntry {
  name?: string;
  value?: string | number;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
}

const statusOrder: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE", "OVERDUE"];
const priorityOrder: TaskPriority[] = ["H", "M", "L"];

const STATUS_COLORS = {
  TODO: "var(--status-desaturated)",
  IN_PROGRESS: "var(--status-in-progress)",
  DONE: "var(--status-done)",
  OVERDUE: "var(--status-overdue)",
};

const PRIORITY_COLORS = {
  H: "var(--error)",
  M: "var(--tertiary)",
  L: "var(--status-desaturated)",
};

function weekKey(date: string) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split("T")[0];
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div style={{ background: "var(--surface-container-highest)", padding: "8px 12px", border: "1px solid var(--outline)", borderRadius: "var(--radius-sm)", color: "var(--on-surface)", boxShadow: "var(--shadow-md)" }}>
      <p style={{ margin: "0 0 4px 0", fontWeight: 600, fontSize: 13 }}>{label || payload[0].name}</p>
      {payload.map((entry, index) => (
        <div key={`${entry.name || "item"}-${index}`} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color }} />
          <span style={{ color: "var(--on-surface-variant)" }}>{entry.name}:</span>
          <span style={{ fontWeight: 600 }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function GanttAnalyticsPanel({
  tasks,
  dependencies,
  analysis,
  mode = "analytics",
  locale,
  onOpenTask,
}: GanttAnalyticsPanelProps) {
  const labels = {
    analytics: locale === "vi" ? "Phân tích dự án" : "Project Analytics",
    dependencies: locale === "vi" ? "Luồng phụ thuộc" : "Dependency Flow",
    workload: locale === "vi" ? "Tải nguồn lực" : "Workload",
    status: locale === "vi" ? "Trạng thái" : "Status",
    priority: locale === "vi" ? "Độ ưu tiên" : "Priority",
    timelineLoad: locale === "vi" ? "Khối lượng công việc theo tuần" : "Timeline Load",
    critical: locale === "vi" ? "Công việc cần chú ý" : "Critical Tasks",
    recommendations: locale === "vi" ? "Gợi ý tự động" : "Auto Recommendations",
    noDependencies: locale === "vi" ? "Chưa có liên kết phụ thuộc" : "No dependencies yet",
    noTasks: locale === "vi" ? "Chưa có công việc để phân tích" : "No tasks to analyze yet",
  };

  const statusData = useMemo(() => {
    return statusOrder.map(status => ({
      name: statusLabel(status),
      value: tasks.filter(t => t.status === status).length,
      color: STATUS_COLORS[status],
    })).filter(d => d.value > 0);
  }, [tasks]);

  const priorityData = useMemo(() => {
    return priorityOrder.map(priority => ({
      name: priorityLabel(priority),
      value: tasks.filter(t => t.priority === priority).length,
      color: PRIORITY_COLORS[priority],
    })).filter(d => d.value > 0);
  }, [tasks]);

  const workloadData = useMemo(() => {
    const map = tasks.reduce<Record<string, { name: string; open: number; overdue: number; done: number }>>((acc, task) => {
      const key = task.assignee_id || (locale === "vi" ? "Chưa giao" : "Unassigned");
      if (!acc[key]) acc[key] = { name: key, open: 0, overdue: 0, done: 0 };
      if (task.status === "DONE") acc[key].done += 1;
      else if (task.status === "OVERDUE") acc[key].overdue += 1;
      else acc[key].open += 1;
      return acc;
    }, {});
    return Object.values(map).sort((a, b) => (b.open + b.overdue + b.done) - (a.open + a.overdue + a.done)).slice(0, 8);
  }, [tasks, locale]);

  const timelineData = useMemo(() => {
    const buckets = tasks.reduce<Record<string, number>>((acc, task) => {
      const start = new Date(task.start_date);
      const end = new Date(task.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = weekKey(d.toISOString());
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {});
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, tasks]) => ({ week: formatDate(week).substring(0, 6), tasks }))
      .slice(0, 15); // Show up to 15 weeks
  }, [tasks]);

  const depScore = useMemo(() => {
    const map = new Map<string, number>();
    dependencies.forEach((dep) => {
      map.set(dep.predecessor_id, (map.get(dep.predecessor_id) || 0) + 2);
      map.set(dep.successor_id, (map.get(dep.successor_id) || 0) + 1);
    });
    return map;
  }, [dependencies]);

  const criticalTasks = useMemo(() => {
    return [...tasks]
      .filter((task) => task.status !== "DONE")
      .map((task) => ({
        task,
        score:
          daysBetween(task.start_date, task.end_date) +
          (depScore.get(task.id) || 0) +
          (task.priority === "H" ? 6 : task.priority === "M" ? 3 : 0) +
          (task.status === "OVERDUE" ? 10 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [tasks, depScore]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  if (!tasks.length) {
    return (
      <div className="gantt-analytics">
        <div className="empty-state empty-state--compact" style={{ height: "100%", minHeight: 400, borderRadius: "var(--radius-lg)" }}>
          <span className="empty-state__icon material-symbols-outlined">monitoring</span>
          <h3 className="empty-state__title">{labels.noTasks}</h3>
        </div>
      </div>
    );
  }

  if (mode === "dependencies") {
    return (
      <div className="gantt-analytics gantt-analytics--flow">
        <div className="gantt-analytics__header" style={{ padding: "0 20px" }}>
          <div>
            <h2>{labels.dependencies}</h2>
            <p style={{ opacity: 0.7 }}>
              {dependencies.length} {locale === "vi" ? "liên kết" : "links"} · {tasks.length} {locale === "vi" ? "công việc" : "tasks"}
            </p>
          </div>
        </div>

        {dependencies.length === 0 ? (
          <div className="empty-state empty-state--compact" style={{ minHeight: 400, borderRadius: "var(--radius-lg)" }}>
            <span className="empty-state__icon material-symbols-outlined">account_tree</span>
            <h3 className="empty-state__title">{labels.noDependencies}</h3>
          </div>
        ) : (
          <div className="dependency-flow" style={{ padding: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {dependencies.map((dep) => {
                const predecessor = taskById.get(dep.predecessor_id);
                const successor = taskById.get(dep.successor_id);
                if (!predecessor || !successor) return null;
                
                return (
                  <div key={dep.id} style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--surface-container)", padding: 16, borderRadius: "var(--radius-default)", border: "1px solid var(--outline-variant)" }}>
                    <div style={{ flex: 1, padding: 12, background: "var(--surface)", borderLeft: "4px solid var(--secondary)", borderRadius: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--on-surface)" }}>{predecessor.name}</div>
                      <div style={{ fontSize: 11, color: "var(--on-surface-variant)", marginTop: 4 }}>End: {formatDate(predecessor.end_date)}</div>
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 80 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--on-surface-variant)", textTransform: "uppercase", letterSpacing: 1 }}>{dep.dependency_type}</span>
                      <div style={{ width: "100%", height: 2, background: "var(--outline)", position: "relative" }}>
                        <div style={{ position: "absolute", right: -4, top: -3, width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "6px solid var(--outline)" }} />
                      </div>
                    </div>
                    
                    <div style={{ flex: 1, padding: 12, background: "var(--surface)", borderLeft: "4px solid var(--tertiary)", borderRadius: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--on-surface)" }}>{successor.name}</div>
                      <div style={{ fontSize: 11, color: "var(--on-surface-variant)", marginTop: 4 }}>Start: {formatDate(successor.start_date)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="gantt-analytics" style={{ padding: 24, overflowY: "auto", height: "100%" }}>
      <div className="gantt-analytics__header" style={{ marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, marginBottom: 4 }}>{labels.analytics}</h2>
          <p style={{ color: "var(--on-surface-variant)" }}>
            {tasks.length} {locale === "vi" ? "công việc" : "tasks"} · {dependencies.length} {locale === "vi" ? "liên kết phụ thuộc" : "dependencies"}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        
        {/* Status Pie Chart */}
        <div className="card" style={{ height: 320, display: "flex", flexDirection: "column" }}>
          <h3 className="card__title">{labels.status}</h3>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="var(--surface-container)">
                  {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "var(--on-surface-variant)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Pie Chart */}
        <div className="card" style={{ height: 320, display: "flex", flexDirection: "column" }}>
          <h3 className="card__title">{labels.priority}</h3>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={priorityData} cx="50%" cy="50%" innerRadius={0} outerRadius={80} dataKey="value" stroke="var(--surface-container)">
                  {priorityData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "var(--on-surface-variant)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Workload Bar Chart */}
        <div className="card" style={{ gridColumn: "1 / -1", height: 320, display: "flex", flexDirection: "column" }}>
          <h3 className="card__title">{labels.workload}</h3>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--on-surface-variant)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--on-surface-variant)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-container-highest)", opacity: 0.4 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar dataKey="open" name={locale === "vi" ? "Đang mở" : "Open"} stackId="a" fill="var(--outline-variant)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="overdue" name={locale === "vi" ? "Trễ hạn" : "Overdue"} stackId="a" fill="var(--error)" />
                <Bar dataKey="done" name={locale === "vi" ? "Hoàn tất" : "Done"} stackId="a" fill="var(--tertiary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Timeline Load Area Chart */}
        <div className="card" style={{ gridColumn: "1 / -1", height: 320, display: "flex", flexDirection: "column" }}>
          <h3 className="card__title">{labels.timelineLoad}</h3>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: "var(--on-surface-variant)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--on-surface-variant)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="tasks" name={locale === "vi" ? "Công việc đang hoạt động" : "Active Tasks"} stroke="var(--secondary)" strokeWidth={3} fillOpacity={1} fill="url(#colorTasks)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Critical Tasks & AI Insights side by side */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <h3 className="card__title">{labels.critical}</h3>
          <div className="critical-list" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {criticalTasks.map(({ task }) => (
              <button
                key={task.id}
                className="btn btn--ghost"
                type="button"
                onClick={() => onOpenTask?.(task.id)}
                style={{ textAlign: "left", display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--outline-variant)", borderRadius: "var(--radius-default)" }}
              >
                <span style={{ fontWeight: 500, color: "var(--on-surface)", fontSize: 13, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{task.name}</span>
                <small style={{ color: task.status === "OVERDUE" ? "var(--error)" : "var(--on-surface-variant)", fontWeight: 600, fontSize: 11 }}>
                  {task.status === "OVERDUE" ? "OVERDUE" : `${task.progress}%`}
                </small>
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <h3 className="card__title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--secondary)" }}>model_training</span>
            {labels.recommendations}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            {(analysis?.recommendations || []).slice(0, 4).map((item) => (
              <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 12, background: "color-mix(in srgb, var(--secondary) 10%, transparent)", borderRadius: "var(--radius-default)", border: "1px solid color-mix(in srgb, var(--secondary) 20%, transparent)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--secondary)", marginTop: 2 }}>lightbulb</span>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--on-surface)" }}>{item}</p>
              </div>
            ))}
            {!analysis?.recommendations?.length && (
              <div style={{ padding: 16, textAlign: "center", color: "var(--on-surface-variant)", fontSize: 13 }}>
                {locale === "vi" ? "Kế hoạch hiện ổn định, chưa phát hiện rủi ro nổi bật." : "Timeline is healthy, no risks detected by ML model."}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
