"""
Evaluation Module for EpiLink Dengue Prediction

Comprehensive model evaluation with metrics, visualization, and reporting.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple, Any
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    mean_absolute_percentage_error,
)
from sklearn.model_selection import TimeSeriesSplit
import matplotlib.pyplot as plt
import warnings

warnings.filterwarnings("ignore")


class ModelEvaluator:
    """
    Comprehensive model evaluation for dengue prediction.
    
    Provides:
    - Standard regression metrics
    - Time series cross-validation
    - District-wise analysis
    - Temporal performance analysis
    - Feature importance analysis
    """
    
    def __init__(self, model: Any):
        """
        Initialize evaluator with a trained model.
        
        Args:
            model: Trained sklearn-compatible model
        """
        self.model = model
        self.metrics: Dict[str, float] = {}
        self.district_metrics: Optional[pd.DataFrame] = None
        self.temporal_metrics: Optional[pd.DataFrame] = None
    
    def calculate_metrics(
        self,
        y_true: pd.Series,
        y_pred: np.ndarray,
        prefix: str = ""
    ) -> Dict[str, float]:
        """
        Calculate comprehensive regression metrics.
        
        Args:
            y_true: True values
            y_pred: Predicted values
            prefix: Prefix for metric names
            
        Returns:
            Dictionary of metrics
        """
        metrics = {}
        
        # Standard metrics
        metrics[f"{prefix}mae"] = mean_absolute_error(y_true, y_pred)
        metrics[f"{prefix}rmse"] = np.sqrt(mean_squared_error(y_true, y_pred))
        metrics[f"{prefix}r2"] = r2_score(y_true, y_pred)
        
        # MAPE (handle zeros)
        y_true_safe = np.maximum(y_true, 1)
        metrics[f"{prefix}mape"] = np.mean(np.abs((y_true - y_pred) / y_true_safe)) * 100
        
        # Median absolute error (more robust)
        metrics[f"{prefix}median_ae"] = np.median(np.abs(y_true - y_pred))
        
        # Explained variance
        metrics[f"{prefix}explained_var"] = 1 - np.var(y_true - y_pred) / np.var(y_true)
        
        # Max error (worst case)
        metrics[f"{prefix}max_error"] = np.max(np.abs(y_true - y_pred))
        
        # Bias (mean error)
        metrics[f"{prefix}bias"] = np.mean(y_pred - y_true)
        
        return metrics
    
    def evaluate(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        verbose: bool = True,
    ) -> Dict[str, float]:
        """
        Full model evaluation on train and test sets.
        
        Args:
            X_train, y_train: Training data
            X_test, y_test: Test data
            verbose: Print results
            
        Returns:
            Dictionary of all metrics
        """
        # Training predictions
        y_train_pred = self.model.predict(X_train)
        train_metrics = self.calculate_metrics(y_train, y_train_pred, "train_")
        
        # Test predictions
        y_test_pred = self.model.predict(X_test)
        test_metrics = self.calculate_metrics(y_test, y_test_pred, "test_")
        
        self.metrics = {**train_metrics, **test_metrics}
        
        if verbose:
            print("\n" + "=" * 60)
            print("Model Evaluation Results")
            print("=" * 60)
            print("\nTraining Set:")
            print(f"   MAE:  {train_metrics['train_mae']:.3f}")
            print(f"   RMSE: {train_metrics['train_rmse']:.3f}")
            print(f"   R²:   {train_metrics['train_r2']:.3f}")
            print(f"   MAPE: {train_metrics['train_mape']:.1f}%")
            
            print("\nTest Set:")
            print(f"   MAE:  {test_metrics['test_mae']:.3f}")
            print(f"   RMSE: {test_metrics['test_rmse']:.3f}")
            print(f"   R²:   {test_metrics['test_r2']:.3f}")
            print(f"   MAPE: {test_metrics['test_mape']:.1f}%")
            
            # Overfitting check
            overfit_ratio = train_metrics['train_mae'] / test_metrics['test_mae']
            if overfit_ratio < 0.7:
                print(f"\nPossible overfitting (train/test MAE ratio: {overfit_ratio:.2f})")
            else:
                print(f"\nTrain/test ratio looks good ({overfit_ratio:.2f})")
            print("=" * 60)
        
        return self.metrics
    
    def cross_validate(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        n_splits: int = 5,
        verbose: bool = True,
    ) -> Dict[str, List[float]]:
        """
        TimeSeriesSplit cross-validation.
        
        Args:
            X: Feature DataFrame
            y: Target Series
            n_splits: Number of CV folds
            verbose: Print results
            
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
        
        if verbose:
            print(f"\n{n_splits}-Fold TimeSeriesSplit Cross-Validation")
            print("-" * 50)
        
        for fold, (train_idx, val_idx) in enumerate(tscv.split(X), 1):
            X_train_fold = X.iloc[train_idx]
            X_val_fold = X.iloc[val_idx]
            y_train_fold = y.iloc[train_idx]
            y_val_fold = y.iloc[val_idx]
            
            # Clone and train
            model_clone = self.model.__class__(**self.model.get_params())
            model_clone.fit(X_train_fold, y_train_fold)
            
            # Predict
            y_pred = model_clone.predict(X_val_fold)
            
            # Metrics
            mae = mean_absolute_error(y_val_fold, y_pred)
            rmse = np.sqrt(mean_squared_error(y_val_fold, y_pred))
            r2 = r2_score(y_val_fold, y_pred)
            y_safe = np.maximum(y_val_fold, 1)
            mape = np.mean(np.abs((y_val_fold - y_pred) / y_safe)) * 100
            
            results["mae"].append(mae)
            results["rmse"].append(rmse)
            results["r2"].append(r2)
            results["mape"].append(mape)
            
            if verbose:
                print(f"Fold {fold}: MAE={mae:.3f}, RMSE={rmse:.3f}, R²={r2:.3f}")
        
        if verbose:
            print("-" * 50)
            print(f"Mean:  MAE={np.mean(results['mae']):.3f} ± {np.std(results['mae']):.3f}")
            print(f"       R²={np.mean(results['r2']):.3f} ± {np.std(results['r2']):.3f}")
        
        return results
    
    def evaluate_by_district(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        district_col: str = "district",
        verbose: bool = True,
    ) -> pd.DataFrame:
        """
        Evaluate model performance by district.
        
        Args:
            X: Feature DataFrame with district column
            y: Target Series
            district_col: Name of district column or one-hot prefix
            verbose: Print results
            
        Returns:
            DataFrame with per-district metrics
        """
        y_pred = self.model.predict(X)
        
        # Find district for each sample
        district_cols = [c for c in X.columns if c.startswith("district_")]
        
        if district_cols:
            # One-hot encoded
            districts = []
            for idx in range(len(X)):
                for col in district_cols:
                    if X[col].iloc[idx] == 1:
                        districts.append(col.replace("district_", ""))
                        break
        elif district_col in X.columns:
            districts = X[district_col].tolist()
        else:
            return pd.DataFrame()
        
        # Calculate metrics per district
        results_df = pd.DataFrame({
            "district": districts,
            "y_true": y.values,
            "y_pred": y_pred,
        })
        
        district_metrics = (
            results_df.groupby("district")
            .apply(lambda g: pd.Series({
                "mae": mean_absolute_error(g["y_true"], g["y_pred"]),
                "rmse": np.sqrt(mean_squared_error(g["y_true"], g["y_pred"])),
                "r2": r2_score(g["y_true"], g["y_pred"]) if len(g) > 1 else np.nan,
                "mean_cases": g["y_true"].mean(),
                "n_samples": len(g),
            }))
            .reset_index()
        )
        
        district_metrics = district_metrics.sort_values("mae")
        self.district_metrics = district_metrics
        
        if verbose:
            print("\nDistrict-wise Performance (sorted by MAE)")
            print("-" * 70)
            print(district_metrics.to_string(index=False))
            print("-" * 70)
            
            # Best and worst
            best = district_metrics.iloc[0]
            worst = district_metrics.iloc[-1]
            print(f"\n   Best:  {best['district']} (MAE: {best['mae']:.2f})")
            print(f"   Worst: {worst['district']} (MAE: {worst['mae']:.2f})")
        
        return district_metrics
    
    def evaluate_by_time(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        year_col: str = "year",
        week_col: str = "week",
        verbose: bool = True,
    ) -> pd.DataFrame:
        """
        Evaluate model performance over time.
        
        Args:
            X: Feature DataFrame with time columns
            y: Target Series
            year_col: Year column name
            week_col: Week column name
            verbose: Print results
            
        Returns:
            DataFrame with temporal metrics
        """
        y_pred = self.model.predict(X)
        
        if year_col not in X.columns or week_col not in X.columns:
            print("   ⚠️ Time columns not found in data")
            return pd.DataFrame()
        
        results_df = pd.DataFrame({
            "year": X[year_col].values,
            "week": X[week_col].values,
            "y_true": y.values,
            "y_pred": y_pred,
            "error": np.abs(y.values - y_pred),
        })
        
        # Yearly performance
        yearly_metrics = (
            results_df.groupby("year")
            .agg({
                "y_true": "mean",
                "error": "mean",
            })
            .rename(columns={"y_true": "mean_cases", "error": "mae"})
            .reset_index()
        )
        
        self.temporal_metrics = yearly_metrics
        
        if verbose:
            print("\nYearly Performance")
            print("-" * 40)
            print(yearly_metrics.to_string(index=False))
        
        return yearly_metrics
    
    def get_feature_importance(
        self,
        top_n: int = 20,
        verbose: bool = True,
    ) -> pd.DataFrame:
        """
        Get feature importance from the model.
        
        Args:
            top_n: Number of top features to return
            verbose: Print results
            
        Returns:
            DataFrame with feature importance
        """
        if not hasattr(self.model, "feature_importances_"):
            print("   ⚠️ Model doesn't support feature importance")
            return pd.DataFrame()
        
        importance = self.model.feature_importances_
        feature_names = (
            self.model.get_booster().feature_names
            if hasattr(self.model, "get_booster")
            else [f"feature_{i}" for i in range(len(importance))]
        )
        
        importance_df = pd.DataFrame({
            "feature": feature_names,
            "importance": importance,
        }).sort_values("importance", ascending=False)
        
        if verbose:
            print("\nTop Feature Importance")
            print("-" * 50)
            print(importance_df.head(top_n).to_string(index=False))
        
        return importance_df
    
    def generate_report(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        output_path: Optional[str] = None,
    ) -> str:
        """
        Generate a comprehensive evaluation report.
        
        Args:
            X_train, y_train, X_test, y_test: Data splits
            output_path: Optional path to save report
            
        Returns:
            Report as string
        """
        report_lines = []
        report_lines.append("=" * 70)
        report_lines.append("EpiLink Dengue Prediction Model - Evaluation Report")
        report_lines.append("=" * 70)
        report_lines.append("")
        
        # Basic metrics
        self.evaluate(X_train, y_train, X_test, y_test, verbose=False)
        
        report_lines.append("## Overall Performance")
        report_lines.append("-" * 40)
        report_lines.append(f"Training samples: {len(X_train)}")
        report_lines.append(f"Test samples: {len(X_test)}")
        report_lines.append("")
        report_lines.append("Training Metrics:")
        report_lines.append(f"  MAE:  {self.metrics['train_mae']:.3f}")
        report_lines.append(f"  RMSE: {self.metrics['train_rmse']:.3f}")
        report_lines.append(f"  R²:   {self.metrics['train_r2']:.3f}")
        report_lines.append("")
        report_lines.append("Test Metrics:")
        report_lines.append(f"  MAE:  {self.metrics['test_mae']:.3f}")
        report_lines.append(f"  RMSE: {self.metrics['test_rmse']:.3f}")
        report_lines.append(f"  R²:   {self.metrics['test_r2']:.3f}")
        report_lines.append("")
        
        # District analysis
        X_full = pd.concat([X_train, X_test])
        y_full = pd.concat([y_train, y_test])
        
        district_metrics = self.evaluate_by_district(X_full, y_full, verbose=False)
        if not district_metrics.empty:
            report_lines.append("## District-wise Performance")
            report_lines.append("-" * 40)
            report_lines.append(district_metrics.to_string(index=False))
            report_lines.append("")
        
        # Feature importance
        importance_df = self.get_feature_importance(top_n=15, verbose=False)
        if not importance_df.empty:
            report_lines.append("## Top 15 Features")
            report_lines.append("-" * 40)
            report_lines.append(importance_df.head(15).to_string(index=False))
            report_lines.append("")
        
        report_lines.append("=" * 70)
        
        report = "\n".join(report_lines)
        
        if output_path:
            with open(output_path, "w") as f:
                f.write(report)
            print(f"Report saved to {output_path}")
        
        return report


def compare_models(
    models: Dict[str, Any],
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> pd.DataFrame:
    """
    Compare multiple models side by side.
    
    Args:
        models: Dictionary of model name to model object
        X_train, y_train, X_test, y_test: Data splits
        
    Returns:
        DataFrame with comparison metrics
    """
    results = []
    
    print("\nModel Comparison")
    print("=" * 70)
    
    for name, model in models.items():
        # Train
        model.fit(X_train, y_train)
        
        # Evaluate
        y_test_pred = model.predict(X_test)
        
        mae = mean_absolute_error(y_test, y_test_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_test_pred))
        r2 = r2_score(y_test, y_test_pred)
        
        results.append({
            "Model": name,
            "MAE": mae,
            "RMSE": rmse,
            "R²": r2,
        })
    
    df = pd.DataFrame(results)
    df = df.sort_values("MAE")
    
    print(df.to_string(index=False))
    print("=" * 70)
    
    return df


if __name__ == "__main__":
    print("=" * 60)
    print("EpiLink Model Evaluation Module")
    print("=" * 60)
    
    print("\nThis module provides:")
    print("  - Comprehensive regression metrics")
    print("  - TimeSeriesSplit cross-validation")
    print("  - District-wise performance analysis")
    print("  - Feature importance analysis")
    print("  - Automated report generation")
    print("\nUsage:")
    print("  evaluator = ModelEvaluator(model)")
    print("  metrics = evaluator.evaluate(X_train, y_train, X_test, y_test)")
    print("  cv_results = evaluator.cross_validate(X, y)")
    print("  report = evaluator.generate_report(...)")
