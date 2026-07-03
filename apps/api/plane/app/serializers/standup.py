# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third Party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import Issue, StandupUpdate, StandupTask


class StandupTaskSerializer(BaseSerializer):
    issue_detail = serializers.SerializerMethodField()

    class Meta:
        model = StandupTask
        fields = [
            "id",
            "issue",
            "issue_detail",
            "worked_yesterday",
            "working_today",
        ]

    def get_issue_detail(self, obj):
        issue = obj.issue
        state = issue.state
        return {
            "id": str(issue.id),
            "name": issue.name,
            "sequence_id": issue.sequence_id,
            "project_id": str(issue.project_id),
            "priority": issue.priority,
            "state_id": str(issue.state_id) if issue.state_id else None,
            "state_name": state.name if state else None,
            "state_group": state.group if state else None,
        }


class StandupUpdateSerializer(BaseSerializer):
    tasks = StandupTaskSerializer(many=True, read_only=True)
    member_detail = serializers.SerializerMethodField()
    # write-only payload: [{issue, worked_yesterday, working_today}, ...]
    task_items = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)

    class Meta:
        model = StandupUpdate
        fields = [
            "id",
            "member",
            "member_detail",
            "date",
            "blockers",
            "tasks",
            "task_items",
            "project",
            "workspace",
            "created_at",
            "updated_at",
        ]

    def get_member_detail(self, obj):
        member = obj.member
        return {
            "id": str(member.id),
            "first_name": member.first_name,
            "last_name": member.last_name,
            "display_name": member.display_name,
            "avatar_url": member.avatar_url,
            "email": member.email,
        }
        read_only_fields = [
            "id",
            "member",
            "project",
            "workspace",
            "created_at",
            "updated_at",
        ]

    def _sync_tasks(self, standup, task_items):
        # Replace the standup's task rows with the incoming set.
        standup.tasks.all().delete()
        rows = []
        for item in task_items:
            issue_id = item.get("issue")
            if not issue_id:
                continue
            rows.append(
                StandupTask(
                    standup=standup,
                    project_id=standup.project_id,
                    workspace_id=standup.workspace_id,
                    issue_id=issue_id,
                    worked_yesterday=bool(item.get("worked_yesterday", False)),
                    working_today=bool(item.get("working_today", True)),
                )
            )
        if rows:
            StandupTask.objects.bulk_create(rows)

    def update(self, instance, validated_data):
        task_items = validated_data.pop("task_items", None)
        standup = super().update(instance, validated_data)
        if task_items is not None:
            self._sync_tasks(standup, task_items)
        return standup
