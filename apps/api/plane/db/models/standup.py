# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.conf import settings
from django.db import models
from django.db.models import Q

# Module imports
from .project import ProjectBaseModel


class StandupUpdate(ProjectBaseModel):
    """A team member's daily standup entry inside a project.

    One entry per (member, project, date). The tasks the member worked on /
    is working on are stored as StandupTask rows, each carrying the
    "worked yesterday" / "working today" flags shown in the standup card.
    """

    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="standup_updates",
    )
    date = models.DateField(verbose_name="Standup Date")
    blockers = models.TextField(verbose_name="Blockers", blank=True, default="")

    class Meta:
        unique_together = ["member", "project", "date", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["member", "project", "date"],
                condition=Q(deleted_at__isnull=True),
                name="standup_unique_member_project_date_when_deleted_at_null",
            )
        ]
        verbose_name = "Standup Update"
        verbose_name_plural = "Standup Updates"
        db_table = "standup_updates"
        ordering = ("-date",)

    def __str__(self):
        return f"{self.member} {self.date}"


class StandupTask(ProjectBaseModel):
    """A single work item attached to a standup, with its per-task flags."""

    standup = models.ForeignKey(
        "db.StandupUpdate",
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    issue = models.ForeignKey(
        "db.Issue",
        on_delete=models.CASCADE,
        related_name="standup_tasks",
    )
    worked_yesterday = models.BooleanField(default=False)
    working_today = models.BooleanField(default=True)

    class Meta:
        unique_together = ["standup", "issue", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["standup", "issue"],
                condition=Q(deleted_at__isnull=True),
                name="standup_task_unique_standup_issue_when_deleted_at_null",
            )
        ]
        verbose_name = "Standup Task"
        verbose_name_plural = "Standup Tasks"
        db_table = "standup_tasks"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.standup} {self.issue_id}"
