from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="GameState",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("singleton_key", models.CharField(default="singleton", max_length=32, unique=True)),
                ("current_block_number", models.BigIntegerField(default=0)),
                ("total_mined_satoshi", models.BigIntegerField(default=0)),
                ("current_epoch", models.BigIntegerField(default=0)),
                ("block_reward_satoshi", models.BigIntegerField(default=5000000000)),
                ("total_network_power", models.BigIntegerField(default=1)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="Miner",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("miner_id", models.CharField(max_length=64, unique=True)),
                ("name", models.CharField(max_length=128)),
                ("era", models.CharField(max_length=32)),
                ("power_hash_per_second", models.BigIntegerField(default=0)),
                ("price_satoshi", models.BigIntegerField(default=0)),
                ("unlock_block", models.BigIntegerField(default=0)),
                ("historical_fact", models.TextField(blank=True, default="")),
            ],
        ),
        migrations.CreateModel(
            name="Player",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("telegram_id", models.BigIntegerField(db_index=True, unique=True)),
                ("username", models.CharField(blank=True, default="", max_length=128)),
                ("first_name", models.CharField(blank=True, default="", max_length=128)),
                ("photo_url", models.URLField(blank=True, default="")),
                ("referral_code", models.CharField(db_index=True, max_length=16, unique=True)),
                ("total_power", models.BigIntegerField(default=1)),
                ("balance_satoshi", models.BigIntegerField(default=0)),
                ("balance_stars", models.BigIntegerField(default=0)),
                ("total_referrals", models.IntegerField(default=0)),
                ("referral_earnings", models.BigIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="Transaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tx_type", models.CharField(max_length=64)),
                ("amount_satoshi", models.BigIntegerField(default=0)),
                ("amount_stars", models.BigIntegerField(default=0)),
                ("miner_ref", models.CharField(blank=True, default="", max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "player",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="transactions", to="api.player"),
                ),
            ],
        ),
        migrations.CreateModel(
            name="PlayerMiner",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("quantity", models.BigIntegerField(default=0)),
                ("miner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="api.miner")),
                (
                    "player",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="owned_miners", to="api.player"),
                ),
            ],
            options={"unique_together": {("player", "miner")}},
        ),
    ]
