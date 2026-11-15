#!/bin/sh
set -eu

repository=${1:?repository is required}
tag=${2:?tag is required}
expected_digest=${3:?digest is required}

printf '%s' "$expected_digest" | grep -Eq '^sha256:[0-9a-f]{64}$'
docker pull "$repository:$tag" >/dev/null
docker image inspect "$repository:$tag" --format '{{range .RepoDigests}}{{println .}}{{end}}' |
  grep -Fx "$repository@$expected_digest" >/dev/null || {
    echo "Registry digest mismatch for $repository:$tag" >&2
    exit 1
  }
