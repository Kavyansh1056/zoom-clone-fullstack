import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
from routers.meetings import router as meetings_router
from websocket.signaling import router as signaling_router
from seed import seed_database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zoom_backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist and seed initial data
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Checking database seed data...")
    seed_database(clear_existing=False)
    logger.info("Application startup completed successfully.")
    yield
    # Shutdown
    logger.info("Application shutting down...")


app = FastAPI(
    title="Zoom Clone Video Conferencing API",
    description="High-performance backend with FastAPI, SQLAlchemy, SQLite, and WebRTC WebSocket Signaling.",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
cors_origins_env = os.getenv("CORS_ORIGINS", "")
frontend_url = os.getenv("FRONTEND_URL", "").strip()

origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
if frontend_url and frontend_url not in origins:
    origins.append(frontend_url)

# Always ensure local development origins are permitted
for default_origin in ["http://localhost:3000", "http://127.0.0.1:3000"]:
    if default_origin not in origins and "*" not in origins:
        origins.append(default_origin)

has_wildcard = "*" in origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if has_wildcard else origins,
    allow_credentials=not has_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(meetings_router)
app.include_router(signaling_router)


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Zoom Clone Video Conferencing API",
        "version": "1.0.0",
        "documentation": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=True)
