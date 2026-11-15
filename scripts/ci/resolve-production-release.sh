#!/bin/sh
set -eu

test "${CI_COMMIT_BRANCH:-}" = "production" || { echo "Resolver only runs on production." >&2; exit 1; }
test "${CI_COMMIT_REF_PROTECTED:-}" = "true" || { echo "production must be protected." >&2; exit 1; }

git fetch --quiet origin develop
develop_ref=$(git rev-parse FETCH_HEAD)
source_sha=''
if git rev-parse -q --verify "$CI_COMMIT_SHA^2" >/dev/null; then
  source_sha=$(git rev-parse "$CI_COMMIT_SHA^2")
else
  source_sha=$CI_COMMIT_SHA
fi
git merge-base --is-ancestor "$source_sha" "$develop_ref" || {
  echo "Production commit is not promoted from develop." >&2
  exit 1
}

mkdir -p release
url="$CI_API_V4_URL/projects/$CI_PROJECT_ID/packages/generic/photofinder-release/$source_sha/release.env"
curl -fsS --header "JOB-TOKEN: $CI_JOB_TOKEN" "$url" -o release/release.env || {
  echo "No immutable develop release manifest exists for $source_sha." >&2
  exit 1
}

EXPECTED_RELEASE_SOURCE_SHA=$source_sha \
EXPECTED_WEB_IMAGE_REPOSITORY=$WEB_IMAGE_REPOSITORY \
EXPECTED_AI_IMAGE_REPOSITORY=$AI_IMAGE_REPOSITORY \
  scripts/ci/validate-release-env.sh release/release.env
