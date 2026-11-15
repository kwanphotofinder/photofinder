#!/bin/sh
set -eu

release_file=${1:-release/release.env}
test -s "$release_file" || { echo "Release manifest is missing: $release_file" >&2; exit 1; }

allowed='RELEASE_SOURCE_BRANCH RELEASE_SOURCE_SHA RELEASE_PIPELINE_ID RELEASE_IMAGE_TAG WEB_IMAGE_REPOSITORY WEB_IMAGE_DIGEST AI_IMAGE_REPOSITORY AI_IMAGE_DIGEST'
seen=''
while IFS= read -r line || test -n "$line"; do
  test -n "$line" || continue
  key=${line%%=*}
  value=${line#*=}
  test "$key" != "$line" || { echo "Malformed release manifest line." >&2; exit 1; }
  case " $allowed " in *" $key "*) ;; *) echo "Unexpected release manifest key: $key" >&2; exit 1 ;; esac
  case " $seen " in *" $key "*) echo "Duplicate release manifest key: $key" >&2; exit 1 ;; esac
  test -n "$value" || { echo "Release manifest value is empty: $key" >&2; exit 1; }
  seen="$seen $key"
done < "$release_file"

for key in $allowed; do
  case " $seen " in *" $key "*) ;; *) echo "Release manifest is missing key: $key" >&2; exit 1 ;; esac
done

case "$release_file" in */*) manifest_path=$release_file ;; *) manifest_path=./$release_file ;; esac
set -a
. "$manifest_path"
set +a

test "$RELEASE_SOURCE_BRANCH" = "develop" || { echo "Release source must be develop." >&2; exit 1; }
printf '%s' "$RELEASE_SOURCE_SHA" | grep -Eq '^[0-9a-f]{40}$' || { echo "Release source SHA must be a full commit SHA." >&2; exit 1; }
test "$RELEASE_IMAGE_TAG" = "$RELEASE_SOURCE_SHA" || { echo "Release image tag must equal the source SHA." >&2; exit 1; }
printf '%s' "$RELEASE_PIPELINE_ID" | grep -Eq '^[0-9]+$' || { echo "Release pipeline ID is invalid." >&2; exit 1; }
printf '%s' "$WEB_IMAGE_DIGEST" | grep -Eq '^sha256:[0-9a-f]{64}$' || { echo "Web digest is invalid." >&2; exit 1; }
printf '%s' "$AI_IMAGE_DIGEST" | grep -Eq '^sha256:[0-9a-f]{64}$' || { echo "AI digest is invalid." >&2; exit 1; }

test -z "${EXPECTED_RELEASE_SOURCE_SHA:-}" || test "$RELEASE_SOURCE_SHA" = "$EXPECTED_RELEASE_SOURCE_SHA" || {
  echo "Release manifest does not match the merged develop commit." >&2
  exit 1
}
test -z "${EXPECTED_WEB_IMAGE_REPOSITORY:-}" || test "$WEB_IMAGE_REPOSITORY" = "$EXPECTED_WEB_IMAGE_REPOSITORY" || exit 1
test -z "${EXPECTED_AI_IMAGE_REPOSITORY:-}" || test "$AI_IMAGE_REPOSITORY" = "$EXPECTED_AI_IMAGE_REPOSITORY" || exit 1
