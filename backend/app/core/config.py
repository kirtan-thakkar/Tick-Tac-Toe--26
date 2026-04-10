from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    INFLUX_URL: str
    INFLUX_TOKEN: str
    INFLUX_ORG: str
    INFLUX_BUCKET: str

    UPSTASH_REDIS_REST_URL: str
    UPSTASH_REDIS_REST_TOKEN: str

    model_config = {
        "env_file": ".env",
        "extra": "ignore"
    }

settings = Settings()