#!/bin/sh
set -eu

test "${CI_COMMIT_BRANCH:-}" = "develop" || { echo "Release images may only be produced from develop." >&2; exit 1; }
test "${CI_COMMIT_REF_PROTECTED:-}" = "true" || { echo "develop must be protected." >&2; exit 1; }
printf '%s' "$CI_COMMIT_SHA" | grep -Eq '^[0-9a-f]{40}$'

resolve_digest() {
  repository=$1
  tag=$2
  docker pull "$repository:$tag" >/dev/null
  docker image inspect "$repository:$tag" --format '{{range .RepoDigests}}{{println .}}{{end}}' |
    awk -v prefix="$repository@" 'index($0,prefix)==1 {print substr($0,length(prefix)+1); exit}'
}

web_digest=$(resolve_digest "$WEB_IMAGE_REPOSITORY" "$CI_COMMIT_SHA")
ai_digest=$(resolve_digest "$AI_IMAGE_REPOSITORY" "$CI_COMMIT_SHA")
test -n "$web_digest" && test -n "$ai_digest"

mkdir -p release
cat > release/release.env <<EOF
RELEASE_SOURCE_BRANCH=develop
RELEASE_SOURCE_SHA=$CI_COMMIT_SHA
RELEASE_PIPELINE_ID=$CI_PIPELINE_ID
RELEASE_IMAGE_TAG=$CI_COMMIT_SHA
WEB_IMAGE_REPOSITORY=$WEB_IMAGE_REPOSITORY
WEB_IMAGE_DIGEST=$web_digest
AI_IMAGE_REPOSITORY=$AI_IMAGE_REPOSITORY
AI_IMAGE_DIGEST=$ai_digest
EOF

scripts/ci/validate-release-env.sh release/release.env
