from __future__ import annotations

import io
import json
import math
import os
import time
import unicodedata
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

import numpy as np
from PIL import Image

# Loading PaddleX at module import time creates cache directories and initializes its
# repository manager. Keep it lazy so liveness/contract checks never need a writable
# home directory and never initialize the model runtime.
PaddleOCR: Any | None = None

from .limits import (
    MAX_DECODED_PIXELS,
    MAX_LINE_CHARACTERS,
    MAX_LINES,
    MAX_OUTPUT_UTF8_BYTES,
)


SEARCH_DETECTION_SIDE_LIMIT = 640
SEARCH_STRATEGY_VERSION = "search-ocr-adaptive-tiles-v1"
SEARCH_MAX_TILES = 4
SEARCH_TILE_OVERLAP_PERCENT = 15
SEARCH_TILE_BATCH_SIZE = 2
SEARCH_MAX_REGIONS_CEILING = 100
SEARCH_REGION_SAFETY_CAP = SEARCH_MAX_REGIONS_CEILING
SEARCH_REGION_ASPECT_BUDGET_FLOOR = 35.0
SEARCH_REGION_ASPECT_BUDGET_CEILING = 240.0
# PaddleX caps dynamic recognition width at 3200 pixels for a 48-pixel-high
# input (ratio 66.67). Keep a small safety margin without truncating ordinary
# long poster lines and associating fragment text with a full-line polygon.
SEARCH_MAX_REGION_ASPECT_RATIO = 64.0
SEARCH_MIN_RECOGNITION_SECONDS = 1.25
# Conservative initial calibration from the pinned Linux/ONNX CPU profile:
# 219.35 aspect units took 3.43 seconds (0.0156 s/unit). The initial value adds
# about 15% headroom. Production aggregate telemetry should replace it when a
# representative sample exists.
SEARCH_TIME_PER_ASPECT_UNIT_SECONDS = 0.018
SEARCH_RECOGNITION_BATCH_SIZE = 5
SEARCH_CROP_MARGIN_PX = 3
SEARCH_MAX_CROP_BATCH_BYTES = 16 * 1024 * 1024
SEARCH_SMALL_BOX_HEIGHT_PX = 14.0
SEARCH_LOW_DETECTION_CONFIDENCE = 0.55
SEARCH_DENSE_REGION_TRIGGER = 28

Point = tuple[float, float]
Polygon = tuple[Point, ...]
Bounds = tuple[int, int, int, int]


@dataclass(frozen=True)
class SearchOcrConfig:
    """Server-side knobs for the image-search-only recovery strategy.

    The feature is opt-in by default. This makes an omitted deployment flag a
    safe rollback to the existing full-image strategy while still allowing the
    candidate strategy to be exercised explicitly in corpus and canary runs.
    """

    adaptive_tiling_enabled: bool = False
    tile_overlap_percent: int = SEARCH_TILE_OVERLAP_PERCENT
    tile_batch_size: int = SEARCH_TILE_BATCH_SIZE
    max_tiles: int = SEARCH_MAX_TILES
    strategy_version: str = SEARCH_STRATEGY_VERSION
    region_safety_cap: int = SEARCH_REGION_SAFETY_CAP
    recognition_batch_size: int = SEARCH_RECOGNITION_BATCH_SIZE
    crop_margin_px: int = SEARCH_CROP_MARGIN_PX
    max_crop_batch_bytes: int = SEARCH_MAX_CROP_BATCH_BYTES
    small_box_height_px: float = SEARCH_SMALL_BOX_HEIGHT_PX
    low_detection_confidence: float = SEARCH_LOW_DETECTION_CONFIDENCE
    dense_region_trigger: int = SEARCH_DENSE_REGION_TRIGGER

    def __post_init__(self) -> None:
        if not isinstance(self.adaptive_tiling_enabled, bool):
            raise ValueError("SEARCH_CONFIG_INVALID")
        if self.tile_overlap_percent not in (10, 15, 20):
            raise ValueError("SEARCH_CONFIG_INVALID")
        if not 1 <= self.tile_batch_size <= 4:
            raise ValueError("SEARCH_CONFIG_INVALID")
        if not 1 <= self.max_tiles <= SEARCH_MAX_TILES:
            raise ValueError("SEARCH_CONFIG_INVALID")
        if self.strategy_version != SEARCH_STRATEGY_VERSION:
            raise ValueError("SEARCH_CONFIG_INVALID")
        if not 1 <= self.region_safety_cap <= SEARCH_REGION_SAFETY_CAP:
            raise ValueError("SEARCH_CONFIG_INVALID")
        if not 1 <= self.recognition_batch_size <= 10:
            raise ValueError("SEARCH_CONFIG_INVALID")
        if not 1 <= self.crop_margin_px <= 4:
            raise ValueError("SEARCH_CONFIG_INVALID")
        if not 1 * 1024 * 1024 <= self.max_crop_batch_bytes <= 64 * 1024 * 1024:
            raise ValueError("SEARCH_CONFIG_INVALID")
        if not 1 <= self.small_box_height_px <= 64:
            raise ValueError("SEARCH_CONFIG_INVALID")
        if not 0 < self.low_detection_confidence < 1:
            raise ValueError("SEARCH_CONFIG_INVALID")
        if not 1 <= self.dense_region_trigger <= SEARCH_REGION_SAFETY_CAP:
            raise ValueError("SEARCH_CONFIG_INVALID")

    @classmethod
    def from_environment(
        cls, environment: Mapping[str, str | None] | None = None
    ) -> "SearchOcrConfig":
        values = os.environ if environment is None else environment

        def boolean(name: str, default: bool) -> bool:
            raw = values.get(name)
            if raw is None:
                return default
            if raw not in {"true", "false"}:
                raise ValueError("SEARCH_CONFIG_INVALID")
            return raw == "true"

        def integer(name: str, default: int) -> int:
            raw = values.get(name)
            if raw is None:
                return default
            try:
                return int(raw)
            except (TypeError, ValueError) as error:
                raise ValueError("SEARCH_CONFIG_INVALID") from error

        return cls(
            adaptive_tiling_enabled=boolean(
                "OCR_SEARCH_ADAPTIVE_TILING_ENABLED", False
            ),
            tile_overlap_percent=integer(
                "OCR_SEARCH_TILE_OVERLAP_PERCENT", SEARCH_TILE_OVERLAP_PERCENT
            ),
            tile_batch_size=integer(
                "OCR_SEARCH_TILE_BATCH_SIZE", SEARCH_TILE_BATCH_SIZE
            ),
            max_tiles=integer("OCR_SEARCH_MAX_TILES", SEARCH_MAX_TILES),
            strategy_version=values.get(
                "OCR_SEARCH_STRATEGY_VERSION", SEARCH_STRATEGY_VERSION
            )
            or "",
        )


@dataclass(frozen=True)
class SearchTile:
    tile_id: str
    offset_x: int
    offset_y: int
    source_bounds: Bounds
    valid_content_bounds: Bounds
    padded_bounds: Bounds
    core_bounds: Bounds
    width: int
    height: int

    @property
    def offsetX(self) -> int:  # pragma: no cover - compatibility spelling
        return self.offset_x

    @property
    def offsetY(self) -> int:  # pragma: no cover - compatibility spelling
        return self.offset_y


@dataclass(frozen=True)
class SearchDetectionCandidate:
    polygon: Polygon
    source: str = "FULL"
    tile_id: str | None = None
    core_bounds: Bounds | None = None
    detection_confidence: float = 0.5
    boundary_contact: bool = False

    @property
    def bounds(self) -> tuple[float, float, float, float]:
        return _polygon_bounds(self.polygon)

    @property
    def estimated_aspect(self) -> float:
        left, top, right, bottom = self.bounds
        return max(1.0, (right - left) / max(1.0, bottom - top))


def file_sha256(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _coerce_polygon(raw: Any) -> Polygon | None:
    """Convert PaddleX/Python test polygon shapes to a finite four-point polygon."""

    try:
        points = list(raw)
    except TypeError:
        return None
    if len(points) != 4:
        return None
    result: list[Point] = []
    for point in points:
        if isinstance(point, Mapping):
            x, y = point.get("x"), point.get("y")
        else:
            try:
                coordinates = list(point)
            except TypeError:
                return None
            if len(coordinates) != 2:
                return None
            x, y = coordinates
        try:
            x_value, y_value = float(x), float(y)
        except (TypeError, ValueError):
            return None
        if not math.isfinite(x_value) or not math.isfinite(y_value):
            return None
        result.append((x_value, y_value))
    return tuple(result)


def _polygon_area(polygon: Sequence[Point]) -> float:
    if len(polygon) < 3:
        return 0.0
    return abs(
        sum(
            polygon[index][0] * polygon[(index + 1) % len(polygon)][1]
            - polygon[(index + 1) % len(polygon)][0] * polygon[index][1]
            for index in range(len(polygon))
        )
        / 2.0
    )


def _polygon_bounds(polygon: Sequence[Point]) -> tuple[float, float, float, float]:
    xs = [point[0] for point in polygon]
    ys = [point[1] for point in polygon]
    return min(xs), min(ys), max(xs), max(ys)


def _rect_polygon(bounds: tuple[float, float, float, float]) -> Polygon:
    left, top, right, bottom = bounds
    return ((left, top), (right, top), (right, bottom), (left, bottom))


def _clamped_polygon(
    polygon: Polygon, *, width: float, height: float
) -> Polygon | None:
    clamped = tuple(
        (
            min(max(point[0], 0.0), width),
            min(max(point[1], 0.0), height),
        )
        for point in polygon
    )
    if _polygon_area(clamped) < 0.25:
        return None
    return clamped


def _polygon_key(raw: Any) -> Polygon | None:
    polygon = _coerce_polygon(raw)
    if polygon is None:
        return None
    return tuple((round(x, 4), round(y, 4)) for x, y in polygon)


def _axis_cell_bounds(length: int, parts: int, index: int) -> tuple[int, int]:
    return (length * index) // parts, (length * (index + 1)) // parts


def _shift_interval(
    start: int, end: int, *, target: int, length: int
) -> tuple[int, int]:
    """Return a centered target interval, shifting at edges instead of resizing."""

    target = min(max(target, 1), length)
    current_start = min(length, max(0, start))
    current_end = min(length, max(current_start, end))
    if target == length:
        return 0, length
    midpoint = (current_start + current_end) / 2.0
    shifted_start = round(midpoint - target / 2.0)
    shifted_start = min(length - target, max(0, shifted_start))
    return shifted_start, shifted_start + target


def plan_search_tiles(
    width: int,
    height: int,
    *,
    overlap_percent: int = SEARCH_TILE_OVERLAP_PERCENT,
    max_tiles: int = SEARCH_MAX_TILES,
) -> list[SearchTile]:
    """Create an overlapping, canonical-resolution tile grid.

    Bounds are integer pixel coordinates with an exclusive right/bottom edge.
    ``core_bounds`` is the non-overlapping ownership cell used to make a line
    detected in two adjacent tiles deterministic. Padding, when necessary, is
    only placed on the right and/or bottom of a tile.
    """

    if width < 1 or height < 1:
        raise ValueError("SEARCH_TILE_DIMENSIONS_INVALID")
    if overlap_percent not in (10, 15, 20) or not 1 <= max_tiles <= SEARCH_MAX_TILES:
        raise ValueError("SEARCH_TILE_CONFIG_INVALID")
    aspect = width / float(height)
    if 0.75 <= aspect <= 1.33:
        columns, rows = 2, 2
    elif aspect > 1.33:
        columns, rows = (3 if aspect >= 2.0 else 2), 1
    else:
        columns, rows = 1, (3 if aspect <= 0.5 else 2)
    if columns * rows > max_tiles:
        if columns > rows:
            columns, rows = max_tiles, 1
        else:
            columns, rows = 1, max_tiles

    base_width = math.ceil(width / columns)
    base_height = math.ceil(height / rows)
    # ``overlap_percent`` describes the pairwise overlap as a fraction of the
    # canonical tile width/height. For two adjacent cells, 2*T - 2*base is
    # the overlap, so T = base / (1 - overlap / 2). Pixel rounding keeps a
    # thin boundary band covered without making the recovery tiles oversized.
    canonical_width = min(
        width,
        max(
            base_width,
            round(base_width / (1.0 - overlap_percent / 200.0))
            if columns > 1
            else base_width,
        ),
    )
    canonical_height = min(
        height,
        max(
            base_height,
            round(base_height / (1.0 - overlap_percent / 200.0))
            if rows > 1
            else base_height,
        ),
    )
    tiles: list[SearchTile] = []
    for row in range(rows):
        core_top, core_bottom = _axis_cell_bounds(height, rows, row)
        for column in range(columns):
            core_left, core_right = _axis_cell_bounds(width, columns, column)
            source_left, source_right = _shift_interval(
                core_left,
                core_right,
                target=canonical_width,
                length=width,
            )
            source_top, source_bottom = _shift_interval(
                core_top,
                core_bottom,
                target=canonical_height,
                length=height,
            )
            source_width = source_right - source_left
            source_height = source_bottom - source_top
            tiles.append(
                SearchTile(
                    tile_id=f"tile-{row}-{column}",
                    offset_x=source_left,
                    offset_y=source_top,
                    source_bounds=(source_left, source_top, source_right, source_bottom),
                    valid_content_bounds=(0, 0, source_width, source_height),
                    padded_bounds=(0, 0, canonical_width, canonical_height),
                    core_bounds=(core_left, core_top, core_right, core_bottom),
                    width=canonical_width,
                    height=canonical_height,
                )
            )
    return tiles


def materialize_search_tile(image_array: np.ndarray, tile: SearchTile) -> np.ndarray:
    """Materialize one tile and right/bottom-pad it without retaining other tiles."""

    if image_array.ndim == 2:
        image_array = image_array[..., np.newaxis]
    if image_array.ndim != 3:
        raise ValueError("SEARCH_IMAGE_SHAPE_INVALID")
    left, top, right, bottom = tile.source_bounds
    source = np.asarray(image_array[top:bottom, left:right])
    if source.size == 0:
        raise ValueError("SEARCH_TILE_EMPTY")
    channels = source.shape[2]
    canvas = np.full(
        (tile.height, tile.width, channels), 255, dtype=image_array.dtype
    )
    copy_height = min(source.shape[0], tile.height)
    copy_width = min(source.shape[1], tile.width)
    canvas[:copy_height, :copy_width] = source[:copy_height, :copy_width]
    return canvas


def transform_tile_polygon(
    polygon: Any,
    tile: SearchTile,
    *,
    image_width: int,
    image_height: int,
) -> Polygon | None:
    """Clamp a tile-local polygon to valid content and map it to image space."""

    local = _coerce_polygon(polygon)
    if local is None:
        return None
    valid_left, valid_top, valid_right, valid_bottom = tile.valid_content_bounds
    local_left, local_top, local_right, local_bottom = _polygon_bounds(local)
    if (
        local_right <= valid_left
        or local_left >= valid_right
        or local_bottom <= valid_top
        or local_top >= valid_bottom
    ):
        return None
    clamped_local = tuple(
        (
            min(max(x, valid_left), valid_right),
            min(max(y, valid_top), valid_bottom),
        )
        for x, y in local
    )
    if _polygon_area(clamped_local) < 0.25:
        return None
    global_polygon = tuple(
        (
            x + tile.offset_x,
            y + tile.offset_y,
        )
        for x, y in clamped_local
    )
    return _clamped_polygon(
        global_polygon, width=float(image_width), height=float(image_height)
    )


def _detection_boundary_contact(
    polygon: Polygon, *, width: float, height: float, tolerance: float = 1.5
) -> bool:
    left, top, right, bottom = _polygon_bounds(polygon)
    return (
        left <= tolerance
        or top <= tolerance
        or width - right <= tolerance
        or height - bottom <= tolerance
    )


def _candidate_centroid(candidate: SearchDetectionCandidate) -> Point:
    left, top, right, bottom = candidate.bounds
    return ((left + right) / 2.0, (top + bottom) / 2.0)


def _candidate_from_polygon(
    polygon: Any,
    *,
    source: str,
    tile: SearchTile | None,
    image_width: int,
    image_height: int,
    detection_confidence: float = 0.5,
    boundary_contact: bool | None = None,
) -> SearchDetectionCandidate | None:
    if tile is not None:
        transformed = transform_tile_polygon(
            polygon,
            tile,
            image_width=image_width,
            image_height=image_height,
        )
        if transformed is None:
            return None
        local = _coerce_polygon(polygon)
        if local is None:
            return None
        valid_left, valid_top, valid_right, valid_bottom = tile.valid_content_bounds
        boundary_contact = boundary_contact or any(
            abs(value - edge) <= 1.5
            for point in local
            for value, edge in (
                (point[0], valid_left),
                (point[1], valid_top),
                (point[0], valid_right),
                (point[1], valid_bottom),
            )
        )
        polygon_value = transformed
        core_bounds = tile.core_bounds
        tile_id = tile.tile_id
    else:
        normalized = _coerce_polygon(polygon)
        if normalized is None:
            return None
        polygon_value = _clamped_polygon(
            normalized, width=float(image_width), height=float(image_height)
        )
        if polygon_value is None:
            return None
        boundary_contact = (
            _detection_boundary_contact(
                polygon_value, width=image_width, height=image_height
            )
            if boundary_contact is None
            else boundary_contact
        )
        core_bounds = None
        tile_id = None
    score = float(detection_confidence)
    if not math.isfinite(score):
        score = 0.5
    return SearchDetectionCandidate(
        polygon=polygon_value,
        source=source,
        tile_id=tile_id,
        core_bounds=core_bounds,
        detection_confidence=min(max(score, 0.0), 1.0),
        boundary_contact=bool(boundary_contact),
    )


def _intersection_area(
    left: tuple[float, float, float, float],
    right: tuple[float, float, float, float],
) -> float:
    width = max(0.0, min(left[2], right[2]) - max(left[0], right[0]))
    height = max(0.0, min(left[3], right[3]) - max(left[1], right[1]))
    return width * height


def _geometry_duplicate(
    left: SearchDetectionCandidate, right: SearchDetectionCandidate
) -> bool:
    left_bounds, right_bounds = left.bounds, right.bounds
    intersection = _intersection_area(left_bounds, right_bounds)
    if intersection <= 0:
        return False
    left_area = max(0.25, _polygon_area(left.polygon))
    right_area = max(0.25, _polygon_area(right.polygon))
    union = left_area + right_area - intersection
    iou = intersection / max(union, 0.25)
    containment = intersection / min(left_area, right_area)
    left_center, right_center = _candidate_centroid(left), _candidate_centroid(right)
    height_left = max(1.0, left_bounds[3] - left_bounds[1])
    height_right = max(1.0, right_bounds[3] - right_bounds[1])
    center_distance = math.hypot(
        left_center[0] - right_center[0], left_center[1] - right_center[1]
    )
    similar_height = max(height_left, height_right) / min(height_left, height_right)
    return (
        iou >= 0.35
        or (containment >= 0.65 and similar_height <= 2.5)
        or (center_distance <= max(height_left, height_right) * 0.65 and similar_height <= 1.5)
    )


def _preferred_detection(
    left: SearchDetectionCandidate, right: SearchDetectionCandidate
) -> SearchDetectionCandidate:
    left_area, right_area = _polygon_area(left.polygon), _polygon_area(right.polygon)
    overlap = _intersection_area(left.bounds, right.bounds)
    if overlap / max(min(left_area, right_area), 0.25) >= 0.75:
        # A containing whole box is safer than a boundary fragment. This is
        # deliberately geometry-only; text is not recognized until after merge.
        if left_area >= right_area * 1.2:
            return left
        if right_area >= left_area * 1.2:
            return right
    if left.boundary_contact != right.boundary_contact:
        return right if left.boundary_contact else left
    if abs(left.detection_confidence - right.detection_confidence) > 0.03:
        return left if left.detection_confidence > right.detection_confidence else right
    if left.source != right.source:
        return left if left.source == "FULL" else right
    if left_area != right_area:
        return left if left_area > right_area else right
    return left


def _candidate_reading_key(
    candidate: SearchDetectionCandidate,
) -> tuple[float, float, str, str]:
    left, top, _, _ = candidate.bounds
    return top, left, candidate.source, candidate.tile_id or ""


def merge_search_detections(
    candidates: Iterable[SearchDetectionCandidate],
) -> tuple[list[SearchDetectionCandidate], int]:
    """Deduplicate full/tile geometry before any recognition crop is materialized."""

    merged: list[SearchDetectionCandidate] = []
    duplicate_count = 0
    for candidate in candidates:
        if candidate.source == "TILE" and candidate.core_bounds is not None:
            center_x, center_y = _candidate_centroid(candidate)
            left, top, right, bottom = candidate.core_bounds
            if not (left <= center_x < right and top <= center_y < bottom):
                duplicate_count += 1
                continue
        duplicate_index = next(
            (
                index
                for index, existing in enumerate(merged)
                if _geometry_duplicate(existing, candidate)
            ),
            None,
        )
        if duplicate_index is None:
            merged.append(candidate)
        else:
            duplicate_count += 1
            merged[duplicate_index] = _preferred_detection(
                merged[duplicate_index], candidate
            )
    return sorted(merged, key=_candidate_reading_key), duplicate_count


def _dimension_bucket(width: int, height: int) -> str:
    longest = max(width, height)
    if longest <= 512:
        return "LT_512"
    if longest <= 1024:
        return "LT_1024"
    if longest <= 2048:
        return "LT_2048"
    return "GTE_2048"


def _count_bucket(value: int) -> str:
    if value <= 0:
        return "ZERO"
    if value == 1:
        return "ONE"
    if value <= 10:
        return "TWO_TO_TEN"
    if value <= 100:
        return "ELEVEN_TO_100"
    return "GT_100"


def _duration_bucket(milliseconds: float) -> str:
    if milliseconds < 100:
        return "LT_100MS"
    if milliseconds < 1_000:
        return "LT_1S"
    if milliseconds < 6_000:
        return "LT_6S"
    if milliseconds < 20_000:
        return "LT_20S"
    return "GTE_20S"


def _gray_sample(image_array: np.ndarray) -> np.ndarray:
    if image_array.ndim == 2:
        gray = image_array.astype(np.float32, copy=False)
    elif image_array.ndim == 3:
        gray = image_array[..., :3].astype(np.float32, copy=False).mean(axis=2)
    else:
        raise ValueError("SEARCH_IMAGE_SHAPE_INVALID")
    step = max(1, math.ceil(max(gray.shape) / 256))
    return gray[::step, ::step]


def near_blank_fast_fail(image_array: np.ndarray) -> bool:
    """High-precision blank gate; uncertainty intentionally falls through to tiling."""

    gray = _gray_sample(image_array)
    if gray.size == 0:
        return True
    variance = float(np.var(gray))
    contrast = float(np.percentile(gray, 95) - np.percentile(gray, 5))
    horizontal_edges = np.abs(np.diff(gray, axis=1)) if gray.shape[1] > 1 else np.empty(0)
    vertical_edges = np.abs(np.diff(gray, axis=0)) if gray.shape[0] > 1 else np.empty(0)
    edge_count = int(np.count_nonzero(horizontal_edges > 10)) + int(
        np.count_nonzero(vertical_edges > 10)
    )
    edge_total = max(1, horizontal_edges.size + vertical_edges.size)
    edge_density = edge_count / edge_total
    histogram, _ = np.histogram(gray, bins=32, range=(0, 256))
    probabilities = histogram[histogram > 0] / gray.size
    entropy = float(-(probabilities * np.log2(probabilities)).sum()) if probabilities.size else 0.0
    # All signals must agree. The thresholds are intentionally conservative and
    # are a rollout gate, not a claim that arbitrary low-contrast images are blank.
    return (
        variance <= 2.0
        and contrast <= 8.0
        and edge_density <= 0.001
        and entropy <= 0.2
    )


def _estimated_column_count(
    candidates: Sequence[SearchDetectionCandidate], width: int
) -> int:
    if len(candidates) < 4:
        return 1
    heights = [max(1.0, candidate.bounds[3] - candidate.bounds[1]) for candidate in candidates]
    gap = max(12.0, float(np.median(heights)) * 4.0, width * 0.08)
    centers = sorted(_candidate_centroid(candidate)[0] for candidate in candidates)
    columns = 1
    for previous, current in zip(centers, centers[1:], strict=False):
        if current - previous > gap:
            columns += 1
    return min(columns, 4)


def should_use_tiled_recovery(
    image_array: np.ndarray,
    full_candidates: Sequence[SearchDetectionCandidate],
    *,
    config: SearchOcrConfig,
    aspect_budget: float | None = None,
) -> bool:
    """Make the recovery decision from detection/cost/image signals only."""

    if not config.adaptive_tiling_enabled:
        return False
    if aspect_budget is not None and aspect_budget <= 0:
        return False
    if not full_candidates:
        return not near_blank_fast_fail(image_array)
    height, width = image_array.shape[:2]
    heights = [candidate.bounds[3] - candidate.bounds[1] for candidate in full_candidates]
    median_height = float(np.median(heights))
    low_confidence = sum(
        candidate.detection_confidence < config.low_detection_confidence
        for candidate in full_candidates
    ) / len(full_candidates)
    boundary_fraction = sum(
        candidate.boundary_contact for candidate in full_candidates
    ) / len(full_candidates)
    projected_aspect = sum(candidate.estimated_aspect for candidate in full_candidates)
    small_image_small_box = (
        max(width, height) > SEARCH_DETECTION_SIDE_LIMIT
        and median_height <= config.small_box_height_px
    )
    return any(
        (
            small_image_small_box,
            len(full_candidates) >= config.dense_region_trigger,
            low_confidence >= 0.5,
            _estimated_column_count(full_candidates, width) >= 2,
            boundary_fraction >= 0.35,
            aspect_budget is not None and projected_aspect > aspect_budget * 0.9,
        )
    )


def _candidate_coverage_cells(
    candidate: SearchDetectionCandidate, *, width: int, height: int
) -> set[tuple[int, int]]:
    left, top, right, bottom = candidate.bounds
    return {
        (
            min(2, max(0, int(((left + right) / 2.0) / max(1, width) * 3))),
            min(2, max(0, int(((top + bottom) / 2.0) / max(1, height) * 3))),
        )
    }


def select_search_regions(
    candidates: Sequence[SearchDetectionCandidate],
    *,
    width: int,
    height: int,
    aspect_budget: float,
    max_regions: int,
    safety_cap: int = SEARCH_REGION_SAFETY_CAP,
) -> tuple[list[SearchDetectionCandidate], bool]:
    """Select geometry metadata without materializing recognition crops."""

    valid = [candidate for candidate in candidates if _polygon_area(candidate.polygon) >= 0.25]
    maximum = min(max(0, max_regions), max(0, safety_cap))
    if not valid or maximum == 0:
        return [], bool(valid)
    selected: list[SearchDetectionCandidate] = []
    covered: set[tuple[int, int]] = set()
    spent = 0.0
    remaining = list(valid)
    while remaining and len(selected) < maximum:
        choices: list[tuple[tuple[float, ...], SearchDetectionCandidate, float, set[tuple[int, int]]]] = []
        for candidate in remaining:
            cost = min(candidate.estimated_aspect, SEARCH_MAX_REGION_ASPECT_RATIO)
            if selected and spent + cost > aspect_budget:
                continue
            cells = _candidate_coverage_cells(candidate, width=width, height=height)
            gain = len(cells - covered)
            left, top, _, _ = candidate.bounds
            priority = (
                float(gain),
                1.0 if not candidate.boundary_contact else 0.0,
                candidate.detection_confidence,
                min(_polygon_area(candidate.polygon), float(width * height)),
                -top,
                -left,
            )
            choices.append((priority, candidate, cost, cells))
        if not choices:
            break
        _, chosen, cost, cells = max(choices, key=lambda item: item[0])
        selected.append(chosen)
        remaining.remove(chosen)
        spent += cost
        covered.update(cells)
    selected.sort(key=_candidate_reading_key)
    return selected, len(selected) < len(valid) or spent > aspect_budget


def _line_geometry(line: Mapping[str, Any]) -> tuple[float, float, float, float, float] | None:
    polygon = _coerce_polygon(line.get("polygon"))
    if polygon is None or _polygon_area(polygon) < 0.25:
        return None
    left, top, right, bottom = _polygon_bounds(polygon)
    angle = math.degrees(math.atan2(polygon[1][1] - polygon[0][1], polygon[1][0] - polygon[0][0]))
    return left, top, right, bottom, angle


def deduplicate_search_lines(lines: Sequence[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    """Remove duplicate recognized lines without concatenating fragments."""

    kept: list[dict[str, Any]] = []
    duplicate_count = 0
    for line in lines:
        geometry = _line_geometry(line)
        if geometry is None:
            continue
        text = " ".join(
            unicodedata.normalize("NFKC", str(line.get("text", ""))).casefold().split()
        )
        duplicate_index = None
        for index, existing in enumerate(kept):
            existing_geometry = _line_geometry(existing)
            if existing_geometry is None:
                continue
            existing_text = " ".join(
                unicodedata.normalize("NFKC", str(existing.get("text", "")))
                .casefold()
                .split()
            )
            if not text or text != existing_text:
                continue
            left, top, right, bottom, _ = geometry
            other_left, other_top, other_right, other_bottom, _ = existing_geometry
            if _intersection_area(
                (left, top, right, bottom),
                (other_left, other_top, other_right, other_bottom),
            ) / max(
                0.25,
                min(
                    (right - left) * (bottom - top),
                    (other_right - other_left) * (other_bottom - other_top),
                ),
            ) >= 0.65:
                duplicate_index = index
                break
        if duplicate_index is None:
            kept.append(line)
            continue
        duplicate_count += 1
        current_confidence = float(line.get("confidence", 0.0))
        previous_confidence = float(kept[duplicate_index].get("confidence", 0.0))
        current_boundary = bool(line.get("_boundary", False))
        previous_boundary = bool(kept[duplicate_index].get("_boundary", False))
        if (not current_boundary, current_confidence, len(str(line.get("text", "")))) > (
            not previous_boundary,
            previous_confidence,
            len(str(kept[duplicate_index].get("text", ""))),
        ):
            kept[duplicate_index] = line
    return kept, duplicate_count


def order_search_lines(lines: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    """Order horizontal content by columns and isolate vertical sidebars."""

    horizontal: list[tuple[dict[str, Any], tuple[float, float, float, float, float]]] = []
    vertical: list[tuple[dict[str, Any], tuple[float, float, float, float, float]]] = []
    for line in lines:
        geometry = _line_geometry(line)
        if geometry is None:
            continue
        left, top, right, bottom, angle = geometry
        if abs(angle) >= 60 or (bottom - top) > (right - left) * 1.5:
            vertical.append((line, geometry))
        else:
            horizontal.append((line, geometry))

    heights = [max(1.0, item[1][3] - item[1][1]) for item in horizontal]
    gap = max(12.0, float(np.median(heights)) * 3.0) if heights else 12.0
    columns: list[list[tuple[dict[str, Any], tuple[float, float, float, float, float]]]] = []
    for item in sorted(horizontal, key=lambda value: (value[1][0], value[1][1])):
        if not columns:
            columns.append([item])
            continue
        current_right = max(value[1][2] for value in columns[-1])
        if item[1][0] > current_right + gap:
            columns.append([item])
        else:
            columns[-1].append(item)
    ordered = [
        item[0]
        for column in columns
        for item in sorted(column, key=lambda value: (value[1][1], value[1][0]))
    ]
    ordered.extend(
        item[0]
        for item in sorted(vertical, key=lambda value: (value[1][0], value[1][1]))
    )
    result: list[dict[str, Any]] = []
    for order, line in enumerate(ordered):
        copy = dict(line)
        copy["order"] = order
        result.append(copy)
    return result


@dataclass(frozen=True)
class EngineManifest:
    name: str
    version: str
    runtime_name: str
    runtime_version: str
    model_name: str
    model_manifest_sha256: str
    runtime_artifacts: tuple[tuple[str, str], ...] = ()
    strategy_version: str = SEARCH_STRATEGY_VERSION

    @classmethod
    def load(cls, path: Path) -> "EngineManifest":
        raw = path.read_bytes()
        source = json.loads(raw)
        engine = source["engine"]
        model = source["model"]
        if source.get("runtimeDownloadsAllowed") or source.get("runtimeNetworkAllowed"):
            raise ValueError("MODEL_MANIFEST_UNSAFE")
        if not source.get("artifacts") or any(
            len(item.get("sha256", "")) != 64 for item in source["artifacts"]
        ):
            raise ValueError("MODEL_MANIFEST_INVALID")
        strategy_version = source.get("strategyVersion", SEARCH_STRATEGY_VERSION)
        if strategy_version != SEARCH_STRATEGY_VERSION:
            raise ValueError("MODEL_MANIFEST_INVALID")
        return cls(
            name=engine["name"],
            version=engine["version"],
            runtime_name=engine["runtimeName"],
            runtime_version=engine["runtimeVersion"],
            model_name=model["name"],
            model_manifest_sha256=sha256(raw).hexdigest(),
            runtime_artifacts=tuple(
                (item["name"], item["sha256"])
                for item in source.get("runtimeArtifacts", [])
            ),
            strategy_version=strategy_version,
        )

    @classmethod
    def fixture(cls) -> "EngineManifest":
        return cls(
            name="paddleocr-onnx",
            version="1.1.0",
            runtime_name="onnxruntime",
            runtime_version="1.27.0",
            model_name="PP-OCRv6-medium",
            model_manifest_sha256="a" * 64,
            strategy_version=SEARCH_STRATEGY_VERSION,
        )

    def public_dict(self) -> dict[str, str]:
        return {
            "name": self.name,
            "version": self.version,
            "runtimeName": self.runtime_name,
            "runtimeVersion": self.runtime_version,
            "modelName": self.model_name,
            "modelManifestSha256": self.model_manifest_sha256,
        }


class RecognitionEngine(ABC):
    @abstractmethod
    def assert_ready(self) -> EngineManifest:
        raise NotImplementedError

    @abstractmethod
    def recognize(
        self,
        image_bytes: bytes,
        *,
        deadline: datetime,
        purpose: str = "CV_IMPORT",
    ) -> dict[str, Any]:
        raise NotImplementedError


def normalize_engine_lines(
    raw_lines: Iterable[dict[str, Any]], *, width: int, height: int
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    utf8_bytes = 0
    for order, raw in enumerate(raw_lines):
        if order >= MAX_LINES:
            raise ValueError("OUTPUT_LIMIT_EXCEEDED")
        text = unicodedata.normalize("NFC", str(raw.get("text", "")).strip())
        if not text:
            continue
        if len(text) > MAX_LINE_CHARACTERS:
            raise ValueError("OUTPUT_LIMIT_EXCEEDED")
        if any(unicodedata.category(character) == "Cs" for character in text):
            raise ValueError("INVALID_UNICODE")
        utf8_bytes += len(text.encode("utf-8"))
        if utf8_bytes > MAX_OUTPUT_UTF8_BYTES:
            raise ValueError("OUTPUT_LIMIT_EXCEEDED")
        confidence = float(raw.get("confidence", -1))
        if not 0 <= confidence <= 1:
            raise ValueError("OCR_CONFIDENCE_INVALID")
        polygon_raw = raw.get("polygon")
        if not isinstance(polygon_raw, (list, tuple)) or len(polygon_raw) != 4:
            raise ValueError("OCR_LINE_GEOMETRY_INVALID")
        polygon: list[dict[str, float]] = []
        for point in polygon_raw:
            if isinstance(point, dict):
                x, y = float(point.get("x", -1)), float(point.get("y", -1))
            elif isinstance(point, (list, tuple)) and len(point) == 2:
                x, y = float(point[0]), float(point[1])
            else:
                raise ValueError("OCR_LINE_GEOMETRY_INVALID")
            if not 0 <= x <= width or not 0 <= y <= height:
                raise ValueError("OCR_LINE_GEOMETRY_INVALID")
            polygon.append({"x": x, "y": y})
        normalized.append(
            {
                "id": f"line-{len(normalized)}",
                "order": len(normalized),
                "text": text,
                "confidence": confidence,
                "polygon": polygon,
            }
        )
    return normalized


class PaddleOcrOnnxEngine(RecognitionEngine):
    def __init__(
        self,
        *,
        manifest_path: Path,
        model_root: Path,
        search_config: SearchOcrConfig | None = None,
    ) -> None:
        self._manifest = EngineManifest.load(manifest_path)
        self._model_root = model_root
        self._pipeline: Any | None = None
        self._search_config = search_config or SearchOcrConfig.from_environment()
        self._last_search_telemetry: dict[str, Any] | None = None

    def warm(self) -> EngineManifest:
        global PaddleOCR
        if PaddleOCR is None:
            try:
                from paddleocr import PaddleOCR as PaddleOcrFactory
            except ImportError as error:
                raise RuntimeError("ENGINE_NOT_READY") from error
            PaddleOCR = PaddleOcrFactory
        detector = self._model_root / "PP-OCRv6_medium_det_infer"
        recognizer = self._model_root / "PP-OCRv6_medium_rec_infer"
        if not detector.is_dir() or not recognizer.is_dir():
            raise RuntimeError("ENGINE_NOT_READY")
        if not self._manifest.runtime_artifacts:
            raise RuntimeError("ENGINE_NOT_READY")
        for relative_path, expected_sha256 in self._manifest.runtime_artifacts:
            artifact = (self._model_root / relative_path).resolve()
            if (
                self._model_root.resolve() not in artifact.parents
                or not artifact.is_file()
                or file_sha256(artifact) != expected_sha256
            ):
                raise RuntimeError("ENGINE_NOT_READY")
        self._pipeline = PaddleOCR(
            text_detection_model_dir=str(detector),
            text_recognition_model_dir=str(recognizer),
            device="cpu",
            enable_hpi=False,
            engine="onnxruntime",
            engine_config={
                "device_type": "cpu",
                "intra_op_num_threads": 4,
                "inter_op_num_threads": 1,
            },
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
        # Force lazy graph/session initialization without retaining user content.
        warm_image = Image.new("RGB", (32, 32), "white")
        list(self._pipeline.predict(np.asarray(warm_image)))
        return self._manifest

    def assert_ready(self) -> EngineManifest:
        if self._pipeline is None:
            raise RuntimeError("ENGINE_NOT_READY")
        return self._manifest

    @staticmethod
    def _region_budget_from_deadline(
        *, deadline: datetime, now: datetime | None = None
    ) -> tuple[float, int]:
        """Convert remaining request time to bounded recognition work.

        The floor preserves useful recall for ordinary requests. An already
        exhausted recognition window returns no work instead of allowing the
        floor to force a batch past the hard deadline.
        """
        now = now or datetime.now(UTC)
        remaining_seconds = (deadline - now).total_seconds()
        if remaining_seconds <= SEARCH_MIN_RECOGNITION_SECONDS:
            return 0.0, 0
        recognition_budget_seconds = (
            remaining_seconds - SEARCH_MIN_RECOGNITION_SECONDS
        )
        aspect_budget = recognition_budget_seconds / (
            SEARCH_TIME_PER_ASPECT_UNIT_SECONDS
        )
        aspect_budget = max(
            SEARCH_REGION_ASPECT_BUDGET_FLOOR,
            min(aspect_budget, SEARCH_REGION_ASPECT_BUDGET_CEILING),
        )
        max_regions = min(
            SEARCH_MAX_REGIONS_CEILING,
            max(3, int(aspect_budget / 4)),
        )
        return aspect_budget, max_regions

    @staticmethod
    def _search_regions(
        crops: list[np.ndarray],
        polygons: list[Any],
        *,
        aspect_budget: float,
        max_regions: int,
    ) -> tuple[list[tuple[np.ndarray, Any]], bool]:
        valid: list[tuple[np.ndarray, Any, float]] = []
        for crop, polygon in zip(crops, polygons, strict=False):
            if crop.size == 0 or crop.shape[0] < 1 or crop.shape[1] < 1:
                continue
            valid.append((crop, polygon, crop.shape[1] / float(crop.shape[0])))
        if not valid:
            return [], False

        selected: list[tuple[np.ndarray, Any]] = []
        spent = 0.0
        for index, (crop, polygon, aspect_ratio) in enumerate(valid):
            if len(selected) >= max_regions:
                break
            if index == 0 and aspect_ratio > SEARCH_MAX_REGION_ASPECT_RATIO:
                maximum_width = max(
                    1, round(crop.shape[0] * SEARCH_MAX_REGION_ASPECT_RATIO)
                )
                selected.append((crop[:, :maximum_width], polygon))
                spent = SEARCH_MAX_REGION_ASPECT_RATIO
                continue
            if aspect_ratio > SEARCH_MAX_REGION_ASPECT_RATIO:
                continue
            if selected and spent + aspect_ratio > aspect_budget:
                continue
            selected.append((crop, polygon))
            spent += aspect_ratio
        return selected, len(selected) < len(valid) or (
            valid[0][2] > SEARCH_MAX_REGION_ASPECT_RATIO
        )

    @staticmethod
    def _payload_dict(value: Any) -> dict[str, Any]:
        payload = getattr(value, "json", value)
        if callable(payload):
            payload = payload()
        if isinstance(payload, dict) and isinstance(payload.get("res"), dict):
            payload = payload["res"]
        return payload if isinstance(payload, dict) else {}

    @classmethod
    def _detection_candidates(
        cls,
        value: Any,
        *,
        inner: Any,
        source: str,
        tile: SearchTile | None,
        image_width: int,
        image_height: int,
    ) -> list[SearchDetectionCandidate]:
        payload = cls._payload_dict(value)
        raw_polygons = payload.get("dt_polys", payload.get("rec_polys", []))
        try:
            polygon_values = list(raw_polygons)
        except TypeError:
            return []
        raw_scores = payload.get("dt_scores", payload.get("det_scores", []))
        try:
            score_values = list(raw_scores)
        except TypeError:
            score_values = []
        scores_by_polygon = {
            _polygon_key(polygon): score
            for polygon, score in zip(polygon_values, score_values, strict=False)
            if _polygon_key(polygon) is not None
        }
        sorter = getattr(inner, "_sort_boxes", None)
        ordered_polygons = (
            list(sorter(polygon_values))
            if callable(sorter)
            else polygon_values
        )
        result: list[SearchDetectionCandidate] = []
        for polygon in ordered_polygons:
            score = scores_by_polygon.get(_polygon_key(polygon), 0.5)
            candidate = _candidate_from_polygon(
                polygon,
                source=source,
                tile=tile,
                image_width=image_width,
                image_height=image_height,
                detection_confidence=score,
            )
            if candidate is not None:
                result.append(candidate)
        return result

    @staticmethod
    def _detection_parameters(inner: Any) -> dict[str, Any]:
        return inner.get_text_det_params(
            SEARCH_DETECTION_SIDE_LIMIT,
            "max",
            SEARCH_DETECTION_SIDE_LIMIT,
            None,
            None,
            None,
        )

    @staticmethod
    def _run_detector(
        inner: Any,
        images: Sequence[np.ndarray],
        *,
        detection_parameters: dict[str, Any],
        deadline: datetime,
    ) -> list[Any]:
        if not images or datetime.now(UTC) >= deadline:
            return []
        shapes = {tuple(image.shape) for image in images}
        if len(shapes) != 1:
            raise ValueError("SEARCH_DETECTOR_BATCH_SHAPE_INVALID")
        detector = inner.text_det_model
        try:
            results = list(detector(list(images), **detection_parameters))
            if len(results) == len(images):
                return results
            if len(images) == 1:
                return results[:1]
            raise ValueError("SEARCH_DETECTOR_BATCH_RESULT_INVALID")
        except (TypeError, ValueError):
            if len(images) == 1:
                raise
            # Some pinned PaddleX builds expose the detector as a single-image
            # callable. Fall back in-process; never create parallel UDS calls.
            return [
                item
                for image in images
                for item in list(detector([image], **detection_parameters))[:1]
            ]

    @staticmethod
    def _expanded_crop_polygon(
        candidate: SearchDetectionCandidate,
        neighbors: Sequence[SearchDetectionCandidate],
        *,
        width: int,
        height: int,
        margin_px: int,
    ) -> Polygon:
        left, top, right, bottom = candidate.bounds
        line_height = max(1.0, bottom - top)
        horizontal_margin = min(4.0, max(float(margin_px), line_height * 0.15))
        vertical_margin = min(4.0, max(float(margin_px), line_height * 0.2))
        nearest_gap: float | None = None
        for neighbor in neighbors:
            if neighbor is candidate:
                continue
            other_left, other_top, other_right, other_bottom = neighbor.bounds
            if min(right, other_right) <= max(left, other_left):
                continue
            if other_bottom <= top:
                gap = top - other_bottom
            elif other_top >= bottom:
                gap = other_top - bottom
            else:
                continue
            nearest_gap = gap if nearest_gap is None else min(nearest_gap, gap)
        if nearest_gap is not None:
            vertical_margin = min(vertical_margin, max(1.0, nearest_gap / 2.0))
        return _rect_polygon(
            (
                max(0.0, left - horizontal_margin),
                max(0.0, top - vertical_margin),
                min(float(width), right + horizontal_margin),
                min(float(height), bottom + vertical_margin),
            )
        )

    @classmethod
    def _direct_crop(
        cls, image_array: np.ndarray, polygon: Polygon
    ) -> np.ndarray:
        left, top, right, bottom = _polygon_bounds(polygon)
        x0, y0 = max(0, math.floor(left)), max(0, math.floor(top))
        x1, y1 = min(image_array.shape[1], math.ceil(right)), min(
            image_array.shape[0], math.ceil(bottom)
        )
        if x1 <= x0 or y1 <= y0:
            return np.empty((0, 0, image_array.shape[2]), dtype=image_array.dtype)
        return np.array(image_array[y0:y1, x0:x1], copy=True)

    @staticmethod
    def _estimated_crop_bytes(
        candidate: SearchDetectionCandidate,
        neighbors: Sequence[SearchDetectionCandidate],
        *,
        width: int,
        height: int,
        channels: int,
        margin_px: int,
    ) -> int:
        expanded = PaddleOcrOnnxEngine._expanded_crop_polygon(
            candidate,
            neighbors,
            width=width,
            height=height,
            margin_px=margin_px,
        )
        left, top, right, bottom = _polygon_bounds(expanded)
        x0, y0 = max(0, math.floor(left)), max(0, math.floor(top))
        x1, y1 = min(width, math.ceil(right)), min(height, math.ceil(bottom))
        return max(0, x1 - x0) * max(0, y1 - y0) * max(1, channels)

    @classmethod
    def _materialize_crop_batch(
        cls,
        inner: Any,
        image_array: np.ndarray,
        regions: Sequence[SearchDetectionCandidate],
        *,
        all_regions: Sequence[SearchDetectionCandidate],
        batch_offset: int,
        margin_px: int,
    ) -> list[np.ndarray]:
        expanded = [
            cls._expanded_crop_polygon(
                region,
                all_regions,
                width=image_array.shape[1],
                height=image_array.shape[0],
                margin_px=margin_px,
            )
            for region in regions
        ]
        cropper = getattr(inner, "_crop_by_polys", None)
        if callable(cropper):
            try:
                materialized = list(cropper(image_array, expanded))
                if len(materialized) == len(regions):
                    return [np.asarray(crop) for crop in materialized]
                # A small compatibility allowance for test doubles and older
                # adapters that return the full input list for each call.
                if len(materialized) >= batch_offset + len(regions):
                    return [
                        np.asarray(crop)
                        for crop in materialized[
                            batch_offset : batch_offset + len(regions)
                        ]
                    ]
            except (TypeError, ValueError):
                pass
        return [cls._direct_crop(image_array, polygon) for polygon in expanded]

    def _recognize_search(
        self, image_array: np.ndarray, *, deadline: datetime
    ) -> tuple[list[dict[str, Any]], bool]:
        pipeline = self._pipeline
        paddlex_pipeline = getattr(pipeline, "paddlex_pipeline", None)
        inner = getattr(paddlex_pipeline, "_pipeline", None)
        if inner is None:
            raise RuntimeError("ENGINE_NOT_READY")
        config = getattr(self, "_search_config", SearchOcrConfig())
        started = time.perf_counter()
        detect_started = started
        detection_parameters = self._detection_parameters(inner)
        full_detections = self._run_detector(
            inner,
            [image_array],
            detection_parameters=detection_parameters,
            deadline=deadline,
        )
        full_candidates = [
            candidate
            for detection in full_detections
            for candidate in self._detection_candidates(
                detection,
                inner=inner,
                source="FULL",
                tile=None,
                image_width=image_array.shape[1],
                image_height=image_array.shape[0],
            )
        ]
        detect_ms = (time.perf_counter() - detect_started) * 1_000
        aspect_budget, deadline_max_regions = self._region_budget_from_deadline(
            deadline=deadline
        )
        max_regions = min(deadline_max_regions, config.region_safety_cap)
        tile_candidates: list[SearchDetectionCandidate] = []
        tiles: list[SearchTile] = []
        partial = False
        deadline_exit_stage = "NONE"
        use_tiles = should_use_tiled_recovery(
            image_array,
            full_candidates,
            config=config,
            aspect_budget=aspect_budget,
        )
        if use_tiles and datetime.now(UTC) < deadline:
            tiles = plan_search_tiles(
                image_array.shape[1],
                image_array.shape[0],
                overlap_percent=config.tile_overlap_percent,
                max_tiles=config.max_tiles,
            )
            for offset in range(0, len(tiles), config.tile_batch_size):
                if datetime.now(UTC) >= deadline:
                    partial = True
                    deadline_exit_stage = "TILE_DETECTION"
                    break
                tile_batch = tiles[offset : offset + config.tile_batch_size]
                tile_images = [
                    materialize_search_tile(image_array, tile) for tile in tile_batch
                ]
                tile_detections = self._run_detector(
                    inner,
                    tile_images,
                    detection_parameters=detection_parameters,
                    deadline=deadline,
                )
                for tile, detection in zip(tile_batch, tile_detections, strict=False):
                    tile_candidates.extend(
                        self._detection_candidates(
                            detection,
                            inner=inner,
                            source="TILE",
                            tile=tile,
                            image_width=image_array.shape[1],
                            image_height=image_array.shape[0],
                        )
                    )
                if len(tile_detections) != len(tile_batch):
                    partial = True
                del tile_images
            if datetime.now(UTC) >= deadline:
                partial = True
                deadline_exit_stage = "TILE_DETECTION"
        all_candidates, duplicate_count = merge_search_detections(
            [*full_candidates, *tile_candidates]
        )
        selected, selection_partial = select_search_regions(
            all_candidates,
            width=image_array.shape[1],
            height=image_array.shape[0],
            aspect_budget=aspect_budget,
            max_regions=max_regions,
            safety_cap=config.region_safety_cap,
        )
        partial = partial or selection_partial
        if not selected:
            self._last_search_telemetry = {
                "strategyVersion": config.strategy_version,
                "path": "TILED_RECOVERY" if use_tiles else "FULL_ONLY",
                "normalizedDimensionBucket": _dimension_bucket(
                    image_array.shape[1], image_array.shape[0]
                ),
                "fullDetectedRegionBucket": _count_bucket(len(full_candidates)),
                "tileCount": len(tiles),
                "tileBatchSize": config.tile_batch_size,
                "mergedRegionBucket": _count_bucket(len(all_candidates)),
                "selectedRegionBucket": "ZERO",
                "skippedRegionBucket": _count_bucket(len(all_candidates)),
                "duplicateCountBucket": _count_bucket(duplicate_count),
                "boundaryFragmentBucket": _count_bucket(
                    sum(candidate.boundary_contact for candidate in all_candidates)
                ),
                "partial": partial,
                "detectMsBucket": _duration_bucket(detect_ms),
                "recognizeMsBucket": "LT_100MS",
                "mergeMsBucket": _duration_bucket(
                    (time.perf_counter() - started) * 1_000 - detect_ms
                ),
                "queueMsBucket": "LT_100MS",
                "deadlineExitStage": deadline_exit_stage,
            }
            return [], partial

        lines: list[dict[str, Any]] = []
        processed_regions = 0
        recognize_started = time.perf_counter()
        batch_offset = 0
        while batch_offset < len(selected):
            if datetime.now(UTC) >= deadline:
                partial = True
                deadline_exit_stage = "RECOGNITION"
                break
            batch = list(
                selected[
                    batch_offset : batch_offset + config.recognition_batch_size
                ]
            )
            batch_end = min(
                len(selected), batch_offset + config.recognition_batch_size
            )
            batch_crop_bytes = sum(
                self._estimated_crop_bytes(
                    candidate,
                    selected,
                    width=image_array.shape[1],
                    height=image_array.shape[0],
                    channels=image_array.shape[2],
                    margin_px=config.crop_margin_px,
                )
                for candidate in batch
            )
            while batch and batch_crop_bytes > config.max_crop_batch_bytes:
                batch.pop()
                partial = True
                batch_crop_bytes = sum(
                    self._estimated_crop_bytes(
                        candidate,
                        selected,
                        width=image_array.shape[1],
                        height=image_array.shape[0],
                        channels=image_array.shape[2],
                        margin_px=config.crop_margin_px,
                    )
                    for candidate in batch
                )
            if not batch:
                batch_offset = max(batch_offset + 1, batch_end)
                continue
            batch_aspect = sum(
                min(candidate.estimated_aspect, SEARCH_MAX_REGION_ASPECT_RATIO)
                for candidate in batch
            )
            estimated_seconds = max(
                SEARCH_MIN_RECOGNITION_SECONDS,
                batch_aspect * SEARCH_TIME_PER_ASPECT_UNIT_SECONDS,
            )
            if (deadline - datetime.now(UTC)).total_seconds() < estimated_seconds:
                partial = True
                deadline_exit_stage = "RECOGNITION"
                break
            crops = self._materialize_crop_batch(
                inner,
                image_array,
                batch,
                all_regions=selected,
                batch_offset=batch_offset,
                margin_px=config.crop_margin_px,
            )
            if len(crops) != len(batch):
                partial = True
                deadline_exit_stage = "RECOGNITION"
                break
            recognitions = list(
                inner.text_rec_model(
                    crops,
                    batch_size=len(crops),
                    return_word_box=False,
                )
            )
            processed_regions += min(len(recognitions), len(batch))
            if len(recognitions) != len(batch):
                partial = True
            for recognition, candidate in zip(
                recognitions, batch, strict=False
            ):
                recognition_payload = self._payload_dict(recognition)
                text_value = str(
                    recognition_payload.get("rec_text", recognition_payload.get("text", ""))
                ).strip()
                if not text_value:
                    continue
                lines.append(
                    {
                        "text": text_value,
                        "confidence": float(
                            recognition_payload.get(
                                "rec_score", recognition_payload.get("confidence", 0.0)
                            )
                        ),
                        "polygon": [
                            [point[0], point[1]] for point in candidate.polygon
                        ],
                        "_boundary": candidate.boundary_contact,
                        "_source": candidate.source,
                    }
                )
            del crops
            batch_offset += len(batch)
            if datetime.now(UTC) >= deadline:
                partial = True
                deadline_exit_stage = "RECOGNITION"
                break
        if processed_regions < len(selected):
            partial = True
        lines, recognition_duplicates = deduplicate_search_lines(lines)
        lines = order_search_lines(lines)
        recognize_ms = (time.perf_counter() - recognize_started) * 1_000
        self._last_search_telemetry = {
            "strategyVersion": config.strategy_version,
            "path": "TILED_RECOVERY" if use_tiles else "FULL_ONLY",
            "normalizedDimensionBucket": _dimension_bucket(
                image_array.shape[1], image_array.shape[0]
            ),
            "fullDetectedRegionBucket": _count_bucket(len(full_candidates)),
            "tileCount": len(tiles),
            "tileBatchSize": config.tile_batch_size,
            "mergedRegionBucket": _count_bucket(len(all_candidates)),
            "selectedRegionBucket": _count_bucket(len(selected)),
            "skippedRegionBucket": _count_bucket(
                max(0, len(all_candidates) - len(selected))
            ),
            "duplicateCountBucket": _count_bucket(duplicate_count + recognition_duplicates),
            "boundaryFragmentBucket": _count_bucket(
                sum(candidate.boundary_contact for candidate in all_candidates)
            ),
            "partial": partial,
            "detectMsBucket": _duration_bucket(detect_ms),
            "recognizeMsBucket": _duration_bucket(recognize_ms),
            "mergeMsBucket": _duration_bucket(
                max(0.0, (time.perf_counter() - started) * 1_000 - detect_ms - recognize_ms)
            ),
            "queueMsBucket": "LT_100MS",
            "deadlineExitStage": deadline_exit_stage,
        }
        return lines, partial

    def recognize(
        self,
        image_bytes: bytes,
        *,
        deadline: datetime,
        purpose: str = "CV_IMPORT",
    ) -> dict[str, Any]:
        if datetime.now(UTC) >= deadline:
            raise TimeoutError("DEADLINE_EXCEEDED")
        pipeline = self._pipeline
        if pipeline is None:
            raise RuntimeError("ENGINE_NOT_READY")
        self._last_search_telemetry = None
        with Image.open(io.BytesIO(image_bytes)) as image:
            image.load()
            width, height = image.size
            if image.format != "PNG":
                raise ValueError("INVALID_REQUEST")
            if width < 1 or height < 1 or width * height > MAX_DECODED_PIXELS:
                raise ValueError("PIXEL_LIMIT_EXCEEDED")
            image_array = np.asarray(image.convert("RGB"))
            if purpose == "JOB_IMAGE_SEARCH":
                raw_lines, partial = self._recognize_search(
                    image_array, deadline=deadline
                )
                predictions: list[Any] = []
            else:
                predictions = list(pipeline.predict(image_array))
                raw_lines = []
                partial = False
        if datetime.now(UTC) >= deadline:
            if purpose == "JOB_IMAGE_SEARCH" and raw_lines:
                partial = True
            else:
                raise TimeoutError("DEADLINE_EXCEEDED")
        for prediction in predictions:
            payload = getattr(prediction, "json", prediction)
            if callable(payload):
                payload = payload()
            if isinstance(payload, dict) and "res" in payload:
                payload = payload["res"]
            if not isinstance(payload, dict):
                continue
            texts = payload.get("rec_texts", [])
            scores = payload.get("rec_scores", [])
            polygons = payload.get("rec_polys", payload.get("dt_polys", []))
            raw_lines.extend(
                {"text": text, "confidence": score, "polygon": polygon}
                for text, score, polygon in zip(texts, scores, polygons, strict=False)
            )
        return {
            "width": width,
            "height": height,
            "detectedOrientationDegrees": 0,
            "lines": normalize_engine_lines(raw_lines, width=width, height=height),
            "partial": partial,
            **(
                {"_telemetry": self._last_search_telemetry}
                if purpose == "JOB_IMAGE_SEARCH" and self._last_search_telemetry
                else {}
            ),
        }
