/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { CalendarDays, ChevronLeft, ChevronRight, ListChecks, Loader2, Plus, X } from "lucide-react";
// plane imports
import { BarChart } from "@plane/propel/charts/bar-chart";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { ISearchIssueResponse, TBarItem, TChartData } from "@plane/types";
import { Avatar } from "@plane/ui";
// components
import { ExistingIssuesListModal } from "@/components/core/modals/existing-issues-list-modal";
// hooks
import { useUser } from "@/hooks/store/user";
// services
import {
  StandupService,
  type TStandupTask,
  type TStandupUpdate,
} from "@/services/standup.service";

const standupService = new StandupService();

// A task in the current user's draft standup.
type TDraftTask = {
  issue: string;
  name: string;
  sequence_id: number | null;
  state_name: string | null;
  state_group: string | null;
  worked_yesterday: boolean;
  working_today: boolean;
};

const stateGroupClass = (group: string | null): string => {
  switch (group) {
    case "started":
      return "bg-[#3f76ff]/15 text-[#3f76ff]";
    case "completed":
      return "bg-green-500/15 text-green-600";
    case "cancelled":
      return "bg-red-500/15 text-red-600";
    case "unstarted":
      return "bg-amber-500/15 text-amber-600";
    default:
      return "bg-layer-1 text-tertiary";
  }
};

const todayISO = (): string => new Date().toISOString().slice(0, 10);

// add/subtract whole days to an ISO date string (YYYY-MM-DD), timezone-safe
const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const fullName = (m: TStandupUpdate["member_detail"]): string =>
  `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.display_name || m.email;

const fromTask = (t: TStandupTask): TDraftTask => ({
  issue: t.issue,
  name: t.issue_detail?.name ?? "Untitled",
  sequence_id: t.issue_detail?.sequence_id ?? null,
  state_name: t.issue_detail?.state_name ?? null,
  state_group: t.issue_detail?.state_group ?? null,
  worked_yesterday: t.worked_yesterday,
  working_today: t.working_today,
});

type Props = {
  workspaceSlug: string;
  projectId: string;
};

export const StandupView = observer(function StandupView({ workspaceSlug, projectId }: Props) {
  const { data: currentUser } = useUser();
  // state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [teamStandups, setTeamStandups] = useState<TStandupUpdate[]>([]);
  const [myTasks, setMyTasks] = useState<TDraftTask[]>([]);
  const [date, setDate] = useState<string>(todayISO());

  const isToday = date === todayISO();

  const loadStandups = useCallback(async () => {
    try {
      const data = await standupService.getStandups(workspaceSlug, projectId, date);
      setTeamStandups(data ?? []);
      const mine = (data ?? []).find((s) => s.member_detail?.id === currentUser?.id);
      setMyTasks(mine ? mine.tasks.map(fromTask) : []);
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: "Could not load standups." });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSlug, projectId, date, currentUser?.id]);

  useEffect(() => {
    void loadStandups();
  }, [loadStandups]);

  const addIssues = async (issues: ISearchIssueResponse[]) => {
    setMyTasks((prev) => {
      const existing = new Set(prev.map((t) => t.issue));
      const additions: TDraftTask[] = issues
        .filter((i) => !existing.has(i.id))
        .map((i) => ({
          issue: i.id,
          name: i.name,
          sequence_id: i.sequence_id,
          state_name: i.state__name ?? null,
          state_group: i.state__group ?? null,
          worked_yesterday: false,
          working_today: true,
        }));
      return [...prev, ...additions];
    });
  };

  const toggle = (issue: string, key: "worked_yesterday" | "working_today") =>
    setMyTasks((prev) => prev.map((t) => (t.issue === issue ? { ...t, [key]: !t[key] } : t)));

  const removeTask = (issue: string) => setMyTasks((prev) => prev.filter((t) => t.issue !== issue));

  const saveStandup = async () => {
    setIsSaving(true);
    try {
      await standupService.saveStandup(workspaceSlug, projectId, {
        date,
        task_items: myTasks.map((t) => ({
          issue: t.issue,
          worked_yesterday: t.worked_yesterday,
          working_today: t.working_today,
        })),
      });
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Saved", message: "Your standup has been saved." });
      await loadStandups();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: "Could not save your standup." });
    } finally {
      setIsSaving(false);
    }
  };

  // chart: how many tasks each member is working on today
  const chartData = useMemo<TChartData<"name", "count">[]>(
    () =>
      teamStandups
        .map((s) => ({
          name: fullName(s.member_detail).split(" ")[0] || "—",
          count: s.tasks.filter((t) => t.working_today).length,
        }))
        .filter((d) => d.count > 0),
    [teamStandups]
  );

  const bars = useMemo<TBarItem<string>[]>(
    () => [
      {
        key: "count",
        label: "Working today",
        stackId: "bar-one",
        fill: "#f97316",
        textClassName: "",
        showPercentage: false,
        showTopBorderRadius: () => true,
        showBottomBorderRadius: () => false,
      },
    ],
    []
  );

  const prettyDate = new Date(date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (isLoading)
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-tertiary" />
      </div>
    );

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-accent-primary" />
            <h2 className="text-lg font-semibold text-primary">Standup — {prettyDate}</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* date navigation */}
            <div className="flex items-center gap-1 rounded-md border border-subtle bg-surface-1 p-0.5">
              <button
                type="button"
                onClick={() => setDate((d) => addDays(d, -1))}
                className="grid size-6 place-items-center rounded text-secondary hover:bg-layer-1 hover:text-primary"
                title="Previous day"
              >
                <ChevronLeft className="size-4" />
              </button>
              <input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="bg-transparent px-1 text-12 text-primary outline-none"
              />
              <button
                type="button"
                onClick={() => setDate((d) => addDays(d, 1))}
                disabled={isToday}
                className="grid size-6 place-items-center rounded text-secondary hover:bg-layer-1 hover:text-primary disabled:opacity-40"
                title="Next day"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            {!isToday && (
              <Button variant="tertiary" size="sm" onClick={() => setDate(todayISO())}>
                Today
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={() => void saveStandup()} disabled={isSaving} loading={isSaving}>
              {isSaving ? "Saving…" : "Save standup"}
            </Button>
          </div>
        </div>

        {/* my update */}
        <div className="rounded-lg border border-subtle bg-surface-1">
          <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
            <span className="flex items-center gap-2 text-13 font-semibold text-primary">
              <ListChecks className="size-4" /> My tasks ({myTasks.length})
            </span>
            <Button variant="secondary" size="sm" prependIcon={<Plus className="size-4" />} onClick={() => setIsPickerOpen(true)}>
              Add tasks
            </Button>
          </div>

          <div className="divide-y divide-subtle">
            {myTasks.length === 0 && (
              <p className="px-4 py-6 text-center text-12 text-tertiary">
                No tasks yet. Click “Add tasks” to pick what you worked on and what you’ll do today.
              </p>
            )}
            {myTasks.map((t) => (
              <div key={t.issue} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-13 font-medium text-primary">
                      {t.sequence_id != null && <span className="text-tertiary">#{t.sequence_id} </span>}
                      {t.name}
                    </p>
                    {t.state_name && (
                      <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-10 font-medium ${stateGroupClass(t.state_group)}`}>
                        {t.state_name}
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={() => removeTask(t.issue)} className="text-tertiary hover:text-primary">
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-1.5 text-12 text-secondary">
                    <input type="checkbox" checked={t.worked_yesterday} onChange={() => toggle(t.issue, "worked_yesterday")} className="accent-accent-primary" />
                    Worked yesterday
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-12 text-secondary">
                    <input type="checkbox" checked={t.working_today} onChange={() => toggle(t.issue, "working_today")} className="accent-accent-primary" />
                    Working today
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* chart */}
        {chartData.length > 0 && (
          <div className="rounded-lg border border-subtle bg-surface-1 p-4">
            <p className="mb-3 text-13 font-semibold text-primary">
              {isToday ? "Who’s working on what today" : "Who worked on what this day"}
            </p>
            <BarChart
              className="h-[260px] w-full"
              data={chartData}
              bars={bars}
              margin={{ bottom: 20 }}
              xAxis={{ key: "name", label: "Member" }}
              yAxis={{ key: "count", label: "Tasks today" }}
            />
          </div>
        )}

        {/* team board */}
        <div className="rounded-lg border border-subtle bg-surface-1">
          <div className="border-b border-subtle px-4 py-3 text-13 font-semibold text-primary">
            Team standup — {isToday ? "today" : prettyDate} ({teamStandups.length})
          </div>
          <div className="divide-y divide-subtle">
            {teamStandups.length === 0 && (
              <p className="px-4 py-6 text-center text-12 text-tertiary">No one has posted a standup yet today.</p>
            )}
            {teamStandups.map((s) => (
              <div key={s.id} className="flex gap-3 px-4 py-3">
                <Avatar name={fullName(s.member_detail)} src={s.member_detail.avatar_url ?? undefined} />
                <div className="min-w-0 flex-1">
                  <p className="text-13 font-medium text-primary">{fullName(s.member_detail)}</p>
                  {s.tasks.length === 0 ? (
                    <p className="text-12 text-tertiary">No tasks listed.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {s.tasks.map((t) => (
                        <li key={t.id} className="flex items-center gap-2 text-12 text-secondary">
                          <span className={`inline-block size-1.5 rounded-full ${t.working_today ? "bg-green-500" : "bg-tertiary"}`} />
                          <span className="truncate">
                            {t.issue_detail?.sequence_id != null && <span className="text-tertiary">#{t.issue_detail.sequence_id} </span>}
                            {t.issue_detail?.name ?? "Untitled"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* task picker */}
      <ExistingIssuesListModal
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        isOpen={isPickerOpen}
        handleClose={() => setIsPickerOpen(false)}
        searchParams={{}}
        handleOnSubmit={addIssues}
      />
    </div>
  );
});
