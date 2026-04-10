import os
from typing import Dict

from django.core.management.base import BaseCommand
from django.db import transaction
from pymongo import MongoClient

from api.models import Player, Miner, PlayerMiner, GameState, Transaction


class Command(BaseCommand):
    help = "One-shot migration from MongoDB (FastAPI) to PostgreSQL (Django v2)."

    def handle(self, *args, **options):
        mongo_url = os.getenv("MONGO_URL")
        db_name = os.getenv("DB_NAME", "genesis_block")
        if not mongo_url:
            self.stderr.write("MONGO_URL is required")
            return

        client = MongoClient(mongo_url)
        db = client[db_name]

        users = list(db.users.find())
        miners = list(db.miners.find())
        user_miners = list(db.user_miners.find())
        txs = list(db.transactions.find())
        state = db.game_state.find_one({"id": "singleton"})

        self.stdout.write(f"Importing users={len(users)} miners={len(miners)} user_miners={len(user_miners)} txs={len(txs)}")

        player_by_legacy: Dict[str, Player] = {}
        miner_by_id: Dict[str, Miner] = {}

        with transaction.atomic():
            for m in miners:
                miner, _ = Miner.objects.update_or_create(
                    miner_id=m.get("id"),
                    defaults={
                        "name": m.get("name", ""),
                        "era": m.get("era", ""),
                        "power_hash_per_second": int(m.get("power_hash_per_second", 0)),
                        "price_satoshi": int(m.get("price_satoshi", 0)),
                        "unlock_block": int(m.get("unlock_block", 0)),
                        "historical_fact": m.get("historical_fact", "") or "",
                    },
                )
                miner_by_id[miner.miner_id] = miner

            for u in users:
                legacy_id = str(u.get("id", ""))
                player, _ = Player.objects.update_or_create(
                    telegram_id=int(u.get("telegram_id")),
                    defaults={
                        "legacy_id": legacy_id or None,
                        "username": u.get("username", "") or "",
                        "first_name": u.get("first_name", "") or "",
                        "photo_url": u.get("photo_url", "") or "",
                        "referral_code": u.get("referral_code", "") or legacy_id[:8],
                        "total_power": int(u.get("total_power", 1)),
                        "balance_satoshi": int(u.get("balance_satoshi", 0)),
                        "balance_stars": int(u.get("balance_stars", 0)),
                        "total_referrals": int(u.get("total_referrals", 0)),
                        "referral_earnings": int(u.get("referral_earnings", 0)),
                        "last_block_processed": int(u.get("last_block_processed", 0)),
                        "speed_boost": float(u.get("speed_boost", 1.0)),
                        "is_active": bool(u.get("is_active", True)),
                    },
                )
                if legacy_id:
                    player_by_legacy[legacy_id] = player

            # second pass for referrer links
            for u in users:
                legacy_id = str(u.get("id", ""))
                ref_legacy = str(u.get("referrer_id", "")) if u.get("referrer_id") else ""
                if not legacy_id or not ref_legacy:
                    continue
                player = player_by_legacy.get(legacy_id)
                referrer = player_by_legacy.get(ref_legacy)
                if player and referrer and player.referrer_id != referrer.id:
                    player.referrer = referrer
                    player.save(update_fields=["referrer", "updated_at"])

            for row in user_miners:
                p = player_by_legacy.get(str(row.get("user_id", "")))
                m = miner_by_id.get(str(row.get("miner_id", "")))
                if not p or not m:
                    continue
                PlayerMiner.objects.update_or_create(
                    player=p,
                    miner=m,
                    defaults={"quantity": int(row.get("quantity", 0))},
                )

            if state:
                gs, _ = GameState.objects.get_or_create(singleton_key="singleton")
                gs.current_block_number = int(state.get("current_block_number", 0))
                gs.total_mined_satoshi = int(state.get("total_mined_satoshi", 0))
                gs.current_epoch = int(state.get("current_epoch", 0))
                gs.block_reward_satoshi = int(state.get("block_reward_satoshi", 5_000_000_000))
                gs.total_network_power = int(state.get("total_network_power", 1))
                gs.save()

            Transaction.objects.all().delete()
            tx_create = []
            for t in txs:
                p = player_by_legacy.get(str(t.get("user_id", "")))
                if not p:
                    continue
                related = player_by_legacy.get(str(t.get("related_user_id", ""))) if t.get("related_user_id") else None
                tx_create.append(
                    Transaction(
                        player=p,
                        tx_type=t.get("type", "") or "",
                        amount_satoshi=int(t.get("amount_satoshi", 0)),
                        amount_stars=int(t.get("amount_stars", 0)),
                        related_player=related,
                        miner_ref=t.get("miner_id", "") or "",
                    )
                )
            if tx_create:
                Transaction.objects.bulk_create(tx_create, batch_size=1000)

        self.stdout.write("Mongo -> Postgres import complete")
