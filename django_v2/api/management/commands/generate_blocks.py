import time

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F

from api.models import Player, GameState, BlockHistory
from api.views import (
    MAX_SUPPLY_SATOSHI,
    calculate_epoch,
    calculate_block_reward,
)


def process_one_block() -> dict:
    state, _ = GameState.objects.get_or_create(singleton_key="singleton")
    if state.total_mined_satoshi >= MAX_SUPPLY_SATOSHI:
        return {"processed": False, "reason": "max_supply"}

    users = list(Player.objects.filter(is_active=True))
    if not users:
        return {"processed": False, "reason": "no_users"}

    total_power = sum(max(int(u.total_power * (u.speed_boost or 1.0)), 1) for u in users)
    if total_power <= 0:
        total_power = 1

    current_epoch = calculate_epoch(state.current_block_number)
    block_reward = calculate_block_reward(current_epoch)
    remaining = MAX_SUPPLY_SATOSHI - state.total_mined_satoshi
    if block_reward > remaining:
        block_reward = remaining

    total_distributed = 0
    with transaction.atomic():
        for user in users:
            effective_power = max(int(user.total_power * (user.speed_boost or 1.0)), 1)
            user_reward = int(block_reward * effective_power / total_power)
            if user_reward <= 0:
                continue
            total_distributed += user_reward
            user.balance_satoshi += user_reward
            user.last_block_processed = state.current_block_number + 1
            user.save(update_fields=["balance_satoshi", "last_block_processed", "updated_at"])

            if user.referrer_id:
                ref_bonus = int(user_reward * 0.03)
                if ref_bonus > 0:
                    Player.objects.filter(id=user.referrer_id).update(
                        balance_satoshi=F("balance_satoshi") + ref_bonus,
                        referral_earnings=F("referral_earnings") + ref_bonus,
                    )

        new_block = state.current_block_number + 1
        new_epoch = calculate_epoch(new_block)
        new_reward = calculate_block_reward(new_epoch)

        state.current_block_number = new_block
        state.current_epoch = new_epoch
        state.block_reward_satoshi = new_reward
        state.total_mined_satoshi += total_distributed
        state.total_network_power = total_power
        state.save()

        BlockHistory.objects.create(
            block_number=new_block,
            epoch=new_epoch,
            reward_satoshi=block_reward,
            total_distributed=total_distributed,
            network_power=total_power,
            participants=len(users),
        )

    return {"processed": True, "block": new_block, "distributed": total_distributed}


class Command(BaseCommand):
    help = "Generate game blocks periodically (Django v2 worker)."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Process exactly one block and exit.")
        parser.add_argument("--interval", type=int, default=30, help="Seconds between blocks.")

    def handle(self, *args, **options):
        interval = max(1, int(options["interval"]))
        if options["once"]:
            result = process_one_block()
            self.stdout.write(str(result))
            return

        self.stdout.write(f"Starting block generator loop (interval={interval}s)")
        while True:
            result = process_one_block()
            self.stdout.write(str(result))
            time.sleep(interval)
