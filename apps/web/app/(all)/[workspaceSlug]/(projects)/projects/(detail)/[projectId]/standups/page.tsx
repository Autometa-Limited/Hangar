/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// components
import { PageHead } from "@/components/core/page-title";
import { StandupView } from "@/components/standup/standup-view";
// hooks
import { useProject } from "@/hooks/store/use-project";
import type { Route } from "./+types/page";

function ProjectStandupsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const { getProjectById } = useProject();

  const project = getProjectById(projectId);
  const pageTitle = project?.name ? `${project?.name} - Standups` : undefined;

  return (
    <>
      <PageHead title={pageTitle} />
      <div className="flex h-full w-full flex-col">
        <StandupView workspaceSlug={workspaceSlug} projectId={projectId} />
      </div>
    </>
  );
}

export default observer(ProjectStandupsPage);
