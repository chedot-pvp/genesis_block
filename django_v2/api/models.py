from django.db import models


class Player(models.Model):
    legacy_id = models.CharField(max_length=64, unique=True, null=True, blank=True, db_index=True)
    telegram_id = models.BigIntegerField(unique=True, db_index=True)
    username = models.CharField(max_length=128, blank=True, default="")
    first_name = models.CharField(max_length=128, blank=True, default="")
    photo_url = models.URLField(blank=True, default="")
    referral_code = models.CharField(max_length=16, unique=True, db_index=True)
    referrer = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="referrals")
    total_power = models.BigIntegerField(default=1)
    balance_satoshi = models.BigIntegerField(default=0)
    balance_stars = models.BigIntegerField(default=0)
    total_referrals = models.IntegerField(default=0)
    referral_earnings = models.BigIntegerField(default=0)
    last_block_processed = models.BigIntegerField(default=0)
    speed_boost = models.FloatField(default=1.0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.telegram_id}:{self.username or self.first_name or 'player'}"


class Miner(models.Model):
    miner_id = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    era = models.CharField(max_length=32)
    power_hash_per_second = models.BigIntegerField(default=0)
    price_satoshi = models.BigIntegerField(default=0)
    unlock_block = models.BigIntegerField(default=0)
    historical_fact = models.TextField(blank=True, default="")

    def __str__(self) -> str:
        return self.name


class PlayerMiner(models.Model):
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="owned_miners")
    miner = models.ForeignKey(Miner, on_delete=models.CASCADE)
    quantity = models.BigIntegerField(default=0)

    class Meta:
        unique_together = ("player", "miner")


class GameState(models.Model):
    singleton_key = models.CharField(max_length=32, unique=True, default="singleton")
    current_block_number = models.BigIntegerField(default=0)
    total_mined_satoshi = models.BigIntegerField(default=0)
    current_epoch = models.BigIntegerField(default=0)
    block_reward_satoshi = models.BigIntegerField(default=5_000_000_000)
    total_network_power = models.BigIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)


class Transaction(models.Model):
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="transactions")
    tx_type = models.CharField(max_length=64)
    amount_satoshi = models.BigIntegerField(default=0)
    amount_stars = models.BigIntegerField(default=0)
    related_player = models.ForeignKey(Player, null=True, blank=True, on_delete=models.SET_NULL, related_name="related_transactions")
    miner_ref = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)


class BlockHistory(models.Model):
    block_number = models.BigIntegerField(db_index=True)
    epoch = models.BigIntegerField(default=0)
    reward_satoshi = models.BigIntegerField(default=0)
    total_distributed = models.BigIntegerField(default=0)
    network_power = models.BigIntegerField(default=0)
    participants = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
