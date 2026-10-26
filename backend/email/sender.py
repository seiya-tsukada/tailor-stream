"""メール送信（EMAIL_PROVIDER=console | resend で切り替える）"""

import logging
from dataclasses import dataclass
from typing import Protocol

import httpx

from backend.config import EMAIL_TIMEOUT_SECONDS, RESEND_API_URL, Settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    text: str


class EmailSender(Protocol):
    def send(self, message: EmailMessage) -> None: ...


class ConsoleEmailSender:
    """開発用: メールを送らずにログへ出す（本文のログインリンクをそのまま使える）"""

    def send(self, message: EmailMessage) -> None:
        logger.info(
            "[ConsoleEmailSender] to=%s subject=%s\n%s", message.to, message.subject, message.text
        )


class ResendEmailSender:
    """Resend の HTTP API で送る（SDK は使わない）"""

    def __init__(self, api_key: str, sender: str, client: httpx.Client) -> None:
        self._api_key = api_key
        self._sender = sender
        self._client = client

    def send(self, message: EmailMessage) -> None:
        response = self._client.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {self._api_key}"},
            json={
                "from": self._sender,
                "to": [message.to],
                "subject": message.subject,
                "text": message.text,
            },
            timeout=EMAIL_TIMEOUT_SECONDS,
        )
        response.raise_for_status()


def create_email_sender(settings: Settings, client: httpx.Client) -> EmailSender:
    if settings.email_provider == "resend":
        # Settings の検証で resend のときは両方そろっていることを保証している
        assert settings.resend_api_key is not None and settings.email_from is not None  # noqa: S101
        return ResendEmailSender(settings.resend_api_key, settings.email_from, client)
    return ConsoleEmailSender()
