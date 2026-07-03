"""Add Pages (docs) and Views (saved filters) to the demo WEB project.

Idempotent. Targets the same workspace/user as seed-lifecycle-demo.py (override
via SEED_WORKSPACE_SLUG / SEED_USER_EMAIL). Run:

  docker exec -e SEED_WORKSPACE_SLUG=maryam-workspace \
    -e SEED_USER_EMAIL=maryam@autometa.dev -i project-management-setup-api-1 \
    python manage.py shell < e2e/seed-pages-views.py
"""

import os

from crum import impersonate

from plane.db.models import IssueView, Label, Page, Project, ProjectPage, User, Workspace

WORKSPACE_SLUG = os.environ.get("SEED_WORKSPACE_SLUG", "e2e-workspace")
USER_EMAIL = os.environ.get("SEED_USER_EMAIL", "e2e-tester@hangar.test")
PROJECT_IDENTIFIER = os.environ.get("SEED_PROJECT_IDENTIFIER", "WEB")

user = User.objects.get(email=USER_EMAIL)
workspace = Workspace.objects.get(slug=WORKSPACE_SLUG)
project = Project.objects.get(workspace=workspace, identifier=PROJECT_IDENTIFIER)

DISPLAY = {
    "group_by": None,
    "order_by": "-created_at",
    "type": None,
    "sub_issue": True,
    "show_empty_groups": True,
    "layout": "list",
    "calendar_date_range": "",
}


def display(**overrides):
    return {**DISPLAY, **overrides}


with impersonate(user):
    bug = Label.objects.filter(project=project, name="Bug").first()
    uid = str(user.id)

    # --- Pages (docs) -------------------------------------------------------
    pages = [
        (
            "Product Requirements (PRD)",
            "<h1>Website Revamp — PRD</h1>"
            "<h2>Goal</h2><p>Rebuild the marketing site and checkout for a faster, "
            "modern experience.</p>"
            "<h2>Scope</h2><ul><li>New landing page</li><li>Responsive navbar</li>"
            "<li>Checkout redesign</li><li>Analytics</li></ul>"
            "<h2>Success metrics</h2><p>+15% conversion, &lt;2s page load.</p>",
        ),
        (
            "Design Spec",
            "<h1>Design Spec</h1><p>Colors, typography and component states.</p>"
            "<h2>Palette</h2><ul><li>Primary #6366F1</li><li>Success #16A34A</li>"
            "<li>Danger #EF4444</li></ul>",
        ),
        (
            "Meeting Notes — Kickoff",
            "<h1>Kickoff</h1><p><strong>Attendees:</strong> team.</p>"
            "<h2>Decisions</h2><ul><li>2-week sprints</li><li>Checkout is P0</li></ul>"
            "<h2>Action items</h2><ul><li>Finalize mockups</li><li>Spike checkout API</li></ul>",
        ),
        (
            "Release Checklist",
            "<h1>Release Checklist</h1><ul><li>[ ] All P0 items Done</li>"
            "<li>[ ] Analytics verified</li><li>[ ] Cross-browser QA</li>"
            "<li>[ ] Rollback plan</li></ul>",
        ),
    ]
    for name, html in pages:
        page, was_new = Page.objects.get_or_create(
            workspace=workspace, name=name, owned_by=user,
            defaults={"description_html": html, "access": 0},
        )
        ProjectPage.objects.get_or_create(project=project, page=page, workspace=workspace)
        print(f"  {'+' if was_new else '='} page: {name}")

    # --- Views (saved filters) ---------------------------------------------
    views = [
        ("My In-Progress", "Items assigned to me that are being worked on",
         {"state_group": ["started"], "assignees": [uid]}, display(layout="list")),
        ("Urgent & High priority", "Everything that needs attention first",
         {"priority": ["urgent", "high"]}, display(layout="spreadsheet", order_by="-priority")),
        ("Board by state", "Kanban across the whole workflow",
         {}, display(layout="kanban", group_by="state")),
        ("Bugs", "Open bugs in the project",
         {"labels": [str(bug.id)]} if bug else {}, display(layout="list")),
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

    print(f"\nDONE. Pages: {ProjectPage.objects.filter(project=project).count()}, "
          f"Views: {IssueView.objects.filter(project=project).count()} on '{project.name}'.")
    print(f"Pages : http://localhost:3000/{WORKSPACE_SLUG}/projects/{project.id}/pages/")
    print(f"Views : http://localhost:3000/{WORKSPACE_SLUG}/projects/{project.id}/views/")
