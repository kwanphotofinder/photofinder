#!/bin/sh
set -eu

ci=.gitlab-ci.yml
grep -q 'CI_COMMIT_SHA' "$ci"
grep -q 'CI_COMMIT_BRANCH == "develop"' "$ci"
grep -q 'CI_COMMIT_BRANCH == "production"' "$ci"
grep -q 'resolve-production-release.sh' "$ci"
grep -q 'verify-image-digest.sh' "$ci"
grep -q 'RECREATE_LEGACY_PRODUCTION' "$ci"
grep -q 'replace-legacy-production, optional: true' "$ci"
! grep -Eq 'CI_COMMIT_SHORT_SHA|production-latest|CI_COMMIT_BRANCH == "main"|ci/production-auto-deploy' "$ci"
! grep -R -n 'production-latest' deploy/helm/photofinder/values.yaml deploy/values/prod.yaml
grep -q 'RepoDigests' scripts/ci/verify-image-digest.sh

for script in scripts/ci/*.sh; do
  if head -1 "$script" | grep -q 'bash'; then
    bash -n "$script"
  else
    sh -n "$script"
  fi
done
