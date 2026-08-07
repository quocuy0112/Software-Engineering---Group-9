from __future__ import annotations

import os
import socket
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import AsyncIterator

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .contracts import RecognitionResponse, SafeError
from .engine import (
    PaddleOcrOnnxEngine,
    RecognitionEngine,
    normalize_engine_lines,
)
from .limits import MAX_INPUT_BYTES, output_limit_for

ALLOWED_REQUEST_HEADERS = {
    "x-ocr-attempt-id",
    "x-ocr-purpose",
    "x-ocr-deadline",
    "x-ocr-model-manifest-sha256",
}


def _error(code: str, status: int, *, retryable: bool = False) -> JSONResponse:
    payload = SafeError.model_validate(
        {"error": {"code": code, "retryable": retryable}}
    )
    return JSONResponse(
        status_code=status,
        content=payload.model_dump(by_alias=True),
        headers={"Cache-Control": "no-store"},
    )


def _deadline(raw: str | None) -> datetime | None:
    try:
        parsed = datetime.fromisoformat((raw or "").replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(UTC)


def create_app(engine: RecognitionEngine) -> FastAPI:
    app = FastAPI(
        title="SmartHire Private OCR Engine",
        version="1.0.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )

    @app.get("/health/live")
    async def live() -> dict[str, str]:
        return {"status": "live"}

    @app.get("/health/ready")
    async def ready() -> JSONResponse:
        try:
            manifest = engine.assert_ready()
        except RuntimeError:
            return _error("ENGINE_NOT_READY", 503, retryable=True)
        return JSONResponse(
            content={
                "status": "ready",
                "engine": manifest.public_dict(),
                "warmedAt": datetime.now(UTC).isoformat(),
            },
            headers={"Cache-Control": "no-store"},
        )

    @app.post("/v1/recognitions")
    async def recognize(request: Request) -> JSONResponse:
        if any(
            name.lower().startswith("x-") and name.lower() not in ALLOWED_REQUEST_HEADERS
            for name in request.headers
        ):
            return _error("INVALID_REQUEST", 400)
        content_type = request.headers.get("content-type", "").split(";", 1)[0]
        if content_type != "image/png":
            return _error("INVALID_REQUEST", 400)
        try:
            declared_length = int(request.headers.get("content-length", "-1"))
        except ValueError:
            return _error("INVALID_REQUEST", 400)
        if declared_length > MAX_INPUT_BYTES:
            return _error("INPUT_TOO_LARGE", 413)
        if declared_length < 1:
            return _error("INVALID_REQUEST", 400)
        attempt_id = request.headers.get("x-ocr-attempt-id", "")
        purpose = request.headers.get("x-ocr-purpose", "")
        if (
            not 10 <= len(attempt_id) <= 80
            or not all(character.isalnum() or character in "_-" for character in attempt_id)
            or purpose not in {"CV_IMPORT", "JOB_IMAGE_SEARCH"}
        ):
            return _error("INVALID_REQUEST", 400)
        deadline = _deadline(request.headers.get("x-ocr-deadline"))
        if deadline is None or deadline <= datetime.now(UTC):
            return _error("INVALID_REQUEST", 400)
        try:
            manifest = engine.assert_ready()
        except RuntimeError:
            return _error("ENGINE_NOT_READY", 503, retryable=True)
        expected_manifest = request.headers.get("x-ocr-model-manifest-sha256")
        if expected_manifest != manifest.model_manifest_sha256:
            return _error("MODEL_MISMATCH", 503)
        image_bytes = await request.body()
        if len(image_bytes) != declared_length:
            return _error("INVALID_REQUEST", 400)
        if len(image_bytes) > MAX_INPUT_BYTES:
            return _error("INPUT_TOO_LARGE", 413)
        if not image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            return _error("INVALID_REQUEST", 400)
        try:
            outcome = engine.recognize(image_bytes, deadline=deadline)
            lines = normalize_engine_lines(
                outcome["lines"],
                width=outcome["width"],
                height=outcome["height"],
            )
            utf8_bytes = sum(len(line["text"].encode("utf-8")) for line in lines)
            if utf8_bytes > output_limit_for(purpose):
                return _error("OUTPUT_LIMIT_EXCEEDED", 413)
            confidences = [line["confidence"] for line in lines]
            response = RecognitionResponse.model_validate(
                {
                    "schemaVersion": "ocr-lines-v1",
                    "attemptId": attempt_id,
                    "purpose": purpose,
                    "engine": manifest.public_dict(),
                    "image": {
                        "width": outcome["width"],
                        "height": outcome["height"],
                        "decodedPixels": outcome["width"] * outcome["height"],
                        "detectedOrientationDegrees": outcome[
                            "detectedOrientationDegrees"
                        ],
                    },
                    "lines": lines,
                    "summary": {
                        "lineCount": len(lines),
                        "utf8Bytes": utf8_bytes,
                        "averageConfidence": (
                            sum(confidences) / len(confidences)
                            if confidences
                            else None
                        ),
                        "minimumConfidence": min(confidences) if confidences else None,
                    },
                }
            )
        except TimeoutError:
            return _error("DEADLINE_EXCEEDED", 422, retryable=True)
        except (ValueError, KeyError):
            return _error("RECOGNITION_FAILED", 422)
        except RuntimeError:
            return _error("ENGINE_NOT_READY", 503, retryable=True)
        return JSONResponse(
            content=response.model_dump(by_alias=True),
            headers={"Cache-Control": "no-store"},
        )

    return app


def _runtime() -> tuple[FastAPI, PaddleOcrOnnxEngine]:
    manifest_path = Path(os.environ.get("OCR_MODEL_MANIFEST_PATH", "/opt/ocr/model-manifest.json"))
    model_root = Path(os.environ.get("OCR_MODEL_ROOT", "/opt/ocr/models"))
    engine = PaddleOcrOnnxEngine(manifest_path=manifest_path, model_root=model_root)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        engine.warm()
        yield

    app = create_app(engine)
    app.router.lifespan_context = lifespan
    return app, engine


def bind_private_unix_socket(socket_path: str) -> socket.socket:
    path = Path(socket_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    previous_umask = os.umask(0o007)
    uds_socket = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        uds_socket.bind(socket_path)
        # Uvicorn's built-in UDS binder forces 0666 after bind. Supplying our
        # own socket preserves the worker-group-only boundary instead.
        path.chmod(0o660)
        return uds_socket
    except BaseException:
        uds_socket.close()
        path.unlink(missing_ok=True)
        raise
    finally:
        os.umask(previous_umask)


if __name__ == "__main__":
    runtime_app, _ = _runtime()
    socket_path = os.environ.get(
        "OCR_ENGINE_SOCKET_PATH", "/run/smarthire-ocr/ocr.sock"
    )
    uds_socket = bind_private_unix_socket(socket_path)
    config = uvicorn.Config(runtime_app, log_level="warning", access_log=False)
    server = uvicorn.Server(config)
    try:
        server.run(sockets=[uds_socket])
    finally:
        uds_socket.close()
        Path(socket_path).unlink(missing_ok=True)
