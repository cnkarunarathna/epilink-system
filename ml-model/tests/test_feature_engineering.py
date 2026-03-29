"""
Unit Tests for Feature Engineering Module
"""

import pytest
import numpy as np
import pandas as pd
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from feature_engineering import FeatureEngineer, DISTRICTS


@pytest.fixture
def sample_data():
    """Create sample dengue data for testing."""
    np.random.seed(42)
    
    data = []
    for district in DISTRICTS[:3]:  # Test with 3 districts
        for year in [2023, 2024]:
            for week in range(1, 53):
                data.append({
                    "district": district,
                    "year": year,
                    "week": week,
                    "cases": np.random.randint(5, 100),
                    "temperature_2m_mean": np.random.uniform(25, 32),
                    "precipitation_sum": np.random.uniform(0, 200),
                    "relative_humidity_mean": np.random.uniform(60, 90),
                })
    
    return pd.DataFrame(data)


@pytest.fixture
def engineer():
    """Create feature engineer instance."""
    return FeatureEngineer(include_population=True)


class TestLagFeatures:
    """Test lag feature creation."""
    
    def test_lag_features_created(self, sample_data, engineer):
        """Test that lag features are created correctly."""
        df = engineer.create_lag_features(sample_data, "cases", lags=[1, 2, 3])
        
        assert "cases_lag1" in df.columns
        assert "cases_lag2" in df.columns
        assert "cases_lag3" in df.columns
    
    def test_lag_values_correct(self, sample_data, engineer):
        """Test that lag values are shifted correctly."""
        df = engineer.create_lag_features(sample_data, "cases", lags=[1])
        df = df.dropna()
        
        # For a specific district, check lag relationship
        colombo = df[df["district"] == "Colombo"].sort_values(["year", "week"])
        
        # lag1 should equal the previous row's cases
        for i in range(1, len(colombo)):
            prev_cases = colombo.iloc[i - 1]["cases"]
            curr_lag1 = colombo.iloc[i]["cases_lag1"]
            # They should match (approximately, due to float conversion)
            assert abs(prev_cases - curr_lag1) < 0.001


class TestCyclicalFeatures:
    """Test cyclical encoding features."""
    
    def test_cyclical_features_created(self, sample_data, engineer):
        """Test that cyclical features are created."""
        df = engineer.create_cyclical_features(sample_data)
        
        assert "week_sin" in df.columns
        assert "week_cos" in df.columns
        assert "month_sin" in df.columns
        assert "month_cos" in df.columns
    
    def test_cyclical_bounds(self, sample_data, engineer):
        """Test that sin/cos values are in [-1, 1] range."""
        df = engineer.create_cyclical_features(sample_data)
        
        assert df["week_sin"].min() >= -1
        assert df["week_sin"].max() <= 1
        assert df["week_cos"].min() >= -1
        assert df["week_cos"].max() <= 1
    
    def test_monsoon_indicators(self, sample_data, engineer):
        """Test monsoon indicator features."""
        df = engineer.create_cyclical_features(sample_data)
        
        assert "is_southwest_monsoon" in df.columns
        assert "is_northeast_monsoon" in df.columns
        
        # Check correct classification
        week_20_data = df[df["week"] == 20].iloc[0]
        assert week_20_data["is_southwest_monsoon"] == 1
        
        week_45_data = df[df["week"] == 45].iloc[0]
        assert week_45_data["is_northeast_monsoon"] == 1


class TestRollingFeatures:
    """Test rolling window features."""
    
    def test_rolling_features_created(self, sample_data, engineer):
        """Test that rolling features are created."""
        df = engineer.create_rolling_features(sample_data, "cases", windows=[4])
        
        assert "cases_mean_4w" in df.columns
        assert "cases_std_4w" in df.columns
        assert "cases_max_4w" in df.columns
    
    def test_rolling_mean_reasonable(self, sample_data, engineer):
        """Test that rolling mean is within expected range."""
        df = engineer.create_rolling_features(sample_data, "cases", windows=[4])
        df = df.dropna()
        
        # Rolling mean should be between min and max of cases
        assert df["cases_mean_4w"].min() >= sample_data["cases"].min()
        assert df["cases_mean_4w"].max() <= sample_data["cases"].max()


class TestTrendFeatures:
    """Test trend and momentum features."""
    
    def test_trend_features_created(self, sample_data, engineer):
        """Test that trend features are created after lag features."""
        df = engineer.create_lag_features(sample_data, "cases", lags=[1, 2, 3])
        df = engineer.create_rolling_features(df, "cases", windows=[4])
        df = engineer.create_trend_features(df)
        df = df.dropna()
        
        assert "cases_wow_change" in df.columns
        assert "cases_wow_pct_change" in df.columns
        assert "cases_trend_3w" in df.columns
        assert "is_accelerating" in df.columns
    
    def test_wow_change_calculation(self, sample_data, engineer):
        """Test week-over-week change calculation."""
        df = engineer.create_lag_features(sample_data, "cases", lags=[1, 2, 3])
        df = engineer.create_rolling_features(df, "cases", windows=[4])
        df = engineer.create_trend_features(df)
        df = df.dropna()
        
        # wow_change should equal lag1 - lag2
        expected = df["cases_lag1"] - df["cases_lag2"]
        np.testing.assert_array_almost_equal(df["cases_wow_change"], expected)


class TestPopulationFeatures:
    """Test population density features."""
    
    def test_population_features_added(self, sample_data, engineer):
        """Test that population features are added."""
        df = engineer.add_population_features(sample_data)
        
        assert "population_density" in df.columns
        assert "log_population_density" in df.columns
        assert "population_density_norm" in df.columns
    
    def test_normalized_density_bounds(self, sample_data, engineer):
        """Test that normalized density is in [0, 1] range."""
        df = engineer.add_population_features(sample_data)
        
        assert df["population_density_norm"].min() >= 0
        assert df["population_density_norm"].max() <= 1


class TestDistrictEncoding:
    """Test district one-hot encoding."""
    
    def test_district_columns_created(self, sample_data, engineer):
        """Test that all district columns are created."""
        df = engineer.encode_districts(sample_data)
        
        for district in DISTRICTS:
            assert f"district_{district}" in df.columns
    
    def test_one_hot_encoding_correct(self, sample_data, engineer):
        """Test that one-hot encoding is mutually exclusive."""
        df = engineer.encode_districts(sample_data)
        
        district_cols = [f"district_{d}" for d in DISTRICTS]
        
        # Sum across district columns should be 1 for each row
        row_sums = df[district_cols].sum(axis=1)
        assert all(row_sums == 1)


class TestFullPipeline:
    """Test full feature engineering pipeline."""
    
    def test_engineer_features_returns_tuple(self, sample_data, engineer):
        """Test that engineer_features returns DataFrame and feature names."""
        df, feature_names = engineer.engineer_features(sample_data)
        
        assert isinstance(df, pd.DataFrame)
        assert isinstance(feature_names, list)
        assert len(feature_names) > 0
    
    def test_all_feature_names_in_dataframe(self, sample_data, engineer):
        """Test that all feature names are columns in the DataFrame."""
        df, feature_names = engineer.engineer_features(sample_data)
        
        for feature in feature_names:
            assert feature in df.columns, f"Feature {feature} not in DataFrame"
    
    def test_no_nan_in_feature_columns(self, sample_data, engineer):
        """Test that there are no NaN values in feature columns after dropna."""
        df, feature_names = engineer.engineer_features(sample_data)
        df = df.dropna(subset=feature_names)
        
        for feature in feature_names:
            assert not df[feature].isna().any(), f"NaN values in {feature}"


class TestPredictionPreparation:
    """Test prepare_for_prediction method."""
    
    def test_prepare_for_prediction_returns_dataframe(self, engineer):
        """Test that prepare_for_prediction returns a DataFrame."""
        result = engineer.prepare_for_prediction(
            district="Colombo",
            cases_lag1=45,
            cases_lag2=38,
            cases_lag3=42,
            cases_lag4=35,
            temperature=29.5,
            precipitation=85.0,
            humidity=72.0,
            week=25,
        )
        
        assert isinstance(result, pd.DataFrame)
        assert len(result) == 1
    
    def test_prepare_for_prediction_has_district_encoding(self, engineer):
        """Test that district encoding is correct."""
        result = engineer.prepare_for_prediction(
            district="Colombo",
            cases_lag1=45,
            cases_lag2=38,
            cases_lag3=42,
            cases_lag4=35,
            temperature=29.5,
            precipitation=85.0,
            week=25,
        )
        
        assert result["district_Colombo"].iloc[0] == 1
        assert result["district_Kandy"].iloc[0] == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
