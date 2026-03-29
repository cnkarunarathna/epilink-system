"""Forecasting module entry point."""
from .weekly import generate_weekly_forecast

if __name__ == "__main__":
    success = generate_weekly_forecast()
    if not success:
        exit(1)
