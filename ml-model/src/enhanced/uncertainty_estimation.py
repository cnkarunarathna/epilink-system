"""
Uncertainty Estimation Module for EpiLink Dengue Prediction

Provides prediction intervals and risk level classification for
communicating forecast uncertainty to public health officials.

Methods:
- Quantile regression for prediction intervals
- Ensemble disagreement for uncertainty
- Risk level classification
- Conformal prediction for calibrated intervals
"""

import numpy as np
import pandas as pd
from typing import Dict, Tuple, Optional, List, Any
from dataclasses import dataclass
from enum import Enum
from sklearn.model_selection import TimeSeriesSplit
from xgboost import XGBRegressor
import lightgbm as lgb


class RiskLevel(Enum):
    """Dengue outbreak risk levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class PredictionResult:
    """
    Container for prediction results with uncertainty.
    
    Attributes:
        point_estimate: Best prediction (median or mean)
        lower_bound: Lower confidence bound
        upper_bound: Upper confidence bound
        confidence_level: Confidence level (e.g., 0.80 for 80%)
        risk_level: Classified risk level
        uncertainty_score: Normalized uncertainty (0-1)
        individual_predictions: Optional dict of model-specific predictions
    """
    point_estimate: float
    lower_bound: float
    upper_bound: float
    confidence_level: float
    risk_level: RiskLevel
    uncertainty_score: float
    individual_predictions: Optional[Dict[str, float]] = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "predicted_cases": int(round(self.point_estimate)),
            "confidence_interval": {
                "lower": int(round(max(0, self.lower_bound))),
                "upper": int(round(self.upper_bound)),
                "confidence_level": self.confidence_level,
            },
            "risk_level": self.risk_level.value,
            "uncertainty_score": round(self.uncertainty_score, 3),
        }


class QuantileRegressor:
    """
    Quantile regression using gradient boosting for prediction intervals.
    
    Trains separate models for different quantiles (e.g., 10th, 50th, 90th)
    to directly predict confidence intervals.
    """
    
    def __init__(
        self,
        quantiles: List[float] = [0.1, 0.5, 0.9],
        n_estimators: int = 200,
        max_depth: int = 6,
        learning_rate: float = 0.05,
    ):
        """
        Initialize quantile regressor.
        
        Args:
            quantiles: List of quantiles to predict (e.g., [0.1, 0.5, 0.9])
            n_estimators: Number of boosting rounds
            max_depth: Tree depth
            learning_rate: Learning rate
        """
        self.quantiles = sorted(quantiles)
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.models: Dict[float, Any] = {}
    
    def fit(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        verbose: bool = True
    ):
        """
        Train quantile regression models.
        
        Args:
            X: Feature DataFrame
            y: Target Series
            verbose: Print progress
        """
        if verbose:
            print("\nTraining Quantile Regression Models")
            print("-" * 40)
        
        for q in self.quantiles:
            if verbose:
                print(f"   Training quantile {q:.2f}...", end=" ")
            
            model = lgb.LGBMRegressor(
                objective="quantile",
                alpha=q,
                n_estimators=self.n_estimators,
                max_depth=self.max_depth,
                learning_rate=self.learning_rate,
                random_state=42,
                n_jobs=-1,
                verbose=-1,
            )
            model.fit(X, y)
            self.models[q] = model
            
            if verbose:
                print("Done")
        
        if verbose:
            print("-" * 40)
    
    def predict(self, X: pd.DataFrame) -> Dict[float, np.ndarray]:
        """
        Predict quantiles.
        
        Args:
            X: Feature DataFrame
            
        Returns:
            Dictionary mapping quantile to predictions
        """
        return {q: model.predict(X) for q, model in self.models.items()}
    
    def predict_interval(
        self,
        X: pd.DataFrame,
        lower_quantile: float = 0.1,
        upper_quantile: float = 0.9,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Predict with confidence interval.
        
        Args:
            X: Feature DataFrame
            lower_quantile: Lower bound quantile
            upper_quantile: Upper bound quantile
            
        Returns:
            Tuple of (median, lower_bound, upper_bound)
        """
        predictions = self.predict(X)
        
        median = predictions.get(0.5, np.mean([predictions[q] for q in predictions], axis=0))
        lower = predictions.get(lower_quantile, median)
        upper = predictions.get(upper_quantile, median)
        
        # Ensure proper ordering
        lower = np.minimum(lower, median)
        upper = np.maximum(upper, median)
        lower = np.maximum(lower, 0)  # Non-negative
        
        return median, lower, upper


class RiskClassifier:
    """
    Classifies dengue risk levels based on predicted cases and trends.
    
    Risk levels:
    - LOW: Normal endemic level
    - MEDIUM: Elevated, monitor closely
    - HIGH: Outbreak warning
    - CRITICAL: Urgent intervention needed
    """
    
    def __init__(
        self,
        thresholds: Optional[Dict[str, int]] = None,
        use_dynamic_thresholds: bool = True,
    ):
        """
        Initialize risk classifier.
        
        Args:
            thresholds: Static thresholds {'low': 10, 'medium': 30, 'high': 50}
            use_dynamic_thresholds: Whether to adjust thresholds based on district history
        """
        self.thresholds = thresholds or {
            "low": 10,
            "medium": 30,
            "high": 50,
        }
        self.use_dynamic_thresholds = use_dynamic_thresholds
        self.district_baselines: Dict[str, float] = {}
    
    def fit_baselines(self, df: pd.DataFrame):
        """
        Calculate baseline case levels for each district.
        
        Args:
            df: Historical data with 'district' and 'cases' columns
        """
        if "district" in df.columns and "cases" in df.columns:
            self.district_baselines = (
                df.groupby("district")["cases"]
                .agg(["mean", "std"])
                .to_dict("index")
            )
    
    def classify(
        self,
        predicted_cases: float,
        district: Optional[str] = None,
        trend: Optional[float] = None,
    ) -> RiskLevel:
        """
        Classify risk level for predicted cases.
        
        Args:
            predicted_cases: Predicted number of cases
            district: Optional district name for dynamic thresholds
            trend: Optional trend value (positive = increasing)
            
        Returns:
            RiskLevel enum
        """
        thresholds = self.thresholds.copy()
        
        # Adjust thresholds based on district baseline
        if self.use_dynamic_thresholds and district and district in self.district_baselines:
            baseline = self.district_baselines[district]
            mean_cases = baseline.get("mean", 20)
            std_cases = baseline.get("std", 10)
            
            # Dynamic thresholds based on historical distribution
            thresholds = {
                "low": mean_cases + 0.5 * std_cases,
                "medium": mean_cases + 1.5 * std_cases,
                "high": mean_cases + 2.5 * std_cases,
            }
        
        # Adjust for increasing trends
        if trend is not None and trend > 0.2:  # >20% week-over-week increase
            predicted_cases *= 1.2  # Increase effective cases for risk calculation
        
        # Classify
        if predicted_cases < thresholds["low"]:
            return RiskLevel.LOW
        elif predicted_cases < thresholds["medium"]:
            return RiskLevel.MEDIUM
        elif predicted_cases < thresholds["high"]:
            return RiskLevel.HIGH
        else:
            return RiskLevel.CRITICAL
    
    def get_risk_color(self, risk_level: RiskLevel) -> str:
        """Get color code for risk level visualization."""
        colors = {
            RiskLevel.LOW: "#4CAF50",      # Green
            RiskLevel.MEDIUM: "#FF9800",   # Orange
            RiskLevel.HIGH: "#F44336",     # Red
            RiskLevel.CRITICAL: "#9C27B0", # Purple
        }
        return colors.get(risk_level, "#9E9E9E")
    
    def get_risk_action(self, risk_level: RiskLevel) -> str:
        """Get recommended action for risk level."""
        actions = {
            RiskLevel.LOW: "Routine surveillance and prevention activities",
            RiskLevel.MEDIUM: "Enhanced monitoring, prepare vector control resources",
            RiskLevel.HIGH: "Activate outbreak response, deploy vector control teams",
            RiskLevel.CRITICAL: "Emergency response, community-wide intervention needed",
        }
        return actions.get(risk_level, "Monitor situation")


class UncertaintyEstimator:
    """
    Main uncertainty estimation class combining multiple methods.
    
    Methods:
    1. Quantile regression for direct interval prediction
    2. Ensemble disagreement for uncertainty
    3. Conformal prediction for calibrated intervals (optional)
    """
    
    def __init__(
        self,
        confidence_level: float = 0.80,
        use_quantile_regression: bool = True,
        use_conformal: bool = False,
    ):
        """
        Initialize uncertainty estimator.
        
        Args:
            confidence_level: Confidence level for intervals (e.g., 0.80 for 80%)
            use_quantile_regression: Use quantile regression for intervals
            use_conformal: Use conformal prediction for calibration
        """
        self.confidence_level = confidence_level
        self.use_quantile_regression = use_quantile_regression
        self.use_conformal = use_conformal
        
        alpha = 1 - confidence_level
        self.lower_quantile = alpha / 2
        self.upper_quantile = 1 - alpha / 2
        
        self.quantile_regressor: Optional[QuantileRegressor] = None
        self.risk_classifier = RiskClassifier()
        self.calibration_factor: float = 1.0
        self.residuals: Optional[np.ndarray] = None
    
    def fit(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        historical_df: Optional[pd.DataFrame] = None,
        verbose: bool = True,
    ):
        """
        Fit uncertainty estimation models.
        
        Args:
            X: Feature DataFrame
            y: Target Series
            historical_df: Optional historical data for risk baselines
            verbose: Print progress
        """
        if verbose:
            print("\nFitting Uncertainty Estimator")
            print("=" * 50)
        
        # Fit quantile regressor
        if self.use_quantile_regression:
            self.quantile_regressor = QuantileRegressor(
                quantiles=[self.lower_quantile, 0.5, self.upper_quantile]
            )
            self.quantile_regressor.fit(X, y, verbose=verbose)
        
        # Fit risk classifier baselines
        if historical_df is not None:
            self.risk_classifier.fit_baselines(historical_df)
            if verbose:
                print(f"   Fitted risk baselines for {len(self.risk_classifier.district_baselines)} districts")
        
        # Calibrate intervals using cross-validation
        if self.use_conformal:
            self._calibrate_intervals(X, y, verbose)
        
        if verbose:
            print("=" * 50)
            print("Uncertainty estimator ready!")
    
    def _calibrate_intervals(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        verbose: bool = True
    ):
        """Calibrate prediction intervals using conformal prediction approach."""
        if verbose:
            print("\n   Calibrating intervals with cross-validation...")
        
        tscv = TimeSeriesSplit(n_splits=5)
        all_residuals = []
        
        for train_idx, val_idx in tscv.split(X):
            X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
            y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]
            
            # Train a simple model for calibration
            model = lgb.LGBMRegressor(n_estimators=100, random_state=42, verbose=-1)
            model.fit(X_train, y_train)
            
            y_pred = model.predict(X_val)
            residuals = np.abs(y_val - y_pred)
            all_residuals.extend(residuals)
        
        self.residuals = np.array(all_residuals)
        
        # Calculate calibration factor for the desired confidence level
        self.calibration_factor = np.percentile(
            self.residuals, self.confidence_level * 100
        )
        
        if verbose:
            print(f"   Calibration factor: {self.calibration_factor:.3f}")
    
    def predict_with_uncertainty(
        self,
        X: pd.DataFrame,
        point_predictions: Optional[np.ndarray] = None,
        districts: Optional[List[str]] = None,
        trends: Optional[List[float]] = None,
    ) -> List[PredictionResult]:
        """
        Make predictions with uncertainty estimates.
        
        Args:
            X: Feature DataFrame
            point_predictions: Optional point predictions from ensemble
            districts: Optional list of district names
            trends: Optional list of trend values
            
        Returns:
            List of PredictionResult objects
        """
        n_samples = len(X)
        results = []
        
        # Get quantile predictions
        if self.quantile_regressor is not None:
            median, lower, upper = self.quantile_regressor.predict_interval(
                X, self.lower_quantile, self.upper_quantile
            )
        else:
            # Fallback to point predictions with calibration factor
            if point_predictions is None:
                raise ValueError("Need either quantile regressor or point predictions")
            median = point_predictions
            lower = median - self.calibration_factor
            upper = median + self.calibration_factor
        
        # Override with point predictions if provided (use as median)
        if point_predictions is not None:
            median = point_predictions
        
        for i in range(n_samples):
            pred = float(median[i])
            lb = float(max(0, lower[i]))
            ub = float(upper[i])
            
            # Calculate uncertainty score (normalized interval width)
            interval_width = ub - lb
            uncertainty = min(interval_width / max(pred, 1), 1.0)
            
            # Classify risk
            district = districts[i] if districts else None
            trend = trends[i] if trends else None
            risk = self.risk_classifier.classify(pred, district, trend)
            
            results.append(PredictionResult(
                point_estimate=pred,
                lower_bound=lb,
                upper_bound=ub,
                confidence_level=self.confidence_level,
                risk_level=risk,
                uncertainty_score=uncertainty,
            ))
        
        return results
    
    def evaluate_coverage(
        self,
        y_true: pd.Series,
        predictions: List[PredictionResult],
    ) -> Dict[str, float]:
        """
        Evaluate prediction interval coverage.
        
        Args:
            y_true: True values
            predictions: List of PredictionResult objects
            
        Returns:
            Dictionary with coverage metrics
        """
        y_true = np.array(y_true)
        covered = 0
        total_width = 0
        
        for i, pred in enumerate(predictions):
            if pred.lower_bound <= y_true[i] <= pred.upper_bound:
                covered += 1
            total_width += pred.upper_bound - pred.lower_bound
        
        coverage = covered / len(predictions)
        avg_width = total_width / len(predictions)
        
        return {
            "coverage": coverage,
            "target_coverage": self.confidence_level,
            "avg_interval_width": avg_width,
            "is_calibrated": abs(coverage - self.confidence_level) < 0.05,
        }


def create_risk_summary(
    predictions: List[PredictionResult],
    districts: List[str],
) -> pd.DataFrame:
    """
    Create a summary DataFrame of risk levels across districts.
    
    Args:
        predictions: List of PredictionResult objects
        districts: List of district names
        
    Returns:
        DataFrame with risk summary
    """
    data = []
    for district, pred in zip(districts, predictions):
        data.append({
            "district": district,
            "predicted_cases": int(round(pred.point_estimate)),
            "lower_bound": int(round(pred.lower_bound)),
            "upper_bound": int(round(pred.upper_bound)),
            "risk_level": pred.risk_level.value,
            "uncertainty": round(pred.uncertainty_score, 3),
        })
    
    df = pd.DataFrame(data)
    df = df.sort_values("predicted_cases", ascending=False)
    
    return df


if __name__ == "__main__":
    print("=" * 60)
    print("EpiLink Uncertainty Estimation Module")
    print("=" * 60)
    
    print("\nThis module provides:")
    print("  - Quantile regression for prediction intervals")
    print("  - Risk level classification (Low/Medium/High/Critical)")
    print("  - Uncertainty scoring")
    print("  - Interval coverage evaluation")
    print("\nUsage:")
    print("  estimator = UncertaintyEstimator(confidence_level=0.80)")
    print("  estimator.fit(X_train, y_train)")
    print("  results = estimator.predict_with_uncertainty(X_test)")
    print("  for r in results: print(r.to_dict())")
