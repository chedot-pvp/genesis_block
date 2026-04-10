# Django v2 Backend (Parallel Migration)

This service is a parallel rewrite track for moving from FastAPI+MongoDB to Django+PostgreSQL.

## Current scope (step 1)

- PostgreSQL-backed Django service
- Core game models scaffold (`Player`, `Miner`, `PlayerMiner`, `GameState`, `Transaction`)
- JWT token issuance on Telegram auth (`/api/v2/auth/telegram`)
- Protected init endpoint (`/api/v2/init`)
- Health endpoint (`/api/v2/health`)

## Step 2 additions

- Game endpoints aligned with existing frontend contract:
  - `/api/v2/miners`, `/api/v2/miners/buy`
  - `/api/v2/exchange/rate`, `/api/v2/exchange/buy`, `/api/v2/exchange/sell`
  - `/api/v2/mine/instant`
  - `/api/v2/leaderboard`
  - `/api/v2/referral/info`, `/api/v2/referral/top`, `/api/v2/auth/referral`
  - `/api/v2/block/info`
- Background block generation worker (`generate_blocks` management command)
- One-shot Mongo import command (`import_mongo`)

## Useful commands

```bash
# Import existing FastAPI/Mongo data into Postgres v2
python manage.py import_mongo

# Generate one block manually
python manage.py generate_blocks --once
```

## Compose services

- `postgres_v2` - PostgreSQL for Django v2
- `backend_v2` - Django API (`gunicorn` on port `8003`)

## Nginx routes

- `/api/v2/*` -> `backend_v2`
- `/admin` -> `django_admin` (separate standard Django admin service)
