import uvicorn


def serve() -> None:
    """Start the route optimizer with hot-reload (development entry point)."""
    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=True)
