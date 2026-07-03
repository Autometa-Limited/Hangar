/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { MessagesSquare } from "lucide-react";
// ui
import { Breadcrumbs, Header } from "@plane/ui";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useAppRouter } from "@/hooks/use-app-router";
// plane web imports
import { CommonProjectBreadcrumbs } from "@/plane-web/components/breadcrumbs/common";

export const StandupsHeader = observer(function StandupsHeader() {
  const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();
  const { loader } = useProject();

  return (
    <Header>
      <Header.LeftItem>
        <div>
          <Breadcrumbs onBack={router.back} isLoading={loader === "init-loader"}>
            <CommonProjectBreadcrumbs workspaceSlug={workspaceSlug?.toString()} projectId={projectId?.toString()} />
            <Breadcrumbs.Item
              component={
                <BreadcrumbLink
                  label="Standups"
                  href={`/${workspaceSlug}/projects/${projectId}/standups/`}
                  icon={<MessagesSquare className="h-4 w-4 text-tertiary" />}
                  isLast
                />
              }
              isLast
            />
          </Breadcrumbs>
        </div>
      </Header.LeftItem>
    </Header>
  );
});
