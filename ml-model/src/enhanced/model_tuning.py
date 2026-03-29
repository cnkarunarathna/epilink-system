"""
Model Tuning Module for EpiLink Dengue Prediction

Uses Optuna for hyperparameter optimization with TimeSeriesSplit cross-validation.
Supports XGBoost, LightGBM, and CatBoost models.
"""

import numpy as np
import pandas as pd
import optuna
from optuna.samplers import TPESampler
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor
import lightgbm as lgb
import platform
import joblib
import os
from typing import Dict, Any, Tuple, Optional, List
from datetime import datetime

# Suppress Optuna logging
optuna.logging.set_verbosity(optuna.logging.WARNING)


class ModelTuner:
    """
    Hyperparameter tuning using Optuna with TimeSeriesSplit cross-validation.
    
    Attributes:
        model_type: Type of model ('xgboost', 'lightgbm', 'catboost')
        n_trials: Number of Optuna trials
        n_splits: Number of TimeSeriesSplit folds
        random_state: Random seed
    """
    
    def __init__(
        self,
        model_type: str = "xgboost",
        n_trials: int = 100,
        n_splits: int = 5,
        random_state: int = 42,
        early_stopping_rounds: int = 20,
    ):
        """
        Initialize the model tuner.
        
        Args:
            model_type: 'xgboost', 'lightgbm', or 'catboost'
            n_trials: Number of Optuna optimization trials
            n_splits: Number of cross-validation folds
            random_state: Random seed for reproducibility
            early_stopping_rounds: Rounds for early stopping during tuning
        """
        self.model_type = model_type.lower()
        self.n_trials = n_trials
        self.n_splits = n_splits
        self.random_state = random_state
        self.early_stopping_rounds = early_stopping_rounds
        
        self.best_params: Dict[str, Any] = {}
        self.best_score: float = float("inf")
        self.study: Optional[optuna.Study] = None
        
        # Detect device
        system = platform.system()
        machine = platform.machine()
        self.is_apple_silicon = system == "Darwin" and machine == "arm64"
        self.device = "cpu" if self.is_apple_silicon else "cuda"
    
    def _get_xgboost_params(self, trial: optuna.Trial) -> Dict[str, Any]:
        """Get XGBoost hyperparameter search space."""
        return {
            "n_estimators": trial.suggest_int("n_estimators", 100, 1000),
            "max_depth": trial.suggest_int("max_depth", 3, 12),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-8, 10.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-8, 10.0, log=True),
            "gamma": trial.suggest_float("gamma", 0, 5),
            "tree_method": "hist",
            "device": self.device,
            "random_state": self.random_state,
            "n_jobs": -1,
        }
    
    def _get_lightgbm_params(self, trial: optuna.Trial) -> Dict[str, Any]:
        """Get LightGBM hyperparameter search space."""
        return {
            "n_estimators": trial.suggest_int("n_estimators", 100, 1000),
            "max_depth": trial.suggest_int("max_depth", 3, 12),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "min_child_samples": trial.suggest_int("min_child_samples", 5, 100),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-8, 10.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-8, 10.0, log=True),
            "num_leaves": trial.suggest_int("num_leaves", 20, 150),
            "random_state": self.random_state,
            "n_jobs": -1,
            "verbose": -1,
        }
    
    def _create_model(self, params: Dict[str, Any]) -> Any:
        """Create a model instance with given parameters."""
        if self.model_type == "xgboost":
            return XGBRegressor(**params)
        elif self.model_type == "lightgbm":
            return lgb.LGBMRegressor(**params)
        else:
            raise ValueError(f"Unknown model type: {self.model_type}")
    
    def _objective(
        self,
        trial: optuna.Trial,
        X: pd.DataFrame,
        y: pd.Series
    ) -> float:
        """
        Optuna objective function for hyperparameter optimization.
        
        Uses TimeSeriesSplit cross-validation to respect temporal ordering.
        """
        # Get parameters based on model type
        if self.model_type == "xgboost":
            params = self._get_xgboost_params(trial)
        elif self.model_type == "lightgbm":
            params = self._get_lightgbm_params(trial)
        else:
            raise ValueError(f"Unknown model type: {self.model_type}")
        
        # TimeSeriesSplit cross-validation
        tscv = TimeSeriesSplit(n_splits=self.n_splits)
        cv_scores = []
        
        for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
            X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
            y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]
            
            model = self._create_model(params)
            
            if self.model_type == "xgboost":
                model.fit(
                    X_train, y_train,
                    eval_set=[(X_val, y_val)],
                    verbose=False,
                )
            elif self.model_type == "lightgbm":
                model.fit(
                    X_train, y_train,
                    eval_set=[(X_val, y_val)],
                )
            
            y_pred = model.predict(X_val)
            mae = mean_absolute_error(y_val, y_pred)
            cv_scores.append(mae)
            
            # Pruning
            trial.report(np.mean(cv_scores), fold)
            if trial.should_prune():
                raise optuna.TrialPruned()
        
        return np.mean(cv_scores)
    
    def tune(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        show_progress: bool = True
    ) -> Dict[str, Any]:
        """
        Run hyperparameter optimization.
        
        Args:
            X: Feature DataFrame
            y: Target Series
            show_progress: Whether to show progress bar
            
        Returns:
            Dictionary of best hyperparameters
        """
        print(f"\nTuning {self.model_type.upper()} with Optuna")
        print(f"   Trials: {self.n_trials}")
        print(f"   CV Folds: {self.n_splits}")
        print(f"   Device: {self.device}")
        
        sampler = TPESampler(seed=self.random_state)
        self.study = optuna.create_study(
            direction="minimize",
            sampler=sampler,
            pruner=optuna.pruners.MedianPruner(n_warmup_steps=5)
        )
        
        self.study.optimize(
            lambda trial: self._objective(trial, X, y),
            n_trials=self.n_trials,
            show_progress_bar=show_progress,
            n_jobs=1,  # Sequential for reproducibility
        )
        
        self.best_params = self.study.best_params
        self.best_score = self.study.best_value
        
        # Add fixed params back
        if self.model_type == "xgboost":
            self.best_params.update({
                "tree_method": "hist",
                "device": self.device,
                "random_state": self.random_state,
                "n_jobs": -1,
            })
        elif self.model_type == "lightgbm":
            self.best_params.update({
                "random_state": self.random_state,
                "n_jobs": -1,
                "verbose": -1,
            })
        
        print(f"\nBest MAE: {self.best_score:.4f}")
        print(f"   Best params: {self.best_params}")
        
        return self.best_params
    
    def train_best_model(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_test: Optional[pd.DataFrame] = None,
        y_test: Optional[pd.Series] = None,
    ) -> Tuple[Any, Dict[str, float]]:
        """
        Train a model with the best found hyperparameters.
        
        Args:
            X_train: Training features
            y_train: Training target
            X_test: Optional test features for evaluation
            y_test: Optional test target
            
        Returns:
            Tuple of (trained model, metrics dict)
        """
        if not self.best_params:
            raise ValueError("No best params found. Run tune() first.")
        
        print(f"\nTraining final {self.model_type.upper()} model...")
        
        model = self._create_model(self.best_params)
        model.fit(X_train, y_train)
        
        metrics = {}
        
        # Training metrics
        y_train_pred = model.predict(X_train)
        metrics["train_mae"] = mean_absolute_error(y_train, y_train_pred)
        metrics["train_rmse"] = np.sqrt(mean_squared_error(y_train, y_train_pred))
        metrics["train_r2"] = r2_score(y_train, y_train_pred)
        
        # Test metrics (if provided)
        if X_test is not None and y_test is not None:
            y_test_pred = model.predict(X_test)
            metrics["test_mae"] = mean_absolute_error(y_test, y_test_pred)
            metrics["test_rmse"] = np.sqrt(mean_squared_error(y_test, y_test_pred))
            metrics["test_r2"] = r2_score(y_test, y_test_pred)
        
        print(f"   Train MAE: {metrics['train_mae']:.4f}")
        print(f"   Train R²: {metrics['train_r2']:.4f}")
        if "test_mae" in metrics:
            print(f"   Test MAE: {metrics['test_mae']:.4f}")
            print(f"   Test R²: {metrics['test_r2']:.4f}")
        
        return model, metrics
    
    def get_optimization_history(self) -> pd.DataFrame:
        """Get the optimization history as a DataFrame."""
        if self.study is None:
            return pd.DataFrame()
        
        history = []
        for trial in self.study.trials:
            if trial.state == optuna.trial.TrialState.COMPLETE:
                history.append({
                    "trial": trial.number,
                    "value": trial.value,
                    **trial.params
                })
        
        return pd.DataFrame(history)


def cross_validate_model(
    model: Any,
    X: pd.DataFrame,
    y: pd.Series,
    n_splits: int = 5
) -> Dict[str, List[float]]:
    """
    Perform TimeSeriesSplit cross-validation on a model.
    
    Args:
        model: Sklearn-compatible model
        X: Feature DataFrame
        y: Target Series
        n_splits: Number of CV folds
        
    Returns:
        Dictionary with lists of metrics per fold
    """
    tscv = TimeSeriesSplit(n_splits=n_splits)
    
    results = {
        "mae": [],
        "rmse": [],
        "r2": [],
        "mape": [],
    }
    
    print(f"\n{n_splits}-Fold TimeSeriesSplit Cross-Validation")
    print("-" * 50)
    
    for fold, (train_idx, val_idx) in enumerate(tscv.split(X), 1):
        X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]
        
        # Clone model for fresh training
        model_clone = model.__class__(**model.get_params())
        model_clone.fit(X_train, y_train)
        
        y_pred = model_clone.predict(X_val)
        
        mae = mean_absolute_error(y_val, y_pred)
        rmse = np.sqrt(mean_squared_error(y_val, y_pred))
        r2 = r2_score(y_val, y_pred)
        mape = np.mean(np.abs((y_val - y_pred) / np.maximum(y_val, 1))) * 100
        
        results["mae"].append(mae)
        results["rmse"].append(rmse)
        results["r2"].append(r2)
        results["mape"].append(mape)
        
        print(f"Fold {fold}: MAE={mae:.3f}, RMSE={rmse:.3f}, R²={r2:.3f}, MAPE={mape:.1f}%")
    
    print("-" * 50)
    print(f"Mean:  MAE={np.mean(results['mae']):.3f} ± {np.std(results['mae']):.3f}")
    print(f"       R²={np.mean(results['r2']):.3f} ± {np.std(results['r2']):.3f}")
    
    return results


def save_tuning_results(
    tuner: ModelTuner,
    model: Any,
    metrics: Dict[str, float],
    output_dir: str = "models"
):
    """Save tuning results, model, and metrics."""
    os.makedirs(output_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Save model
    model_path = os.path.join(output_dir, f"tuned_{tuner.model_type}_{timestamp}.pkl")
    joblib.dump(model, model_path)
    
    # Save results
    results = {
        "model_type": tuner.model_type,
        "best_params": tuner.best_params,
        "best_cv_score": tuner.best_score,
        "final_metrics": metrics,
        "n_trials": tuner.n_trials,
        "n_splits": tuner.n_splits,
        "timestamp": timestamp,
    }
    
    results_path = os.path.join(output_dir, f"tuning_results_{tuner.model_type}_{timestamp}.pkl")
    joblib.dump(results, results_path)
    
    print(f"\nSaved model to: {model_path}")
    print(f"   Saved results to: {results_path}")
    
    return model_path, results_path


if __name__ == "__main__":
    print("=" * 60)
    print("EpiLink Model Tuning Module")
    print("=" * 60)
    
    # Example usage
    print("\nThis module provides:")
    print("  - Optuna hyperparameter optimization")
    print("  - TimeSeriesSplit cross-validation")
    print("  - Support for XGBoost, LightGBM")
    print("\nUsage:")
    print("  tuner = ModelTuner(model_type='xgboost', n_trials=50)")
    print("  best_params = tuner.tune(X, y)")
    print("  model, metrics = tuner.train_best_model(X_train, y_train, X_test, y_test)")
