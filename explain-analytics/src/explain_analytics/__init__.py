import uvicorn


def main() -> None:
    uvicorn.run("explain_analytics.main:app", host="0.0.0.0", port=8010, reload=True)
