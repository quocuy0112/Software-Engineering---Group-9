from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest

from src.engine import (
    EngineManifest,
    PaddleOcrOnnxEngine,
    SearchDetectionCandidate,
    SearchOcrConfig,
    SearchTile,
    deduplicate_search_lines,
    materialize_search_tile,
    merge_search_detections,
    near_blank_fast_fail,
    normalize_engine_lines,
    order_search_lines,
    plan_search_tiles,
    select_search_regions,
    should_use_tiled_recovery,
    transform_tile_polygon,
)


ROOT = Path(__file__).parents[1]


def test_committed_manifest_has_exact_packages_models_and_checksums() -> None:
    path = ROOT / "model-manifest.json"
    raw = path.read_bytes()
    manifest = json.loads(raw)
    assert manifest["engine"] == {
        "name": "paddleocr-onnx",
        "version": "1.1.0",
        "package": "paddleocr",
        "packageVersion": "3.7.0",
        "runtimeName": "onnxruntime",
        "runtimeVersion": "1.27.0",
    }
    assert manifest["model"]["name"] == "PP-OCRv6-medium"
    assert manifest["model"]["supportedLanguages"] == ["vi", "en", "mixed-vi-en"]
    assert manifest["runtimeDownloadsAllowed"] is False
    assert manifest["runtimeNetworkAllowed"] is False
    assert manifest["strategyVersion"] == "search-ocr-adaptive-tiles-v1"
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
    assert spare_time == (240.0, 60)
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


def test_adaptive_search_completes_detection_gate_before_one_recognition_phase() -> None:
    detection_batch_sizes: list[int] = []
    recognition_calls = 0

    class InnerPipeline:
        @staticmethod
        def get_text_det_params(*_args: object) -> dict[str, object]:
            return {}

        @staticmethod
        def text_det_model(images: list[np.ndarray], **_kwargs: object):
            detection_batch_sizes.append(len(images))
            if len(images) == 1:
                return [{"dt_polys": []}]
            polygon = [[10, 10], [40, 10], [40, 22], [10, 22]]
            return [{"dt_polys": [polygon]} for _image in images]

        @staticmethod
        def _sort_boxes(items: object) -> object:
            return items

        @staticmethod
        def _crop_by_polys(_image: object, polygons: list[object]) -> object:
            return [np.zeros((12, 30, 3), dtype=np.uint8) for _ in polygons]

        @staticmethod
        def text_rec_model(
            batch: list[np.ndarray], *, batch_size: int, return_word_box: bool
        ):
            nonlocal recognition_calls
            recognition_calls += 1
            assert batch_size == len(batch)
            assert return_word_box is False
            return [
                {"rec_text": f"region {index}", "rec_score": 0.95}
                for index in range(len(batch))
            ]

    engine = PaddleOcrOnnxEngine.__new__(PaddleOcrOnnxEngine)
    engine._pipeline = SimpleNamespace(
        paddlex_pipeline=SimpleNamespace(_pipeline=InnerPipeline())
    )
    engine._search_config = SearchOcrConfig(adaptive_tiling_enabled=True)
    image = np.tile(np.arange(100, dtype=np.uint8)[:, None, None], (1, 100, 3))

    lines, partial = engine._recognize_search(
        image,
        deadline=datetime.now(UTC) + timedelta(seconds=10),
    )

    assert detection_batch_sizes == [1, 2, 2]
    assert recognition_calls == 1
    assert len(lines) == 4
    assert partial is False
    assert engine._last_search_telemetry["path"] == "TILED_RECOVERY"
    assert engine._last_search_telemetry["tileCount"] == 4


def test_search_tile_grid_has_canonical_shapes_and_non_overlapping_cores() -> None:
    for width, height, expected_count in [(100, 100, 4), (300, 100, 3), (100, 300, 3)]:
        tiles = plan_search_tiles(width, height, overlap_percent=15)
        assert len(tiles) == expected_count
        shapes = {
            materialize_search_tile(
                np.zeros((height, width, 3), dtype=np.uint8), tile
            ).shape
            for tile in tiles
        }
        assert len(shapes) == 1
        assert next(iter(shapes)) == (tiles[0].height, tiles[0].width, 3)
        assert all(tile.padded_bounds == (0, 0, tile.width, tile.height) for tile in tiles)
        assert all(
            tile.source_bounds[2] > tile.source_bounds[0]
            and tile.source_bounds[3] > tile.source_bounds[1]
            for tile in tiles
        )

    square = plan_search_tiles(100, 100, overlap_percent=15)
    assert square[0].source_bounds[2] > square[0].core_bounds[2]
    assert square[1].source_bounds[0] < square[1].core_bounds[0]
    assert square[0].core_bounds[2] <= square[1].core_bounds[0]
    wide = plan_search_tiles(300, 100, overlap_percent=15)
    assert wide[0].source_bounds[2] > wide[1].source_bounds[0]
    assert wide[1].source_bounds[2] > wide[2].source_bounds[0]
    assert wide[0].width < 300


def test_search_tile_padding_and_coordinate_transform_reject_padded_only_boxes() -> None:
    tile = SearchTile(
        tile_id="tile-test",
        offset_x=20,
        offset_y=30,
        source_bounds=(0, 0, 4, 4),
        valid_content_bounds=(0, 0, 4, 4),
        padded_bounds=(0, 0, 6, 6),
        core_bounds=(20, 30, 24, 34),
        width=6,
        height=6,
    )
    source = np.zeros((4, 4, 3), dtype=np.uint8)
    materialized = materialize_search_tile(source, tile)
    assert materialized.shape == (6, 6, 3)
    assert np.all(materialized[4:, :] == 255)
    assert np.all(materialized[:, 4:] == 255)
    assert transform_tile_polygon(
        [[4.5, 4.5], [5.5, 4.5], [5.5, 5.5], [4.5, 5.5]],
        tile,
        image_width=100,
        image_height=100,
    ) is None
    assert transform_tile_polygon(
        [[1, 1], [3, 1], [3, 3], [1, 3]],
        tile,
        image_width=100,
        image_height=100,
    ) == ((21.0, 31.0), (23.0, 31.0), (23.0, 33.0), (21.0, 33.0))


def test_search_detection_merge_prefers_whole_box_without_string_stitching() -> None:
    whole = SearchDetectionCandidate(
        polygon=((0, 0), (100, 0), (100, 20), (0, 20)),
        source="FULL",
        detection_confidence=0.7,
    )
    fragment = SearchDetectionCandidate(
        polygon=((0, 0), (52, 0), (52, 20), (0, 20)),
        source="TILE",
        tile_id="tile-0-0",
        core_bounds=(0, 0, 100, 20),
        detection_confidence=0.99,
        boundary_contact=True,
    )
    merged, duplicates = merge_search_detections([fragment, whole])
    assert duplicates == 1
    assert merged == [whole]

    lines, line_duplicates = deduplicate_search_lines(
        [
            {
                "text": "Senior Python",
                "confidence": 0.8,
                "polygon": [[0, 0], [50, 0], [50, 10], [0, 10]],
            },
            {
                "text": "Senior Python",
                "confidence": 0.95,
                "polygon": [[0, 0], [100, 0], [100, 10], [0, 10]],
            },
        ]
    )
    assert line_duplicates == 1
    assert len(lines) == 1
    assert lines[0]["text"] == "Senior Python"
    assert lines[0]["polygon"][1][0] == 100


def test_search_recovery_gate_is_conservative_and_detection_only() -> None:
    blank = np.full((100, 100, 3), 255, dtype=np.uint8)
    non_blank = blank.copy()
    non_blank[48:52, 20:80] = 0
    assert near_blank_fast_fail(blank) is True
    assert near_blank_fast_fail(non_blank) is False
    config = SearchOcrConfig(adaptive_tiling_enabled=True)
    assert should_use_tiled_recovery(
        non_blank, [], config=config, aspect_budget=240
    ) is True
    normal_box = SearchDetectionCandidate(
        polygon=((10, 10), (80, 10), (80, 35), (10, 35)),
        detection_confidence=0.99,
    )
    assert should_use_tiled_recovery(
        non_blank, [normal_box], config=config, aspect_budget=240
    ) is False
    tiny_box = SearchDetectionCandidate(
        polygon=((10, 10), (80, 10), (80, 18), (10, 18)),
        detection_confidence=0.99,
    )
    large_non_blank = np.tile(
        np.arange(800, dtype=np.uint8)[:, None, None], (1, 800, 3)
    )
    assert should_use_tiled_recovery(
        large_non_blank, [tiny_box], config=config, aspect_budget=240
    ) is True


def test_search_region_selection_keeps_spatial_coverage_and_marks_budget_partial() -> None:
    candidates = [
        SearchDetectionCandidate(
            polygon=((column * 100, row * 30), (column * 100 + 40, row * 30),
                     (column * 100 + 40, row * 30 + 10), (column * 100, row * 30 + 10)),
            detection_confidence=0.9,
        )
        for row in range(3)
        for column in range(4)
    ]
    selected, partial = select_search_regions(
        candidates,
        width=400,
        height=100,
        aspect_budget=16,
        max_regions=100,
        safety_cap=100,
    )
    assert len(selected) == 4
    assert partial is True
    covered_columns = {
        min(2, int(((candidate.bounds[0] + candidate.bounds[2]) / 2) / 400 * 3))
        for candidate in selected
    }
    assert len(covered_columns) >= 3


def test_search_reading_order_isolates_vertical_block() -> None:
    lines = [
        {"text": "left lower", "confidence": 0.9, "polygon": [[0, 30], [40, 30], [40, 40], [0, 40]]},
        {"text": "right upper", "confidence": 0.9, "polygon": [[100, 0], [140, 0], [140, 10], [100, 10]]},
        {"text": "left upper", "confidence": 0.9, "polygon": [[0, 0], [40, 0], [40, 10], [0, 10]]},
        {"text": "vertical", "confidence": 0.9, "polygon": [[180, 0], [180, 50], [170, 50], [170, 0]]},
    ]
    ordered = order_search_lines(lines)
    assert [line["text"] for line in ordered] == [
        "left upper",
        "left lower",
        "right upper",
        "vertical",
    ]
