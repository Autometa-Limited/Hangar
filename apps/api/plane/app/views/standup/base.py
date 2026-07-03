# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import allow_permission, ROLE
from plane.app.serializers import StandupUpdateSerializer
from plane.db.models import StandupUpdate
from .. import BaseAPIView


class StandupUpdateEndpoint(BaseAPIView):
    """Project-scoped daily standup.

    GET  -> all members' standup entries for a given date (default: today).
    POST -> create or update the current user's standup for a given date,
            with manually linked work items.
    """

    def _parse_date(self, request):
        date = request.query_params.get("date") or request.data.get("date")
        if not date:
            return timezone.now().date()
        return date

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="PROJECT")
    def get(self, request, slug, project_id):
        date = self._parse_date(request)
        standups = (
            StandupUpdate.objects.filter(
                workspace__slug=slug,
                project_id=project_id,
                date=date,
            )
            .select_related("member")
            .prefetch_related("tasks")
            .order_by("member__first_name")
        )
        serializer = StandupUpdateSerializer(standups, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="PROJECT")
    def post(self, request, slug, project_id):
        date = self._parse_date(request)

        standup, _ = StandupUpdate.objects.get_or_create(
            member=request.user,
            project_id=project_id,
            date=date,
        )

        serializer = StandupUpdateSerializer(standup, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
