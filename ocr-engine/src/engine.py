from __future__ import annotations

import io
import json
import unicodedata
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from typing import Any, Iterable

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


def file_sha256(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@dataclass(frozen=True)
class EngineManifest:
    name: str
    version: str
    runtime_name: str
    runtime_version: str
    model_name: str
    model_manifest_sha256: str
    runtime_artifacts: tuple[tuple[str, str], ...] = ()

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
        )

    @classmethod
    def fixture(cls) -> "EngineManifest":
        return cls(
            name="paddleocr-onnx",
            version="1.0.0",
            runtime_name="onnxruntime",
            runtime_version="1.27.0",
            model_name="PP-OCRv6-medium",
            model_manifest_sha256="a" * 64,
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
    def recognize(self, image_bytes: bytes, *, deadline: datetime) -> dict[str, Any]:
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
    def __init__(self, *, manifest_path: Path, model_root: Path) -> None:
        self._manifest = EngineManifest.load(manifest_path)
        self._model_root = model_root
        self._pipeline: Any | None = None

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

    def recognize(self, image_bytes: bytes, *, deadline: datetime) -> dict[str, Any]:
        if datetime.now(UTC) >= deadline:
            raise TimeoutError("DEADLINE_EXCEEDED")
        pipeline = self._pipeline
        if pipeline is None:
            raise RuntimeError("ENGINE_NOT_READY")
        with Image.open(io.BytesIO(image_bytes)) as image:
            image.load()
            width, height = image.size
            if image.format != "PNG":
                raise ValueError("INVALID_REQUEST")
            if width < 1 or height < 1 or width * height > MAX_DECODED_PIXELS:
                raise ValueError("PIXEL_LIMIT_EXCEEDED")
            predictions = list(pipeline.predict(np.asarray(image.convert("RGB"))))
        if datetime.now(UTC) >= deadline:
            raise TimeoutError("DEADLINE_EXCEEDED")
        raw_lines: list[dict[str, Any]] = []
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
        }
