from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0002_player_referrer_transaction_related_player"),
    ]

    operations = [
        migrations.AddField(
            model_name="player",
            name="last_block_processed",
            field=models.BigIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="player",
            name="legacy_id",
            field=models.CharField(blank=True, db_index=True, max_length=64, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="player",
            name="speed_boost",
            field=models.FloatField(default=1.0),
        ),
        migrations.CreateModel(
            name="BlockHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("block_number", models.BigIntegerField(db_index=True)),
                ("epoch", models.BigIntegerField(default=0)),
                ("reward_satoshi", models.BigIntegerField(default=0)),
                ("total_distributed", models.BigIntegerField(default=0)),
                ("network_power", models.BigIntegerField(default=0)),
                ("participants", models.BigIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
