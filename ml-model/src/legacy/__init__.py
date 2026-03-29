"""
Legacy (V1) Model Implementation

The original single-model approach using XGBoost with basic features:
- 6 core features (3 lags, 1 rolling mean, 2 weather)
- 25 one-hot encoded district columns
- Simple 80/20 train-test split
- No hyperparameter tuning
- No uncertainty estimation

This module is preserved for academic comparison with the enhanced approach.
"""
