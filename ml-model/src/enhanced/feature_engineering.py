"""
Feature Engineering Module for EpiLink Dengue Prediction

This module provides comprehensive feature engineering for dengue case prediction,
including temporal features, weather features, cyclical encoding, and trend analysis.

Features included:
- Lag features (cases from previous 1-3 weeks)
- Rolling statistics (mean, std, min, max)
- Lagged weather features
- Cyclical week encoding (sin/cos for seasonality)
- Trend and momentum features
- Population density normalization
- Humidity-temperature interaction terms
"""

import numpy as np
import pandas as pd
from typing import Optional, List, Dict, Tuple


# District list for one-hot encoding
DISTRICTS = [
    "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "NuwaraEliya",
    "Galle", "Matara", "Hambanthota", "Jaffna", "Kilinochchi", "Mannar",
    "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee",
    "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
    "Monaragala", "Ratnapura", "Kegalle",
]


class FeatureEngineer:
    """
    Feature engineering class for dengue prediction model.
    
    Transforms raw dengue case and weather data into features suitable
    for machine learning models.
    """
    
    def __init__(self, include_population: bool = True):
        """
        Initialize the feature engineer.
        
        Args:
            include_population: Whether to include population density features
        """
        self.include_population = include_population
        self.feature_names: List[str] = []
        
        # Population data (per 1000 people for normalization)
        self.population_density = {
            "Colombo": 3463.52, "Gampaha": 1661.14, "Kalutara": 789.74,
            "Kandy": 705.67, "Matale": 248.87, "NuwaraEliya": 423.32,
            "Galle": 643.58, "Matara": 643.80, "Hambanthota": 244.54,
            "Jaffna": 598.93, "Kilinochchi": 111.81, "Mannar": 52.61,
            "Vavuniya": 87.45, "Mullaitivu": 56.17, "Batticaloa": 192.36,
            "Ampara": 150.62, "Trincomalee": 150.02, "Kurunegala": 335.98,
            "Puttalam": 256.51, "Anuradhapura": 125.50, "Polonnaruwa": 127.24,
            "Badulla": 303.04, "Monaragala": 84.77, "Ratnapura": 332.21,
            "Kegalle": 502.66,
        }
        
        # Urbanization encoding
        self.urbanization_encoding = {
            "high": 1.0, "medium": 0.5, "low": 0.0
        }
    
    def create_lag_features(
        self, 
        df: pd.DataFrame, 
        column: str = "cases",
        lags: List[int] = [1, 2, 3, 4]
    ) -> pd.DataFrame:
        """
        Create lagged features for a given column.
        
        Args:
            df: DataFrame with 'district', 'year', 'week' and target column
            column: Column to create lags for
            lags: List of lag periods (weeks)
            
        Returns:
            DataFrame with lag features added
        """
        df = df.copy()
        df = df.sort_values(["district", "year", "week"])
        
        for lag in lags:
            df[f"{column}_lag{lag}"] = df.groupby("district")[column].shift(lag)
        
        return df
    
    def create_rolling_features(
        self,
        df: pd.DataFrame,
        column: str = "cases",
        windows: List[int] = [4, 8, 12]
    ) -> pd.DataFrame:
        """
        Create rolling window statistics.
        
        Args:
            df: DataFrame with 'district' and target column
            column: Column to compute rolling stats for
            windows: List of window sizes (weeks)
            
        Returns:
            DataFrame with rolling features added
        """
        df = df.copy()
        df = df.sort_values(["district", "year", "week"])
        
        for window in windows:
            # Rolling mean
            df[f"{column}_mean_{window}w"] = (
                df.groupby("district")[column]
                .rolling(window, min_periods=1)
                .mean()
                .reset_index(0, drop=True)
            )
            
            # Rolling standard deviation
            df[f"{column}_std_{window}w"] = (
                df.groupby("district")[column]
                .rolling(window, min_periods=2)
                .std()
                .reset_index(0, drop=True)
            )
            
            # Rolling max (outbreak detection)
            df[f"{column}_max_{window}w"] = (
                df.groupby("district")[column]
                .rolling(window, min_periods=1)
                .max()
                .reset_index(0, drop=True)
            )
        
        return df
    
    def create_weather_lag_features(
        self,
        df: pd.DataFrame,
        weather_cols: List[str] = ["temperature_2m_mean", "precipitation_sum", "relative_humidity_mean"],
        lags: List[int] = [1, 2]
    ) -> pd.DataFrame:
        """
        Create lagged weather features.
        
        Weather affects mosquito breeding with a delay of 1-3 weeks,
        so lagged weather features are important predictors.
        
        Args:
            df: DataFrame with weather columns
            weather_cols: List of weather columns to lag
            lags: Lag periods in weeks
            
        Returns:
            DataFrame with lagged weather features
        """
        df = df.copy()
        df = df.sort_values(["district", "year", "week"])
        
        for col in weather_cols:
            if col in df.columns:
                for lag in lags:
                    df[f"{col}_lag{lag}"] = df.groupby("district")[col].shift(lag)
        
        return df
    
    def create_cyclical_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create cyclical features for week of year.
        
        Uses sin/cos encoding to capture monsoon seasonality patterns.
        Sri Lanka has two monsoons:
        - Southwest (May-Sep): Week 18-39
        - Northeast (Oct-Jan): Week 40-52 and 1-4
        
        Args:
            df: DataFrame with 'week' column
            
        Returns:
            DataFrame with cyclical features
        """
        df = df.copy()
        
        # Sin/cos encoding for week (period = 52 weeks)
        df["week_sin"] = np.sin(2 * np.pi * df["week"] / 52)
        df["week_cos"] = np.cos(2 * np.pi * df["week"] / 52)
        
        # Month-level cyclical features for broader seasonality
        # Approximate month from week
        df["month_approx"] = ((df["week"] - 1) / 4.33).astype(int) + 1
        df["month_sin"] = np.sin(2 * np.pi * df["month_approx"] / 12)
        df["month_cos"] = np.cos(2 * np.pi * df["month_approx"] / 12)
        
        # Monsoon indicator features
        df["is_southwest_monsoon"] = df["week"].apply(
            lambda w: 1 if 18 <= w <= 39 else 0
        )
        df["is_northeast_monsoon"] = df["week"].apply(
            lambda w: 1 if w >= 40 or w <= 4 else 0
        )
        
        return df
    
    def create_trend_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create trend and momentum features.
        
        These features help detect outbreak patterns and acceleration.
        
        Args:
            df: DataFrame with lag features already created
            
        Returns:
            DataFrame with trend features
        """
        df = df.copy()
        
        # Week-over-week change
        if "cases_lag1" in df.columns and "cases_lag2" in df.columns:
            df["cases_wow_change"] = df["cases_lag1"] - df["cases_lag2"]
            
            # Percentage change (with safety for division by zero)
            df["cases_wow_pct_change"] = np.where(
                df["cases_lag2"] > 0,
                (df["cases_lag1"] - df["cases_lag2"]) / df["cases_lag2"],
                0
            )
        
        # Trend direction (3-week trend)
        if "cases_lag1" in df.columns and "cases_lag3" in df.columns:
            df["cases_trend_3w"] = df["cases_lag1"] - df["cases_lag3"]
            
            # Is cases accelerating?
            df["is_accelerating"] = (
                (df["cases_lag1"] > df["cases_lag2"]) & 
                (df["cases_lag2"] > df["cases_lag3"])
            ).astype(int)
        
        # Outbreak momentum (deviation from 4-week mean)
        if "cases_lag1" in df.columns and "cases_mean_4w" in df.columns:
            df["outbreak_momentum"] = np.where(
                df["cases_mean_4w"] > 0,
                (df["cases_lag1"] - df["cases_mean_4w"]) / df["cases_mean_4w"],
                0
            )
        
        return df
    
    def create_interaction_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create interaction features between weather variables.
        
        Mosquito breeding is optimal at specific temperature-humidity combinations.
        
        Args:
            df: DataFrame with weather features
            
        Returns:
            DataFrame with interaction features
        """
        df = df.copy()
        
        # Temperature-humidity interaction
        if "temperature_2m_mean" in df.columns and "relative_humidity_mean" in df.columns:
            # Optimal breeding conditions: 25-32°C and 60-80% humidity
            df["temp_humidity_interaction"] = (
                df["temperature_2m_mean"] * df["relative_humidity_mean"] / 100
            )
            
            # Is in optimal breeding range?
            df["is_optimal_breeding"] = (
                (df["temperature_2m_mean"] >= 25) & 
                (df["temperature_2m_mean"] <= 32) &
                (df["relative_humidity_mean"] >= 60) &
                (df["relative_humidity_mean"] <= 80)
            ).astype(int)
        
        # Rainfall-temperature interaction
        if "temperature_2m_mean" in df.columns and "precipitation_sum" in df.columns:
            # Hot + wet conditions favor breeding
            df["hot_wet_index"] = np.where(
                df["temperature_2m_mean"] > 27,
                df["temperature_2m_mean"] * np.log1p(df["precipitation_sum"]),
                0
            )
        
        return df
    
    def add_population_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Add population density features for normalization.
        
        Args:
            df: DataFrame with 'district' column
            
        Returns:
            DataFrame with population features
        """
        if not self.include_population:
            return df
        
        df = df.copy()
        
        # Add population density
        df["population_density"] = df["district"].map(self.population_density)
        
        # Log-transform for better distribution
        df["log_population_density"] = np.log1p(df["population_density"])
        
        # Normalize population density (min-max to 0-1 range)
        min_density = min(self.population_density.values())
        max_density = max(self.population_density.values())
        df["population_density_norm"] = (
            (df["population_density"] - min_density) / (max_density - min_density)
        )
        
        return df
    
    def encode_districts(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        One-hot encode districts.
        
        Args:
            df: DataFrame with 'district' column
            
        Returns:
            DataFrame with district one-hot columns
        """
        df = df.copy()
        
        for district in DISTRICTS:
            df[f"district_{district}"] = (df["district"] == district).astype(int)
        
        return df
    
    def engineer_features(
        self,
        df: pd.DataFrame,
        target_col: str = "cases",
        include_weather_lags: bool = True,
        include_interactions: bool = True,
        include_cyclical: bool = True,
        include_trends: bool = True,
    ) -> Tuple[pd.DataFrame, List[str]]:
        """
        Full feature engineering pipeline.
        
        Args:
            df: Raw DataFrame with cases, weather, and district data
            target_col: Name of target column
            include_weather_lags: Include lagged weather features
            include_interactions: Include feature interactions
            include_cyclical: Include cyclical time features
            include_trends: Include trend features
            
        Returns:
            Tuple of (engineered DataFrame, list of feature names)
        """
        # Step 1: Lag features for cases
        df = self.create_lag_features(df, target_col, lags=[1, 2, 3, 4])
        
        # Step 2: Rolling statistics
        df = self.create_rolling_features(df, target_col, windows=[4, 8])
        
        # Step 3: Weather lag features
        if include_weather_lags:
            df = self.create_weather_lag_features(df)
        
        # Step 4: Cyclical time features
        if include_cyclical:
            df = self.create_cyclical_features(df)
        
        # Step 5: Trend features
        if include_trends:
            df = self.create_trend_features(df)
        
        # Step 6: Interaction features
        if include_interactions:
            df = self.create_interaction_features(df)
        
        # Step 7: Population features
        df = self.add_population_features(df)
        
        # Step 8: District encoding
        df = self.encode_districts(df)
        
        # Define feature columns
        feature_cols = [
            # Base lag features
            "cases_lag1", "cases_lag2", "cases_lag3", "cases_lag4",
            # Rolling stats
            "cases_mean_4w", "cases_std_4w", "cases_max_4w",
            "cases_mean_8w", "cases_std_8w", "cases_max_8w",
            # Weather current
            "temperature_2m_mean", "precipitation_sum",
        ]
        
        # Add humidity if available
        if "relative_humidity_mean" in df.columns:
            feature_cols.append("relative_humidity_mean")
        
        # Add weather lags
        if include_weather_lags:
            weather_lag_cols = [c for c in df.columns if "_lag" in c and c.startswith(("temperature", "precipitation", "relative"))]
            feature_cols.extend(weather_lag_cols)
        
        # Add cyclical features
        if include_cyclical:
            feature_cols.extend([
                "week_sin", "week_cos", "month_sin", "month_cos",
                "is_southwest_monsoon", "is_northeast_monsoon"
            ])
        
        # Add trend features
        if include_trends:
            trend_cols = ["cases_wow_change", "cases_wow_pct_change", 
                         "cases_trend_3w", "is_accelerating", "outbreak_momentum"]
            feature_cols.extend([c for c in trend_cols if c in df.columns])
        
        # Add interaction features
        if include_interactions:
            interaction_cols = ["temp_humidity_interaction", "is_optimal_breeding", "hot_wet_index"]
            feature_cols.extend([c for c in interaction_cols if c in df.columns])
        
        # Add population features
        if self.include_population:
            feature_cols.extend(["log_population_density", "population_density_norm"])
        
        # Add district one-hot columns
        district_cols = [f"district_{d}" for d in DISTRICTS]
        feature_cols.extend(district_cols)
        
        # Filter to only existing columns
        self.feature_names = [c for c in feature_cols if c in df.columns]
        
        return df, self.feature_names
    
    def prepare_for_prediction(
        self,
        district: str,
        cases_lag1: float,
        cases_lag2: float,
        cases_lag3: float,
        cases_lag4: float,
        temperature: float,
        precipitation: float,
        humidity: Optional[float] = None,
        week: int = 1,
    ) -> pd.DataFrame:
        """
        Prepare a single prediction input with all engineered features.
        
        Args:
            district: District name
            cases_lag1-4: Cases from previous 1-4 weeks
            temperature: Current week temperature
            precipitation: Current week precipitation
            humidity: Current week humidity (optional)
            week: Week number (1-52)
            
        Returns:
            DataFrame ready for model prediction
        """
        # Use default humidity if not provided (average for Sri Lanka)
        if humidity is None:
            humidity = 70.0  # Default humidity
        
        # Create base record
        record = {
            "district": district,
            "week": week,
            "cases_lag1": cases_lag1,
            "cases_lag2": cases_lag2,
            "cases_lag3": cases_lag3,
            "cases_lag4": cases_lag4,
            "temperature_2m_mean": temperature,
            "precipitation_sum": precipitation,
            "relative_humidity_mean": humidity,
        }
        
        df = pd.DataFrame([record])
        
        # Calculate derived features
        cases_history = [cases_lag4, cases_lag3, cases_lag2, cases_lag1]
        df["cases_mean_4w"] = np.mean(cases_history)
        df["cases_std_4w"] = np.std(cases_history)
        df["cases_max_4w"] = np.max(cases_history)
        df["cases_mean_8w"] = df["cases_mean_4w"]  # Approximate
        df["cases_std_8w"] = df["cases_std_4w"]
        df["cases_max_8w"] = df["cases_max_4w"]
        
        # Weather lag features (use current values as approximation)
        df["temperature_2m_mean_lag1"] = temperature
        df["temperature_2m_mean_lag2"] = temperature
        df["precipitation_sum_lag1"] = precipitation
        df["precipitation_sum_lag2"] = precipitation
        df["relative_humidity_mean_lag1"] = humidity
        df["relative_humidity_mean_lag2"] = humidity
        
        # Cyclical features
        df["week_sin"] = np.sin(2 * np.pi * week / 52)
        df["week_cos"] = np.cos(2 * np.pi * week / 52)
        month_approx = ((week - 1) / 4.33) + 1
        df["month_sin"] = np.sin(2 * np.pi * month_approx / 12)
        df["month_cos"] = np.cos(2 * np.pi * month_approx / 12)
        df["is_southwest_monsoon"] = 1 if 18 <= week <= 39 else 0
        df["is_northeast_monsoon"] = 1 if week >= 40 or week <= 4 else 0
        
        # Trend features
        df["cases_wow_change"] = cases_lag1 - cases_lag2
        df["cases_wow_pct_change"] = (cases_lag1 - cases_lag2) / cases_lag2 if cases_lag2 > 0 else 0
        df["cases_trend_3w"] = cases_lag1 - cases_lag3
        df["is_accelerating"] = 1 if cases_lag1 > cases_lag2 > cases_lag3 else 0
        df["outbreak_momentum"] = (cases_lag1 - df["cases_mean_4w"].iloc[0]) / df["cases_mean_4w"].iloc[0] if df["cases_mean_4w"].iloc[0] > 0 else 0
        
        # Interaction features
        df["temp_humidity_interaction"] = temperature * humidity / 100
        df["is_optimal_breeding"] = 1 if (25 <= temperature <= 32 and 60 <= humidity <= 80) else 0
        df["hot_wet_index"] = temperature * np.log1p(precipitation) if temperature > 27 else 0
        
        # Population features
        df = self.add_population_features(df)
        
        # District encoding
        df = self.encode_districts(df)
        
        return df


def create_enhanced_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """
    Convenience function to create all enhanced features.
    
    Args:
        df: Raw DataFrame with cases, weather, and district data
        
    Returns:
        Tuple of (engineered DataFrame, feature names list)
    """
    engineer = FeatureEngineer(include_population=True)
    return engineer.engineer_features(df)


if __name__ == "__main__":
    # Example usage
    print("Feature Engineering Module for EpiLink Dengue Prediction")
    print("=" * 60)
    
    engineer = FeatureEngineer()
    
    # Test with sample data
    sample = engineer.prepare_for_prediction(
        district="Colombo",
        cases_lag1=45,
        cases_lag2=38,
        cases_lag3=42,
        cases_lag4=35,
        temperature=29.5,
        precipitation=85.0,
        humidity=72.0,
        week=25
    )
    
    print(f"\nSample prediction input shape: {sample.shape}")
    print(f"Number of features: {sample.shape[1]}")
    print("\nSample features:")
    for col in sample.columns[:20]:
        print(f"  {col}: {sample[col].iloc[0]}")
