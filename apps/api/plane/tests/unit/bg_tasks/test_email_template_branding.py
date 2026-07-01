# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Branding guard for transactional email *template bodies*.

The subject-line guard lives in test_email_branding.py; this one walks the email
HTML templates themselves and fails if any upstream Plane property URL has crept
back in (forum/site/socials). Resolves the templates dir via Django's loader so
it tracks however templates are actually configured.
"""

import pathlib
import re

import pytest
from django.template.loader import get_template

# Plane-owned URLs that must not appear in Hangar emails. Anchored on the dot so
# the word "Planet" (e.g. "Planet Earth") is not a false positive.
FORBIDDEN = re.compile(r"plane\.so|plane\.sh|makeplane|planepowers", re.IGNORECASE)


def _emails_dir() -> pathlib.Path:
    """Absolute path to templates/emails, via a known template's origin."""
    known = get_template("emails/auth/forgot_password.html")
    # .../emails/auth/forgot_password.html -> .../emails
    return pathlib.Path(known.origin.name).parent.parent


@pytest.mark.unit
class TestEmailTemplateBranding:
    def test_no_plane_property_urls_in_email_templates(self):
        emails = _emails_dir()
        files = sorted(emails.rglob("*.html"))
        assert files, f"no email templates found under {emails}"

        offenders = {}
        for f in files:
            hits = sorted(set(FORBIDDEN.findall(f.read_text(encoding="utf-8"))))
            if hits:
                offenders[str(f.relative_to(emails))] = hits

        assert not offenders, f"Plane property URLs still present in email templates: {offenders}"
