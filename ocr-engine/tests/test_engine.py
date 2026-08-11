from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from pathlib import Path
from types import SimpleNamespace

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
    selected, partial = PaddleOcrOnnxEngine._search_regions(
        crops,
        polygons,
        aspect_budget=35.0,
        max_regions=3,
    )
    assert [crop.shape[1] for crop, _ in selected] == [300]
    assert partial is True


def test_search_region_budget_scales_with_remaining_deadline() -> None:
    now = datetime(2026, 8, 11, tzinfo=UTC)
    ordinary = PaddleOcrOnnxEngine._region_budget_from_deadline(
        deadline=now + timedelta(seconds=3), now=now
    )
    spare_time = PaddleOcrOnnxEngine._region_budget_from_deadline(
        deadline=now + timedelta(seconds=6), now=now
    )
    exhausted = PaddleOcrOnnxEngine._region_budget_from_deadline(
        deadline=now + timedelta(seconds=1), now=now
    )

    assert ordinary[0] == pytest.approx(97.22222222222223)
    assert ordinary[1] == 24
    assert spare_time == (240.0, 40)
    assert exhausted == (0.0, 0)


def test_search_regions_use_dynamic_budget_beyond_three_lines() -> None:
    crops = [np.zeros((10, 40, 3), dtype=np.uint8) for _ in range(8)]
    polygons = [
        [[0, row * 10], [40, row * 10], [40, row * 10 + 9], [0, row * 10 + 9]]
        for row in range(8)
    ]

    selected, partial = PaddleOcrOnnxEngine._search_regions(
        crops,
        polygons,
        aspect_budget=35.0,
        max_regions=8,
    )

    assert len(selected) == 8
    assert partial is False


def test_search_recognition_runs_bounded_batches_in_reading_order() -> None:
    polygons = [
        [[0, row * 10], [40, row * 10], [40, row * 10 + 9], [0, row * 10 + 9]]
        for row in range(12)
    ]
    crops = [np.zeros((10, 40, 3), dtype=np.uint8) for _ in polygons]
    batch_sizes: list[int] = []

    class InnerPipeline:
        @staticmethod
        def get_text_det_params(*_args: object) -> dict[str, object]:
            return {}

        @staticmethod
        def text_det_model(*_args: object, **_kwargs: object):
            return [{"dt_polys": polygons}]

        @staticmethod
        def _sort_boxes(items: object) -> object:
            return items

        @staticmethod
        def _crop_by_polys(_image: object, _polygons: object) -> object:
            return crops

        @staticmethod
        def text_rec_model(
            batch: list[np.ndarray], *, batch_size: int, return_word_box: bool
        ):
            assert return_word_box is False
            assert batch_size == len(batch)
            batch_sizes.append(batch_size)
            start = sum(batch_sizes[:-1])
            return [
                {"rec_text": f"line {start + index}", "rec_score": 0.95}
                for index in range(len(batch))
            ]

    engine = PaddleOcrOnnxEngine.__new__(PaddleOcrOnnxEngine)
    engine._pipeline = SimpleNamespace(
        paddlex_pipeline=SimpleNamespace(_pipeline=InnerPipeline())
    )

    lines, partial = engine._recognize_search(
        np.zeros((120, 40, 3), dtype=np.uint8),
        deadline=datetime.now(UTC) + timedelta(seconds=10),
    )

    assert batch_sizes == [5, 5, 2]
    assert [line["text"] for line in lines] == [f"line {index}" for index in range(12)]
    assert partial is False
