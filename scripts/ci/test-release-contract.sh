#!/bin/sh
set -eu

fixture_dir=$(mktemp -d "${TMPDIR:-/tmp}/photofinder-release-test.XXXXXX")
valid="$fixture_dir/valid.env"
cat > "$valid" <<'EOF'
RELEASE_SOURCE_BRANCH=develop
RELEASE_SOURCE_SHA=1111111111111111111111111111111111111111
RELEASE_PIPELINE_ID=123
RELEASE_IMAGE_TAG=1111111111111111111111111111111111111111
WEB_IMAGE_REPOSITORY=hub-registry.mfu.ac.th/photofinder/web
WEB_IMAGE_DIGEST=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
AI_IMAGE_REPOSITORY=hub-registry.mfu.ac.th/photofinder/ai-service
AI_IMAGE_DIGEST=sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
EOF
sh scripts/ci/validate-release-env.sh "$valid"

bad_digest="$fixture_dir/bad-digest.env"
sed 's/AI_IMAGE_DIGEST=.*/AI_IMAGE_DIGEST=sha256:1234/' "$valid" > "$bad_digest"
if sh scripts/ci/validate-release-env.sh "$bad_digest" >/dev/null 2>&1; then
  echo "Invalid digest unexpectedly passed." >&2
  exit 1
fi
unexpected="$fixture_dir/unexpected.env"
awk '1; END { print "UNAPPROVED_FIELD=value" }' "$valid" > "$unexpected"
if sh scripts/ci/validate-release-env.sh "$unexpected" >/dev/null 2>&1; then
  echo "Unexpected manifest field passed." >&2
  exit 1
fi

wrong_source="$fixture_dir/wrong-source.env"
sed 's/RELEASE_IMAGE_TAG=.*/RELEASE_IMAGE_TAG=2222222222222222222222222222222222222222/' "$valid" > "$wrong_source"
if sh scripts/ci/validate-release-env.sh "$wrong_source" >/dev/null 2>&1; then
  echo "Source/tag mismatch unexpectedly passed." >&2
  exit 1
fi

