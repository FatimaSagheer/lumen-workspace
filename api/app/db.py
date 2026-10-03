# ============================================================
# DATABASE CONNECTION / POOL
# ============================================================
#
# This file is responsible for:
#
# 1. Creating a connection pool for PostgreSQL
# 2. Configuring how database rows are returned
# 3. Providing database connections to FastAPI endpoints
#
# Instead of opening a brand-new PostgreSQL connection for
# every API request, we create a CONNECTION POOL.
#
# A connection pool keeps multiple database connections
# available and reuses them when requests need them.
#
# Conceptually:
#
# FastAPI requests
#       │
#       ├── Request 1 ──┐
#       ├── Request 2 ──┤
#       ├── Request 3 ──┤
#       └── Request 4 ──┘
#                       │
#                       ▼
#                Connection Pool
#                 │    │    │
#                 ▼    ▼    ▼
#                DB   DB   DB
#
# This is much more efficient than creating a new database
# connection for every request.


# ============================================================
# dict_row
# ============================================================
#
# dict_row tells psycopg:
#
# "When I execute a SELECT query, return each database row
#  as a dictionary."
#
# Without dict_row, a query might return something like:
#
# (
#     UUID("..."),
#     "fatima@example.com",
#     "Fatima"
# )
#
# With dict_row, the same row becomes:
#
# {
#     "id": UUID("..."),
#     "email": "fatima@example.com",
#     "name": "Fatima"
# }
#
# This is much easier to understand and use in Python.
from psycopg.rows import dict_row


# ============================================================
# AsyncConnectionPool
# ============================================================
#
# AsyncConnectionPool is provided by psycopg_pool.
#
# "Async" means it works with Python's asynchronous code.
#
# FastAPI supports async endpoints, so this allows database
# operations to work nicely with:
#
#     async def
#     await
#
# Instead of blocking the whole application while waiting
# for PostgreSQL.
from psycopg_pool import AsyncConnectionPool


# ============================================================
# SETTINGS
# ============================================================
#
# Import our application configuration.
#
# settings is expected to contain configuration values such as:
#
#     settings.database_url
#
# Example database URL:
#
# postgresql://lumen:lumen@localhost:5432/lumen
#
# The actual value should normally come from an environment
# variable rather than being hard-coded in the Python file.
from .config import settings


# ============================================================
# CREATE THE DATABASE CONNECTION POOL
# ============================================================

# AsyncConnectionPool creates a pool of reusable PostgreSQL
# connections.
#
# We pass three important things here:
#
#     1. settings.database_url
#     2. open=False
#     3. kwargs={"row_factory": dict_row}
#
pool = AsyncConnectionPool(

    # --------------------------------------------------------
    # DATABASE URL
    # --------------------------------------------------------
    #
    # settings.database_url contains the PostgreSQL connection
    # string.
    #
    # For example:
    #
    # postgresql://lumen:lumen@localhost:5432/lumen
    #
    # It tells psycopg:
    #
    # - which database server to connect to
    # - which username to use
    # - which password to use
    # - which database to use
    #
    # Your actual value comes from settings.
    settings.database_url,


    # --------------------------------------------------------
    # OPEN = FALSE
    # --------------------------------------------------------
    #
    # open=False means:
    #
    # "Create the pool object now, but don't open database
    #  connections yet."
    #
    # We deliberately control when the pool opens.
    #
    # Your main.py already has:
    #
    #     @asynccontextmanager
    #     async def lifespan(app: FastAPI):
    #         await pool.open()
    #
    # So the application lifecycle controls when the pool
    # actually connects to PostgreSQL.
    #
    # This is a clean pattern because:
    #
    # Application starts
    #       ↓
    # FastAPI lifespan starts
    #       ↓
    # pool.open()
    #       ↓
    # PostgreSQL connections become available
    #
    # Application shuts down
    #       ↓
    # pool.close()
    #       ↓
    # Database connections are released
    open=False,


    # --------------------------------------------------------
    # CONNECTION OPTIONS
    # --------------------------------------------------------
    #
    # kwargs allows us to pass additional keyword arguments
    # to psycopg whenever it creates a database connection.
    #
    # Here we tell psycopg:
    #
    #     row_factory = dict_row
    #
    # This means SELECT results should be dictionary-like rows.
    kwargs={"row_factory": dict_row}

)


# ============================================================
# DATABASE DEPENDENCY
# ============================================================

# get_conn() is a FastAPI dependency.
#
# Its purpose is to provide an active database connection
# to an API endpoint.
#
# We can use it like:
#
#     conn = Depends(get_conn)
#
# FastAPI will call get_conn() for us.
#
# Because this function is async, we use:
#
#     async def
#
# instead of:
#
#     def
async def get_conn():

    # --------------------------------------------------------
    # GET A CONNECTION FROM THE POOL
    # --------------------------------------------------------
    #
    # pool.connection() asks the connection pool for an
    # available PostgreSQL connection.
    #
    # "async with" is used because the connection needs to be
    # automatically returned to the pool when we're finished.
    #
    # Conceptually:
    #
    # Pool
    #  │
    #  ├── Connection 1
    #  ├── Connection 2 ← get_conn() borrows this
    #  └── Connection 3
    #
    # After the request:
    #
    # Connection 2 → returned to pool
    #
    # It is NOT permanently destroyed.
    async with pool.connection() as conn:

        # ----------------------------------------------------
        # YIELD THE CONNECTION
        # ----------------------------------------------------
        #
        # "yield" temporarily gives the connection to the
        # FastAPI endpoint that requested it.
        #
        # For example:
        #
        #     async def get_user(
        #         conn=Depends(get_conn)
        #     ):
        #
        # FastAPI runs get_conn(), reaches yield, and gives
        # the "conn" object to get_user().
        #
        # The endpoint can then do:
        #
        #     await conn.execute(...)
        #
        # When the endpoint finishes, execution comes back
        # here and the "async with" block cleans up the
        # connection automatically.
        yield conn