"""
Ensemble Model for EpiLink Dengue Prediction

Combines multiple gradient boosting models (XGBoost, LightGBM, CatBoost)
for more robust predictions with uncertainty estimation.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor
import lightgbm as lgb
import joblib
import os
import platform
from datetime import datetime


class DengueEnsemblePredictor:
    """
    Ensemble predictor combining XGBoost, LightGBM, and optionally CatBoost.
    
    Features:
    - Weighted averaging of predictions
    - Uncertainty estimation from model disagreement
    - Risk level classification
    - Model-specific predictions available
    
    Attributes:
        weights: Dictionary of model weights (sum to 1.0)
        models: Dictionary of trained models
    """
    
    def __init__(
        self,
        weights: Optional[Dict[str, float]] = None,
        include_catboost: bool = False,
    ):
        """
        Initialize the ensemble predictor.
        
        Args:
            weights: Model weights dict. Default: {'xgboost': 0.5, 'lightgbm': 0.35, 'catboost': 0.15}
            include_catboost: Whether to include CatBoost (requires catboost package)
        """
        self.include_catboost = include_catboost
        
        if weights is None:
            if include_catboost:
                self.weights = {"xgboost": 0.5, "lightgbm": 0.35, "catboost": 0.15}
            else:
                self.weights = {"xgboost": 0.6, "lightgbm": 0.4}
        else:
            self.weights = weights
        
        # Normalize weights
        total = sum(self.weights.values())
        self.weights = {k: v / total for k, v in self.weights.items()}
        
        self.models: Dict[str, Any] = {}
        self.feature_names: List[str] = []
        self.is_trained = False
        
        # Detect device
        system = platform.system()
        machine = platform.machine()
        self.is_apple_silicon = system == "Darwin" and machine == "arm64"
        self.device = "cpu" if self.is_apple_silicon else "cuda"
        
        # Model parameters (can be overridden with set_params)
        self._default_params = {
            "xgboost": {
                "n_estimators": 300,
                "learning_rate": 0.05,
                "max_depth": 8,
                "subsample": 0.8,
                "colsample_bytree": 0.8,
                "tree_method": "hist",
                "device": self.device,
                "random_state": 42,
                "n_jobs": -1,
            },
            "lightgbm": {
                "n_estimators": 300,
                "learning_rate": 0.05,
                "max_depth": 8,
                "subsample": 0.8,
                "colsample_bytree": 0.8,
                "num_leaves": 50,
                "random_state": 42,
                "n_jobs": -1,
                "verbose": -1,
            },
        }
        
        self.params = self._default_params.copy()
    
    def set_params(self, model_type: str, params: Dict[str, Any]):
        """
        Set parameters for a specific model type.
        
        Args:
            model_type: 'xgboost', 'lightgbm', or 'catboost'
            params: Parameter dictionary
        """
        if model_type in self.params:
            self.params[model_type].update(params)
        else:
            self.params[model_type] = params
    
    def train(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: Optional[pd.DataFrame] = None,
        y_val: Optional[pd.Series] = None,
        verbose: bool = True,
    ) -> Dict[str, Dict[str, float]]:
        """
        Train all ensemble models.
        
        Args:
            X_train: Training features
            y_train: Training target
            X_val: Optional validation features
            y_val: Optional validation target
            verbose: Print training progress
            
        Returns:
            Dictionary of metrics for each model
        """
        self.feature_names = list(X_train.columns)
        metrics = {}
        
        if verbose:
            print("\n" + "=" * 60)
            print("Training Ensemble Models")
            print("=" * 60)
        
        # Train XGBoost
        if "xgboost" in self.weights:
            if verbose:
                print(f"\nTraining XGBoost (weight: {self.weights['xgboost']:.2f})...")
            
            xgb_model = XGBRegressor(**self.params["xgboost"])
            
            if X_val is not None and y_val is not None:
                xgb_model.fit(
                    X_train, y_train,
                    eval_set=[(X_val, y_val)],
                    verbose=False,
                )
            else:
                xgb_model.fit(X_train, y_train)
            
            self.models["xgboost"] = xgb_model
            metrics["xgboost"] = self._evaluate_model(xgb_model, X_train, y_train, X_val, y_val)
            
            if verbose:
                print(f"   XGBoost - Train MAE: {metrics['xgboost']['train_mae']:.3f}")
                if "val_mae" in metrics["xgboost"]:
                    print(f"              Val MAE: {metrics['xgboost']['val_mae']:.3f}")
        
        # Train LightGBM
        if "lightgbm" in self.weights:
            if verbose:
                print(f"\nTraining LightGBM (weight: {self.weights['lightgbm']:.2f})...")
            
            lgbm_model = lgb.LGBMRegressor(**self.params["lightgbm"])
            
            if X_val is not None and y_val is not None:
                lgbm_model.fit(
                    X_train, y_train,
                    eval_set=[(X_val, y_val)],
                )
            else:
                lgbm_model.fit(X_train, y_train)
            
            self.models["lightgbm"] = lgbm_model
            metrics["lightgbm"] = self._evaluate_model(lgbm_model, X_train, y_train, X_val, y_val)
            
            if verbose:
                print(f"   LightGBM - Train MAE: {metrics['lightgbm']['train_mae']:.3f}")
                if "val_mae" in metrics["lightgbm"]:
                    print(f"               Val MAE: {metrics['lightgbm']['val_mae']:.3f}")
        
        # Train CatBoost (if included)
        if self.include_catboost and "catboost" in self.weights:
            try:
                from catboost import CatBoostRegressor
                
                if verbose:
                    print(f"\nTraining CatBoost (weight: {self.weights['catboost']:.2f})...")
                
                cb_params = self.params.get("catboost", {
                    "iterations": 300,
                    "learning_rate": 0.05,
                    "depth": 8,
                    "random_seed": 42,
                    "verbose": False,
                })
                
                cb_model = CatBoostRegressor(**cb_params)
                cb_model.fit(X_train, y_train, eval_set=(X_val, y_val) if X_val is not None else None)
                
                self.models["catboost"] = cb_model
                metrics["catboost"] = self._evaluate_model(cb_model, X_train, y_train, X_val, y_val)
                
                if verbose:
                    print(f"   CatBoost - Train MAE: {metrics['catboost']['train_mae']:.3f}")
            except ImportError:
                if verbose:
                    print("   CatBoost not installed, skipping...")
                # Redistribute weights
                if "catboost" in self.weights:
                    del self.weights["catboost"]
                    total = sum(self.weights.values())
                    self.weights = {k: v / total for k, v in self.weights.items()}
        
        self.is_trained = True
        
        if verbose:
            print("\n" + "=" * 60)
            print("Ensemble training complete!")
            print(f"   Models trained: {list(self.models.keys())}")
            print(f"   Weights: {self.weights}")
            print("=" * 60)
        
        return metrics
    
    def _evaluate_model(
        self,
        model: Any,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: Optional[pd.DataFrame] = None,
        y_val: Optional[pd.Series] = None,
    ) -> Dict[str, float]:
        """Evaluate a single model."""
        metrics = {}
        
        y_train_pred = model.predict(X_train)
        metrics["train_mae"] = mean_absolute_error(y_train, y_train_pred)
        metrics["train_rmse"] = np.sqrt(mean_squared_error(y_train, y_train_pred))
        metrics["train_r2"] = r2_score(y_train, y_train_pred)
        
        if X_val is not None and y_val is not None:
            y_val_pred = model.predict(X_val)
            metrics["val_mae"] = mean_absolute_error(y_val, y_val_pred)
            metrics["val_rmse"] = np.sqrt(mean_squared_error(y_val, y_val_pred))
            metrics["val_r2"] = r2_score(y_val, y_val_pred)
        
        return metrics
    
    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """
        Make weighted ensemble predictions.
        
        Args:
            X: Feature DataFrame
            
        Returns:
            Array of predictions
        """
        if not self.is_trained:
            raise ValueError("Ensemble not trained. Call train() first.")
        
        predictions = []
        weights = []
        
        for name, model in self.models.items():
            pred = model.predict(X)
            predictions.append(pred)
            weights.append(self.weights.get(name, 0))
        
        # Weighted average
        predictions = np.array(predictions)
        weights = np.array(weights)
        weights = weights / weights.sum()  # Normalize
        
        ensemble_pred = np.average(predictions, axis=0, weights=weights)
        
        # Ensure non-negative predictions
        return np.maximum(ensemble_pred, 0)
    
    def predict_with_uncertainty(
        self,
        X: pd.DataFrame
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Make predictions with uncertainty estimation.
        
        Uncertainty is estimated from disagreement between models.
        
        Args:
            X: Feature DataFrame
            
        Returns:
            Tuple of (predictions, lower_bound, upper_bound)
        """
        if not self.is_trained:
            raise ValueError("Ensemble not trained. Call train() first.")
        
        predictions = []
        for model in self.models.values():
            pred = model.predict(X)
            predictions.append(pred)
        
        predictions = np.array(predictions)
        
        # Point estimate (weighted mean)
        weights = np.array([self.weights.get(name, 0) for name in self.models.keys()])
        weights = weights / weights.sum()
        mean_pred = np.average(predictions, axis=0, weights=weights)
        
        # Uncertainty from model disagreement
        std_pred = np.std(predictions, axis=0)
        
        # Confidence interval (approximately 80% CI)
        lower_bound = np.maximum(mean_pred - 1.28 * std_pred, 0)
        upper_bound = mean_pred + 1.28 * std_pred
        
        return mean_pred, lower_bound, upper_bound
    
    def predict_individual(self, X: pd.DataFrame) -> Dict[str, np.ndarray]:
        """
        Get predictions from each individual model.
        
        Args:
            X: Feature DataFrame
            
        Returns:
            Dictionary of predictions by model name
        """
        if not self.is_trained:
            raise ValueError("Ensemble not trained. Call train() first.")
        
        return {name: model.predict(X) for name, model in self.models.items()}
    
    def get_feature_importance(self) -> pd.DataFrame:
        """
        Get aggregated feature importance across all models.
        
        Returns:
            DataFrame with feature importance scores
        """
        if not self.is_trained:
            raise ValueError("Ensemble not trained. Call train() first.")
        
        importance_data = []
        
        for name, model in self.models.items():
            if hasattr(model, "feature_importances_"):
                importance = model.feature_importances_
                for i, feat in enumerate(self.feature_names):
                    importance_data.append({
                        "model": name,
                        "feature": feat,
                        "importance": importance[i],
                    })
        
        if not importance_data:
            return pd.DataFrame()
        
        df = pd.DataFrame(importance_data)
        
        # Aggregate importance across models
        agg_importance = (
            df.groupby("feature")["importance"]
            .mean()
            .sort_values(ascending=False)
            .reset_index()
        )
        agg_importance.columns = ["feature", "mean_importance"]
        
        return agg_importance
    
    def save(self, filepath: str):
        """
        Save the ensemble model to disk.
        
        Args:
            filepath: Path to save the model
        """
        if not self.is_trained:
            raise ValueError("Cannot save untrained ensemble.")
        
        save_data = {
            "models": self.models,
            "weights": self.weights,
            "feature_names": self.feature_names,
            "params": self.params,
            "include_catboost": self.include_catboost,
            "saved_at": datetime.now().isoformat(),
        }
        
        os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else ".", exist_ok=True)
        joblib.dump(save_data, filepath)
        print(f"Ensemble saved to {filepath}")
    
    @classmethod
    def load(cls, filepath: str) -> "DengueEnsemblePredictor":
        """
        Load an ensemble model from disk.
        
        Args:
            filepath: Path to the saved model
            
        Returns:
            Loaded DengueEnsemblePredictor instance
        """
        save_data = joblib.load(filepath)
        
        ensemble = cls(
            weights=save_data["weights"],
            include_catboost=save_data["include_catboost"],
        )
        ensemble.models = save_data["models"]
        ensemble.feature_names = save_data["feature_names"]
        ensemble.params = save_data["params"]
        ensemble.is_trained = True
        
        print(f"Ensemble loaded from {filepath}")
        print(f"   Models: {list(ensemble.models.keys())}")
        
        return ensemble


def compare_models(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> pd.DataFrame:
    """
    Compare individual models vs ensemble performance.
    
    Args:
        X_train, y_train: Training data
        X_test, y_test: Test data
        
    Returns:
        DataFrame with comparison metrics
    """
    results = []
    
    # Train individual models
    print("\nModel Comparison")
    print("=" * 60)
    
    # XGBoost
    xgb = XGBRegressor(n_estimators=300, learning_rate=0.05, max_depth=8, random_state=42)
    xgb.fit(X_train, y_train)
    y_pred_xgb = xgb.predict(X_test)
    results.append({
        "Model": "XGBoost",
        "MAE": mean_absolute_error(y_test, y_pred_xgb),
        "RMSE": np.sqrt(mean_squared_error(y_test, y_pred_xgb)),
        "R²": r2_score(y_test, y_pred_xgb),
    })
    
    # LightGBM
    lgbm = lgb.LGBMRegressor(n_estimators=300, learning_rate=0.05, max_depth=8, random_state=42, verbose=-1)
    lgbm.fit(X_train, y_train)
    y_pred_lgbm = lgbm.predict(X_test)
    results.append({
        "Model": "LightGBM",
        "MAE": mean_absolute_error(y_test, y_pred_lgbm),
        "RMSE": np.sqrt(mean_squared_error(y_test, y_pred_lgbm)),
        "R²": r2_score(y_test, y_pred_lgbm),
    })
    
    # Ensemble
    ensemble = DengueEnsemblePredictor()
    split_idx = int(len(X_train) * 0.9)
    ensemble.train(
        X_train.iloc[:split_idx], y_train.iloc[:split_idx],
        X_train.iloc[split_idx:], y_train.iloc[split_idx:],
        verbose=False
    )
    y_pred_ensemble = ensemble.predict(X_test)
    results.append({
        "Model": "Ensemble",
        "MAE": mean_absolute_error(y_test, y_pred_ensemble),
        "RMSE": np.sqrt(mean_squared_error(y_test, y_pred_ensemble)),
        "R²": r2_score(y_test, y_pred_ensemble),
    })
    
    df = pd.DataFrame(results)
    print(df.to_string(index=False))
    
    return df


if __name__ == "__main__":
    print("=" * 60)
    print("EpiLink Ensemble Model Module")
    print("=" * 60)
    
    print("\nThis module provides:")
    print("  - Weighted ensemble of XGBoost + LightGBM (+ optional CatBoost)")
    print("  - Uncertainty estimation from model disagreement")
    print("  - Feature importance aggregation")
    print("\nUsage:")
    print("  ensemble = DengueEnsemblePredictor()")
    print("  ensemble.train(X_train, y_train, X_val, y_val)")
    print("  predictions = ensemble.predict(X_test)")
    print("  pred, lower, upper = ensemble.predict_with_uncertainty(X_test)")
