"""Seed the local test user/workspace the Playwright authed tests expect.

Run it through the API container's Django shell:

    docker exec -i project-management-setup-api-1 \
        python manage.py shell < e2e/seed-test-user.py

Idempotent: re-running it just re-applies the same state. Credentials match
e2e/tests/fixtures.ts (override there via E2E_* env vars if you change them).
"""

from plane.db.models import Profile, User, Workspace, WorkspaceMember

EMAIL = "e2e-tester@hangar.test"
PASSWORD = "E2eTest!Pass2026"
WORKSPACE_SLUG = "e2e-workspace"
WORKSPACE_NAME = "E2E Workspace"

# --- User ---------------------------------------------------------------------
user, _ = User.objects.get_or_create(
    email=EMAIL,
    defaults={"username": EMAIL, "first_name": "E2E", "last_name": "Tester"},
)
user.set_password(PASSWORD)
user.is_password_autoset = False  # allow email/password sign-in
user.is_active = True
user.save()

# --- Workspace ----------------------------------------------------------------
workspace, _ = Workspace.objects.get_or_create(
    slug=WORKSPACE_SLUG,
    defaults={"name": WORKSPACE_NAME, "owner": user},
)

# --- Membership (role 20 == Admin) --------------------------------------------
WorkspaceMember.objects.get_or_create(
    workspace=workspace,
    member=user,
    defaults={"role": 20},
)

# --- Profile: mark onboarded so login lands on the workspace ------------------
profile, _ = Profile.objects.get_or_create(user=user)
profile.is_onboarded = True
profile.onboarding_step = {
    "profile_complete": True,
    "workspace_create": True,
    "workspace_invite": True,
    "workspace_join": True,
}
profile.last_workspace_id = workspace.id
profile.save()

print(f"Seeded {EMAIL} / workspace '{WORKSPACE_SLUG}' (admin, onboarded).")
