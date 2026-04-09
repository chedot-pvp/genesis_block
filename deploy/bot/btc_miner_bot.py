#!/usr/bin/env python3
"""Polling bot for @btc_miner_history_bot: menu button + /start → Web App (game5)."""
import json
import logging
import os
import sys
import time
from pathlib import Path

import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# deploy/.env (parent of bot/)
ENV_FILE = str(Path(__file__).resolve().parent.parent / ".env")


def load_env_file(path: str) -> None:
    if not os.path.isfile(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


load_env_file(ENV_FILE)

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
MINIAPP_URL = os.environ.get("GENESIS_MINIAPP_URL", "https://game5.chedot.com/").strip()
API = f"https://api.telegram.org/bot{TOKEN}"


def tg_api(method: str, data: dict, timeout: int = 45) -> dict:
    r = requests.post(f"{API}/{method}", json=data, timeout=timeout)
    r.raise_for_status()
    return r.json()


def set_menu_button():
    try:
        ok = tg_api(
            "setChatMenuButton",
            {
                "menu_button": {
                    "type": "web_app",
                    "text": "Play",
                    "web_app": {"url": MINIAPP_URL},
                }
            },
            timeout=20,
        )
        if ok.get("ok"):
            log.info("Menu button → %s", MINIAPP_URL)
        else:
            log.warning("setChatMenuButton: %s", ok)
    except Exception as e:
        log.warning("set_menu_button skipped: %s", e)


def send_start(chat_id: int):
    text = (
        "👋 Добро пожаловать!\n\n"
        "Откройте мини-приложение кнопкой ниже."
    )
    markup = {"inline_keyboard": [[{"text": "🎮 Играть", "web_app": {"url": MINIAPP_URL}}]]}
    try:
        tg_api(
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": text,
                "reply_markup": json.dumps(markup),
            },
            timeout=25,
        )
    except Exception:
        log.exception("sendMessage failed chat_id=%s", chat_id)


def main():
    if not TOKEN:
        log.error("TELEGRAM_BOT_TOKEN пустой — %s", ENV_FILE)
        sys.exit(1)
    log.info("btc_miner_history_bot → %s", MINIAPP_URL)
    set_menu_button()
    offset = 0
    log.info("Polling /start…")
    while True:
        try:
            resp = tg_api("getUpdates", {"offset": offset, "timeout": 30}, timeout=50)
            if not resp.get("ok"):
                continue
            for upd in resp.get("result", []):
                offset = upd["update_id"] + 1
                msg = upd.get("message") or upd.get("edited_message")
                if not msg:
                    continue
                t = (msg.get("text") or "").strip()
                if t == "/start" or t.lower().startswith("/start "):
                    send_start(msg["chat"]["id"])
        except Exception:
            log.exception("poll loop")
            time.sleep(5)


if __name__ == "__main__":
    main()
