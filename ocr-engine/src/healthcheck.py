from __future__ import annotations

import json
import os
import socket
import sys


def main() -> int:
    path = os.environ.get("OCR_SOCKET_PATH", "/run/smarthire-ocr/ocr.sock")
    request = b"GET /health/ready HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
            client.settimeout(2)
            client.connect(path)
            client.sendall(request)
            response = client.recv(16_384)
    except OSError:
        return 1
    if b" 200 " not in response.split(b"\r\n", 1)[0]:
        return 1
    body = response.split(b"\r\n\r\n", 1)[-1]
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeDecodeError):
        return 1
    return 0 if payload.get("status") == "ready" else 1


if __name__ == "__main__":
    sys.exit(main())
