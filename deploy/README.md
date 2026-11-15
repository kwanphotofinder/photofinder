# Production deployment

`production` is the only runtime environment. The release path uses two protected branches and does not use `main`:

1. Feature merge requests enter `develop` after validation and tests.
2. A protected `develop` push runs the full gates, builds Web and AI exactly once, tags both images with the full source SHA, verifies Harbor `RepoDigests`, scans them, and publishes an immutable release manifest to the GitLab Generic Package Registry.
3. A reviewed `develop` -> `production` merge resolves the manifest for the exact merged source SHA, verifies both digests again, and deploys `repository@digest` without rebuilding or retagging.
4. Helm deploys atomically and the verification job checks rollout status, workload images, pod image IDs, ingress, and AI health at `https://photofinder.mfu.ac.th`.

Merge request pipelines run validation and tests only. Direct pushes to `develop` and `production` must be disabled in GitLab branch protection. Configure merge commits or fast-forward merges for `develop` -> `production`; squash-only production merges cannot preserve the exact release-source lineage expected by the resolver.

Required protected GitLab CI/CD variables:

- `HARBOR_USERNAME`, `HARBOR_PASSWORD`
- `KUBE_CONFIG_PROD` as a file variable scoped to `production`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for the protected `develop` build
- `RUNTIME_ENV_FILE_PROD` as a protected file variable containing the production environment, or `RUNTIME_ENV_BASE64_PROD` containing the same file encoded as base64

The runtime file must include at least:

- `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`
- `SUPER_ADMIN_EMAIL`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `CLOUDINARY_URL`

Optional integrations such as Groq, Gmail, and LINE remain in the same runtime file. The pipeline creates or updates the `photofinder-runtime` Kubernetes secret without logging values. Removing the CI env variable later does not delete the existing Kubernetes secret; it switches the job to presence/readiness validation.

The generic helper can also create or update individual GitLab variables without committing their values:

```sh
GITLAB_TOKEN=... CI_PROJECT_ID=... scripts/ci/upsert-gitlab-variable.sh NEXT_PUBLIC_GOOGLE_CLIENT_ID 'client-id'
```

Kubernetes mapping:

- namespace: `mfu-apps-prod`
- release: `photofinder`
- deployments: `photofinder-web`, `photofinder-ai`
- ingress: `photofinder.mfu.ac.th`
- runtime secret: `photofinder-runtime`
- image pull secret: `harbor-registry`
- deploy identity: namespace-scoped service account `photofinder-gitlab-deployer`, bootstrapped from `deploy/rbac/photofinder-gitlab-deployer.yaml`

Rollback is an explicit manual CI job and runs `helm rollback` for the production release.

## Initial replacement of a legacy release

Do not uninstall the live release as part of every pipeline. For the one-time replacement, run the reviewed `production` pipeline with protected variable `RECREATE_LEGACY_PRODUCTION=true`. The pipeline captures non-secret Helm/workload/ingress evidence, verifies namespace-scoped RBAC, runtime and pull Secrets, and the new immutable manifest, then removes only the exact `photofinder` Helm release before installing the new chart. If that exact release is absent, the destructive job fails closed instead of guessing resource names. A missing kubeconfig, concurrent deployment, missing baseline, or failed authorization check stops the cutover. Leave the variable unset for every later release so normal atomic upgrades preserve Helm history.
