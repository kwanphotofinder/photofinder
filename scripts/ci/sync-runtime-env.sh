#!/usr/bin/env bash
set -euo pipefail

: "${KUBE_NAMESPACE_PROD:=mfu-apps-prod}"
: "${K8S_RUNTIME_SECRET_PROD:=photofinder-runtime}"

env_file=""
cleanup() { [ -z "$env_file" ] || [ "${RUNTIME_ENV_FILE_PROD:-}" = "$env_file" ] || rm -f "$env_file"; }
trap cleanup EXIT

if [ -n "${RUNTIME_ENV_FILE_PROD:-}" ]; then
  env_file="$RUNTIME_ENV_FILE_PROD"
elif [ -n "${RUNTIME_ENV_BASE64_PROD:-}" ]; then
  env_file=$(mktemp)
  printf '%s' "$RUNTIME_ENV_BASE64_PROD" | base64 -d > "$env_file"
fi

if [ -n "$env_file" ]; then
  test -s "$env_file" || (echo "Production runtime env file is empty." >&2 && exit 1)
  kubectl create secret generic "$K8S_RUNTIME_SECRET_PROD" \
    --namespace "$KUBE_NAMESPACE_PROD" \
    --from-env-file="$env_file" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
else
  kubectl get secret "$K8S_RUNTIME_SECRET_PROD" -n "$KUBE_NAMESPACE_PROD" >/dev/null
fi

required_keys=(DATABASE_URL DIRECT_URL JWT_SECRET SUPER_ADMIN_EMAIL NEXT_PUBLIC_GOOGLE_CLIENT_ID GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET CLOUDINARY_URL)
for key in "${required_keys[@]}"; do
  value=$(kubectl get secret "$K8S_RUNTIME_SECRET_PROD" -n "$KUBE_NAMESPACE_PROD" -o "jsonpath={.data.$key}")
  test -n "$value" || (echo "Runtime secret is missing required key: $key" >&2 && exit 1)
done

echo "Production runtime secret is present and contains all required keys."

