from django.contrib import admin

from .models import Player, Miner, PlayerMiner, GameState, Transaction, BlockHistory


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ("id", "telegram_id", "username", "first_name", "balance_satoshi", "total_power", "is_active")
    search_fields = ("telegram_id", "username", "first_name", "referral_code")
    list_filter = ("is_active",)


@admin.register(Miner)
class MinerAdmin(admin.ModelAdmin):
    list_display = ("miner_id", "name", "era", "power_hash_per_second", "price_satoshi", "unlock_block")
    search_fields = ("miner_id", "name", "era")


@admin.register(PlayerMiner)
class PlayerMinerAdmin(admin.ModelAdmin):
    list_display = ("player", "miner", "quantity")
    search_fields = ("player__username", "player__telegram_id", "miner__name")


@admin.register(GameState)
class GameStateAdmin(admin.ModelAdmin):
    list_display = ("singleton_key", "current_block_number", "current_epoch", "block_reward_satoshi", "total_network_power")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "player", "tx_type", "amount_satoshi", "amount_stars", "created_at")
    search_fields = ("player__username", "player__telegram_id", "tx_type")
    list_filter = ("tx_type",)


@admin.register(BlockHistory)
class BlockHistoryAdmin(admin.ModelAdmin):
    list_display = ("block_number", "epoch", "reward_satoshi", "total_distributed", "network_power", "participants", "created_at")
    search_fields = ("block_number",)
