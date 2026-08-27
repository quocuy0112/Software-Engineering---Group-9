from __future__ import annotations

from datetime import UTC, datetime, timedelta
from hashlib import sha256
from pathlib import Path
from stat import S_IMODE, S_ISSOCK

from fastapi.testclient import TestClient

from src.app import bind_private_unix_socket, create_app
from src.contracts import RecognitionResponse
from src.engine import EngineManifest, RecognitionEngine


FIXTURE_PNG = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
    b"\x00\x00\x00\x0cIDAT\x08\xd7c\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb4"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


class FakeEngine(RecognitionEngine):
    def __init__(self) -> None:
        self.manifest = EngineManifest.fixture()

    def assert_ready(self) -> EngineManifest:
        return self.manifest

    def recognize(
        self,
        image_bytes: bytes,
        *,
        deadline: datetime,
        purpose: str = "CV_IMPORT",
    ):
        assert image_bytes == FIXTURE_PNG
        assert deadline > datetime.now(UTC)
        assert purpose == "CV_IMPORT"
        return {
            "width": 1,
            "height": 1,
            "detectedOrientationDegrees": 0,
            "lines": [
                {
                    "text": "Xin chào OCR",
                    "confidence": 0.95,
                    "polygon": [
                        {"x": 0, "y": 0},
                        {"x": 1, "y": 0},
                        {"x": 1, "y": 1},
                        {"x": 0, "y": 1},
                    ],
                }
            ],
        }


def headers(**overrides: str) -> dict[str, str]:
    result = {
        "content-type": "image/png",
        "content-length": str(len(FIXTURE_PNG)),
        "x-ocr-attempt-id": "attempt_fixture_001",
        "x-ocr-purpose": "CV_IMPORT",
        "x-ocr-deadline": (datetime.now(UTC) + timedelta(seconds=10)).isoformat(),
        "x-ocr-model-manifest-sha256": EngineManifest.fixture().model_manifest_sha256,
    }
    result.update(overrides)
    return result


def test_recognition_contract_is_strict_and_bounded() -> None:
    client = TestClient(create_app(FakeEngine()))
    response = client.post("/v1/recognitions", headers=headers(), content=FIXTURE_PNG)
    assert response.status_code == 200
    body = response.json()
    parsed = RecognitionResponse.model_validate(body)
    assert parsed.schema_version == "ocr-lines-v1"
    assert parsed.summary.partial is False
    assert parsed.summary.utf8_bytes == len("Xin chào OCR".encode("utf-8"))
    assert parsed.lines[0].id == "line-0"
    assert set(body) == {
        "schemaVersion",
        "attemptId",
        "purpose",
        "engine",
        "image",
        "lines",
        "summary",
    }


def test_rejects_unknown_headers_wrong_purpose_and_expired_deadline() -> None:
    client = TestClient(create_app(FakeEngine()))
    assert client.post(
        "/v1/recognitions",
        headers=headers(**{"x-ocr-purpose": "GENERIC_OCR"}),
        content=FIXTURE_PNG,
    ).status_code == 400
    expired = client.post(
        "/v1/recognitions",
        headers=headers(
            **{
                "x-ocr-deadline": (
                    datetime.now(UTC) - timedelta(seconds=1)
                ).isoformat()
            }
        ),
        content=FIXTURE_PNG,
    )
    assert expired.status_code == 422
    assert expired.json() == {
        "error": {"code": "DEADLINE_EXCEEDED", "retryable": True}
    }
    assert client.post(
        "/v1/recognitions",
        headers=headers(**{"x-untrusted-owner": "candidate"}),
        content=FIXTURE_PNG,
    ).status_code == 400


def test_rejects_manifest_mismatch_non_png_and_oversized_declared_body() -> None:
    client = TestClient(create_app(FakeEngine()))
    assert client.post(
        "/v1/recognitions",
        headers=headers(**{"x-ocr-model-manifest-sha256": "0" * 64}),
        content=FIXTURE_PNG,
    ).status_code == 503
    assert client.post(
        "/v1/recognitions",
        headers=headers(**{"content-type": "image/jpeg"}),
        content=b"not-png",
    ).status_code == 400
    assert client.post(
        "/v1/recognitions",
        headers=headers(**{"content-length": str(25 * 1024 * 1024 + 1)}),
        content=FIXTURE_PNG,
    ).status_code == 413


def test_openapi_contract_matches_committed_service_contract() -> None:
    committed = Path(__file__).parents[2] / "spec-kit" / "specs" / "005-ocr-parsing" / "contracts" / "ocr-engine.openapi.yaml"
    text = committed.read_text(encoding="utf-8")
    for token in (
        "ocr-lines-v1",
        "CV_IMPORT",
        "JOB_IMAGE_SEARCH",
        "PP-OCRv6-medium",
        "onnxruntime",
        "26214400",
        "65536",
        "2000",
    ):
        assert token in text
    assert sha256(text.encode("utf-8")).hexdigest()


def test_unix_socket_is_group_private(tmp_path: Path) -> None:
    socket_path = tmp_path / "ocr.sock"
    uds_socket = bind_private_unix_socket(str(socket_path))
    try:
        metadata = socket_path.stat()
        assert S_ISSOCK(metadata.st_mode)
        assert S_IMODE(metadata.st_mode) == 0o660
    finally:
        uds_socket.close()
        socket_path.unlink(missing_ok=True)
