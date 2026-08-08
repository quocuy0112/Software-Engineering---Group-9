from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from pathlib import Path

import numpy as np
import pytest

from src.engine import EngineManifest, PaddleOcrOnnxEngine, normalize_engine_lines


ROOT = Path(__file__).parents[1]


def test_committed_manifest_has_exact_packages_models_and_checksums() -> None:
    path = ROOT / "model-manifest.json"
    raw = path.read_bytes()
    manifest = json.loads(raw)
    assert manifest["engine"] == {
        "name": "paddleocr-onnx",
        "version": "1.0.0",
        "package": "paddleocr",
        "packageVersion": "3.7.0",
        "runtimeName": "onnxruntime",
        "runtimeVersion": "1.27.0",
    }
    assert manifest["model"]["name"] == "PP-OCRv6-medium"
    assert manifest["model"]["supportedLanguages"] == ["vi", "en", "mixed-vi-en"]
    assert manifest["runtimeDownloadsAllowed"] is False
    assert manifest["runtimeNetworkAllowed"] is False
    assert all(len(item["sha256"]) == 64 for item in manifest["artifacts"])
    assert all(len(item["sha256"]) == 64 for item in manifest["runtimeArtifacts"])
    assert EngineManifest.load(path).model_manifest_sha256 == sha256(raw).hexdigest()


def test_line_normalization_preserves_unicode_and_enforces_bounds() -> None:
    lines = normalize_engine_lines(
        [
            {
                "text": "  Kỹ sư phần mềm  ",
                "confidence": 0.91,
                "polygon": [[0, 0], [20, 0], [20, 10], [0, 10]],
            }
        ],
        width=20,
        height=10,
    )
    assert lines[0]["text"] == "Kỹ sư phần mềm"
    assert lines[0]["confidence"] == 0.91
    with pytest.raises(ValueError, match="OCR_LINE_GEOMETRY_INVALID"):
        normalize_engine_lines(
            [{"text": "x", "confidence": 0.5, "polygon": [[-1, 0]] * 4}],
            width=1,
            height=1,
        )


def test_engine_rejects_expired_deadline_and_unwarmed_backend() -> None:
    engine = PaddleOcrOnnxEngine.__new__(PaddleOcrOnnxEngine)
    engine._pipeline = None
    engine._manifest = EngineManifest.fixture()
    with pytest.raises(RuntimeError, match="ENGINE_NOT_READY"):
        engine.assert_ready()
    with pytest.raises(TimeoutError, match="DEADLINE_EXCEEDED"):
        engine.recognize(
            b"png",
            deadline=datetime.now(UTC) - timedelta(milliseconds=1),
        )


def test_warmup_uses_local_models_only(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    manifest_path = tmp_path / "manifest.json"
    fixture = json.loads((ROOT / "model-manifest.json").read_text("utf-8"))
    model_root = tmp_path / "models"
    (model_root / "PP-OCRv6_medium_det_infer").mkdir(parents=True)
    (model_root / "PP-OCRv6_medium_rec_infer").mkdir(parents=True)
    for item in fixture["runtimeArtifacts"]:
        payload = item["name"].encode("utf-8")
        path = model_root / item["name"]
        path.write_bytes(payload)
        item["sha256"] = sha256(payload).hexdigest()
    manifest_path.write_text(json.dumps(fixture), encoding="utf-8")

    captured: dict[str, object] = {}

    class Pipeline:
        def __init__(self, **options: object) -> None:
            captured.update(options)

        def predict(self, _image: object):
            return []

    monkeypatch.setattr("src.engine.PaddleOCR", Pipeline)
    engine = PaddleOcrOnnxEngine(manifest_path=manifest_path, model_root=model_root)
    engine.warm()
    assert captured["text_detection_model_dir"] == str(
        model_root / "PP-OCRv6_medium_det_infer"
    )
    assert captured["text_recognition_model_dir"] == str(
        model_root / "PP-OCRv6_medium_rec_infer"
    )
    assert captured["device"] == "cpu"
    assert captured["enable_hpi"] is False
    assert captured["engine"] == "onnxruntime"
    assert captured["engine_config"] == {
        "device_type": "cpu",
        "intra_op_num_threads": 4,
        "inter_op_num_threads": 1,
    }


def test_search_regions_bound_work_and_mark_partial_output() -> None:
    polygons = [
        [[0, 0], [300, 0], [300, 10], [0, 10]],
        [[0, 10], [100, 10], [100, 20], [0, 20]],
        [[0, 20], [180, 20], [180, 30], [0, 30]],
    ]
    crops = [
        np.zeros((10, 300, 3), dtype=np.uint8),
        np.zeros((10, 100, 3), dtype=np.uint8),
        np.zeros((10, 180, 3), dtype=np.uint8),
    ]
    selected, partial = PaddleOcrOnnxEngine._search_regions(crops, polygons)
    assert [crop.shape[1] for crop, _ in selected] == [200, 100]
    assert partial is True
