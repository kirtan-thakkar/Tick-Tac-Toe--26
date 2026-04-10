from upstash_redis import Redis
from app.core.config import settings

# This is the "Normal" method you asked about.
# It handles the Authorization Bearer header internally.
redis_client = Redis(
    url=settings.UPSTASH_REDIS_REST_URL, 
    token=settings.UPSTASH_REDIS_REST_TOKEN
)

def redis_set(key: str, value: str, expire_seconds: int = 3600):
    """Stores a value in Redis with an optional timeout."""
    return redis_client.set(key, value, ex=expire_seconds)

def redis_get(key: str):
    """Retrieves a value from Redis."""
    return redis_client.get(key)