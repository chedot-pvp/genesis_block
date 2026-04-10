from rest_framework.request import Request
from rest_framework.throttling import SimpleRateThrottle
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


class TelegramAuthRateThrottle(SimpleRateThrottle):
    scope = "telegram_auth"

    def get_cache_key(self, request: Request, view):
        ident = self.get_ident(request)
        if not ident:
            return None
        return self.cache_format % {"scope": self.scope, "ident": f"ip:{ident}"}


class PlayerMutationRateThrottle(SimpleRateThrottle):
    scope = "player_mutation"

    def get_cache_key(self, request: Request, view):
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:].strip()
            if token:
                try:
                    payload = AccessToken(token)
                    player_id = payload.get("player_id")
                    if player_id is not None:
                        return self.cache_format % {"scope": self.scope, "ident": f"player:{player_id}"}
                except (TokenError, TypeError, ValueError):
                    pass

        ident = self.get_ident(request)
        if not ident:
            return None
        return self.cache_format % {"scope": self.scope, "ident": f"ip:{ident}"}
