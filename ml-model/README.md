# EpiLink Dengue Forecasting Model – Usage Guide

**Version:** 1.0
**Author:** Charuka Karunarathna
**Model Type:** XGBoost (GPU-Accelerated)
**Last Updated:** December 2025

---

## Overview

The **EpiLink Dengue Forecasting Model** predicts **next-week dengue case counts** for each district in Sri Lanka using:

- recent weekly dengue data, and
- current weather conditions (temperature & rainfall).

This model is part of the **EpiLink – Smart Dengue Risk Monitoring and Cleanup Management System** and runs as a **FastAPI microservice** that can be consumed by the EpiLink web dashboard, backend cron jobs, or external health data APIs.

---

## Model Objective

| Goal        | Description                                                          |
| ----------- | -------------------------------------------------------------------- |
| Predict     | Forecast next-week dengue case count for each Sri Lankan district.   |
| Inputs      | Recent weekly dengue counts + weather (temperature & rainfall).      |
| Output      | Expected dengue case count (float).                                  |
| Algorithm   | XGBoost (tree-based gradient boosting) with GPU acceleration (CUDA). |
| Integration | FastAPI microservice running on local or cloud infrastructure.       |

---

## Input Features

| Field                 | Type   | Description                                              |
| --------------------- | ------ | -------------------------------------------------------- |
| `district`            | string | District name (e.g., `"Colombo"`, `"Kandy"`, `"Galle"`). |
| `cases_lag1`          | float  | Dengue cases one week before (Week -1).                  |
| `cases_lag2`          | float  | Dengue cases two weeks before (Week -2).                 |
| `cases_lag3`          | float  | Dengue cases three weeks before (Week -3).               |
| `cases_mean_4w`       | float  | Average number of dengue cases over the last four weeks. |
| `temperature_2m_mean` | float  | Average weekly air temperature in °C (2m above ground).  |
| `precipitation_sum`   | float  | Total weekly rainfall in mm.                             |

**All numeric fields must be provided as floats or integers.**

---

## Model Output

### Single Prediction Response:

```json
{
  "district": "Colombo",
  "predicted_cases": 25.83
}
```

| Field             | Type   | Description                                      |
| ----------------- | ------ | ------------------------------------------------ |
| `district`        | string | The district name provided in the input.         |
| `predicted_cases` | float  | The model’s forecast for next-week dengue cases. |

---

## FastAPI Microservice Setup

### 1. Prerequisites

- Python 3.11
- NVIDIA GPU with CUDA 12+ (optional, but recommended)
- Installed dependencies:

  ```bash
  pip install -r requirements.txt
  ```

### 2. Start the API

From project root:

```bash
# Make the run scripts executable (first time only)
chmod +x ./run.sh ./run_prod.sh

# Development (auto-reload, default host: 127.0.0.1:8000)
./run.sh

# Development with custom host/port or without reload
./run.sh --host 0.0.0.0 --port 8000
./run.sh --no-reload

# Production (no reload, uses gunicorn if installed)
./run_prod.sh
./run_prod.sh --host 0.0.0.0 --port 8000
```

Output:

```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

---

## Testing the Model

### API Endpoint

`POST /predict`

### Example Request (via Swagger UI or curl)

```json
{
  "district": "Colombo",
  "cases_lag1": 25,
  "cases_lag2": 32,
  "cases_lag3": 28,
  "cases_mean_4w": 27.5,
  "temperature_2m_mean": 28.3,
  "precipitation_sum": 35.6
}
```

### Example Response

```json
{
  "district": "Colombo",
  "predicted_cases": 25.83
}
```

---

## Integrating with the EpiLink System

The model API can be integrated with either:

1. The **EpiLink backend (FastAPI or Node/Express)** for automated weekly forecasting.
2. The **EpiLink dashboard frontend** for real-time “predict” buttons.

---

### Backend Integration (Python Example)

```python
import requests

url = "http://localhost:8000/predict"
data = {
        "district": "Colombo",
        "cases_lag1": 25,
        "cases_lag2": 32,
        "cases_lag3": 28,
        "cases_mean_4w": 27.5,
        "temperature_2m_mean": 28.3,
        "precipitation_sum": 35.6
}

response = requests.post(url, json=data)
result = response.json()
print(result["predicted_cases"])
```

---

### Frontend Integration (JavaScript Example)

```javascript
const res = await fetch("http://localhost:8000/predict", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    district: "Colombo",
    cases_lag1: 25,
    cases_lag2: 32,
    cases_lag3: 28,
    cases_mean_4w: 27.5,
    temperature_2m_mean: 28.3,
    precipitation_sum: 35.6,
  }),
});
const data = await res.json();
console.log(`Predicted Cases: ${data.predicted_cases}`);
```

---

## Batch Forecasting (Optional Extension)

To generate forecasts for **all districts at once**, extend the API with a `/batch_predict` endpoint:

### Example Payload:

```json
[
  {
    "district": "Colombo",
    "cases_lag1": 25,
    "cases_lag2": 32,
    "cases_lag3": 28,
    "cases_mean_4w": 27.5,
    "temperature_2m_mean": 28.3,
    "precipitation_sum": 35.6
  },
  {
    "district": "Kandy",
    "cases_lag1": 18,
    "cases_lag2": 22,
    "cases_lag3": 19,
    "cases_mean_4w": 20.5,
    "temperature_2m_mean": 26.8,
    "precipitation_sum": 44.2
  }
]
```

### Example Response:

```json
[
  { "district": "Colombo", "predicted_cases": 25.83 },
  { "district": "Kandy", "predicted_cases": 19.47 }
]
```

This can be used in scheduled backend jobs to auto-update district-level dashboards weekly.

---

## Model Technical Summary

| Aspect              | Details                                         |
| ------------------- | ----------------------------------------------- |
| **Model Type**      | XGBoost Regressor                               |
| **Tree Method**     | Hist (GPU Accelerated via `device='cuda'`)      |
| **Target Variable** | Weekly dengue case count                        |
| **Training Data**   | Weekly dengue + weather data (2006–2025)        |
| **Training Size**   | ~23,000 records                                 |
| **Features**        | 6 core features + 25 district one-hot encodings |
| **Performance**     | MAE ≈ 2.9, R² ≈ 0.93                            |
| **Trained On**      | Windows 11, RTX 3050, 16GB RAM                  |

---

## Deployment Notes

| Environment     | Recommendation                       |
| --------------- | ------------------------------------ |
| **Local Dev**   | Use `venv` + `uvicorn --reload`      |
| **Production**  | Docker + Nginx Reverse Proxy         |
| **GPU Support** | Requires NVIDIA driver with CUDA 12+ |
| **Model File**  | `models/dengue_xgb_model.pkl`        |
| **API Port**    | 8000 (configurable)                  |

---

## Interpretation

| Feature               | Effect on Prediction                                                                |
| --------------------- | ----------------------------------------------------------------------------------- |
| `cases_lag1–3`        | Show short-term increase or decline in dengue trend.                                |
| `cases_mean_4w`       | Smooths random spikes; represents outbreak momentum.                                |
| `temperature_2m_mean` | Higher temps (27–32°C) increase mosquito breeding.                                  |
| `precipitation_sum`   | Moderate rainfall (20–80mm) boosts larval habitat formation.                        |
| `district_*`          | Encodes spatial differences — urban districts typically have higher baseline cases. |

---

## Maintenance Commands

| Task                 | Command                                   |
| -------------------- | ----------------------------------------- |
| Run API              | `./run.sh` (dev) / `./run_prod.sh` (prod) |
| Install deps         | `pip install -r requirements.txt`         |
| Train model again    | `python train_dengue_model.py`            |
| Test API             | Open `http://127.0.0.1:8000/docs`         |
| Export venv packages | `pip freeze > requirements.txt`           |

---

## Version Control Best Practices

- Keep model weights (`.pkl`) in `/models/`
- Do **not** push `/data/` with raw files (use `.gitignore`)
- Push only trained models and metadata

---

## Credits

| Role            | Name                                                               |
| --------------- | ------------------------------------------------------------------ |
| Model Developer | Charuka Karunarathna                                               |
| Project         | EpiLink – Smart Dengue Risk Monitoring & Cleanup Management System |
| Year            | Final Year Project 2025                                            |

---
