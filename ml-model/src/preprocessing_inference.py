"""
DriveIQ - Preprocessing & Classification Inference
====================================================
Adapted from Lorna's preprocessing_inference.py for backend deployment.

Changes from original:
  - Model paths are configurable via MODELS_DIR (not hardcoded ../models)
  - Reduced print statements, uses logging instead
  - Handles the numeric-key JSON format from create_test_session_json.py
"""

import os
import json
import logging
import numpy as np
import pandas as pd
import joblib
from collections import Counter
from sklearn.impute import KNNImputer

logger = logging.getLogger("driveiq.preprocessing")

# ── Model directory ──────────────────────────────────────────────
# Set this to wherever your trained models live.
# Default: ml-model/models  (relative to this file's location in ml-model/src/)
MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")


# =====================================================
# STEP 1: Build unified 10Hz timeline (paper-compliant)
# =====================================================

def build_10hz_timebase(max_timestamp_sec):
    t_10hz = pd.DataFrame({
        "t_10hz": range(0, int(max_timestamp_sec * 10) + 1)
    })
    t_10hz["timestamp"] = t_10hz["t_10hz"] / 10.0
    return t_10hz


# =====================================================
# STEP 2: Preprocess ONE session from JSON
# =====================================================

def preprocess_session_from_json(sensor_json):
    """
    Preprocess one driving session from JSON input.
    Handles both named columns AND numeric-key JSON
    (from pandas to_dict(orient='records') with header=None).
    """

    # ── Helper: Convert numeric-key dicts to proper column names ──
    def _rename_cols(records, col_names):
        """If keys are '0','1','2'... rename to actual column names."""
        if not records:
            return pd.DataFrame(columns=col_names)
        df = pd.DataFrame(records)
        if set(df.columns) == set(str(i) for i in range(len(col_names))):
            df.columns = col_names
        elif set(df.columns) == set(range(len(col_names))):
            df.columns = col_names
        return df

    # ── GPS (1 Hz → 10 Hz) ──
    gps = _rename_cols(sensor_json["gps"], [
        "timestamp", "speed_kmh", "lat", "lon", "alt",
        "vert_acc", "horiz_acc", "course", "difcourse",
        "hdop", "vdop", "pdop"
    ])
    gps["timestamp"] = pd.to_numeric(gps["timestamp"], errors="coerce")
    max_time = gps["timestamp"].max()
    timebase_10hz = build_10hz_timebase(max_time)
    gps = gps.sort_values("timestamp")
    timebase_10hz = timebase_10hz.sort_values("timestamp")
    gps_10hz = pd.merge_asof(timebase_10hz, gps, on="timestamp", direction="backward")

    # ── Accelerometer (already 10 Hz) ──
    acc = _rename_cols(sensor_json["accelerometer"], [
        "timestamp", "active",
        "acc_x", "acc_y", "acc_z",
        "acc_x_kf", "acc_y_kf", "acc_z_kf",
        "roll", "pitch", "yaw"
    ])
    acc["timestamp"] = pd.to_numeric(acc["timestamp"], errors="coerce")
    acc = acc.sort_values("timestamp")
    acc_10hz = pd.merge_asof(timebase_10hz, acc, on="timestamp", direction="nearest")

    # ── Lane Detection (~30 Hz → 10 Hz) ──
    lane = _rename_cols(sensor_json["lane"], [
        "timestamp", "x_lane", "phi", "road_width", "lane_state"
    ])
    lane["timestamp"] = pd.to_numeric(lane["timestamp"], errors="coerce")
    lane = lane.sort_values("timestamp")
    lane_10hz = pd.merge_asof(timebase_10hz, lane, on="timestamp", direction="nearest")

    # ── Vehicle Detection (~10 Hz) ──
    veh = _rename_cols(sensor_json["vehicle"], [
        "timestamp", "dist_front", "ttc_front",
        "num_vehicles", "gps_speed"
    ])
    veh["timestamp"] = pd.to_numeric(veh["timestamp"], errors="coerce")
    veh = veh.sort_values("timestamp")
    veh_10hz = pd.merge_asof(timebase_10hz, veh, on="timestamp", direction="nearest")

    # ── OpenStreetMap Data (~1 Hz → 10 Hz) ──
    osm = _rename_cols(sensor_json["osm"], [
        "timestamp", "max_speed", "speed_rel",
        "road_type_osm", "num_lanes", "lane_id",
        "lat_osm", "lon_osm", "osm_delay", "gps_speed_osm"
    ])
    osm["timestamp"] = pd.to_numeric(osm["timestamp"], errors="coerce")
    osm = osm.sort_values("timestamp")
    osm_10hz = pd.merge_asof(timebase_10hz, osm, on="timestamp", direction="backward")

    # ── Merge all streams ──
    data = gps_10hz.copy()
    for df in [acc_10hz, lane_10hz, veh_10hz, osm_10hz]:
        data = data.merge(df, on=["timestamp", "t_10hz"], how="left")

    cols = ["t_10hz", "timestamp"] + [
        c for c in data.columns if c not in ["t_10hz", "timestamp"]
    ]
    data = data[cols]

    # ── Feature engineering ──
    data["speed_ratio"] = np.where(
        data["max_speed"] > 0,
        data["speed_kmh"] / data["max_speed"],
        0
    )

    # ── KNN imputation ──
    exclude_cols = ["t_10hz", "timestamp", "road_type_osm"]
    feature_cols = [c for c in data.columns if c not in exclude_cols]

    X = data[feature_cols]
    nan_count = X.isna().sum().sum()
    if nan_count > 0:
        logger.info(f"Imputing {nan_count} NaN values with KNN...")

    imputer = KNNImputer(n_neighbors=5, weights="distance")
    X_imputed = pd.DataFrame(imputer.fit_transform(X), columns=feature_cols)

    data_imputed = data.copy()
    data_imputed[feature_cols] = X_imputed

    # ── Enforce training feature order ──
    schema_path = os.path.join(MODELS_DIR, "feature_schema.json")
    with open(schema_path, "r") as f:
        schema = json.load(f)

    feature_order = schema["feature_order"]
    data_final = data_imputed[feature_order]

    logger.info(f"Preprocessed shape: {data_final.shape}")
    return data_final


# =====================================================
# Windowing
# =====================================================

def create_windows_inference(df, window_size=2400, stride=240):
    data = df.values
    n_rows = data.shape[0]
    windows = []

    for start in range(0, n_rows - window_size + 1, stride):
        end = start + window_size
        windows.append(data[start:end])

    if len(windows) == 0:
        return np.empty((0, window_size, df.shape[1]))

    return np.array(windows)


# =====================================================
# Scaling
# =====================================================

def scale_windows(windows, scaler_path):
    if windows.shape[0] == 0:
        return windows

    original_shape = windows.shape
    reshaped = windows.reshape(-1, original_shape[-1])

    scaler = joblib.load(scaler_path)
    scaled = scaler.transform(reshaped)

    return scaled.reshape(original_shape)


# =====================================================
# Prediction
# =====================================================

def predict_windows(windows, model_path):
    if windows.shape[0] == 0:
        return None

    from tensorflow.keras.models import load_model
    model = load_model(model_path)
    return model.predict(windows)


def get_predicted_classes(predictions):
    if predictions is None:
        return None
    return np.argmax(predictions, axis=1)


def map_classes_to_labels(class_indices):
    label_map = {
        0: "Aggressive",
        1: "Normal",
        2: "Drowsy"
    }
    return [label_map[int(i)] for i in class_indices]


# =====================================================
# Full classification pipeline
# =====================================================

def run_classification(sensor_json):
    """
    Full classification pipeline. Called by knn_alerts_inference.
    """
    road_type = sensor_json.get("road_type")
    session_id = sensor_json.get("session_id")

    # 1. Preprocess
    df = preprocess_session_from_json(sensor_json)

    # 2. Choose model + scaler by road type
    if road_type == "Motorway":
        stride = 240
        model_path = os.path.join(MODELS_DIR, "motor_model.keras")
        scaler_path = os.path.join(MODELS_DIR, "motor_scaler.pkl")
    elif road_type == "Secondary":
        stride = 260
        model_path = os.path.join(MODELS_DIR, "secondary_model.keras")
        scaler_path = os.path.join(MODELS_DIR, "secondary_scaler.pkl")
    else:
        raise ValueError(f"Unknown road type: {road_type}")

    # 3. Window
    windows = create_windows_inference(df, 2400, stride)
    if windows.shape[0] == 0:
        return {"session_id": session_id, "error": "Not enough data for windowing"}

    # 4. Scale
    scaled_windows = scale_windows(windows, scaler_path)

    # 5. Predict
    predictions = predict_windows(scaled_windows, model_path)

    # 6. Labels
    class_indices = get_predicted_classes(predictions)
    predicted_labels = map_classes_to_labels(class_indices)

    return {
        "session_id": session_id,
        "road_type": road_type,
        "scaled_windows": scaled_windows,
        "predicted_labels": predicted_labels
    }


# =====================================================
# Local test
# =====================================================

if __name__ == "__main__":
    with open("test_session.json", "r") as f:
        sensor_json = json.load(f)

    result = run_classification(sensor_json)
    print("\nClassification Output:")
    print({k: v for k, v in result.items() if k != "scaled_windows"})
