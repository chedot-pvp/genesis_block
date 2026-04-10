from django.urls import path

from .views import (
    health,
    telegram_auth,
    init_view,
    block_info,
    miners_list,
    miners_buy,
    exchange_rate,
    exchange_buy,
    exchange_sell,
    leaderboard,
    referral_info,
    referral_top,
    auth_referral,
    mine_instant,
)

urlpatterns = [
    path("health", health),
    path("auth/telegram", telegram_auth),
    path("auth/referral", auth_referral),
    path("init", init_view),
    path("block/info", block_info),
    path("miners", miners_list),
    path("miners/buy", miners_buy),
    path("exchange/rate", exchange_rate),
    path("exchange/buy", exchange_buy),
    path("exchange/sell", exchange_sell),
    path("leaderboard", leaderboard),
    path("referral/info", referral_info),
    path("referral/top", referral_top),
    path("mine/instant", mine_instant),
]
