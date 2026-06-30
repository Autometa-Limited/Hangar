# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Branding guard for transactional email subjects.

After the Hangar rebrand, every user-facing email subject must read "Hangar"
and must never leak the upstream "Plane" name. These tests drive each email
task with the network (SMTP), templates, and ORM fully mocked, then assert on
the subject handed to ``EmailMultiAlternatives``. No DB or live SMTP needed.
"""

from unittest.mock import MagicMock, patch

import pytest

from plane.bgtasks.forgot_password_task import forgot_password
from plane.bgtasks.magic_link_code_task import magic_link
from plane.bgtasks.project_invitation_task import project_invitation
from plane.bgtasks.workspace_invitation_task import workspace_invitation

# A complete EMAIL_* tuple as get_email_configuration() would return it.
_EMAIL_CONFIG = (
    "smtp.example.com",  # EMAIL_HOST
    "user@example.com",  # EMAIL_HOST_USER
    "password",  # EMAIL_HOST_PASSWORD
    "587",  # EMAIL_PORT
    "1",  # EMAIL_USE_TLS
    "0",  # EMAIL_USE_SSL
    "no-reply@example.com",  # EMAIL_FROM
)


def _captured_subject(mock_email_cls):
    """Pull the ``subject`` kwarg out of the EmailMultiAlternatives call."""
    assert mock_email_cls.called, "no email was constructed — task bailed early"
    return mock_email_cls.call_args.kwargs["subject"]


def _assert_branded(subject):
    assert "Hangar" in subject, f"subject is not branded: {subject!r}"
    assert "Plane" not in subject, f"subject still leaks 'Plane': {subject!r}"


@pytest.mark.unit
class TestEmailSubjectBranding:
    """Each transactional email subject says Hangar, never Plane."""

    @patch("plane.bgtasks.forgot_password_task.EmailMultiAlternatives")
    @patch("plane.bgtasks.forgot_password_task.get_connection")
    @patch("plane.bgtasks.forgot_password_task.render_to_string", return_value="<p>hi</p>")
    @patch(
        "plane.bgtasks.forgot_password_task.get_email_configuration",
        return_value=_EMAIL_CONFIG,
    )
    def test_forgot_password_subject(self, _cfg, _tpl, _conn, mock_email):
        forgot_password("Ada", "ada@example.com", "uid", "tok", "http://localhost")
        subject = _captured_subject(mock_email)
        _assert_branded(subject)
        assert subject == "A new password to your Hangar account has been requested"

    @patch("plane.bgtasks.magic_link_code_task.EmailMultiAlternatives")
    @patch("plane.bgtasks.magic_link_code_task.get_connection")
    @patch("plane.bgtasks.magic_link_code_task.render_to_string", return_value="<p>hi</p>")
    @patch(
        "plane.bgtasks.magic_link_code_task.get_email_configuration",
        return_value=_EMAIL_CONFIG,
    )
    def test_magic_link_subject(self, _cfg, _tpl, _conn, mock_email):
        magic_link("ada@example.com", "key", "123456")
        subject = _captured_subject(mock_email)
        _assert_branded(subject)
        assert subject == "Your unique Hangar login code is 123456"

    @patch("plane.bgtasks.workspace_invitation_task.EmailMultiAlternatives")
    @patch("plane.bgtasks.workspace_invitation_task.get_connection")
    @patch("plane.bgtasks.workspace_invitation_task.render_to_string", return_value="<p>hi</p>")
    @patch(
        "plane.bgtasks.workspace_invitation_task.get_email_configuration",
        return_value=_EMAIL_CONFIG,
    )
    @patch("plane.bgtasks.workspace_invitation_task.WorkspaceMemberInvite")
    @patch("plane.bgtasks.workspace_invitation_task.Workspace")
    @patch("plane.bgtasks.workspace_invitation_task.User")
    def test_workspace_invitation_subject(
        self, mock_user, mock_workspace, mock_invite, _cfg, _tpl, _conn, mock_email
    ):
        mock_user.objects.get.return_value = MagicMock(
            first_name="Maryam", display_name="Maryam", email="m@example.com"
        )
        mock_workspace.objects.get.return_value = MagicMock(name="ws", slug="acme")
        mock_workspace.objects.get.return_value.name = "Acme"
        mock_invite.objects.get.return_value = MagicMock(id="inv-1")

        workspace_invitation("invitee@example.com", "ws-id", "tok", "http://localhost", "m@example.com")
        subject = _captured_subject(mock_email)
        _assert_branded(subject)
        assert subject == "Maryam has invited you to join them in Acme on Hangar"

    @patch("plane.bgtasks.project_invitation_task.EmailMultiAlternatives")
    @patch("plane.bgtasks.project_invitation_task.get_connection")
    @patch("plane.bgtasks.project_invitation_task.render_to_string", return_value="<p>hi</p>")
    @patch(
        "plane.bgtasks.project_invitation_task.get_email_configuration",
        return_value=_EMAIL_CONFIG,
    )
    @patch("plane.bgtasks.project_invitation_task.ProjectMemberInvite")
    @patch("plane.bgtasks.project_invitation_task.Project")
    @patch("plane.bgtasks.project_invitation_task.User")
    def test_project_invitation_subject(
        self, mock_user, mock_project, mock_invite, _cfg, _tpl, _conn, mock_email
    ):
        mock_user.objects.get.return_value = MagicMock(
            first_name="Maryam", display_name="Maryam", email="m@example.com"
        )
        project = MagicMock()
        project.name = "Apollo"
        project.workspace.slug = "acme"
        mock_project.objects.get.return_value = project
        mock_invite.objects.get.return_value = MagicMock(id="inv-1")

        project_invitation("invitee@example.com", "proj-id", "tok", "http://localhost", "m@example.com")
        subject = _captured_subject(mock_email)
        _assert_branded(subject)
        assert subject == "Maryam invited you to join Apollo on Hangar"
