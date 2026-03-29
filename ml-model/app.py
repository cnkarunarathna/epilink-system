from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import joblib
import pandas as pd
import numpy as np
import os
from datetime import datetime

# Model paths (check both legacy and new locations)
MODEL_PATH = "models/dengue_xgb_model.pkl"
LEGACY_MODEL_PATH = "models/legacy/dengue_xgb_model.pkl"
ENSEMBLE_PATH = "models/dengue_ensemble_model.pkl"
ENHANCED_ENSEMBLE_PATH = "models/enhanced/dengue_ensemble_model.pkl"
UNCERTAINTY_PATH = "models/uncertainty_estimator.pkl"
ENHANCED_UNCERTAINTY_PATH = "models/enhanced/uncertainty_estimator.pkl"
METADATA_PATH = "models/model_metadata.pkl"
ENHANCED_METADATA_PATH = "models/enhanced/model_metadata.pkl"

# Model version
MODEL_VERSION = "2.0.0"

# Load models
model = None
ensemble = None
uncertainty_estimator = None
model_metadata = None

# Try to load ensemble model first (check both locations)
ensemble_path = ENHANCED_ENSEMBLE_PATH if os.path.exists(ENHANCED_ENSEMBLE_PATH) else ENSEMBLE_PATH
if os.path.exists(ensemble_path):
    try:
        from src.enhanced.ensemble_model import DengueEnsemblePredictor
        ensemble = DengueEnsemblePredictor.load(ensemble_path)
        print("Loaded ensemble model")
    except Exception as e:
        print(f"Could not load ensemble: {e}")

# Load uncertainty estimator
uncertainty_path = ENHANCED_UNCERTAINTY_PATH if os.path.exists(ENHANCED_UNCERTAINTY_PATH) else UNCERTAINTY_PATH
if os.path.exists(uncertainty_path):
    try:
        uncertainty_estimator = joblib.load(uncertainty_path)
        print("Loaded uncertainty estimator")
    except Exception as e:
        print(f"Could not load uncertainty estimator: {e}")

# Load metadata
metadata_path = ENHANCED_METADATA_PATH if os.path.exists(ENHANCED_METADATA_PATH) else METADATA_PATH
if os.path.exists(metadata_path):
    try:
        model_metadata = joblib.load(metadata_path)
        print("Loaded model metadata")
    except Exception as e:
        print(f"Could not load metadata: {e}")

# Fall back to legacy XGBoost model
if ensemble is None:
    model_path = LEGACY_MODEL_PATH if os.path.exists(LEGACY_MODEL_PATH) else MODEL_PATH
    if not os.path.exists(model_path):
        print("No trained model found! Please train first with: ./scripts/training/train_enhanced.sh")
    else:
        model = joblib.load(model_path)
        print("Loaded legacy XGBoost model")

# Load district list dynamically from the model training data
DISTRICTS = [
    "Colombo",
    "Gampaha",
    "Kalutara",
    "Kandy",
    "Matale",
    "NuwaraEliya",
    "Galle",
    "Matara",
    "Hambanthota",
    "Jaffna",
    "Kilinochchi",
    "Mannar",
    "Vavuniya",
    "Mullaitivu",
    "Batticaloa",
    "Ampara",
    "Trincomalee",
    "Kurunegala",
    "Puttalam",
    "Anuradhapura",
    "Polonnaruwa",
    "Badulla",
    "Monaragala",
    "Ratnapura",
    "Kegalle",
]

# Risk level thresholds
RISK_THRESHOLDS = {
    "low": 10,
    "medium": 30,
    "high": 50,
}

def classify_risk(cases: float) -> str:
    """Classify risk level based on predicted cases."""
    if cases < RISK_THRESHOLDS["low"]:
        return "low"
    elif cases < RISK_THRESHOLDS["medium"]:
        return "medium"
    elif cases < RISK_THRESHOLDS["high"]:
        return "high"
    else:
        return "critical"

# FastAPI app
app = FastAPI(
    title="EpiLink Dengue Forecast API",
    version=MODEL_VERSION,
    description="Dengue case prediction API with confidence intervals and risk classification",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Input Schema
class DengueInput(BaseModel):
    district: str
    cases_lag1: float
    cases_lag2: float
    cases_lag3: float
    cases_mean_4w: float
    temperature_2m_mean: float
    precipitation_sum: float
    humidity: Optional[float] = Field(None, description="Relative humidity (optional)")
    week: Optional[int] = Field(None, ge=1, le=53, description="Week number (optional)")


# Input Schema for bulk prediction
class BulkDengueInput(BaseModel):
    cases_lag1: float
    cases_lag2: float
    cases_lag3: float
    cases_mean_4w: float
    temperature_2m_mean: float
    precipitation_sum: float


# Input Schema for district-specific bulk prediction
class DistrictFeatures(BaseModel):
    district: str
    cases_lag1: float
    cases_lag2: float
    cases_lag3: float
    cases_mean_4w: float
    temperature_2m_mean: float
    precipitation_sum: float


class BulkDistrictInput(BaseModel):
    districts: list[DistrictFeatures]


# Prediction Endpoint (Enhanced)
@app.post("/predict")
def predict_dengue(input_data: DengueInput):
    """
    Predict dengue cases for a district with optional confidence intervals.
    
    Returns predicted cases, confidence interval, and risk level.
    """
    if input_data.district not in DISTRICTS:
        raise HTTPException(status_code=400, detail="Invalid district name")

    # Build feature vector
    input_dict = input_data.model_dump(exclude_none=True)
    df = pd.DataFrame([input_dict])

    # Add one-hot encoding columns for all districts
    for d in DISTRICTS:
        df[f"district_{d}"] = 1 if d == input_data.district else 0

    # Use ensemble model if available
    if ensemble is not None:
        # Get model features
        model_features = ensemble.feature_names
        
        # Add missing columns
        for col in model_features:
            if col not in df.columns:
                df[col] = 0
        
        # Keep only model features
        df = df[[c for c in model_features if c in df.columns]]
        
        # Get prediction with uncertainty
        prediction = ensemble.predict(df)[0]
        
        # Get uncertainty bounds if available
        if uncertainty_estimator is not None:
            try:
                _, lower, upper = ensemble.predict_with_uncertainty(df)
                lower_bound = float(max(0, lower[0]))
                upper_bound = float(upper[0])
            except:
                # Fallback: estimate from ensemble disagreement
                lower_bound = max(0, prediction * 0.7)
                upper_bound = prediction * 1.3
        else:
            lower_bound = max(0, prediction * 0.7)
            upper_bound = prediction * 1.3
    else:
        # Legacy XGBoost model
        model_features = model.get_booster().feature_names
        
        for col in model_features:
            if col not in df.columns:
                df[col] = 0
        
        df = df[model_features]
        prediction = model.predict(df)[0]
        lower_bound = max(0, prediction * 0.7)
        upper_bound = prediction * 1.3

    predicted_cases = int(round(float(prediction)))
    risk_level = classify_risk(predicted_cases)
    
    return {
        "district": input_data.district,
        "predicted_cases": predicted_cases,
        "confidence_interval": {
            "lower": int(round(lower_bound)),
            "upper": int(round(upper_bound)),
            "confidence_level": 0.80,
        },
        "risk_level": risk_level,
        "model_version": MODEL_VERSION,
    }


# Bulk Prediction Endpoint - Predict all 25 districts at once
@app.post("/predict/all")
def predict_all_districts(input_data: BulkDengueInput):
    """
    Predict dengue cases for all 25 districts using the same input features.
    Returns predictions sorted by predicted cases (highest to lowest).
    """
    # Build base feature dictionary
    base_features = input_data.dict()

    # Get model features
    model_features = model.get_booster().feature_names

    # Create a list of feature dictionaries for all districts
    all_rows = []
    for district in DISTRICTS:
        row = base_features.copy()
        # Add one-hot encoding for all districts
        for d in DISTRICTS:
            row[f"district_{d}"] = 1 if d == district else 0
        all_rows.append(row)

    # Create single DataFrame with all 25 districts
    df = pd.DataFrame(all_rows)

    # Add missing columns if needed
    for col in model_features:
        if col not in df.columns:
            df[col] = 0

    # Keep only model features in correct order
    df = df[model_features]

    # Make predictions for all districts at once
    predictions_array = model.predict(df)

    # Build results
    predictions = [
        {"district": district, "predicted_cases": int(round(float(pred)))}
        for district, pred in zip(DISTRICTS, predictions_array)
    ]

    # Sort by predicted cases (highest to lowest)
    predictions.sort(key=lambda x: x["predicted_cases"], reverse=True)

    return {
        "total_districts": len(predictions),
        "total_predicted_cases": sum(p["predicted_cases"] for p in predictions),
        "predictions": predictions,
    }


# Bulk Prediction with District-Specific Features
@app.post("/predict/bulk/districts")
def predict_bulk_districts(input_data: BulkDistrictInput):
    """
    Predict dengue cases for multiple districts with district-specific features.
    Each district can have its own lag features and weather data.
    Returns predictions sorted by predicted cases (highest to lowest).
    """
    # Validate all district names first
    district_names = []
    for district_data in input_data.districts:
        if district_data.district not in DISTRICTS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid district name: {district_data.district}",
            )
        district_names.append(district_data.district)

    # Build all rows for DataFrame
    all_rows = []
    for district_data in input_data.districts:
        # Build feature vector
        input_dict = district_data.model_dump()
        district_name = input_dict.pop("district")

        # Add one-hot encoding for all districts
        for d in DISTRICTS:
            input_dict[f"district_{d}"] = 1 if d == district_name else 0

        all_rows.append(input_dict)

    # Create single DataFrame with all districts
    df = pd.DataFrame(all_rows)

    # Use ensemble model if available
    if ensemble is not None:
        model_features = ensemble.feature_names
        
        # Add missing columns
        for col in model_features:
            if col not in df.columns:
                df[col] = 0
        
        # Keep only model features
        df = df[[c for c in model_features if c in df.columns]]
        
        # Get predictions with uncertainty
        predictions_array = ensemble.predict(df)
        _, lower_bounds, upper_bounds = ensemble.predict_with_uncertainty(df)
        
        # Build results with confidence intervals
        predictions = []
        for i, (district_name, pred) in enumerate(zip(district_names, predictions_array)):
            predicted_cases = int(round(float(pred)))
            predictions.append({
                "district": district_name,
                "predicted_cases": predicted_cases,
                "confidence_interval": {
                    "lower": int(round(max(0, float(lower_bounds[i])))),
                    "upper": int(round(float(upper_bounds[i]))),
                    "confidence_level": 0.80,
                },
                "risk_level": classify_risk(predicted_cases),
            })
    else:
        # Legacy XGBoost model
        model_features = model.get_booster().feature_names
        
        for col in model_features:
            if col not in df.columns:
                df[col] = 0
        
        df = df[model_features]
        predictions_array = model.predict(df)
        
        predictions = []
        for district_name, pred in zip(district_names, predictions_array):
            predicted_cases = int(round(float(pred)))
            predictions.append({
                "district": district_name,
                "predicted_cases": predicted_cases,
                "risk_level": classify_risk(predicted_cases),
            })

    # Sort by predicted cases (highest to lowest)
    predictions.sort(key=lambda x: x["predicted_cases"], reverse=True)

    return {
        "total_districts": len(predictions),
        "total_predicted_cases": sum(p["predicted_cases"] for p in predictions),
        "predictions": predictions,
        "model_version": MODEL_VERSION,
    }


# Root Route
@app.get("/")
def root():
    return {"message": "EpiLink Dengue Forecast API is running!"}


# Health Check Endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "EpiLink Dengue Forecast API"}


# Get Current Lag Features Endpoint
@app.get("/features/current")
def get_current_features(district: str = None):
    """
    Get the most recent lag features for predictions.
    Uses forecasted data if available, otherwise returns instructions.

    Query params:
    - district: Optional. Get features for specific district, or all if omitted.
    """
    FORECAST_FILE = "data/forecast_features.csv"

    # Check if forecast file exists
    if not os.path.exists(FORECAST_FILE):
        return {
            "error": "Forecast data not available",
            "message": "Run 'python generate_forecast_features.py' to generate current lag features",
            "instructions": [
                "1. Run: python generate_forecast_features.py",
                "2. This will predict from March 2025 to current date",
                "3. The lag features will be saved and available for predictions",
            ],
        }

    # Load forecast data
    forecast_df = pd.read_csv(FORECAST_FILE)

    # Get current week
    today = datetime.now()
    current_year = today.year
    current_week = today.isocalendar()[1]

    # Get the most recent week's data for each district
    # (This should be the current week or the last forecasted week)
    latest_data = (
        forecast_df.sort_values(["district", "year", "week"])
        .groupby("district")
        .tail(1)
    )

    if district:
        # Get specific district
        if district not in DISTRICTS:
            raise HTTPException(status_code=400, detail="Invalid district name")

        district_data = latest_data[latest_data["district"] == district]
        if district_data.empty:
            raise HTTPException(
                status_code=404, detail=f"No forecast data for {district}"
            )

        row = district_data.iloc[0]
        return {
            "district": district,
            "current_week": f"{row['year']}-W{row['week']}",
            "features": {
                "cases_lag1": float(row["cases_lag1"]),
                "cases_lag2": float(row["cases_lag2"]),
                "cases_lag3": float(row["cases_lag3"]),
                "cases_mean_4w": float(row["cases_mean_4w"]),
                "temperature_2m_mean": float(row["temperature_2m_mean"]),
                "precipitation_sum": float(row["precipitation_sum"]),
            },
            "note": "These lag features are based on forecasted data from March 2025",
        }
    else:
        # Get all districts
        all_features = []
        for _, row in latest_data.iterrows():
            all_features.append(
                {
                    "district": row["district"],
                    "current_week": f"{row['year']}-W{row['week']}",
                    "features": {
                        "cases_lag1": float(row["cases_lag1"]),
                        "cases_lag2": float(row["cases_lag2"]),
                        "cases_lag3": float(row["cases_lag3"]),
                        "cases_mean_4w": float(row["cases_mean_4w"]),
                        "temperature_2m_mean": float(row["temperature_2m_mean"]),
                        "precipitation_sum": float(row["precipitation_sum"]),
                    },
                }
            )

        return {
            "total_districts": len(all_features),
            "current_year_week": f"{current_year}-W{current_week}",
            "districts": all_features,
            "note": "These lag features are based on forecasted data from March 2025",
        }


# Model Info Endpoint
@app.get("/model/info")
def get_model_info():
    """
    Get model information including version, performance metrics, and feature importance.
    """
    info = {
        "version": MODEL_VERSION,
        "model_type": "ensemble" if ensemble is not None else "xgboost",
        "has_uncertainty_estimation": uncertainty_estimator is not None,
        "risk_thresholds": RISK_THRESHOLDS,
    }
    
    # Add metadata if available
    if model_metadata is not None:
        info["trained_at"] = model_metadata.get("trained_at", "unknown")
        info["n_features"] = model_metadata.get("n_features", 0)
        info["metrics"] = model_metadata.get("metrics", {})
        if "ensemble_weights" in model_metadata:
            info["ensemble_weights"] = model_metadata["ensemble_weights"]
    
    # Add ensemble info
    if ensemble is not None:
        info["models"] = list(ensemble.models.keys())
        info["weights"] = ensemble.weights
        
        # Get top feature importance
        importance = ensemble.get_feature_importance()
        if not importance.empty:
            info["top_features"] = importance.head(10).to_dict(orient="records")
    
    return info


# Districts List Endpoint
@app.get("/districts")
def get_districts():
    """
    Get list of all supported districts.
    """
    return {
        "total": len(DISTRICTS),
        "districts": DISTRICTS,
    }


# Risk Thresholds Endpoint
@app.get("/risk/thresholds")
def get_risk_thresholds():
    """
    Get current risk classification thresholds.
    """
    return {
        "thresholds": RISK_THRESHOLDS,
        "levels": ["low", "medium", "high", "critical"],
        "description": {
            "low": "Normal endemic level - routine surveillance",
            "medium": "Elevated - enhanced monitoring recommended",
            "high": "Outbreak warning - activate response measures",
            "critical": "Emergency - urgent intervention needed",
        },
    }
