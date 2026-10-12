from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    database_url: str
    jwt_secret: str
    access_token_minutes: int = 15
    refresh_token_days: int = 14

    # Object storage (Cloudflare R2). Empty until you fill in .env
    s3_endpoint: str = model_config.S3_ENDPOINT
    s3_access_key: str = model_config.S3_ACCESS_KEY
    s3_secret_key: str = model_config.S3_SECRET_KEY
    s3_bucket: str = "lumen-docs"


settings = Settings()
