#!/usr/bin/env bash
# Deploy the PolicyTracer Lambda (policy-service) to AWS
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - AWS SAM CLI installed (brew install aws-sam-cli)
#   - Node.js 22+ and npm installed
#
# Usage:
#   export MONGO_URI="mongodb+srv://..."   # or it will be read from backend/.env
#   ./deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Resolve MONGO_URI ─────────────────────────────────────────────────────────
if [[ -z "${MONGO_URI:-}" ]]; then
  ENV_FILE="$SCRIPT_DIR/../backend/.env"
  if [[ -f "$ENV_FILE" ]]; then
    MONGO_URI=$(grep -E '^MONGO_URI=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
  fi
fi

if [[ -z "${MONGO_URI:-}" ]]; then
  echo "ERROR: MONGO_URI is not set. Export it or add it to backend/.env"
  exit 1
fi

echo "▶ Installing dependencies..."
npm install

echo "▶ Building Lambda bundle (esbuild)..."
npm run build

echo "▶ Deploying with SAM..."
sam deploy \
  --parameter-overrides "MongoUri=${MONGO_URI}" \
  --no-confirm-changeset

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Copy the 'PolicyApiUrl' output above"
echo "  2. Add to backend/.env:"
echo "       POLICY_LAMBDA_URL=<PolicyApiUrl>"
echo "       CW_LOG_GROUPS=/aws/lambda/policy-service"
echo "  3. Restart the local backend: npm run dev (in backend/)"
