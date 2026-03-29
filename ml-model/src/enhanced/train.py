"""
Enhanced Training Pipeline Entry Point

This is the main entry point for training the enhanced ensemble model.
It integrates all enhanced modules: feature engineering, hyperparameter
tuning, ensemble training, and uncertainty estimation.

Usage:
    # From project root:
    uv run train-enhanced
    
    # Or directly:
    python -m src.enhanced.train [--tune] [--n_trials 50]
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

# Ensure proper imports
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.enhanced.feature_engineering import FeatureEngineer
from src.enhanced.model_tuning import ModelTuner
from src.enhanced.ensemble_model import DengueEnsemblePredictor
from src.enhanced.uncertainty_estimation import UncertaintyEstimator
from src.utils.districts import DISTRICTS


# Configuration
DATA_FILE = PROJECT_ROOT / "data" / "srilanka_weekly_dengue.csv"
WEATHER_DIR = PROJECT_ROOT / "data" / "weather_data"
MODEL_OUTPUT_DIR = PROJECT_ROOT / "models" / "enhanced"
MODEL_VERSION = "2.0.0"


def load_and_prepare_data() -> pd.DataFrame:
    """Load dengue and weather data, merge, and prepare for training."""
    print("\nLoading Data")
    print("=" * 50)
    
    dengue_df = pd.read_csv(DATA_FILE)
    print(f"   Loaded {len(dengue_df)} dengue case records")
    
    weather_frames = []
    for district in DISTRICTS:
        weather_file = WEATHER_DIR / f"{district}_weather.csv"
        if weather_file.exists():
            w_df = pd.read_csv(weather_file)
            w_df["district"] = district
            weather_frames.append(w_df)
    
    if weather_frames:
        weather_df = pd.concat(weather_frames, ignore_index=True)
        print(f"   Loaded weather data for {len(weather_frames)} districts")
        
        merged_df = dengue_df.merge(
            weather_df,
            on=["district", "year", "week"],
            how="left"
        )
        
        merged_df["temperature_2m_mean"] = merged_df.groupby("district")["temperature_2m_mean"].ffill()
        merged_df["precipitation_sum"] = merged_df.groupby("district")["precipitation_sum"].ffill()
        
        if "relative_humidity_mean" not in merged_df.columns:
            merged_df["relative_humidity_mean"] = 80 - (merged_df["temperature_2m_mean"] - 25) * 2
            merged_df["relative_humidity_mean"] = merged_df["relative_humidity_mean"].clip(50, 95)
    else:
        merged_df = dengue_df
        print("   No weather data found, using dengue data only")
    
    print(f"   Final dataset: {len(merged_df)} records")
    return merged_df


def engineer_features(df: pd.DataFrame) -> tuple:
    """Apply feature engineering pipeline."""
    print("\nFeature Engineering")
    print("=" * 50)
    
    engineer = FeatureEngineer(include_population=True)
    
    df_features, feature_names = engineer.engineer_features(
        df,
        target_col="cases",
        include_weather_lags=True,
        include_interactions=True,
        include_cyclical=True,
        include_trends=True,
    )
    
    df_features = df_features.dropna(subset=feature_names + ["cases"])
    
    print(f"   Created {len(feature_names)} features")
    print(f"   Dataset after feature engineering: {len(df_features)} records")
    
    return df_features, feature_names, engineer


def split_data(df: pd.DataFrame, feature_names: list) -> tuple:
    """Split data using temporal split."""
    print("\nSplitting Data")
    print("=" * 50)
    
    df = df.sort_values(["year", "week", "district"])
    
    X = df[feature_names]
    y = df["cases"]
    
    split_idx = int(len(df) * 0.8)
    
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    
    print(f"   Training: {len(X_train)} samples")
    print(f"   Testing:  {len(X_test)} samples")
    
    val_split = int(len(X_train) * 0.9)
    X_train_final = X_train.iloc[:val_split]
    y_train_final = y_train.iloc[:val_split]
    X_val = X_train.iloc[val_split:]
    y_val = y_train.iloc[val_split:]
    
    return X_train_final, X_val, X_test, y_train_final, y_val, y_test, df


def tune_models(X_train: pd.DataFrame, y_train: pd.Series, n_trials: int = 50) -> dict:
    """Hyperparameter tuning."""
    print("\nHyperparameter Tuning")
    print("=" * 50)
    
    best_params = {}
    
    xgb_tuner = ModelTuner(model_type="xgboost", n_trials=n_trials, n_splits=3)
    best_params["xgboost"] = xgb_tuner.tune(X_train, y_train)
    
    lgbm_tuner = ModelTuner(model_type="lightgbm", n_trials=n_trials, n_splits=3)
    best_params["lightgbm"] = lgbm_tuner.tune(X_train, y_train)
    
    return best_params


def train_ensemble(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    tuned_params: dict = None,
) -> DengueEnsemblePredictor:
    """Train the ensemble model."""
    ensemble = DengueEnsemblePredictor(include_catboost=False)
    
    if tuned_params:
        if "xgboost" in tuned_params:
            ensemble.set_params("xgboost", tuned_params["xgboost"])
        if "lightgbm" in tuned_params:
            ensemble.set_params("lightgbm", tuned_params["lightgbm"])
    
    ensemble.train(X_train, y_train, X_val, y_val, verbose=True)
    return ensemble


def save_models(ensemble, uncertainty, engineer, feature_names, metrics):
    """Save all trained models."""
    print("\nSaving Models")
    print("=" * 50)
    
    MODEL_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    ensemble.save(str(MODEL_OUTPUT_DIR / "dengue_ensemble_model.pkl"))
    
    joblib.dump(uncertainty, MODEL_OUTPUT_DIR / "uncertainty_estimator.pkl")
    joblib.dump(engineer, MODEL_OUTPUT_DIR / "feature_engineer.pkl")
    
    metadata = {
        "version": MODEL_VERSION,
        "trained_at": datetime.now().isoformat(),
        "feature_names": feature_names,
        "metrics": metrics,
    }
    joblib.dump(metadata, MODEL_OUTPUT_DIR / "model_metadata.pkl")
    
    print("   Models saved to models/enhanced/")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Enhanced EpiLink Model Training")
    parser.add_argument("--tune", action="store_true", help="Run hyperparameter tuning")
    parser.add_argument("--n_trials", type=int, default=50, help="Number of tuning trials")
    args = parser.parse_args()
    
    print("=" * 60)
    print("EpiLink Enhanced Training Pipeline")
    print(f"   Version: {MODEL_VERSION}")
    print("=" * 60)
    
    df = load_and_prepare_data()
    df_features, feature_names, engineer = engineer_features(df)
    X_train, X_val, X_test, y_train, y_val, y_test, full_df = split_data(df_features, feature_names)
    
    tuned_params = None
    if args.tune:
        tuned_params = tune_models(
            pd.concat([X_train, X_val]),
            pd.concat([y_train, y_val]),
            n_trials=args.n_trials,
        )
    
    ensemble = train_ensemble(X_train, y_train, X_val, y_val, tuned_params)
    
    uncertainty = UncertaintyEstimator(confidence_level=0.80)
    uncertainty.fit(pd.concat([X_train, X_val]), pd.concat([y_train, y_val]), verbose=True)
    
    # Evaluate
    from sklearn.metrics import mean_absolute_error, r2_score
    y_pred = ensemble.predict(X_test)
    metrics = {
        "test_mae": mean_absolute_error(y_test, y_pred),
        "test_r2": r2_score(y_test, y_pred),
    }
    
    print(f"\n   Test MAE: {metrics['test_mae']:.3f}")
    print(f"   Test R²:  {metrics['test_r2']:.3f}")
    
    save_models(ensemble, uncertainty, engineer, feature_names, metrics)
    
    print("\nTraining Complete!")


if __name__ == "__main__":
    main()
