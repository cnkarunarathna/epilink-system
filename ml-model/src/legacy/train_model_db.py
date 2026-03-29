"""
Train dengue prediction model using data from PostgreSQL database.
This version fetches all training data from the database instead of CSV files.
"""

import pandas as pd
import platform
import psycopg2
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os
from config import DB_CONFIG, MODEL_PATH


def get_db_connection():
    """Create database connection."""
    return psycopg2.connect(**DB_CONFIG)


def load_data_from_db():
    """Load and merge dengue cases and weather data from database."""
    print("Loading data from PostgreSQL...")

    conn = get_db_connection()

    # Query to join dengue cases and weather data
    query = """
        SELECT 
            d.name as district,
            dc.year,
            dc.week,
            dc.cases,
            w.temperature_2m_mean,
            w.precipitation_sum
        FROM dengue_cases dc
        JOIN districts d ON dc.district_id = d.id
        LEFT JOIN weather_data w ON dc.district_id = w.district_id 
                                  AND dc.year = w.year 
                                  AND dc.week = w.week
        ORDER BY d.name, dc.year, dc.week
    """

    df = pd.read_sql_query(query, conn)
    conn.close()

    print(f"  Loaded {len(df)} records from database")
    return df


def create_features(df):
    """Create lag features and rolling averages."""
    print("Creating features...")

    # Sort by district, year, week
    df = df.sort_values(["district", "year", "week"])

    # Create lag features
    df["cases_lag1"] = df.groupby("district")["cases"].shift(1)
    df["cases_lag2"] = df.groupby("district")["cases"].shift(2)
    df["cases_lag3"] = df.groupby("district")["cases"].shift(3)

    # Create rolling mean
    df["cases_mean_4w"] = (
        df.groupby("district")["cases"].rolling(4).mean().reset_index(0, drop=True)
    )

    # Forward fill missing weather data
    df["temperature_2m_mean"] = df.groupby("district")["temperature_2m_mean"].ffill()
    df["precipitation_sum"] = df.groupby("district")["precipitation_sum"].ffill()

    # Drop rows with missing lag features
    df.dropna(
        subset=["cases_lag1", "cases_lag2", "cases_lag3", "cases_mean_4w"], inplace=True
    )

    # Drop rows with missing weather data
    df.dropna(subset=["temperature_2m_mean", "precipitation_sum"], inplace=True)

    print(f"  Dataset shape after feature engineering: {df.shape}")
    return df


def prepare_training_data(df):
    """Prepare features and target for training."""
    print("Preparing training data...")

    # One-hot encode districts
    df_encoded = pd.get_dummies(df, columns=["district"])

    # Define feature columns
    features = [
        "cases_lag1",
        "cases_lag2",
        "cases_lag3",
        "cases_mean_4w",
        "temperature_2m_mean",
        "precipitation_sum",
    ] + [c for c in df_encoded.columns if c.startswith("district_")]

    X = df_encoded[features]
    y = df_encoded["cases"]

    # Split into train/test (80/20)
    split = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split], X.iloc[split:]
    y_train, y_test = y.iloc[:split], y.iloc[split:]

    print(f"  Training samples: {len(X_train)}")
    print(f"  Test samples: {len(X_test)}")

    return X_train, X_test, y_train, y_test, X, y, df_encoded


def train_model(X_train, y_train):
    """Train XGBoost model with auto-detected device."""
    print("\nTraining XGBoost model...")

    # Auto-detect device: CUDA for NVIDIA GPU, CPU for Apple Silicon
    system = platform.system()
    machine = platform.machine()
    is_apple_silicon = system == "Darwin" and machine == "arm64"

    if is_apple_silicon:
        device = "cpu"  # Apple Silicon uses optimized CPU
        print("Detected Apple Silicon - using optimized CPU training")
    else:
        device = "cuda"  # NVIDIA GPU acceleration
        print("Using CUDA GPU acceleration")

    model = XGBRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=8,
        subsample=0.8,
        tree_method="hist",  # Optimized for both CPU and GPU
        device=device,  # Auto-detected device
        random_state=42,
        n_jobs=-1,  # Use all CPU cores
    )

    model.fit(X_train, y_train)
    print("Training complete!")

    return model


def evaluate_model(model, X_test, y_test, X, y, df_encoded):
    """Evaluate model performance."""
    print("\nEvaluating model...")

    # Overall metrics
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print(f"  Overall MAE: {mae:.3f}")
    print(f"  Overall R²: {r2:.3f}")

    # District-wise performance
    df_encoded["predicted"] = model.predict(X)
    district_mae = []

    # Get original district names from encoded columns
    district_cols = [c for c in df_encoded.columns if c.startswith("district_")]

    for col in district_cols:
        district_name = col.replace("district_", "")
        subset = df_encoded[df_encoded[col] == 1]
        if len(subset) > 0:
            mae_district = mean_absolute_error(subset["cases"], subset["predicted"])
            district_mae.append((district_name, mae_district))

    district_mae_df = pd.DataFrame(
        district_mae, columns=["District", "MAE"]
    ).sort_values("MAE")

    print("\n  District-wise MAE (lower is better):")
    print(district_mae_df.to_string(index=False))

    return mae, r2


def save_model(model):
    """Save trained model to disk."""
    print(f"\nSaving model to {MODEL_PATH}...")

    os.makedirs("models", exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    print("Model saved successfully!")


def main():
    """Main training pipeline."""
    print("EpiLink ML Model Training (PostgreSQL Version)\n")

    try:
        # Load data from database
        df = load_data_from_db()

        # Create features
        df = create_features(df)

        # Prepare training data
        X_train, X_test, y_train, y_test, X, y, df_encoded = prepare_training_data(df)

        # Train model
        model = train_model(X_train, y_train)

        # Evaluate
        evaluate_model(model, X_test, y_test, X, y, df_encoded)

        # Save model
        save_model(model)

        print("\nTraining pipeline completed successfully!")

    except psycopg2.Error as e:
        print(f"\nDatabase error: {e}")
        print("\nMake sure:")
        print("  1. PostgreSQL is running")
        print("  2. Database and tables exist")
        print("  3. Data has been migrated (run: python migrate_data_to_db.py)")
        print("  4. .env file is configured correctly")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    main()
