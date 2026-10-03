from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from .config import settings

pool = AsyncConnectionPool(
    settings.database_url, open=False, kwargs={"row_factory": dict_row}
)


async def get_conn():
    async with pool.connection() as conn:
        yield conn
