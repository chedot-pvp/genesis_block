import hashlib
import hmac
import os
import urllib.parse
import uuid

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import AccessToken

from .models import Player, GameState, Miner, PlayerMiner


TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
GENESIS_DEBUG = os.getenv("GENESIS_DEBUG", "0") == "1"
MAX_SUPPLY_SATOSHI = 2_100_000_000_000_000
INITIAL_BLOCK_REWARD = 5_000_000_000
HALVING_INTERVAL = 210_000
BLOCK_TIME_SECONDS = 30
BASE_STARS_TO_BTC = 10_000

MINERS_DATA = [
    {"miner_id": "cpu_celeron", "name": "Intel Celeron", "era": "cpu", "power_hash_per_second": 1, "price_satoshi": 0, "unlock_block": 0, "historical_fact": "Первые майнеры использовали обычные процессоры. Сатоши Накамото намайнил первые блоки на своём CPU."},
    {"miner_id": "cpu_i7", "name": "Intel Core i7", "era": "cpu", "power_hash_per_second": 5, "price_satoshi": 100_000, "unlock_block": 1_000, "historical_fact": "Мощные процессоры быстро заменили слабые. К 2010 году i7 был лучшим выбором для майнеров-энтузиастов."},
    {"miner_id": "gpu_rx580", "name": "Radeon RX 580", "era": "gpu", "power_hash_per_second": 50, "price_satoshi": 1_000_000, "unlock_block": 10_000, "historical_fact": "В 2010 году майнеры обнаружили, что GPU в сотни раз эффективнее CPU. Началась эра GPU-майнинга."},
    {"miner_id": "gpu_1080", "name": "NVIDIA GTX 1080", "era": "gpu", "power_hash_per_second": 120, "price_satoshi": 2_500_000, "unlock_block": 25_000, "historical_fact": "NVIDIA GTX 1080 была флагманской картой, которую массово скупали майнеры в 2016-2017 годах."},
    {"miner_id": "fpga_custom", "name": "FPGA Custom Board", "era": "fpga", "power_hash_per_second": 500, "price_satoshi": 10_000_000, "unlock_block": 50_000, "historical_fact": "FPGA появились в 2011 году как промежуточный этап перед ASIC."},
    {"miner_id": "asic_s9", "name": "Antminer S9", "era": "asic", "power_hash_per_second": 5_000, "price_satoshi": 50_000_000, "unlock_block": 100_000, "historical_fact": "Antminer S9 от Bitmain стал легендой."},
    {"miner_id": "asic_s19", "name": "Antminer S19", "era": "asic", "power_hash_per_second": 25_000, "price_satoshi": 250_000_000, "unlock_block": 200_000, "historical_fact": "S19 Pro сделал майнинг промышленным."},
    {"miner_id": "asic_s21", "name": "Antminer S21", "era": "asic", "power_hash_per_second": 100_000, "price_satoshi": 1_000_000_000, "unlock_block": 400_000, "historical_fact": "Antminer S21 — вершина эффективности."},
]


def validate_telegram_init_data(init_data: str):
    if not init_data:
        return None

    if not TELEGRAM_BOT_TOKEN and GENESIS_DEBUG and init_data.startswith("mock_"):
        parts = init_data.split("_")
        user_id = int(parts[1]) if len(parts) > 1 else 12345
        return {"id": user_id, "first_name": f"Player{user_id}", "username": f"player{user_id}"}

    if not TELEGRAM_BOT_TOKEN:
        return None

    try:
        parsed = dict(urllib.parse.parse_qsl(init_data))
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            return None

        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
        secret_key = hmac.new(b"WebAppData", TELEGRAM_BOT_TOKEN.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        if calculated_hash != received_hash:
            return None

        user_json = parsed.get("user")
        if not user_json:
            return None
        import json

        return json.loads(user_json)
    except Exception:
        return None


def get_or_create_state() -> GameState:
    state, _ = GameState.objects.get_or_create(singleton_key="singleton")
    return state


def seed_miners() -> None:
    if Miner.objects.count() > 0:
        return
    Miner.objects.bulk_create([Miner(**m) for m in MINERS_DATA], ignore_conflicts=True)


def calculate_epoch(block_number: int) -> int:
    return block_number // HALVING_INTERVAL


def calculate_block_reward(epoch: int) -> int:
    return INITIAL_BLOCK_REWARD // (2 ** epoch)


def calculate_exchange_rate(epoch: int) -> dict:
    btc_per_star = BASE_STARS_TO_BTC / (2 ** epoch)
    satoshi_per_star = int(btc_per_star * 100_000_000)
    return {
        "btc_per_star": btc_per_star,
        "satoshi_per_star": satoshi_per_star,
        "stars_per_btc": 1 / btc_per_star if btc_per_star > 0 else 0,
        "epoch": epoch,
    }


def serialize_player(player: Player) -> dict:
    return {
        "id": str(player.id),
        "telegram_id": player.telegram_id,
        "username": player.username,
        "first_name": player.first_name,
        "photo_url": player.photo_url,
        "total_power": player.total_power,
        "balance_satoshi": player.balance_satoshi,
        "balance_stars": player.balance_stars,
        "referral_code": player.referral_code,
        "total_referrals": player.total_referrals,
        "referral_earnings": player.referral_earnings,
        "speed_boost": 1.0,
    }


def get_player_id_from_request(request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    if not token:
        return None
    try:
        payload = AccessToken(token)
        player_id = payload.get("player_id")
        return int(player_id) if player_id is not None else None
    except Exception:
        return None


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "healthy", "service": "django-v2"})


@api_view(["POST"])
@permission_classes([AllowAny])
def telegram_auth(request):
    init_data = request.data.get("init_data", "")
    tg_user = validate_telegram_init_data(init_data)
    if not tg_user:
        return Response({"detail": "Invalid Telegram authentication"}, status=status.HTTP_401_UNAUTHORIZED)

    telegram_id = int(tg_user.get("id"))
    with transaction.atomic():
        seed_miners()
        player, created = Player.objects.get_or_create(
            telegram_id=telegram_id,
            defaults={
                "username": tg_user.get("username", "") or "",
                "first_name": tg_user.get("first_name", "") or "",
                "photo_url": tg_user.get("photo_url", "") or "",
                "referral_code": uuid.uuid4().hex[:8],
            },
        )
        if not created:
            player.username = tg_user.get("username", "") or ""
            player.first_name = tg_user.get("first_name", "") or ""
            player.photo_url = tg_user.get("photo_url", "") or ""
            player.is_active = True
            player.save(update_fields=["username", "first_name", "photo_url", "is_active", "updated_at"])

    token = AccessToken()
    token["player_id"] = player.id
    token["telegram_id"] = player.telegram_id

    return Response({"user": serialize_player(player), "token": str(token)})


@api_view(["GET"])
def init_view(request):
    player_id = get_player_id_from_request(request)
    if not player_id:
        return Response({"detail": "Missing player_id in token"}, status=status.HTTP_401_UNAUTHORIZED)
    try:
        player = Player.objects.get(id=player_id)
    except Player.DoesNotExist:
        return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    state = get_or_create_state()
    seed_miners()
    miners = list(Miner.objects.values("miner_id", "name", "era", "power_hash_per_second", "price_satoshi", "unlock_block", "historical_fact"))
    miners = [{**m, "id": m.pop("miner_id")} for m in miners]
    owned = {str(pm.miner.miner_id): pm.quantity for pm in PlayerMiner.objects.select_related("miner").filter(player=player)}

    return Response(
        {
            "user": serialize_player(player),
            "game_state": {
                "current_block_number": state.current_block_number,
                "total_mined_satoshi": state.total_mined_satoshi,
                "current_epoch": state.current_epoch,
                "block_reward_satoshi": state.block_reward_satoshi,
                "total_network_power": state.total_network_power,
            },
            "miners": miners,
            "user_miners": owned,
            "exchange_rate": calculate_exchange_rate(state.current_epoch),
        }
    )


@api_view(["GET"])
def block_info(request):
    state = get_or_create_state()
    next_halving = (state.current_epoch + 1) * HALVING_INTERVAL
    return Response(
        {
            "current_block_number": state.current_block_number,
            "total_mined_satoshi": state.total_mined_satoshi,
            "current_epoch": state.current_epoch,
            "block_reward_satoshi": state.block_reward_satoshi,
            "total_network_power": state.total_network_power,
            "next_halving_block": next_halving,
            "blocks_until_halving": next_halving - state.current_block_number,
            "max_supply": MAX_SUPPLY_SATOSHI,
            "remaining_supply": MAX_SUPPLY_SATOSHI - state.total_mined_satoshi,
            "exchange_rate": calculate_exchange_rate(state.current_epoch),
        }
    )


@api_view(["GET"])
def miners_list(request):
    seed_miners()
    miners = list(Miner.objects.values("miner_id", "name", "era", "power_hash_per_second", "price_satoshi", "unlock_block", "historical_fact"))
    return Response([{**m, "id": m.pop("miner_id")} for m in miners])


@api_view(["POST"])
def miners_buy(request):
    player_id = get_player_id_from_request(request)
    if not player_id:
        return Response({"detail": "Missing player_id in token"}, status=status.HTTP_401_UNAUTHORIZED)
    try:
        player = Player.objects.get(id=player_id)
    except Player.DoesNotExist:
        return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    miner_id = request.data.get("miner_id")
    quantity = int(request.data.get("quantity", 1))
    if quantity < 1 or quantity > 100:
        return Response({"detail": "Quantity must be between 1 and 100"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        miner = Miner.objects.get(miner_id=miner_id)
    except Miner.DoesNotExist:
        return Response({"detail": "Miner not found"}, status=status.HTTP_404_NOT_FOUND)

    state = get_or_create_state()
    if state.current_block_number < miner.unlock_block:
        return Response({"detail": f"Miner unlocks at block {miner.unlock_block}"}, status=status.HTTP_400_BAD_REQUEST)

    total_cost = miner.price_satoshi * quantity
    if player.balance_satoshi < total_cost:
        return Response({"detail": "Insufficient balance"}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        player.balance_satoshi = player.balance_satoshi - total_cost
        player.total_power = player.total_power + (miner.power_hash_per_second * quantity)
        player.save(update_fields=["balance_satoshi", "total_power", "updated_at"])
        pm, _ = PlayerMiner.objects.get_or_create(player=player, miner=miner, defaults={"quantity": 0})
        pm.quantity = pm.quantity + quantity
        pm.save(update_fields=["quantity"])
        from .models import Transaction
        Transaction.objects.create(player=player, tx_type="purchase_miner", amount_satoshi=-total_cost, miner_ref=miner.miner_id)

    owned = {str(row.miner.miner_id): row.quantity for row in PlayerMiner.objects.select_related("miner").filter(player=player)}
    return Response({"user": serialize_player(player), "user_miners": owned})


@api_view(["GET"])
def exchange_rate(request):
    state = get_or_create_state()
    return Response(calculate_exchange_rate(state.current_epoch))


@api_view(["POST"])
def exchange_buy(request):
    player_id = get_player_id_from_request(request)
    if not player_id:
        return Response({"detail": "Missing player_id in token"}, status=status.HTTP_401_UNAUTHORIZED)
    try:
        player = Player.objects.get(id=player_id)
    except Player.DoesNotExist:
        return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    amount = int(request.data.get("amount", 0))
    if amount <= 0:
        return Response({"detail": "Amount must be positive"}, status=status.HTTP_400_BAD_REQUEST)
    if player.balance_stars < amount:
        return Response({"detail": "Insufficient Stars balance"}, status=status.HTTP_400_BAD_REQUEST)

    state = get_or_create_state()
    rate = calculate_exchange_rate(state.current_epoch)
    satoshi_to_receive = amount * rate["satoshi_per_star"]
    player.balance_stars -= amount
    player.balance_satoshi += satoshi_to_receive
    player.save(update_fields=["balance_stars", "balance_satoshi", "updated_at"])
    from .models import Transaction
    Transaction.objects.create(player=player, tx_type="exchange_stars_to_btc", amount_satoshi=satoshi_to_receive, amount_stars=-amount)
    return Response({"user": serialize_player(player), "rate": rate})


@api_view(["POST"])
def exchange_sell(request):
    player_id = get_player_id_from_request(request)
    if not player_id:
        return Response({"detail": "Missing player_id in token"}, status=status.HTTP_401_UNAUTHORIZED)
    try:
        player = Player.objects.get(id=player_id)
    except Player.DoesNotExist:
        return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    amount = int(request.data.get("amount", 0))
    if amount <= 0:
        return Response({"detail": "Amount must be positive"}, status=status.HTTP_400_BAD_REQUEST)
    if player.balance_satoshi < amount:
        return Response({"detail": "Insufficient BTC balance"}, status=status.HTTP_400_BAD_REQUEST)

    state = get_or_create_state()
    rate = calculate_exchange_rate(state.current_epoch)
    stars_to_receive = int(amount / rate["satoshi_per_star"]) if rate["satoshi_per_star"] > 0 else 0
    if stars_to_receive <= 0:
        return Response({"detail": "Amount too small to convert"}, status=status.HTTP_400_BAD_REQUEST)
    player.balance_satoshi -= amount
    player.balance_stars += stars_to_receive
    player.save(update_fields=["balance_satoshi", "balance_stars", "updated_at"])
    from .models import Transaction
    Transaction.objects.create(player=player, tx_type="exchange_btc_to_stars", amount_satoshi=-amount, amount_stars=stars_to_receive)
    return Response({"user": serialize_player(player), "rate": rate})


@api_view(["GET"])
def leaderboard(request):
    lb_type = request.query_params.get("type", "balance")
    limit = max(1, min(int(request.query_params.get("limit", 100)), 200))
    sort_field = {"balance": "-balance_satoshi", "power": "-total_power", "referrals": "-total_referrals"}.get(lb_type, "-balance_satoshi")
    rows = list(Player.objects.filter(is_active=True).order_by(sort_field)[:limit])
    payload = []
    for idx, player in enumerate(rows, start=1):
        payload.append(
            {
                "rank": idx,
                "telegram_id": player.telegram_id,
                "username": player.username,
                "first_name": player.first_name,
                "balance_satoshi": player.balance_satoshi,
                "total_power": player.total_power,
                "total_referrals": player.total_referrals,
                "referral_earnings": player.referral_earnings,
            }
        )
    return Response(payload)


@api_view(["GET"])
def referral_info(request):
    player_id = get_player_id_from_request(request)
    if not player_id:
        return Response({"detail": "Missing player_id in token"}, status=status.HTTP_401_UNAUTHORIZED)
    try:
        player = Player.objects.get(id=player_id)
    except Player.DoesNotExist:
        return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    refs = list(
        Player.objects.filter(referrer=player).values("username", "first_name", "total_power", "created_at")[:100]
    )
    return Response(
        {
            "referral_code": player.referral_code,
            "total_referrals": player.total_referrals,
            "referral_earnings": player.referral_earnings,
            "referrals": refs,
        }
    )


@api_view(["GET"])
def referral_top(request):
    limit = max(1, min(int(request.query_params.get("limit", 10)), 100))
    rows = list(Player.objects.filter(total_referrals__gt=0).order_by("-total_referrals")[:limit])
    payload = []
    for idx, player in enumerate(rows, start=1):
        payload.append(
            {
                "rank": idx,
                "username": player.username,
                "first_name": player.first_name,
                "total_referrals": player.total_referrals,
                "referral_earnings": player.referral_earnings,
            }
        )
    return Response(payload)


@api_view(["POST"])
def auth_referral(request):
    player_id = get_player_id_from_request(request)
    if not player_id:
        return Response({"detail": "Missing player_id in token"}, status=status.HTTP_401_UNAUTHORIZED)
    referral_code = (request.query_params.get("referral_code", "") or "").strip()
    if not referral_code:
        return Response({"detail": "Referral code is required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        player = Player.objects.get(id=player_id)
    except Player.DoesNotExist:
        return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    if player.referrer_id:
        return Response({"detail": "Referral already applied"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        referrer = Player.objects.get(referral_code=referral_code)
    except Player.DoesNotExist:
        return Response({"detail": "Invalid referral code"}, status=status.HTTP_404_NOT_FOUND)
    if referrer.id == player.id:
        return Response({"detail": "Cannot refer yourself"}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        player.referrer = referrer
        player.save(update_fields=["referrer", "updated_at"])
        referrer.balance_satoshi += 100_000
        referrer.total_referrals += 1
        referrer.save(update_fields=["balance_satoshi", "total_referrals", "updated_at"])
        from .models import Transaction
        Transaction.objects.create(
            player=referrer,
            tx_type="referral_bonus",
            amount_satoshi=100_000,
            related_player=player,
        )
    return Response({"success": True, "message": "Referral applied successfully"})


@api_view(["POST"])
def mine_instant(request):
    player_id = get_player_id_from_request(request)
    if not player_id:
        return Response({"detail": "Missing player_id in token"}, status=status.HTTP_401_UNAUTHORIZED)
    try:
        player = Player.objects.get(id=player_id)
    except Player.DoesNotExist:
        return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    state = get_or_create_state()
    total_power = max(state.total_network_power, 1)
    reward = int((state.block_reward_satoshi / BLOCK_TIME_SECONDS) * (player.total_power / total_power))
    reward = max(reward, 1)

    player.balance_satoshi += reward
    player.save(update_fields=["balance_satoshi", "updated_at"])
    return Response({"reward": reward, "user": serialize_player(player)})
