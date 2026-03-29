# Enhanced Model Approach (V2)

## Overview

This module contains the advanced ensemble approach for dengue case prediction, featuring comprehensive feature engineering, hyperparameter optimization, and uncertainty quantification.

## Methodology

### Features Used (60 total)

| Category          | Features | Purpose                                |
| ----------------- | -------- | -------------------------------------- |
| Lag Features      | 10       | Case history (lag 1-4) + rolling stats |
| Cyclical          | 6        | Week/month sin/cos, monsoon indicators |
| Weather Lags      | 6        | Delayed weather effects                |
| Trend             | 5        | Week-over-week changes, momentum       |
| Interaction       | 3        | Temperature-humidity combined effects  |
| Population        | 3        | Density normalization                  |
| District Encoding | 25       | One-hot encoded districts              |

### Model Architecture

- **Algorithm**: Weighted Ensemble (XGBoost 60%, LightGBM 40%)
- **Hyperparameters**: Optuna-optimized (50 trials)
- **Validation**: TimeSeriesSplit (3-fold temporal CV)
- **Uncertainty**: Quantile regression for 80% confidence intervals

## Performance Metrics

| Metric      | Value              |
| ----------- | ------------------ |
| Test MAE    | ~2.2 cases         |
| Test R²     | ~0.99              |
| CI Coverage | ~79% (target: 80%) |

## Key Improvements Over Legacy

| Aspect      | Legacy       | Enhanced             |
| ----------- | ------------ | -------------------- |
| Features    | 31           | 60                   |
| Models      | 1 (XGBoost)  | 2 (Ensemble)         |
| Tuning      | None         | Optuna (50 trials)   |
| Validation  | Random split | TimeSeriesSplit      |
| Uncertainty | None         | 80% CI + Risk levels |
| MAE         | ~3.0         | ~2.2 (25% better)    |

## Usage

```python
from src.enhanced import FeatureEngineer, DengueEnsemblePredictor

engineer = FeatureEngineer()
df_features, feature_names = engineer.engineer_features(df)

ensemble = DengueEnsemblePredictor()
ensemble.train(X_train, y_train, X_val, y_val)
predictions = ensemble.predict(X_test)
```

Or via CLI:

```bash
uv run train-enhanced
uv run train-enhanced --tune --n_trials 100
```

## Module Structure

```
enhanced/
├── __init__.py              # Package exports
├── feature_engineering.py   # 60-feature creation pipeline
├── model_tuning.py          # Optuna hyperparameter optimization
├── ensemble_model.py        # XGBoost + LightGBM ensemble
├── uncertainty_estimation.py # Confidence intervals + risk levels
├── evaluation.py            # Comprehensive metrics
├── train.py                 # Training entry point
└── README.md                # This file
```

## Files

| File                        | Description                               |
| --------------------------- | ----------------------------------------- |
| `feature_engineering.py`    | Creates 60 features from raw data         |
| `model_tuning.py`           | Optuna + TimeSeriesSplit optimization     |
| `ensemble_model.py`         | Weighted ensemble predictor               |
| `uncertainty_estimation.py` | Quantile regression + risk classification |
| `evaluation.py`             | MAE, RMSE, R², cross-validation           |
| `train.py`                  | Unified training pipeline                 |
