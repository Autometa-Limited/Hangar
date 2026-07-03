# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Branding guard for the OpenAPI / API-reference metadata.

The drf-spectacular ``SPECTACULAR_SETTINGS`` drive the public Swagger/Redoc docs
(title, contact, license, servers). After the Hangar rebrand none of these may
advertise the upstream Plane product or its owned domains.
"""

import json
import re

import pytest

from plane.settings.openapi import SPECTACULAR_SETTINGS

# Plane product name and owned domains that must not surface in the API docs.
FORBIDDEN = re.compile(r"\bPlane\b|plane\.so|plane\.sh|makeplane", re.IGNORECASE)


@pytest.mark.unit
class TestOpenAPIBranding:
    def test_title_is_hangar(self):
        assert "Hangar" in SPECTACULAR_SETTINGS["TITLE"]
        assert not FORBIDDEN.search(SPECTACULAR_SETTINGS["TITLE"])

    def test_contact_and_license_are_not_plane(self):
        contact = SPECTACULAR_SETTINGS["CONTACT"]
        assert contact["name"] == "Hangar"
        assert not FORBIDDEN.search(json.dumps(contact))
        assert not FORBIDDEN.search(SPECTACULAR_SETTINGS["LICENSE"]["url"])

    def test_no_plane_owned_server_urls(self):
        for server in SPECTACULAR_SETTINGS["SERVERS"]:
            assert not FORBIDDEN.search(server["url"]), server

    def test_whole_metadata_has_no_plane_branding(self):
        # Tag descriptions are product-neutral; guard the branding-bearing keys.
        branded = {k: SPECTACULAR_SETTINGS[k] for k in ("TITLE", "DESCRIPTION", "CONTACT", "LICENSE", "SERVERS")}
        hits = sorted(set(FORBIDDEN.findall(json.dumps(branded))))
        assert not hits, f"Plane branding still present in API-docs metadata: {hits}"
