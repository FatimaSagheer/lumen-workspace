# ============================================================
# APPLICATION CONFIGURATION
# ============================================================
#
# This file is responsible for loading configuration/settings
# for the Lumen backend.
#
# Instead of writing sensitive or environment-specific values
# directly inside Python code, we keep them in a .env file.
#
# For example:
#
# .env
# ─────────────────────────────────────────
# DATABASE_URL=postgresql://lumen:lumen@localhost:5432/lumen
# JWT_SECRET=some-long-secret-value
# ACCESS_TOKEN_MINUTES=15
# REFRESH_TOKEN_DAYS=14
#
# Then this Python file reads those values and makes them
# available through:
#
#     settings.database_url
#     settings.jwt_secret
#     settings.access_token_minutes
#     settings.refresh_token_days
#
#
# Architecture:
#
# .env
#   ↓
# config.py
#   ↓
# settings
#   ↓
# db.py / security.py / auth.py
#


# BaseSettings is provided by pydantic-settings.
#
# It allows us to create a Python settings class whose values
# can be automatically loaded from environment variables
# and .env files.
#
# SettingsConfigDict is used to configure how BaseSettings
# should behave.
from pydantic_settings import BaseSettings, SettingsConfigDict


# ============================================================
# SETTINGS CLASS
# ============================================================

# We create our own Settings class by inheriting from
# BaseSettings.
#
# BaseSettings gives us:
#
# - Environment variable loading
# - .env file loading
# - Type validation
# - Automatic conversion of compatible values
# - Validation of required settings
#
# For example:
#
# If .env contains:
#
# ACCESS_TOKEN_MINUTES=15
#
# Pydantic can convert the string "15" into the Python integer:
#
# 15
#
class Settings(BaseSettings):


    # ========================================================
    # PYDANTIC SETTINGS CONFIGURATION
    # ========================================================

    # model_config tells Pydantic how this Settings class
    # should behave.
    #
    # SettingsConfigDict is a configuration object provided
    # by Pydantic Settings.
    model_config = SettingsConfigDict(

        # ----------------------------------------------------
        # .ENV FILE LOCATION
        # ----------------------------------------------------
        #
        # env_file tells Pydantic where to look for variables
        # if they are stored in a .env file.
        #
        # "../.env" means:
        #
        # Go one directory up from the current configuration
        # context and look for:
        #
        #     .env
        #
        # IMPORTANT:
        #
        # This path is relative to the application's working
        # directory, so you should make sure your project is
        # started from the directory where this path resolves
        # correctly.
        env_file="../.env",


        # ----------------------------------------------------
        # EXTRA VARIABLES
        # ----------------------------------------------------
        #
        # extra="ignore" means:
        #
        # "If the .env file contains variables that are NOT
        #  defined in this Settings class, ignore them."
        #
        # For example, your .env might contain:
        #
        # DATABASE_URL=...
        # JWT_SECRET=...
        # ACCESS_TOKEN_MINUTES=15
        # REFRESH_TOKEN_DAYS=14
        # MINIO_USER=...
        # REDIS_URL=...
        #
        # If MINIO_USER and REDIS_URL aren't defined in this
        # Settings class, Pydantic won't complain about them.
        #
        # This is useful because your .env may eventually
        # contain settings for PostgreSQL, Redis, MinIO, etc.
        extra="ignore",
    )


    # ========================================================
    # DATABASE CONFIGURATION
    # ========================================================

    # database_url is a REQUIRED configuration value.
    #
    # ": str" means the value must be a string.
    #
    # There is no default value here.
    #
    # Therefore Pydantic expects to find:
    #
    #     DATABASE_URL
    #
    # in the environment or .env file.
    #
    # Example:
    #
    # DATABASE_URL=postgresql://lumen:lumen@localhost:5432/lumen
    #
    # This value is later used in db.py:
    #
    #     AsyncConnectionPool(
    #         settings.database_url,
    #         ...
    #     )
    #
    database_url: str


    # ========================================================
    # JWT SECRET
    # ========================================================

    # jwt_secret is another REQUIRED configuration value.
    #
    # It is used by your JWT authentication system to sign
    # and/or verify access tokens.
    #
    # Example .env:
    #
    # JWT_SECRET=very-long-random-secret
    #
    # IMPORTANT:
    #
    # This is a SECRET.
    #
    # It should NOT be:
    #
    # - hard-coded in your Python source code
    # - committed to GitHub
    # - shared publicly
    #
    # Your security.py will eventually use:
    #
    #     settings.jwt_secret
    #
    jwt_secret: str


    # ========================================================
    # ACCESS TOKEN LIFETIME
    # ========================================================

    # access_token_minutes controls how long an access token
    # remains valid.
    #
    # The type is int, so Pydantic expects a number.
    #
    # "= 15" means the default value is 15 minutes.
    #
    # So:
    #
    #     access_token_minutes = 15
    #
    # means an access token normally expires after 15 minutes.
    #
    # Example:
    #
    # User logs in at:
    #
    # 2:00 PM
    #
    # Access token expires around:
    #
    # 2:15 PM
    #
    # The exact expiration is determined by the JWT creation
    # code.
    access_token_minutes: int = 15


    # ========================================================
    # REFRESH TOKEN LIFETIME
    # ========================================================

    # refresh_token_days controls how long a refresh token
    # remains valid.
    #
    # Default:
    #
    # 14 days
    #
    # This allows the user to remain logged in for longer
    # without entering their password every 15 minutes.
    #
    # Conceptually:
    #
    # Access token:
    #     short lifetime
    #
    # Refresh token:
    #     longer lifetime
    refresh_token_days: int = 14


# ============================================================
# CREATE SETTINGS OBJECT
# ============================================================

# This creates an actual instance of our Settings class.
#
# At this moment, Pydantic will:
#
# 1. Look for environment variables
# 2. Look at the configured .env file
# 3. Read DATABASE_URL
# 4. Read JWT_SECRET
# 5. Read ACCESS_TOKEN_MINUTES if provided
# 6. Read REFRESH_TOKEN_DAYS if provided
# 7. Validate their types
# 8. Apply defaults where necessary
#
# After this line, other files can simply import:
#
#     from .config import settings
#
# and use:
#
#     settings.database_url
#     settings.jwt_secret
#     settings.access_token_minutes
#     settings.refresh_token_days
settings = Settings()