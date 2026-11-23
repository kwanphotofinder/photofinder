#!/bin/sh
set -eu

sh scripts/ci/validate-release-env.sh release/release.env
url="$CI_API_V4_URL/projects/$CI_PROJECT_ID/packages/generic/photofinder-release/$RELEASE_SOURCE_SHA/release.env"
tmp_file=$(mktemp)
trap 'rm -f "$tmp_file"' EXIT
status=$(curl -sS -o "$tmp_file" -w '%{http_code}' --header "JOB-TOKEN: $CI_JOB_TOKEN" "$url")
case "$status" in
  200)
    cmp -s release/release.env "$tmp_file" || { echo "A different release manifest already exists for $RELEASE_SOURCE_SHA." >&2; exit 1; }
    ;;
  404)
    curl -fsS --header "JOB-TOKEN: $CI_JOB_TOKEN" --upload-file release/release.env "$url" >/dev/null
    ;;
  *)
    echo "Unable to inspect release manifest package (HTTP $status)." >&2
    exit 1
    ;;
esac
