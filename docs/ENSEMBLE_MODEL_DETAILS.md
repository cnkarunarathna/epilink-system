# EpiLink ML Enhancement Suite

## Overview

This document describes the comprehensive machine learning enhancements implemented for the EpiLink Dengue Forecasting System. The enhancements transform the original single-model approach into a production-grade ensemble system with advanced feature engineering, hyperparameter optimization, and uncertainty quantification.

---

## Performance Improvements

| Metric                   | Before Enhancement | After Enhancement | Improvement               |
| ------------------------ | ------------------ | ----------------- | ------------------------- |
| **Test MAE**             | 2.95 cases         | 2.22 cases        | **25% reduction**         |
| **Test R²**              | 0.982              | 0.991             | **Near-perfect fit**      |
| **Training R²**          | 0.929              | 0.946             | **Better generalization** |
| **Features**             | ~10                | 60                | **6x more signals**       |
| **Confidence Intervals** | ❌ None            | ✅ 80% CI         | **New capability**        |
| **Risk Classification**  | ❌ None            | ✅ 4 levels       | **New capability**        |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EpiLink ML Pipeline v2.0                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Raw Data   │───▶│   Feature    │───▶│   Ensemble   │       │
│  │  (CSV/DB)    │    │  Engineering │    │    Model     │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                            │                    │                │
│                            ▼                    ▼                │
│                    ┌──────────────┐    ┌──────────────┐         │
│                    │   60 Rich    │    │   XGBoost    │         │
│                    │   Features   │    │  (60% wt)    │         │
│                    └──────────────┘    ├──────────────┤         │
│                                        │  LightGBM    │         │
│                                        │  (40% wt)    │         │
│                                        └──────────────┘         │
│                                               │                  │
│                                               ▼                  │
│                                    ┌──────────────────┐         │
│                                    │   Uncertainty    │         │
│                                    │   Estimation     │         │
│                                    └──────────────────┘         │
│                                               │                  │
│                                               ▼                  │
│                              ┌────────────────────────┐         │
│                              │  Prediction + CI +     │         │
│                              │  Risk Level            │         │
│                              └────────────────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Feature Engineering

### Module: `feature_engineering.py`

The feature engineering module creates 60 rich features from raw dengue and weather data.

### 1.1 Lag Features (10 features)

Capture temporal dependencies and auto-correlation patterns.

```python
# Cases from previous weeks
cases_lag1  # 1 week ago
cases_lag2  # 2 weeks ago
cases_lag3  # 3 weeks ago
cases_lag4  # 4 weeks ago
```

**Rationale**: Dengue outbreaks have memory - current cases depend heavily on recent history due to mosquito breeding cycles (10-14 days).

### 1.2 Rolling Statistics (6 features)

Smooth out noise and capture trends.

```python
cases_mean_4w   # 4-week rolling mean
cases_std_4w    # 4-week standard deviation (volatility)
cases_max_4w    # 4-week maximum (peak detection)
cases_mean_8w   # 8-week rolling mean (longer trend)
cases_std_8w    # 8-week standard deviation
cases_max_8w    # 8-week maximum
```

**Rationale**: Rolling statistics help distinguish between random fluctuations and genuine trend changes.

### 1.3 Cyclical/Seasonal Features (6 features)

Encode temporal patterns without discontinuities.

```python
# Week-of-year encoding (handles week 52 → week 1 transition)
week_sin = sin(2π × week / 52)
week_cos = cos(2π × week / 52)

# Month encoding
month_sin = sin(2π × month / 12)
month_cos = cos(2π × month / 12)

# Monsoon indicators (Sri Lanka specific)
is_southwest_monsoon  # May-September (Yala)
is_northeast_monsoon  # December-February (Maha)
```

**Rationale**: Sin/cos encoding preserves cyclical relationships (December is close to January). Monsoons directly affect mosquito breeding conditions.

### 1.4 Trend Features (5 features)

Detect acceleration and outbreak momentum.

```python
cases_wow_change      # Week-over-week absolute change
cases_wow_pct_change  # Week-over-week percentage change
cases_trend_3w        # 3-week trend direction
is_accelerating       # Boolean: is growth accelerating?
outbreak_momentum     # Composite momentum score
```

**Rationale**: Early outbreak detection requires understanding not just current levels, but rate of change and acceleration.

### 1.5 Weather Lag Features (6 features)

Account for delayed weather effects on mosquito populations.

```python
temp_lag1       # Temperature 1 week ago
precip_lag1     # Precipitation 1 week ago
precip_lag2     # Precipitation 2 weeks ago
humidity_lag1   # Humidity 1 week ago
```

**Rationale**: Weather affects mosquito breeding with a delay (rain creates breeding sites → larvae develop → adult mosquitoes → disease transmission = 2-3 weeks).

### 1.6 Interaction Features (3 features)

Capture non-linear weather effects.

```python
temp_humidity_interaction  # Temperature × Humidity
is_optimal_breeding        # Boolean: conditions favor mosquitoes (25-30°C, >70% humidity)
hot_wet_index             # Combined heat and moisture index
```

**Rationale**: Mosquito breeding is optimal under specific combined conditions, not just individual factors.

### 1.7 Population Features (3 features)

Normalize for district size and urbanization.

```python
population_density       # People per km²
log_population_density   # Log-transformed (handles outliers like Colombo)
population_density_norm  # Min-max normalized [0, 1]
```

**Rationale**: Higher population density generally correlates with higher transmission rates.

### 1.8 District Encoding (25 features)

One-hot encoding for all 25 Sri Lankan districts.

```python
district_Colombo, district_Gampaha, district_Kandy, ...
```

---

## 2. Model Training Optimization

### Module: `model_tuning.py`

### 2.1 TimeSeriesSplit Cross-Validation

Prevents data leakage by respecting temporal ordering.

```
Fold 1: Train [====]     | Val [=]
Fold 2: Train [======]   | Val [=]
Fold 3: Train [========] | Val [=]
```

**Why it matters**: Random K-Fold would allow the model to "peek" into the future during training, causing overly optimistic validation scores.

### 2.2 Optuna Hyperparameter Optimization

Bayesian optimization with TPE (Tree-structured Parzen Estimator).

**Tuned Parameters:**

| Parameter          | Search Space | Best Value |
| ------------------ | ------------ | ---------- |
| `n_estimators`     | 100-1000     | 477        |
| `max_depth`        | 3-12         | 4          |
| `learning_rate`    | 0.01-0.3     | 0.09       |
| `subsample`        | 0.6-1.0      | 0.77       |
| `colsample_bytree` | 0.6-1.0      | 0.83       |
| `min_child_weight` | 1-10         | 2          |
| `reg_alpha`        | 1e-8 - 10    | 1.74       |
| `reg_lambda`       | 1e-8 - 10    | 0.017      |
| `gamma`            | 0-5          | 0.33       |

**Optimization Strategy:**

- 50 trials per model
- 3-fold TimeSeriesSplit CV
- Early pruning of unpromising trials
- MAE as optimization objective

---

## 3. Ensemble Architecture

### Module: `ensemble_model.py`

### 3.1 Model Combination

Weighted averaging of two gradient boosting models:

| Model        | Weight | Strengths                                  |
| ------------ | ------ | ------------------------------------------ |
| **XGBoost**  | 60%    | Robust to outliers, handles missing values |
| **LightGBM** | 40%    | Faster training, better generalization     |

### 3.2 Prediction Formula

```python
final_prediction = 0.6 × XGBoost_pred + 0.4 × LightGBM_pred
```

### 3.3 Why Ensemble?

- **Reduced variance**: Different models make different errors
- **Better generalization**: Combines diverse learning algorithms
- **Uncertainty estimation**: Model disagreement indicates uncertainty

---

## 4. Uncertainty Quantification

### Module: `uncertainty_estimation.py`

### 4.1 Quantile Regression

Train separate models for different quantiles:

```python
Q10_model → Predicts 10th percentile (lower bound)
Q50_model → Predicts 50th percentile (median)
Q90_model → Predicts 90th percentile (upper bound)
```

**80% Confidence Interval** = [Q10, Q90]

### 4.2 Risk Level Classification

| Risk Level   | Threshold   | Color     | Recommended Action         |
| ------------ | ----------- | --------- | -------------------------- |
| **Low**      | < 10 cases  | 🟢 Green  | Routine surveillance       |
| **Medium**   | 10-30 cases | 🟡 Orange | Enhanced monitoring        |
| **High**     | 30-50 cases | 🔴 Red    | Activate outbreak response |
| **Critical** | > 50 cases  | 🟣 Purple | Emergency intervention     |

### 4.3 Coverage Calibration

Actual coverage achieved: **79%** (target: 80%) ✅

---

## 5. API Enhancements

### Module: `app.py`

### 5.1 Enhanced Prediction Response

**Before:**

```json
{
  "district": "Colombo",
  "predicted_cases": 42
}
```

**After:**

```json
{
  "district": "Colombo",
  "predicted_cases": 42,
  "confidence_interval": {
    "lower": 35,
    "upper": 49,
    "confidence_level": 0.8
  },
  "risk_level": "high",
  "model_version": "2.0.0"
}
```

### 5.2 New Endpoints

| Endpoint                  | Method | Description                            |
| ------------------------- | ------ | -------------------------------------- |
| `/predict`                | POST   | Single district prediction with CI     |
| `/predict/bulk`           | POST   | All districts, same features           |
| `/predict/bulk/districts` | POST   | Multiple districts, different features |
| `/model/info`             | GET    | Model metadata and metrics             |
| `/districts`              | GET    | List of supported districts            |
| `/risk/thresholds`        | GET    | Risk classification thresholds         |

---

## 6. File Structure

```
epilink-ml-model/
├── feature_engineering.py    # 60-feature creation pipeline
├── model_tuning.py          # Optuna + TimeSeriesSplit
├── ensemble_model.py        # XGBoost + LightGBM ensemble
├── uncertainty_estimation.py # Quantile regression + risk levels
├── evaluation.py            # Comprehensive metrics
├── train_enhanced.py        # Unified training script
├── train_enhanced.sh        # Training workflow script
├── backfill_humidity.py     # Weather data backfill
├── app.py                   # Enhanced FastAPI endpoints
├── database_schema.sql      # Updated with humidity + population
├── models/
│   ├── dengue_ensemble_model.pkl
│   ├── uncertainty_estimator.pkl
│   ├── feature_engineer.pkl
│   └── model_metadata.pkl
└── tests/
    ├── test_feature_engineering.py
    └── test_ensemble.py
```

---

## 7. Training Workflow

### Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Basic training
./train_enhanced.sh

# With hyperparameter tuning (recommended)
./train_enhanced.sh --tune

# With database setup
./train_enhanced.sh --setup-db --tune
```

### Training Output

```
Training Performance:
   MAE: 2.234
   R²:  0.946

Test Performance:
   MAE: 2.221
   R²:  0.991

Top 10 Features:
   cases_mean_4w: 328.66
   outbreak_momentum: 323.00
   cases_trend_3w: 238.01
   cases_lag3: 188.01
   cases_lag2: 169.51
```

---

## 8. Dependencies

```
# requirements.txt additions
xgboost>=2.0.0
lightgbm>=4.1.0
catboost>=1.2.0      # Optional ensemble member
optuna>=3.4.0        # Hyperparameter optimization
shap>=0.43.0         # Model interpretability
```

---

## 9. Future Improvements

1. **CatBoost Integration**: Add as third ensemble member
2. **SHAP Explanations**: Per-prediction feature importance
3. **Online Learning**: Model updates with streaming data
4. **Spatial Features**: Geographic clustering and neighbor effects
5. **External Data**: Incorporate climate indices (ENSO, IOD)

---

## 10. References

- Chen, T., & Guestrin, C. (2016). XGBoost: A Scalable Tree Boosting System
- Ke, G., et al. (2017). LightGBM: A Highly Efficient Gradient Boosting Decision Tree
- Akiba, T., et al. (2019). Optuna: A Next-generation Hyperparameter Optimization Framework
- Koenker, R. (2005). Quantile Regression

---

_Last Updated: January 13, 2026_  
_Model Version: 2.0.0_
