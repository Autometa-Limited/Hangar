# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Branding guard for the default EMAIL_FROM sender.

Every outgoing Hangar email is sent ``from_email=EMAIL_FROM``. When a deployment
does not set the ``EMAIL_FROM`` env var / instance configuration, the fallback
default kicks in — this test makes sure that fallback is Hangar-branded and can
never regress to the upstream "Team Plane <…@plane.so>" sender.
"""

import os
from unittest.mock import patch

import pytest
from django.test import override_settings

from plane.license.utils.instance_value import get_email_configuration

# EMAIL_FROM is the last element of the configuration tuple.
_EMAIL_FROM_INDEX = 6


@pytest.mark.unit
class TestEmailFromBranding:
    def _from_default(self):
        """EMAIL_FROM as resolved when the env var is absent (env-var path)."""
        env = {k: v for k, v in os.environ.items() if k != "EMAIL_FROM"}
        with override_settings(SKIP_ENV_VAR=False), patch.dict(os.environ, env, clear=True):
            return get_email_configuration()[_EMAIL_FROM_INDEX]

    def test_default_email_from_is_hangar_branded(self):
        email_from = self._from_default()
        assert "Hangar" in email_from, f"EMAIL_FROM default is not branded: {email_from!r}"

    def test_default_email_from_has_no_plane_leak(self):
        email_from = self._from_default().lower()
        assert "plane" not in email_from, f"EMAIL_FROM default still leaks Plane: {email_from!r}"
        assert "plane.so" not in email_from
