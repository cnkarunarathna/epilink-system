# Legacy Model Approach (V1)

## Overview

This module contains the original single-model approach for dengue case prediction, preserved for academic comparison with the enhanced approach.

## Methodology

### Features Used (31 total)

| Feature Type      | Count | Description                                |
| ----------------- | ----- | ------------------------------------------ |
| Case Lags         | 3     | `cases_lag1`, `cases_lag2`, `cases_lag3`   |
| Rolling Stats     | 1     | `cases_mean_4w`                            |
| Weather           | 2     | `temperature_2m_mean`, `precipitation_sum` |
| District Encoding | 25    | One-hot encoded districts                  |

### Model Architecture

- **Algorithm**: XGBoost Regressor
- **Hyperparameters**: Default values (no tuning)
- **Validation**: Simple 80/20 random split

### Limitations

1. No temporal validation (data leakage risk)
2. No uncertainty estimation
3. No hyperparameter optimization
4. Limited feature engineering

## Performance Metrics

| Metric   | Value      |
| -------- | ---------- |
| Test MAE | ~3.0 cases |
| Test R²  | ~0.93      |

## Usage

```python
from src.legacy.train_model import main
main()
```

Or via CLI:

```bash
uv run train-legacy
```

## Files

- `train_model.py` - Training script using CSV data
- `train_model_db.py` - Training script using PostgreSQL database

## Comparison with Enhanced Approach

See [ML_ENHANCE.md](../../ML_ENHANCE.md) for detailed comparison.
