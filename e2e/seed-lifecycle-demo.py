"""Seed a full-lifecycle demo project into the local Hangar dev DB.

Idempotent — safe to re-run. Creates, inside the e2e-workspace, a realistic
"Website Revamp" project that shows the whole app lifecycle end to end:

  Project -> default States -> Labels -> a Cycle (sprint) -> a Module (feature)
  -> Work items spread across every state group, with priorities, an assignee,
  labels, cycle/module links, sub-items and a couple of comments.

Run:
  docker exec -i project-management-setup-api-1 \
      python manage.py shell < e2e/seed-lifecycle-demo.py
"""

import os
from datetime import timedelta

from crum import impersonate
from django.utils import timezone

from plane.db.models import (
    Cycle,
    CycleIssue,
    Issue,
    IssueAssignee,
    IssueComment,
    IssueLabel,
    Label,
    Module,
    ModuleIssue,
    Project,
    ProjectMember,
    State,
    User,
    Workspace,
)

# Override the target workspace/user via env vars, e.g.
#   docker exec -e SEED_WORKSPACE_SLUG=maryam-workspace \
#     -e SEED_USER_EMAIL=maryam@autometa.dev -i <api> python manage.py shell < ...
WORKSPACE_SLUG = os.environ.get("SEED_WORKSPACE_SLUG", "e2e-workspace")
USER_EMAIL = os.environ.get("SEED_USER_EMAIL", "e2e-tester@hangar.test")

DEFAULT_STATES = [
    {"name": "Backlog", "color": "#A3A3A3", "sequence": 15000, "group": "backlog", "default": True},
    {"name": "Todo", "color": "#3A3A3A", "sequence": 25000, "group": "unstarted", "default": False},
    {"name": "In Progress", "color": "#F59E0B", "sequence": 35000, "group": "started", "default": False},
    {"name": "Done", "color": "#16A34A", "sequence": 45000, "group": "completed", "default": False},
    {"name": "Cancelled", "color": "#EF4444", "sequence": 55000, "group": "cancelled", "default": False},
]

user = User.objects.get(email=USER_EMAIL)
workspace = Workspace.objects.get(slug=WORKSPACE_SLUG)

with impersonate(user):
    # --- Project ------------------------------------------------------------
    project, created = Project.objects.get_or_create(
        workspace=workspace,
        identifier="WEB",
        defaults={"name": "Website Revamp", "project_lead": user},
    )
    print(f"{'created' if created else 'reusing'} project: {project.name} ({project.identifier})")

    # These feature tabs default to OFF on a new project, which hides Cycles /
    # Modules / Views in the UI even when the data exists. Turn them on.
    if not (project.cycle_view and project.module_view and project.issue_views_view and project.page_view):
        project.cycle_view = project.module_view = project.issue_views_view = project.page_view = True
        project.save(update_fields=["cycle_view", "module_view", "issue_views_view", "page_view"])
        print("enabled cycle/module/views/page features")

    ProjectMember.objects.get_or_create(
        project=project, member=user, defaults={"role": 20, "is_active": True}
    )

    # --- States (only if the project has none yet) --------------------------
    if not State.objects.filter(project=project).exists():
        State.objects.bulk_create(
            [
                State(
                    name=s["name"], color=s["color"], project=project, workspace=workspace,
                    sequence=s["sequence"], group=s["group"], default=s["default"], created_by=user,
                )
                for s in DEFAULT_STATES
            ]
        )
        print("created default states")
    states = {s.group: s for s in State.objects.filter(project=project)}

    # --- Labels -------------------------------------------------------------
    label_names = ["Frontend", "Backend", "Design", "Bug"]
    labels = {}
    for name in label_names:
        labels[name], _ = Label.objects.get_or_create(
            project=project, workspace=workspace, name=name, defaults={"color": "#6366F1"}
        )
    print(f"labels: {', '.join(labels)}")

    # --- Cycle (sprint) -----------------------------------------------------
    now = timezone.now()
    cycle, _ = Cycle.objects.get_or_create(
        project=project, name="Sprint 1",
        defaults={"start_date": now, "end_date": now + timedelta(days=14), "owned_by": user},
    )
    print(f"cycle: {cycle.name}")

    # --- Module (feature) ---------------------------------------------------
    module, _ = Module.objects.get_or_create(
        project=project, name="Checkout Redesign",
        defaults={"lead": user, "start_date": now.date(), "target_date": (now + timedelta(days=21)).date()},
    )
    print(f"module: {module.name}")

    # --- Work items across the lifecycle ------------------------------------
    # (title, state group, priority, labels, in_cycle, in_module)
    items = [
        ("Audit current site & gather requirements", "completed", "high", ["Design"], True, False),
        ("Design new landing page mockups", "completed", "medium", ["Design"], True, True),
        ("Build responsive navbar component", "started", "high", ["Frontend"], True, True),
        ("Implement checkout API endpoints", "started", "urgent", ["Backend"], True, True),
        ("Fix cart total rounding bug", "unstarted", "urgent", ["Bug", "Frontend"], True, False),
        ("Write product-page copy", "unstarted", "low", [], False, False),
        ("Set up analytics & conversion tracking", "backlog", "medium", ["Backend"], False, False),
        ("Explore dark-mode theme", "backlog", "low", ["Design"], False, False),
        ("Deprecated: old payment gateway", "cancelled", "none", ["Backend"], False, False),
    ]

    created_issues = []
    for title, group, priority, item_labels, in_cycle, in_module in items:
        issue, was_new = Issue.objects.get_or_create(
            project=project, name=title,
            defaults={"state": states[group], "priority": priority},
        )
        # keep state/priority in sync on re-run too
        if issue.state_id != states[group].id or issue.priority != priority:
            issue.state = states[group]
            issue.priority = priority
            issue.save()

        IssueAssignee.objects.get_or_create(issue=issue, assignee=user, project=project)
        for lname in item_labels:
            IssueLabel.objects.get_or_create(issue=issue, label=labels[lname], project=project)
        if in_cycle:
            CycleIssue.objects.get_or_create(issue=issue, cycle=cycle, project=project)
        if in_module:
            ModuleIssue.objects.get_or_create(issue=issue, module=module, project=project)

        created_issues.append(issue)
        print(f"  {'+' if was_new else '=' } {issue.project.identifier}-{issue.sequence_id}  [{group}]  {title}")

    # --- A parent/sub-item relationship -------------------------------------
    parent = created_issues[3]  # "Implement checkout API endpoints"
    sub, _ = Issue.objects.get_or_create(
        project=project, name="Add /checkout/validate endpoint",
        defaults={"state": states["started"], "priority": "high", "parent": parent},
    )
    if sub.parent_id != parent.id:
        sub.parent = parent
        sub.save()
    IssueAssignee.objects.get_or_create(issue=sub, assignee=user, project=project)
    print(f"  sub-item of {parent.project.identifier}-{parent.sequence_id}: {sub.name}")

    # --- Comments -----------------------------------------------------------
    for issue, html in [
        (created_issues[2], "<p>Navbar is mid-build — mobile breakpoint pending review.</p>"),
        (created_issues[4], "<p>Repro: add 3 items at $9.99, total shows $29.96 instead of $29.97.</p>"),
    ]:
        IssueComment.objects.get_or_create(
            issue=issue, project=project, actor=user, comment_html=html,
            defaults={"access": "INTERNAL"},
        )
    print("comments added")

    total = Issue.objects.filter(project=project).count()
    print(f"\nDONE. Project '{project.name}' has {total} work items.")
    print(f"View: http://localhost:3000/{WORKSPACE_SLUG}/projects/{project.id}/issues/")
