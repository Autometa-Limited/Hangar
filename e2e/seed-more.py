"""Add more modules, another cycle, and more views to the demo WEB project.

Idempotent. Same workspace/user overrides as the other seed scripts. Run:

  docker exec -e SEED_WORKSPACE_SLUG=maryam-workspace \
    -e SEED_USER_EMAIL=maryam@autometa.dev -i project-management-setup-api-1 \
    python manage.py shell < e2e/seed-more.py
"""

import os
from datetime import timedelta

from crum import impersonate
from django.utils import timezone

from plane.db.models import (
    Cycle,
    CycleIssue,
    Issue,
    IssueView,
    Label,
    Module,
    ModuleIssue,
    Project,
    User,
    Workspace,
)

WORKSPACE_SLUG = os.environ.get("SEED_WORKSPACE_SLUG", "e2e-workspace")
USER_EMAIL = os.environ.get("SEED_USER_EMAIL", "e2e-tester@hangar.test")
PROJECT_IDENTIFIER = os.environ.get("SEED_PROJECT_IDENTIFIER", "WEB")

user = User.objects.get(email=USER_EMAIL)
workspace = Workspace.objects.get(slug=WORKSPACE_SLUG)
project = Project.objects.get(workspace=workspace, identifier=PROJECT_IDENTIFIER)


def issue(name_startswith):
    return Issue.objects.filter(project=project, name__startswith=name_startswith).first()


DISPLAY = {
    "group_by": None, "order_by": "-created_at", "type": None, "sub_issue": True,
    "show_empty_groups": True, "layout": "list", "calendar_date_range": "",
}


def display(**overrides):
    return {**DISPLAY, **overrides}


with impersonate(user):
    now = timezone.now()

    # --- More modules (name, status, item-title-prefixes) -------------------
    modules = [
        ("Landing Page", "in-progress", ["Design new landing", "Write product-page"]),
        ("Analytics & Tracking", "planned", ["Set up analytics"]),
        ("Design System", "in-progress", ["Build responsive navbar", "Explore dark-mode"]),
    ]
    for name, status, item_prefixes in modules:
        module, was_new = Module.objects.get_or_create(
            project=project, name=name,
            defaults={"lead": user, "status": status,
                      "start_date": now.date(), "target_date": (now + timedelta(days=21)).date()},
        )
        if module.status != status:
            module.status = status
            module.save()
        linked = 0
        for prefix in item_prefixes:
            it = issue(prefix)
            if it:
                ModuleIssue.objects.get_or_create(module=module, issue=it, project=project)
                linked += 1
        print(f"  {'+' if was_new else '='} module: {name} [{status}] — {linked} items")

    # --- Another cycle (Sprint 2) for the backlog items ---------------------
    sprint2, was_new = Cycle.objects.get_or_create(
        project=project, name="Sprint 2",
        defaults={"start_date": now + timedelta(days=14), "end_date": now + timedelta(days=28), "owned_by": user},
    )
    for prefix in ["Set up analytics", "Explore dark-mode"]:
        it = issue(prefix)
        if it:
            CycleIssue.objects.get_or_create(cycle=sprint2, issue=it, project=project)
    print(f"  {'+' if was_new else '='} cycle: Sprint 2 — 2 items")

    # --- More views ---------------------------------------------------------
    fe = Label.objects.filter(project=project, name="Frontend").first()
    be = Label.objects.filter(project=project, name="Backend").first()
    views = [
        ("Backlog", "Not started yet", {"state_group": ["backlog"]}, display(layout="list")),
        ("Done", "Completed work", {"state_group": ["completed"]}, display(layout="list")),
        ("Frontend work", "Frontend-labelled items",
         {"labels": [str(fe.id)]} if fe else {}, display(layout="list")),
        ("Backend work", "Backend-labelled items",
         {"labels": [str(be.id)]} if be else {}, display(layout="list")),
        ("Timeline (Gantt)", "Everything on a timeline", {}, display(layout="gantt_chart")),
        ("Calendar", "Items by date", {}, display(layout="calendar")),
        ("All items (Spreadsheet)", "Full table view", {}, display(layout="spreadsheet")),
    ]
    for name, desc, filters, disp in views:
        view, was_new = IssueView.objects.get_or_create(
            workspace=workspace, project=project, name=name, owned_by=user,
            defaults={"description": desc, "filters": filters, "display_filters": disp, "access": 1},
        )
        if not was_new:
            view.filters, view.display_filters, view.description = filters, disp, desc
            view.save()
        print(f"  {'+' if was_new else '='} view: {name}")

    print(f"\nDONE on '{project.name}':")
    print(f"  Modules: {Module.objects.filter(project=project).count()}")
    print(f"  Cycles : {Cycle.objects.filter(project=project).count()}")
    print(f"  Views  : {IssueView.objects.filter(project=project).count()}")
    base = f"http://localhost:3000/{WORKSPACE_SLUG}/projects/{project.id}"
    print(f"  Modules: {base}/modules/")
    print(f"  Cycles : {base}/cycles/")
    print(f"  Views  : {base}/views/")
