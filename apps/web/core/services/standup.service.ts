/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type TStandupIssueDetail = {
  id: string;
  name: string;
  sequence_id: number;
  project_id: string;
  priority: string;
  state_id: string | null;
  state_name: string | null;
  state_group: string | null;
};

export type TStandupTask = {
  id: string;
  issue: string;
  issue_detail: TStandupIssueDetail;
  worked_yesterday: boolean;
  working_today: boolean;
};

export type TStandupMemberDetail = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  avatar_url: string | null;
  email: string;
};

export type TStandupUpdate = {
  id: string;
  member: string;
  member_detail: TStandupMemberDetail;
  date: string;
  blockers: string;
  tasks: TStandupTask[];
  project: string;
  workspace: string;
  created_at: string;
  updated_at: string;
};

export type TStandupTaskInput = {
  issue: string;
  worked_yesterday: boolean;
  working_today: boolean;
};

export type TStandupSavePayload = {
  date?: string;
  blockers?: string;
  task_items?: TStandupTaskInput[];
};

export class StandupService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  /** All members' standup entries for a project on a given date (default: today). */
  async getStandups(workspaceSlug: string, projectId: string, date?: string): Promise<TStandupUpdate[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/standup/`, {
      params: date ? { date } : {},
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /** Create or update the current user's standup for the given date. */
  async saveStandup(workspaceSlug: string, projectId: string, data: TStandupSavePayload): Promise<TStandupUpdate> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/standup/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
