#!/bin/sh
set -eu

readonly CLAMAV_UID="100"
readonly CLAMAV_GID="101"
readonly RUNTIME_DIR="/run/clamav"
readonly SOCKET_PATH="${RUNTIME_DIR}/clamd.sock"
readonly DATABASE_DIR="/var/lib/clamav"
readonly CLAMD_CONFIG="/etc/clamav/clamd.conf"
readonly FRESHCLAM_CONFIG="/etc/clamav/freshclam.conf"
readonly STARTUP_TIMEOUT="${CLAMD_STARTUP_TIMEOUT_SECONDS:-1800}"
readonly FRESHCLAM_CHECKS="${FRESHCLAM_CHECKS_PER_DAY:-12}"

if [ "$(id -u clamav)" != "${CLAMAV_UID}" ] || [ "$(id -g clamav)" != "${CLAMAV_GID}" ]; then
  echo "ClamAV image user/group IDs do not match the reviewed shared socket contract." >&2
  exit 1
fi

install -d -o clamav -g clamav -m 0770 "${RUNTIME_DIR}"
install -d -o clamav -g clamav -m 0750 "${DATABASE_DIR}"
rm -f "${SOCKET_PATH}"

# A persistent volume can contain a complete but stale database. Always finish
# one successful foreground refresh before starting either long-running
# process. With `set -e`, an update failure stops the container fail-closed.
freshclam \
  --stdout \
  --user=clamav \
  --config-file="${FRESHCLAM_CONFIG}"

freshclam \
  --daemon \
  --foreground \
  --stdout \
  --user=clamav \
  --checks="${FRESHCLAM_CHECKS}" \
  --config-file="${FRESHCLAM_CONFIG}" &
freshclam_pid=$!

clamd --foreground --config-file="${CLAMD_CONFIG}" &
clamd_pid=$!

shutdown() {
  if [ -n "${clamd_pid}" ]; then
    kill -TERM "${clamd_pid}" 2>/dev/null || true
    wait "${clamd_pid}" 2>/dev/null || true
  fi
  if [ -n "${freshclam_pid}" ]; then
    kill -TERM "${freshclam_pid}" 2>/dev/null || true
    wait "${freshclam_pid}" 2>/dev/null || true
  fi
}
trap shutdown INT TERM EXIT

elapsed=0
while [ ! -S "${SOCKET_PATH}" ]; do
  if ! kill -0 "${clamd_pid}" 2>/dev/null; then
    echo "clamd exited before creating its Unix socket." >&2
    wait "${clamd_pid}"
    exit 1
  fi

  if [ "${elapsed}" -ge "${STARTUP_TIMEOUT}" ]; then
    echo "clamd did not create its Unix socket before the startup timeout." >&2
    exit 1
  fi

  sleep 1
  elapsed=$((elapsed + 1))
done

chmod 0660 "${SOCKET_PATH}"
chown clamav:clamav "${SOCKET_PATH}"

while kill -0 "${clamd_pid}" 2>/dev/null && kill -0 "${freshclam_pid}" 2>/dev/null; do
  sleep 5
done

echo "A required ClamAV process exited unexpectedly." >&2
exit 1
