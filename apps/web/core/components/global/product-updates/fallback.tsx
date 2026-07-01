/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { EmptyStateDetailed } from "@plane/propel/empty-state";

type TProductUpdatesFallbackProps = {
  description: string;
  variant: "cloud" | "self-managed";
};

export function ProductUpdatesFallback(props: TProductUpdatesFallbackProps) {
  const { description } = props;

  // The "Go to changelog" action pointed at plane.so/changelog, which has no
  // Hangar equivalent, so it is omitted until Hangar hosts its own changelog.
  return (
    <div className="py-8">
      <EmptyStateDetailed assetKey="changelog" description={description} align="center" />
    </div>
  );
}
