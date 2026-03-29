import os, time, requests, pandas as pd, platform
from tqdm import tqdm
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import joblib


# CONFIGURATION

DENGUE_FILE = "data/srilanka_weekly_dengue.csv"
OUTPUT_MODEL = "models/dengue_xgb_model.pkl"
START_DATE, END_DATE = "2020-01-01", "2025-01-01"

# District coordinates (25 districts)
district_coords = {
    "Colombo": (6.9271, 79.8612),
    "Gampaha": (7.0917, 79.9994),
    "Kalutara": (6.5854, 79.9607),
    "Kandy": (7.2906, 80.6337),
    "Matale": (7.4675, 80.6234),
    "NuwaraEliya": (6.9497, 80.7891),
    "Galle": (6.0535, 80.2210),
    "Matara": (5.9549, 80.5550),
    "Hambanthota": (6.1248, 81.1010),
    "Jaffna": (9.6615, 80.0255),
    "Kilinochchi": (9.3951, 80.3987),
    "Mannar": (8.9770, 79.9046),
    "Vavuniya": (8.7514, 80.4970),
    "Mullaitivu": (9.2671, 80.8128),
    "Batticaloa": (7.7310, 81.6747),
    "Ampara": (7.3018, 81.6820),
    "Trincomalee": (8.5779, 81.2152),
    "Kurunegala": (7.4863, 80.3623),
    "Puttalam": (8.0400, 79.8390),
    "Anuradhapura": (8.3114, 80.4037),
    "Polonnaruwa": (7.9403, 81.0188),
    "Badulla": (6.9896, 81.0550),
    "Monaragala": (6.8710, 81.3487),
    "Ratnapura": (6.7056, 80.3847),
    "Kegalle": (7.2513, 80.3464),
}

# STEP 1 — Load and preprocess dengue data

df = pd.read_csv(DENGUE_FILE)
df = df.sort_values(["district", "year", "week"])
df["cases_lag1"] = df.groupby("district")["cases"].shift(1)
df["cases_lag2"] = df.groupby("district")["cases"].shift(2)
df["cases_lag3"] = df.groupby("district")["cases"].shift(3)
df["cases_mean_4w"] = (
    df.groupby("district")["cases"].rolling(4).mean().reset_index(0, drop=True)
)
df.dropna(
    subset=["cases_lag1", "cases_lag2", "cases_lag3", "cases_mean_4w"], inplace=True
)


# STEP 2 — Fetch weather data and merge per district


def fetch_weather(lat, lon, start_date, end_date):
    """Fetch daily weather and aggregate to weekly."""
    url = (
        f"https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&daily=temperature_2m_mean,precipitation_sum"
        f"&timezone=Asia%2FColombo"
    )
    r = requests.get(url)
    data = r.json()
    if "daily" not in data:
        return pd.DataFrame()
    w = pd.DataFrame(data["daily"])
    w["date"] = pd.to_datetime(w["time"])
    w["year"] = w["date"].dt.year
    w["week"] = w["date"].dt.isocalendar().week
    w = (
        w.groupby(["year", "week"])
        .agg({"temperature_2m_mean": "mean", "precipitation_sum": "sum"})
        .reset_index()
    )
    return w


merged_frames = []
os.makedirs("data/weather_data", exist_ok=True)

for district, (lat, lon) in tqdm(district_coords.items(), desc="Fetching weather"):
    cache_file = f"data/weather_data/{district}_weather.csv"
    if os.path.exists(cache_file):
        w = pd.read_csv(cache_file)
    else:
        w = fetch_weather(lat, lon, START_DATE, END_DATE)
        time.sleep(1)  # polite API delay
        if not w.empty:
            w.to_csv(cache_file, index=False)
    if w.empty:
        continue
    temp = df[df["district"] == district].merge(w, on=["year", "week"], how="left")
    temp.ffill(inplace=True)  # Updated pandas syntax
    merged_frames.append(temp)

merged_df = pd.concat(merged_frames, ignore_index=True)
print("Merged dataset shape:", merged_df.shape)

# STEP 3 — Encode districts and prepare features

merged_df = pd.get_dummies(merged_df, columns=["district"])
features = [
    "cases_lag1",
    "cases_lag2",
    "cases_lag3",
    "cases_mean_4w",
    "temperature_2m_mean",
    "precipitation_sum",
] + [c for c in merged_df.columns if c.startswith("district_")]

X, y = merged_df[features], merged_df["cases"]
split = int(len(X) * 0.8)
X_train, X_test = X.iloc[:split], X.iloc[split:]
y_train, y_test = y.iloc[:split], y.iloc[split:]


# STEP 4 — Train XGBoost model (cross-platform)

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

print("Training model...")
model.fit(X_train, y_train)
print("Training complete")


# STEP 5 — Evaluate performance

y_pred = model.predict(X_test)
print(f"MAE: {mean_absolute_error(y_test, y_pred):.3f}")
print(f"R²: {r2_score(y_test, y_pred):.3f}")

merged_df["predicted"] = model.predict(X)
district_mae = []
for d in df["district"].unique():
    col = f"district_{d}"
    if col in merged_df.columns:
        subset = merged_df[merged_df[col] == 1]
        mae = mean_absolute_error(subset["cases"], subset["predicted"])
        district_mae.append((d, mae))
district_mae = pd.DataFrame(district_mae, columns=["District", "MAE"]).sort_values(
    "MAE"
)
print("\nDistrict-wise MAE (lower is better):\n", district_mae)


# STEP 6 — Save model

os.makedirs("models", exist_ok=True)
joblib.dump(model, OUTPUT_MODEL)
print(f"\nModel saved to {OUTPUT_MODEL}")
