"""
Unit Tests for Ensemble Model and Uncertainty Estimation
"""

import pytest
import numpy as np
import pandas as pd
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ensemble_model import DengueEnsemblePredictor
from uncertainty_estimation import (
    UncertaintyEstimator,
    RiskClassifier,
    RiskLevel,
    QuantileRegressor,
    PredictionResult,
)


@pytest.fixture
def sample_train_data():
    """Create sample training data."""
    np.random.seed(42)
    n_samples = 500
    
    X = pd.DataFrame({
        "cases_lag1": np.random.randint(10, 80, n_samples),
        "cases_lag2": np.random.randint(10, 80, n_samples),
        "cases_lag3": np.random.randint(10, 80, n_samples),
        "cases_mean_4w": np.random.uniform(15, 60, n_samples),
        "temperature_2m_mean": np.random.uniform(25, 32, n_samples),
        "precipitation_sum": np.random.uniform(0, 200, n_samples),
        "week_sin": np.random.uniform(-1, 1, n_samples),
        "week_cos": np.random.uniform(-1, 1, n_samples),
    })
    
    # Add district columns
    for district in ["Colombo", "Kandy", "Galle"]:
        X[f"district_{district}"] = np.random.randint(0, 2, n_samples)
    
    # Target: somewhat correlated with lag features
    y = pd.Series(
        X["cases_lag1"] * 0.5 + X["cases_mean_4w"] * 0.3 + np.random.normal(0, 5, n_samples)
    )
    y = y.clip(lower=0)
    
    return X, y


@pytest.fixture
def sample_test_data():
    """Create sample test data."""
    np.random.seed(123)
    n_samples = 100
    
    X = pd.DataFrame({
        "cases_lag1": np.random.randint(10, 80, n_samples),
        "cases_lag2": np.random.randint(10, 80, n_samples),
        "cases_lag3": np.random.randint(10, 80, n_samples),
        "cases_mean_4w": np.random.uniform(15, 60, n_samples),
        "temperature_2m_mean": np.random.uniform(25, 32, n_samples),
        "precipitation_sum": np.random.uniform(0, 200, n_samples),
        "week_sin": np.random.uniform(-1, 1, n_samples),
        "week_cos": np.random.uniform(-1, 1, n_samples),
    })
    
    for district in ["Colombo", "Kandy", "Galle"]:
        X[f"district_{district}"] = np.random.randint(0, 2, n_samples)
    
    y = pd.Series(
        X["cases_lag1"] * 0.5 + X["cases_mean_4w"] * 0.3 + np.random.normal(0, 5, n_samples)
    )
    y = y.clip(lower=0)
    
    return X, y


class TestEnsemblePredictor:
    """Tests for DengueEnsemblePredictor."""
    
    def test_initialization(self):
        """Test ensemble initialization."""
        ensemble = DengueEnsemblePredictor()
        
        assert ensemble.weights is not None
        assert sum(ensemble.weights.values()) == pytest.approx(1.0)
        assert not ensemble.is_trained
    
    def test_custom_weights(self):
        """Test custom weight initialization."""
        weights = {"xgboost": 0.7, "lightgbm": 0.3}
        ensemble = DengueEnsemblePredictor(weights=weights)
        
        assert ensemble.weights["xgboost"] == pytest.approx(0.7)
        assert ensemble.weights["lightgbm"] == pytest.approx(0.3)
    
    def test_training(self, sample_train_data):
        """Test model training."""
        X, y = sample_train_data
        
        ensemble = DengueEnsemblePredictor()
        metrics = ensemble.train(X, y, verbose=False)
        
        assert ensemble.is_trained
        assert len(ensemble.models) >= 1
        assert "xgboost" in metrics or "lightgbm" in metrics
    
    def test_prediction(self, sample_train_data, sample_test_data):
        """Test prediction returns correct shape."""
        X_train, y_train = sample_train_data
        X_test, y_test = sample_test_data
        
        ensemble = DengueEnsemblePredictor()
        ensemble.train(X_train, y_train, verbose=False)
        
        predictions = ensemble.predict(X_test)
        
        assert len(predictions) == len(X_test)
        assert all(predictions >= 0)  # Non-negative predictions
    
    def test_prediction_with_uncertainty(self, sample_train_data, sample_test_data):
        """Test uncertainty estimation."""
        X_train, y_train = sample_train_data
        X_test, y_test = sample_test_data
        
        ensemble = DengueEnsemblePredictor()
        ensemble.train(X_train, y_train, verbose=False)
        
        mean_pred, lower, upper = ensemble.predict_with_uncertainty(X_test)
        
        assert len(mean_pred) == len(X_test)
        assert all(lower <= mean_pred)  # Lower bound <= mean
        assert all(mean_pred <= upper)  # Mean <= upper bound
    
    def test_feature_importance(self, sample_train_data):
        """Test feature importance extraction."""
        X, y = sample_train_data
        
        ensemble = DengueEnsemblePredictor()
        ensemble.train(X, y, verbose=False)
        
        importance = ensemble.get_feature_importance()
        
        assert not importance.empty
        assert "feature" in importance.columns
        assert "mean_importance" in importance.columns
    
    def test_save_and_load(self, sample_train_data, tmp_path):
        """Test model serialization."""
        X, y = sample_train_data
        
        ensemble = DengueEnsemblePredictor()
        ensemble.train(X, y, verbose=False)
        
        # Save
        save_path = str(tmp_path / "test_ensemble.pkl")
        ensemble.save(save_path)
        
        # Load
        loaded = DengueEnsemblePredictor.load(save_path)
        
        assert loaded.is_trained
        assert len(loaded.models) == len(ensemble.models)
        
        # Predictions should match
        orig_pred = ensemble.predict(X[:5])
        loaded_pred = loaded.predict(X[:5])
        np.testing.assert_array_almost_equal(orig_pred, loaded_pred)


class TestRiskClassifier:
    """Tests for RiskClassifier."""
    
    def test_default_thresholds(self):
        """Test default thresholds."""
        classifier = RiskClassifier()
        
        assert "low" in classifier.thresholds
        assert "medium" in classifier.thresholds
        assert "high" in classifier.thresholds
    
    def test_risk_classification(self):
        """Test risk level classification."""
        classifier = RiskClassifier()
        
        assert classifier.classify(5) == RiskLevel.LOW
        assert classifier.classify(20) == RiskLevel.MEDIUM
        assert classifier.classify(40) == RiskLevel.HIGH
        assert classifier.classify(60) == RiskLevel.CRITICAL
    
    def test_custom_thresholds(self):
        """Test custom thresholds."""
        thresholds = {"low": 20, "medium": 50, "high": 100}
        classifier = RiskClassifier(thresholds=thresholds)
        
        assert classifier.classify(15) == RiskLevel.LOW
        assert classifier.classify(30) == RiskLevel.MEDIUM
        assert classifier.classify(75) == RiskLevel.HIGH
        assert classifier.classify(150) == RiskLevel.CRITICAL
    
    def test_get_risk_color(self):
        """Test risk color mapping."""
        classifier = RiskClassifier()
        
        assert classifier.get_risk_color(RiskLevel.LOW).startswith("#")
        assert classifier.get_risk_color(RiskLevel.CRITICAL).startswith("#")
    
    def test_get_risk_action(self):
        """Test risk action recommendations."""
        classifier = RiskClassifier()
        
        assert len(classifier.get_risk_action(RiskLevel.LOW)) > 0
        assert len(classifier.get_risk_action(RiskLevel.CRITICAL)) > 0


class TestQuantileRegressor:
    """Tests for QuantileRegressor."""
    
    def test_initialization(self):
        """Test default quantiles."""
        qr = QuantileRegressor()
        
        assert 0.1 in qr.quantiles
        assert 0.5 in qr.quantiles
        assert 0.9 in qr.quantiles
    
    def test_fit_and_predict(self, sample_train_data, sample_test_data):
        """Test quantile regression training and prediction."""
        X_train, y_train = sample_train_data
        X_test, y_test = sample_test_data
        
        qr = QuantileRegressor(n_estimators=50)
        qr.fit(X_train, y_train, verbose=False)
        
        predictions = qr.predict(X_test)
        
        assert 0.1 in predictions
        assert 0.5 in predictions
        assert 0.9 in predictions
        
        # Lower quantile should be <= median <= upper quantile (mostly)
        lower = predictions[0.1]
        median = predictions[0.5]
        upper = predictions[0.9]
        
        # Most predictions should follow ordering
        ordering_correct = np.sum((lower <= median) & (median <= upper))
        assert ordering_correct / len(lower) > 0.9
    
    def test_predict_interval(self, sample_train_data, sample_test_data):
        """Test prediction interval method."""
        X_train, y_train = sample_train_data
        X_test, y_test = sample_test_data
        
        qr = QuantileRegressor(n_estimators=50)
        qr.fit(X_train, y_train, verbose=False)
        
        median, lower, upper = qr.predict_interval(X_test)
        
        assert len(median) == len(X_test)
        assert all(lower <= median)
        assert all(median <= upper)
        assert all(lower >= 0)  # Should be non-negative


class TestUncertaintyEstimator:
    """Tests for UncertaintyEstimator."""
    
    def test_initialization(self):
        """Test default configuration."""
        estimator = UncertaintyEstimator()
        
        assert estimator.confidence_level == 0.80
        assert estimator.use_quantile_regression
    
    def test_fit(self, sample_train_data):
        """Test fitting the estimator."""
        X, y = sample_train_data
        
        estimator = UncertaintyEstimator()
        estimator.fit(X, y, verbose=False)
        
        assert estimator.quantile_regressor is not None
    
    def test_predict_with_uncertainty(self, sample_train_data, sample_test_data):
        """Test uncertainty prediction."""
        X_train, y_train = sample_train_data
        X_test, y_test = sample_test_data
        
        estimator = UncertaintyEstimator()
        estimator.fit(X_train, y_train, verbose=False)
        
        results = estimator.predict_with_uncertainty(X_test)
        
        assert len(results) == len(X_test)
        assert all(isinstance(r, PredictionResult) for r in results)
    
    def test_prediction_result_structure(self, sample_train_data, sample_test_data):
        """Test PredictionResult structure."""
        X_train, y_train = sample_train_data
        X_test, y_test = sample_test_data
        
        estimator = UncertaintyEstimator()
        estimator.fit(X_train, y_train, verbose=False)
        
        results = estimator.predict_with_uncertainty(X_test)
        result = results[0]
        
        assert hasattr(result, "point_estimate")
        assert hasattr(result, "lower_bound")
        assert hasattr(result, "upper_bound")
        assert hasattr(result, "risk_level")
        assert hasattr(result, "confidence_level")
    
    def test_prediction_result_to_dict(self, sample_train_data, sample_test_data):
        """Test PredictionResult serialization."""
        X_train, y_train = sample_train_data
        X_test, y_test = sample_test_data
        
        estimator = UncertaintyEstimator()
        estimator.fit(X_train, y_train, verbose=False)
        
        results = estimator.predict_with_uncertainty(X_test)
        result_dict = results[0].to_dict()
        
        assert "predicted_cases" in result_dict
        assert "confidence_interval" in result_dict
        assert "risk_level" in result_dict
        assert "lower" in result_dict["confidence_interval"]
        assert "upper" in result_dict["confidence_interval"]
    
    def test_evaluate_coverage(self, sample_train_data, sample_test_data):
        """Test coverage evaluation."""
        X_train, y_train = sample_train_data
        X_test, y_test = sample_test_data
        
        estimator = UncertaintyEstimator()
        estimator.fit(X_train, y_train, verbose=False)
        
        results = estimator.predict_with_uncertainty(X_test)
        coverage = estimator.evaluate_coverage(y_test, results)
        
        assert "coverage" in coverage
        assert "target_coverage" in coverage
        assert 0 <= coverage["coverage"] <= 1


class TestPredictionResult:
    """Tests for PredictionResult dataclass."""
    
    def test_creation(self):
        """Test PredictionResult creation."""
        result = PredictionResult(
            point_estimate=25.5,
            lower_bound=18.0,
            upper_bound=33.0,
            confidence_level=0.80,
            risk_level=RiskLevel.MEDIUM,
            uncertainty_score=0.3,
        )
        
        assert result.point_estimate == 25.5
        assert result.risk_level == RiskLevel.MEDIUM
    
    def test_to_dict(self):
        """Test serialization."""
        result = PredictionResult(
            point_estimate=25.5,
            lower_bound=18.0,
            upper_bound=33.0,
            confidence_level=0.80,
            risk_level=RiskLevel.MEDIUM,
            uncertainty_score=0.3,
        )
        
        d = result.to_dict()
        
        assert d["predicted_cases"] == 26  # Rounded
        assert d["risk_level"] == "medium"
        assert d["confidence_interval"]["lower"] == 18
        assert d["confidence_interval"]["upper"] == 33


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
