# EpiLink Scripts

Organized shell scripts for the EpiLink ML pipeline.

## Directory Structure

```
scripts/
├── setup/                     # Setup and initialization
│   ├── setup_all.sh          # Legacy model setup (XGBoost)
│   ├── setup_enhanced.sh     # Enhanced model setup (Ensemble) ⭐
│   └── setup_db.sh           # Database only setup
│
├── training/                  # Model training
│   ├── train_enhanced.sh     # Train enhanced ensemble (V2)
│   └── train_legacy.sh       # Train legacy XGBoost (V1)
│
└── forecasting/               # Prediction generation
    └── generate_weekly.sh    # Generate weekly forecast
```

## Quick Start

### Enhanced Model (Recommended) ⭐

```bash
# Complete setup with enhanced ensemble model
./scripts/setup/setup_enhanced.sh

# With hyperparameter tuning (better accuracy, takes longer)
./scripts/setup/setup_enhanced.sh --tune

# With custom trial count
./scripts/setup/setup_enhanced.sh --tune 100
```

**What it does:**

1. Installs dependencies via UV
2. Sets up database schema
3. Trains XGBoost + LightGBM ensemble
4. Backfills historical predictions
5. Generates weekly forecast

### Legacy Model

```bash
# Complete setup with legacy XGBoost model
./scripts/setup/setup_all.sh

# Skip training (use existing model)
./scripts/setup/setup_all.sh --skip-training
```

## Model Comparison

| Feature     | Legacy (V1)  | Enhanced (V2)                    |
| ----------- | ------------ | -------------------------------- |
| Algorithm   | XGBoost      | XGBoost + LightGBM Ensemble      |
| Tuning      | Fixed params | Optional Optuna tuning           |
| Uncertainty | None         | 80% confidence intervals         |
| Features    | Basic lags   | Advanced (cyclical, trend, etc.) |
| Best for    | Quick setup  | Production/Research              |

## Individual Commands

### Training Only

```bash
# Train enhanced ensemble model
./scripts/training/train_enhanced.sh

# With Optuna tuning
./scripts/training/train_enhanced.sh --tune

# Train legacy model
./scripts/training/train_legacy.sh
```

### Forecasting Only

```bash
./scripts/forecasting/generate_weekly.sh
```

### API Server

```bash
# Start development server (from project root)
./run.sh

# Start production server
./run_prod.sh
```

## Requirements

All scripts use **UV** package manager. If UV is not installed, setup scripts will install it automatically.
