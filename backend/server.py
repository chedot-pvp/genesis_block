from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import hashlib
import hmac
import urllib.parse
import asyncio
from contextlib import asynccontextmanager

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'genesis_block')]

# Telegram Bot Token
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')

# Game Constants
MAX_SUPPLY_SATOSHI = 2_100_000_000_000_000  # 21 million BTC in satoshi
INITIAL_BLOCK_REWARD = 5_000_000_000  # 50 BTC in satoshi
HALVING_INTERVAL = 210_000  # blocks
BLOCK_TIME_SECONDS = 30
BASE_STARS_TO_BTC = 10_000  # 1 Star = 10000 BTC at epoch 0

# Predefined Miners
MINERS_DATA = [
    {"id": "cpu_celeron", "name": "Intel Celeron", "era": "cpu", "power_hash_per_second": 1, "price_satoshi": 0, "unlock_block": 0, "historical_fact": "Первые майнеры использовали обычные процессоры. Сатоши Накамото намайнил первые блоки на своём CPU."},
    {"id": "cpu_i7", "name": "Intel Core i7", "era": "cpu", "power_hash_per_second": 5, "price_satoshi": 100_000, "unlock_block": 1_000, "historical_fact": "Мощные процессоры быстро заменили слабые. К 2010 году i7 был лучшим выбором для майнеров-энтузиастов."},
    {"id": "gpu_rx580", "name": "Radeon RX 580", "era": "gpu", "power_hash_per_second": 50, "price_satoshi": 1_000_000, "unlock_block": 10_000, "historical_fact": "В 2010 году майнеры обнаружили, что GPU в сотни раз эффективнее CPU. Началась эра GPU-майнинга."},
    {"id": "gpu_1080", "name": "NVIDIA GTX 1080", "era": "gpu", "power_hash_per_second": 120, "price_satoshi": 2_500_000, "unlock_block": 25_000, "historical_fact": "NVIDIA GTX 1080 была флагманской картой, которую массово скупали майнеры в 2016-2017 годах."},
    {"id": "fpga_custom", "name": "FPGA Custom Board", "era": "fpga", "power_hash_per_second": 500, "price_satoshi": 10_000_000, "unlock_block": 50_000, "historical_fact": "FPGA (программируемые логические матрицы) появились в 2011 году как промежуточный этап перед ASIC."},
    {"id": "asic_s9", "name": "Antminer S9", "era": "asic", "power_hash_per_second": 5_000, "price_satoshi": 50_000_000, "unlock_block": 100_000, "historical_fact": "Antminer S9 от Bitmain (2016) стал легендой. 14 TH/s мощности сделали его королём майнинга на годы."},
    {"id": "asic_s19", "name": "Antminer S19", "era": "asic", "power_hash_per_second": 25_000, "price_satoshi": 250_000_000, "unlock_block": 200_000, "historical_fact": "S19 Pro (2020) достиг 110 TH/s. Майнинг стал исключительно промышленным делом."},
    {"id": "asic_s21", "name": "Antminer S21", "era": "asic", "power_hash_per_second": 100_000, "price_satoshi": 1_000_000_000, "unlock_block": 400_000, "historical_fact": "Antminer S21 (2023) — вершина эффективности с 200 TH/s и потреблением 17.5 Дж/TH."},
]

# Background task reference
block_generation_task = None

# ============== MODELS ==============

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: int
    username: str = ""
    first_name: str = ""
    total_power: int = 1  # Starting with 1 H/s (free Celeron)
    balance_satoshi: int = 0
    balance_stars: int = 0
    last_block_processed: int = 0
    referrer_id: Optional[str] = None
    referral_code: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    referral_bonus_power: int = 0
    referral_earnings: int = 0
    total_referrals: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    speed_boost: float = 1.0
    speed_boost_until: Optional[datetime] = None

class UserMiner(BaseModel):
    user_id: str
    miner_id: str
    quantity: int = 0

class GameState(BaseModel):
    id: str = "singleton"
    current_block_number: int = 0
    total_mined_satoshi: int = 0
    current_epoch: int = 0
    block_reward_satoshi: int = INITIAL_BLOCK_REWARD
    last_block_time: datetime = Field(default_factory=datetime.utcnow)
    total_network_power: int = 1

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # mine, purchase_miner, exchange_stars_to_btc, exchange_btc_to_stars, referral_bonus
    amount_satoshi: int = 0
    amount_stars: int = 0
    related_user_id: Optional[str] = None
    miner_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ============== REQUEST/RESPONSE MODELS ==============

class TelegramAuthRequest(BaseModel):
    init_data: str

class BuyMinerRequest(BaseModel):
    miner_id: str
    quantity: int = 1

class ExchangeRequest(BaseModel):
    amount: int  # satoshi for sell, stars for buy

class InitResponse(BaseModel):
    user: dict
    game_state: dict
    miners: List[dict]
    user_miners: dict
    exchange_rate: dict

# ============== HELPER FUNCTIONS ==============

def validate_telegram_init_data(init_data: str) -> dict:
    """Validate Telegram WebApp initData and extract user info"""
    if not TELEGRAM_BOT_TOKEN:
        # For testing without token - parse but don't validate
        parsed = dict(urllib.parse.parse_qsl(init_data))
        if 'user' in parsed:
            import json
            return json.loads(parsed['user'])
        return None
    
    try:
        parsed = dict(urllib.parse.parse_qsl(init_data))
        
        # Extract hash
        received_hash = parsed.pop('hash', None)
        if not received_hash:
            return None
        
        # Create data check string
        data_check_string = '\n'.join(
            f"{k}={v}" for k, v in sorted(parsed.items())
        )
        
        # Calculate secret key
        secret_key = hmac.new(
            b"WebAppData",
            TELEGRAM_BOT_TOKEN.encode(),
            hashlib.sha256
        ).digest()
        
        # Calculate hash
        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if calculated_hash != received_hash:
            return None
        
        # Parse user data
        import json
        if 'user' in parsed:
            return json.loads(parsed['user'])
        return None
    except Exception as e:
        logging.error(f"Telegram auth validation error: {e}")
        return None

def calculate_block_reward(epoch: int) -> int:
    """Calculate block reward based on epoch (halving)"""
    return INITIAL_BLOCK_REWARD // (2 ** epoch)

def calculate_epoch(block_number: int) -> int:
    """Calculate epoch based on block number"""
    return block_number // HALVING_INTERVAL

def calculate_exchange_rate(epoch: int) -> dict:
    """Calculate exchange rate based on epoch"""
    btc_per_star = BASE_STARS_TO_BTC / (2 ** epoch)
    satoshi_per_star = int(btc_per_star * 100_000_000)
    return {
        "btc_per_star": btc_per_star,
        "satoshi_per_star": satoshi_per_star,
        "stars_per_btc": 1 / btc_per_star if btc_per_star > 0 else 0,
        "epoch": epoch
    }

def calculate_user_power(user_miners: dict, miners: List[dict]) -> int:
    """Calculate total user power from owned miners"""
    total = 0
    miners_dict = {m['id']: m for m in miners}
    for miner_id, quantity in user_miners.items():
        if miner_id in miners_dict:
            total += miners_dict[miner_id]['power_hash_per_second'] * quantity
    return max(total, 1)  # Minimum 1 H/s

async def get_or_create_game_state() -> dict:
    """Get or initialize game state"""
    state = await db.game_state.find_one({"id": "singleton"})
    if not state:
        state = GameState().dict()
        await db.game_state.insert_one(state)
    return state

async def process_block():
    """Process a new block - distribute rewards to all players"""
    state = await get_or_create_game_state()
    
    # Check if max supply reached
    if state['total_mined_satoshi'] >= MAX_SUPPLY_SATOSHI:
        logging.info("Max supply reached, no more blocks")
        return
    
    # Get all active users with their power
    users = await db.users.find({"is_active": True}).to_list(10000)
    if not users:
        return
    
    # Calculate total network power
    total_power = sum(u.get('total_power', 1) for u in users)
    
    # Get current block reward
    current_epoch = calculate_epoch(state['current_block_number'])
    block_reward = calculate_block_reward(current_epoch)
    
    # Remaining supply check
    remaining = MAX_SUPPLY_SATOSHI - state['total_mined_satoshi']
    if block_reward > remaining:
        block_reward = remaining
    
    # Distribute rewards
    total_distributed = 0
    for user in users:
        user_power = user.get('total_power', 1)
        
        # Apply speed boost
        boost = user.get('speed_boost', 1.0)
        boost_until = user.get('speed_boost_until')
        if boost_until and datetime.fromisoformat(str(boost_until)) < datetime.utcnow():
            boost = 1.0
            await db.users.update_one(
                {"id": user['id']},
                {"$set": {"speed_boost": 1.0, "speed_boost_until": None}}
            )
        
        effective_power = int(user_power * boost)
        user_reward = int(block_reward * effective_power / total_power)
        
        if user_reward > 0:
            total_distributed += user_reward
            await db.users.update_one(
                {"id": user['id']},
                {
                    "$inc": {"balance_satoshi": user_reward},
                    "$set": {"last_block_processed": state['current_block_number'] + 1}
                }
            )
            
            # Process referral bonus (3% to referrer)
            if user.get('referrer_id'):
                referral_bonus = int(user_reward * 0.03)
                if referral_bonus > 0:
                    await db.users.update_one(
                        {"id": user['referrer_id']},
                        {"$inc": {"balance_satoshi": referral_bonus, "referral_earnings": referral_bonus}}
                    )
    
    # Update game state
    new_block = state['current_block_number'] + 1
    new_epoch = calculate_epoch(new_block)
    new_reward = calculate_block_reward(new_epoch)
    
    await db.game_state.update_one(
        {"id": "singleton"},
        {
            "$set": {
                "current_block_number": new_block,
                "total_mined_satoshi": state['total_mined_satoshi'] + total_distributed,
                "current_epoch": new_epoch,
                "block_reward_satoshi": new_reward,
                "last_block_time": datetime.utcnow(),
                "total_network_power": total_power
            }
        }
    )
    
    logging.info(f"Block {new_block} processed. Reward: {block_reward} satoshi. Distributed: {total_distributed} satoshi")

async def block_generation_loop():
    """Background task to generate blocks every 30 seconds"""
    while True:
        try:
            await process_block()
        except Exception as e:
            logging.error(f"Block generation error: {e}")
        await asyncio.sleep(BLOCK_TIME_SECONDS)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global block_generation_task
    
    # Initialize game state
    await get_or_create_game_state()
    
    # Initialize miners in DB
    for miner in MINERS_DATA:
        await db.miners.update_one(
            {"id": miner['id']},
            {"$set": miner},
            upsert=True
        )
    
    # Start block generation task
    block_generation_task = asyncio.create_task(block_generation_loop())
    logging.info("Block generation task started")
    
    yield
    
    # Shutdown
    if block_generation_task:
        block_generation_task.cancel()
        try:
            await block_generation_task
        except asyncio.CancelledError:
            pass
    client.close()

# Create the main app with lifespan
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============== AUTH ENDPOINTS ==============

@api_router.post("/v1/auth/telegram")
async def telegram_auth(request: TelegramAuthRequest):
    """Authenticate user via Telegram WebApp initData"""
    user_data = validate_telegram_init_data(request.init_data)
    
    # For development/testing, allow mock data
    if not user_data and request.init_data.startswith("mock_"):
        parts = request.init_data.split("_")
        telegram_id = int(parts[1]) if len(parts) > 1 else 12345
        user_data = {
            "id": telegram_id,
            "first_name": f"Player{telegram_id}",
            "username": f"player{telegram_id}"
        }
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid Telegram authentication")
    
    telegram_id = user_data.get('id')
    
    # Find or create user
    existing_user = await db.users.find_one({"telegram_id": telegram_id})
    
    if existing_user:
        # Update user info
        await db.users.update_one(
            {"telegram_id": telegram_id},
            {"$set": {
                "username": user_data.get('username', ''),
                "first_name": user_data.get('first_name', ''),
                "is_active": True
            }}
        )
        user = await db.users.find_one({"telegram_id": telegram_id})
    else:
        # Create new user with free Celeron miner
        user = User(
            telegram_id=telegram_id,
            username=user_data.get('username', ''),
            first_name=user_data.get('first_name', ''),
            total_power=1
        ).dict()
        await db.users.insert_one(user)
        
        # Give free Celeron
        await db.user_miners.update_one(
            {"user_id": user['id'], "miner_id": "cpu_celeron"},
            {"$set": {"user_id": user['id'], "miner_id": "cpu_celeron", "quantity": 1}},
            upsert=True
        )
    
    # Clean MongoDB _id
    user.pop('_id', None)
    return {"user": user, "token": user['id']}

@api_router.post("/v1/auth/referral")
async def apply_referral(user_id: str, referral_code: str):
    """Apply referral code for a user"""
    # Find the user
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get('referrer_id'):
        raise HTTPException(status_code=400, detail="Referral already applied")
    
    # Find referrer by code
    referrer = await db.users.find_one({"referral_code": referral_code})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    if referrer['id'] == user_id:
        raise HTTPException(status_code=400, detail="Cannot refer yourself")
    
    # Apply referral
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"referrer_id": referrer['id']}}
    )
    
    # Give bonus to referrer (100,000 satoshi)
    await db.users.update_one(
        {"id": referrer['id']},
        {"$inc": {"balance_satoshi": 100_000, "total_referrals": 1}}
    )
    
    # Log transaction
    tx = Transaction(
        user_id=referrer['id'],
        type="referral_bonus",
        amount_satoshi=100_000,
        related_user_id=user_id
    ).dict()
    await db.transactions.insert_one(tx)
    
    return {"success": True, "message": "Referral applied successfully"}

# ============== INIT ENDPOINT ==============

@api_router.get("/v1/init")
async def get_init(user_id: str):
    """Get all initial data for the game"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate offline earnings
    game_state = await get_or_create_game_state()
    last_processed = user.get('last_block_processed', 0)
    current_block = game_state['current_block_number']
    
    if current_block > last_processed:
        # Calculate missed blocks reward
        offline_reward = 0
        for block in range(last_processed, current_block):
            epoch = calculate_epoch(block)
            block_reward = calculate_block_reward(epoch)
            # Simplified: use current network power
            user_share = user.get('total_power', 1) / max(game_state.get('total_network_power', 1), 1)
            offline_reward += int(block_reward * user_share)
        
        if offline_reward > 0:
            await db.users.update_one(
                {"id": user_id},
                {
                    "$inc": {"balance_satoshi": offline_reward},
                    "$set": {"last_block_processed": current_block}
                }
            )
            user['balance_satoshi'] = user.get('balance_satoshi', 0) + offline_reward
    
    # Get miners
    miners = await db.miners.find().to_list(100)
    
    # Get user miners
    user_miners_list = await db.user_miners.find({"user_id": user_id}).to_list(100)
    user_miners = {um['miner_id']: um['quantity'] for um in user_miners_list}
    
    # Calculate exchange rate
    exchange_rate = calculate_exchange_rate(game_state['current_epoch'])
    
    # Clean up MongoDB _id fields
    for m in miners:
        m.pop('_id', None)
    user.pop('_id', None)
    game_state.pop('_id', None)
    
    return {
        "user": user,
        "game_state": game_state,
        "miners": miners,
        "user_miners": user_miners,
        "exchange_rate": exchange_rate
    }

# ============== MINERS ENDPOINTS ==============

@api_router.get("/v1/miners")
async def get_miners():
    """Get all available miners"""
    miners = await db.miners.find().to_list(100)
    for m in miners:
        m.pop('_id', None)
    return miners

@api_router.post("/v1/miners/buy")
async def buy_miner(user_id: str, request: BuyMinerRequest):
    """Purchase a miner"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    miner = await db.miners.find_one({"id": request.miner_id})
    if not miner:
        raise HTTPException(status_code=404, detail="Miner not found")
    
    # Check if unlocked
    game_state = await get_or_create_game_state()
    if game_state['current_block_number'] < miner['unlock_block']:
        raise HTTPException(status_code=400, detail=f"Miner unlocks at block {miner['unlock_block']}")
    
    # Check balance
    total_cost = miner['price_satoshi'] * request.quantity
    if user['balance_satoshi'] < total_cost:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Purchase
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"balance_satoshi": -total_cost, "total_power": miner['power_hash_per_second'] * request.quantity}}
    )
    
    # Add miner to user
    await db.user_miners.update_one(
        {"user_id": user_id, "miner_id": request.miner_id},
        {"$inc": {"quantity": request.quantity}},
        upsert=True
    )
    
    # Log transaction
    tx = Transaction(
        user_id=user_id,
        type="purchase_miner",
        amount_satoshi=-total_cost,
        miner_id=request.miner_id
    ).dict()
    await db.transactions.insert_one(tx)
    
    # Return updated user
    updated_user = await db.users.find_one({"id": user_id})
    updated_user.pop('_id', None)
    
    user_miners_list = await db.user_miners.find({"user_id": user_id}).to_list(100)
    user_miners = {um['miner_id']: um['quantity'] for um in user_miners_list}
    
    return {"user": updated_user, "user_miners": user_miners}

# ============== EXCHANGE ENDPOINTS ==============

@api_router.get("/v1/exchange/rate")
async def get_exchange_rate():
    """Get current exchange rate"""
    game_state = await get_or_create_game_state()
    return calculate_exchange_rate(game_state['current_epoch'])

@api_router.post("/v1/exchange/buy")
async def buy_btc_with_stars(user_id: str, request: ExchangeRequest):
    """Buy BTC with Stars"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get('balance_stars', 0) < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient Stars balance")
    
    game_state = await get_or_create_game_state()
    rate = calculate_exchange_rate(game_state['current_epoch'])
    satoshi_to_receive = request.amount * rate['satoshi_per_star']
    
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"balance_stars": -request.amount, "balance_satoshi": satoshi_to_receive}}
    )
    
    # Log transaction
    tx = Transaction(
        user_id=user_id,
        type="exchange_stars_to_btc",
        amount_satoshi=satoshi_to_receive,
        amount_stars=-request.amount
    ).dict()
    await db.transactions.insert_one(tx)
    
    updated_user = await db.users.find_one({"id": user_id})
    updated_user.pop('_id', None)
    return {"user": updated_user, "rate": rate}

@api_router.post("/v1/exchange/sell")
async def sell_btc_for_stars(user_id: str, request: ExchangeRequest):
    """Sell BTC for Stars"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get('balance_satoshi', 0) < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient BTC balance")
    
    game_state = await get_or_create_game_state()
    rate = calculate_exchange_rate(game_state['current_epoch'])
    stars_to_receive = int(request.amount / rate['satoshi_per_star']) if rate['satoshi_per_star'] > 0 else 0
    
    if stars_to_receive <= 0:
        raise HTTPException(status_code=400, detail="Amount too small to convert")
    
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"balance_satoshi": -request.amount, "balance_stars": stars_to_receive}}
    )
    
    # Log transaction
    tx = Transaction(
        user_id=user_id,
        type="exchange_btc_to_stars",
        amount_satoshi=-request.amount,
        amount_stars=stars_to_receive
    ).dict()
    await db.transactions.insert_one(tx)
    
    updated_user = await db.users.find_one({"id": user_id})
    updated_user.pop('_id', None)
    return {"user": updated_user, "rate": rate}

# ============== LEADERBOARD ENDPOINTS ==============

@api_router.get("/v1/leaderboard")
async def get_leaderboard(type: str = "balance", limit: int = 100):
    """Get leaderboard by type: balance, power, referrals"""
    sort_field = {
        "balance": "balance_satoshi",
        "power": "total_power",
        "referrals": "total_referrals"
    }.get(type, "balance_satoshi")
    
    users = await db.users.find(
        {"is_active": True},
        {"telegram_id": 1, "username": 1, "first_name": 1, "balance_satoshi": 1, "total_power": 1, "total_referrals": 1, "referral_earnings": 1}
    ).sort(sort_field, -1).limit(limit).to_list(limit)
    
    for i, user in enumerate(users):
        user['rank'] = i + 1
        user.pop('_id', None)
    
    return users

# ============== REFERRAL ENDPOINTS ==============

@api_router.get("/v1/referral/info")
async def get_referral_info(user_id: str):
    """Get referral statistics for a user"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get referrals
    referrals = await db.users.find(
        {"referrer_id": user_id},
        {"username": 1, "first_name": 1, "total_power": 1, "created_at": 1}
    ).to_list(100)
    
    for r in referrals:
        r.pop('_id', None)
    
    return {
        "referral_code": user.get('referral_code'),
        "total_referrals": user.get('total_referrals', 0),
        "referral_earnings": user.get('referral_earnings', 0),
        "referrals": referrals
    }

@api_router.get("/v1/referral/top")
async def get_top_referrers(limit: int = 10):
    """Get top referrers"""
    users = await db.users.find(
        {"total_referrals": {"$gt": 0}},
        {"username": 1, "first_name": 1, "total_referrals": 1, "referral_earnings": 1}
    ).sort("total_referrals", -1).limit(limit).to_list(limit)
    
    for i, user in enumerate(users):
        user['rank'] = i + 1
        user.pop('_id', None)
    
    return users

# ============== BLOCK INFO ENDPOINT ==============

@api_router.get("/v1/block/info")
async def get_block_info():
    """Get current block information"""
    state = await get_or_create_game_state()
    state.pop('_id', None)
    
    current_block = state['current_block_number']
    current_epoch = state['current_epoch']
    next_halving = (current_epoch + 1) * HALVING_INTERVAL
    blocks_until_halving = next_halving - current_block
    
    return {
        **state,
        "next_halving_block": next_halving,
        "blocks_until_halving": blocks_until_halving,
        "max_supply": MAX_SUPPLY_SATOSHI,
        "remaining_supply": MAX_SUPPLY_SATOSHI - state['total_mined_satoshi'],
        "exchange_rate": calculate_exchange_rate(current_epoch)
    }

# ============== INSTANT MINING (Tap to mine) ==============

@api_router.post("/v1/mine/instant")
async def instant_mine(user_id: str):
    """Instant mining - gives 1 second worth of mining"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    game_state = await get_or_create_game_state()
    
    # Calculate reward for 1 second
    block_reward = game_state['block_reward_satoshi']
    total_power = max(game_state.get('total_network_power', 1), 1)
    user_power = user.get('total_power', 1)
    
    # 1 second = block_reward / 30 (since block is 30 seconds)
    instant_reward = int((block_reward / BLOCK_TIME_SECONDS) * (user_power / total_power))
    instant_reward = max(instant_reward, 1)  # Minimum 1 satoshi
    
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"balance_satoshi": instant_reward}}
    )
    
    updated_user = await db.users.find_one({"id": user_id})
    updated_user.pop('_id', None)
    
    return {"reward": instant_reward, "user": updated_user}

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "Genesis Block API", "version": "1.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
