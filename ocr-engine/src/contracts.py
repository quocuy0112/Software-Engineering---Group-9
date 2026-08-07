from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .limits import MAX_DECODED_PIXELS, MAX_LINE_CHARACTERS, MAX_LINES, MAX_OUTPUT_UTF8_BYTES

OCR_SCHEMA_VERSION = "ocr-lines-v1"
OCR_ENGINE_NAME = "paddleocr-onnx"
OCR_MODEL_NAME = "PP-OCRv6-medium"
OCR_RUNTIME_NAME = "onnxruntime"
OCR_RUNTIME_VERSION = "1.27.0"
OCR_PURPOSES = ("CV_IMPORT", "JOB_IMAGE_SEARCH")
OCR_RESULT_MAX_LINES = 2000
OCR_RESULT_MAX_UTF8_BYTES = 65536


def _to_camel(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ContractModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        extra="forbid",
        strict=True,
    )


class EngineManifestContract(ContractModel):
    name: Literal["paddleocr-onnx"]
    version: Annotated[str, Field(min_length=1, max_length=40)]
    runtime_name: Literal["onnxruntime"]
    runtime_version: Literal["1.27.0"]
    model_name: Literal["PP-OCRv6-medium"]
    model_manifest_sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]


class Point(ContractModel):
    x: Annotated[float, Field(ge=0, le=MAX_DECODED_PIXELS, allow_inf_nan=False)]
    y: Annotated[float, Field(ge=0, le=MAX_DECODED_PIXELS, allow_inf_nan=False)]


class OcrLine(ContractModel):
    id: Annotated[str, Field(pattern=r"^line-[0-9]{1,4}$")]
    order: Annotated[int, Field(ge=0, lt=MAX_LINES)]
    text: Annotated[str, Field(min_length=1, max_length=MAX_LINE_CHARACTERS)]
    confidence: Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
    polygon: Annotated[list[Point], Field(min_length=4, max_length=4)]


class ImageOutcome(ContractModel):
    width: Annotated[int, Field(ge=1, le=MAX_DECODED_PIXELS)]
    height: Annotated[int, Field(ge=1, le=MAX_DECODED_PIXELS)]
    decoded_pixels: Annotated[int, Field(ge=1, le=MAX_DECODED_PIXELS)]
    detected_orientation_degrees: Literal[0, 90, 180, 270]

    @model_validator(mode="after")
    def validate_pixels(self) -> "ImageOutcome":
        if self.width * self.height != self.decoded_pixels:
            raise ValueError("PIXEL_COUNT_MISMATCH")
        return self


class RecognitionSummary(ContractModel):
    line_count: Annotated[int, Field(ge=0, le=MAX_LINES)]
    utf8_bytes: Annotated[int, Field(ge=0, le=MAX_OUTPUT_UTF8_BYTES)]
    average_confidence: Annotated[
        float | None, Field(ge=0, le=1, allow_inf_nan=False)
    ]
    minimum_confidence: Annotated[
        float | None, Field(ge=0, le=1, allow_inf_nan=False)
    ]


class RecognitionResponse(ContractModel):
    schema_version: Literal["ocr-lines-v1"]
    attempt_id: Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{10,80}$")]
    purpose: Literal["CV_IMPORT", "JOB_IMAGE_SEARCH"]
    engine: EngineManifestContract
    image: ImageOutcome
    lines: Annotated[list[OcrLine], Field(max_length=MAX_LINES)]
    summary: RecognitionSummary

    @model_validator(mode="after")
    def validate_derived_values(self) -> "RecognitionResponse":
        ids = {line.id for line in self.lines}
        orders = {line.order for line in self.lines}
        if len(ids) != len(self.lines) or len(orders) != len(self.lines):
            raise ValueError("DUPLICATE_LINE")
        for line in self.lines:
            if any(
                point.x > self.image.width or point.y > self.image.height
                for point in line.polygon
            ):
                raise ValueError("OCR_LINE_GEOMETRY_INVALID")
        confidences = [line.confidence for line in self.lines]
        average = sum(confidences) / len(confidences) if confidences else None
        minimum = min(confidences) if confidences else None
        if (
            self.summary.line_count != len(self.lines)
            or self.summary.utf8_bytes
            != sum(len(line.text.encode("utf-8")) for line in self.lines)
            or self.summary.average_confidence != average
            or self.summary.minimum_confidence != minimum
        ):
            raise ValueError("OCR_SUMMARY_MISMATCH")
        return self


class SafeErrorDetail(ContractModel):
    code: Literal[
        "INVALID_REQUEST",
        "INPUT_TOO_LARGE",
        "PIXEL_LIMIT_EXCEEDED",
        "OUTPUT_LIMIT_EXCEEDED",
        "DEADLINE_EXCEEDED",
        "MODEL_MISMATCH",
        "ENGINE_NOT_READY",
        "RECOGNITION_FAILED",
    ]
    retryable: bool


class SafeError(ContractModel):
    error: SafeErrorDetail
