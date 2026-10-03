# ============================================================
# main.py
# ============================================================
#
# This is the main entry point of the Lumen FastAPI backend.
#
# Its main responsibilities are:
#
# 1. Create the FastAPI application.
# 2. Open the database connection pool when the API starts.
# 3. Close the database connection pool when the API stops.
# 4. Configure CORS so the Next.js frontend can communicate
#    with the FastAPI backend.
# 5. Provide a /health endpoint to check whether the API and
#    database are working.
# 6. Register routers such as authentication routes.
#
# Overall flow:
#
#     FastAPI starts
#          ↓
#     lifespan() starts
#          ↓
#     Database pool opens
#          ↓
#     API accepts requests
#          ↓
#     Next.js → FastAPI
#          ↓
#     Routers handle requests
#          ↓
#     FastAPI shuts down
#          ↓
#     Database pool closes
#
# ============================================================


# ------------------------------------------------------------
# IMPORT: asynccontextmanager
# ------------------------------------------------------------

# "contextlib" is a Python standard-library module.
#
# "asynccontextmanager" allows us to create an asynchronous
# context manager using "async def" and "yield".
#
# We use it to define code that should run:
#
#     BEFORE the FastAPI application starts
#
# and:
#
#     AFTER the FastAPI application stops.
#
# In our case:
#
#     startup  → open database pool
#     shutdown → close database pool
from contextlib import asynccontextmanager


# ------------------------------------------------------------
# IMPORT: FastAPI
# ------------------------------------------------------------

# FastAPI is the framework we are using to build the backend API.
#
# The FastAPI class creates our application object.
#
# We will later do:
#
#     app = FastAPI(...)
#
# and run that application using Uvicorn.
from fastapi import FastAPI


# ------------------------------------------------------------
# IMPORT: CORSMiddleware
# ------------------------------------------------------------

# CORSMiddleware is middleware provided by FastAPI/Starlette.
#
# CORS = Cross-Origin Resource Sharing.
#
# Our frontend and backend run on different origins during
# development:
#
#     Next.js  → http://localhost:3000
#     FastAPI  → http://localhost:8000
#
# The browser normally restricts requests between different
# origins.
#
# CORSMiddleware tells the backend which frontend origins
# are allowed to communicate with it.
from fastapi.middleware.cors import CORSMiddleware


# ------------------------------------------------------------
# IMPORT: DATABASE POOL
# ------------------------------------------------------------

# ".db" means the db.py module in the same package.
#
# "pool" is imported from db.py.
#
# The pool is responsible for managing database connections.
#
# Instead of creating a brand-new PostgreSQL connection for
# every request, we maintain a pool of reusable connections.
from .db import pool


# ------------------------------------------------------------
# IMPORT: AUTH ROUTER
# ------------------------------------------------------------

# Import the authentication router from:
#
#     app/routers/auth.py
#
# The router will contain endpoints such as:
#
#     POST /auth/signup
#     POST /auth/login
#
# We don't want to put all endpoints inside main.py.
#
# Instead, we organize them into separate router files.
from .routers import auth



# ============================================================
# APPLICATION LIFESPAN
# ============================================================

# "@asynccontextmanager" converts the function below into an
# asynchronous context manager.
#
# FastAPI can use this function to perform startup and shutdown
# operations.
#
# "async def" means this function can perform asynchronous
# operations using "await".
#
# "app: FastAPI" means:
#
#     app
#       ↓
#     parameter name
#
#     FastAPI
#       ↓
#     expected type
#
# This is a Python type hint.
#
# "yield" separates the function into two phases:
#
#     BEFORE yield → application startup
#     AFTER yield  → application shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):


    # --------------------------------------------------------
    # STARTUP
    # --------------------------------------------------------
    #
    # "await" means:
    #
    #     Wait for this asynchronous operation to finish.
    #
    # "pool.open()" opens/initializes the database connection
    # pool.
    #
    # This happens when FastAPI starts.
    #
    # Conceptually:
    #
    #     FastAPI starts
    #          ↓
    #     pool.open()
    #          ↓
    #     PostgreSQL connections become available
    await pool.open()


    # --------------------------------------------------------
    # APPLICATION RUNNING
    # --------------------------------------------------------
    #
    # "yield" tells FastAPI:
    #
    #     "Startup is complete. Now run the application."
    #
    # Everything before yield is startup code.
    #
    # Everything after yield is shutdown code.
    #
    # While the application is running, execution stays
    # conceptually between the startup and shutdown sections.
    yield


    # --------------------------------------------------------
    # SHUTDOWN
    # --------------------------------------------------------
    #
    # Once FastAPI is shutting down, execution continues here.
    #
    # "pool.close()" closes the database connection pool.
    #
    # This is important because database connections should
    # be released cleanly.
    #
    # Otherwise connections/resources could remain open.
    await pool.close()



# ============================================================
# CREATE FASTAPI APPLICATION
# ============================================================

# Create the actual FastAPI application object.
#
# "FastAPI(...)" creates the application instance.
#
# "title" gives our API a name.
#
# The title can appear in automatically generated API
# documentation such as:
#
#     /docs
#
# "lifespan=lifespan" tells FastAPI:
#
#     Use our lifespan function when starting/stopping.
#
# Therefore:
#
#     app = FastAPI(...)
#
# creates the application that Uvicorn will run.
app = FastAPI(
    title="Lumen API",
    lifespan=lifespan
)



# ============================================================
# CORS CONFIGURATION
# ============================================================

# "add_middleware()" adds middleware to the FastAPI application.
#
# Middleware is code that runs around requests/responses.
#
# Conceptually:
#
#     Browser request
#          ↓
#       Middleware
#          ↓
#       FastAPI route
#          ↓
#       Response
#          ↓
#       Middleware
#          ↓
#       Browser
#
# Here we add CORSMiddleware.
app.add_middleware(

    # Tell FastAPI which middleware class we want to use.
    #
    # CORSMiddleware handles Cross-Origin Resource Sharing.
    CORSMiddleware,


    # --------------------------------------------------------
    # ALLOWED FRONTEND ORIGIN
    # --------------------------------------------------------
    #
    # "allow_origins" specifies exact frontend origins that
    # are allowed to make browser requests to our API.
    #
    # During local development:
    #
    #     Next.js → http://localhost:3000
    #
    #     FastAPI → http://localhost:8000
    #
    # These are DIFFERENT origins because the ports are different.
    #
    # Therefore we explicitly allow the Next.js frontend.
    allow_origins=[
        "http://localhost:3000"
    ],


    # --------------------------------------------------------
    # GITHUB CODESPACES ORIGIN
    # --------------------------------------------------------
    #
    # "allow_origin_regex" allows us to define a pattern instead
    # of listing every possible URL individually.
    #
    # GitHub Codespaces can generate URLs such as:
    #
    #     https://something-3000.app.github.dev
    #
    # The regex allows matching Codespaces frontend URLs.
    #
    # IMPORTANT:
    # This must be a valid regular-expression string.
    #
    # A cleaner version for Codespaces is:
    allow_origin_regex=r"https://.*\.app\.github\.dev",


    # --------------------------------------------------------
    # CREDENTIALS
    # --------------------------------------------------------
    #
    # "allow_credentials=True" allows the browser to include
    # credentials in cross-origin requests.
    #
    # This is particularly relevant if we use:
    #
    #     cookies
    #     authentication cookies
    #     secure session cookies
    #
    # For example, if authentication uses an HttpOnly cookie,
    # this setting can be important.
    allow_credentials=True,


    # --------------------------------------------------------
    # HTTP METHODS
    # --------------------------------------------------------
    #
    # "allow_methods" specifies which HTTP methods the frontend
    # is allowed to use.
    #
    # "*" means ALL methods.
    #
    # Examples:
    #
    #     GET
    #     POST
    #     PUT
    #     PATCH
    #     DELETE
    #     OPTIONS
    #
    # This is convenient during development.
    allow_methods=["*"],


    # --------------------------------------------------------
    # HTTP HEADERS
    # --------------------------------------------------------
    #
    # "allow_headers" specifies which HTTP request headers
    # the browser is allowed to send.
    #
    # "*" means all headers.
    #
    # This is useful because our API may eventually use headers
    # such as:
    #
    #     Content-Type
    #     Authorization
    #
    # etc.
    allow_headers=["*"],
)



# ============================================================
# HEALTH CHECK ENDPOINT
# ============================================================

# "@app.get()" is a FastAPI route decorator.
#
# It means:
#
#     When a GET request comes to /health,
#     execute the function below.
#
# Therefore:
#
#     GET http://localhost:8000/health
#
# will call the "health()" function.
@app.get("/health")


# "async def" creates an asynchronous Python function.
#
# FastAPI supports async functions so that the server can
# efficiently handle I/O operations such as database requests.
async def health():


    # "async with" creates an asynchronous context manager.
    #
    # "pool.connection()" obtains a database connection from
    # the connection pool.
    #
    # "as conn" stores that connection in the variable "conn".
    #
    # Conceptually:
    #
    #     Connection pool
    #          ↓
    #     Get available connection
    #          ↓
    #     conn
    #          ↓
    #     execute SQL
    #          ↓
    #     return connection to pool
    async with pool.connection() as conn:


        # "conn.execute()" executes SQL against PostgreSQL.
        #
        # "SELECT 1" is a very simple SQL query.
        #
        # It does not query an actual application table.
        #
        # It simply verifies that PostgreSQL can accept and
        # execute a query.
        #
        # If the database connection is broken, this operation
        # will raise an error.
        await conn.execute("SELECT 1")


    # Return a Python dictionary.
    #
    # FastAPI automatically converts dictionaries into JSON.
    #
    # Python:
    #
    #     {"status": "ok"}
    #
    # becomes HTTP JSON:
    #
    #     {
    #       "status": "ok"
    #     }
    #
    # So:
    #
    #     GET /health
    #
    # returns:
    #
    #     {"status": "ok"}
    return {"status": "ok"}



# ============================================================
# REGISTER AUTHENTICATION ROUTES
# ============================================================

# "include_router()" adds routes from another FastAPI router
# into the main application.
#
# "auth.router" comes from:
#
#     app/routers/auth.py
#
# That file can contain routes such as:
#
#     /signup
#     /login
#     /refresh
#     /logout
#
# Without include_router(), those routes would not be connected
# to the main FastAPI application.
app.include_router(auth.router)