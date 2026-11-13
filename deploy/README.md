# Production deployment

`production` is the only deployment branch. A merge or push to this protected branch builds immutable web and AI images tagged with the commit SHA, scans them, synchronizes the runtime secret, deploys with Helm, and verifies `https://photofinder.mfu.ac.th`.

Merge request pipelines run validation and tests only.

Required protected GitLab CI/CD variables:

- `HARBOR_USERNAME`, `HARBOR_PASSWORD`
- `KUBE_CONFIG_PROD` as a file variable scoped to `production`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for the Next.js build
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

Rollback is an explicit manual CI job and runs `helm rollback` for the production release.

Any merge into `production` deploys the app, even if you only change docs.
