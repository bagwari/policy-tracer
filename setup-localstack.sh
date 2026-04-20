#!/usr/bin/env bash
# setup-localstack.sh — creates mock CloudWatch log groups in LocalStack
# Run after docker-compose up: ./setup-localstack.sh

set -e
ENDPOINT="http://localhost:4566"
REGION="us-east-1"

echo "⚙️  Setting up LocalStack CloudWatch Log Groups..."

aws --endpoint-url=$ENDPOINT --region=$REGION logs create-log-group \
  --log-group-name /app/policy-api 2>/dev/null || true

aws --endpoint-url=$ENDPOINT --region=$REGION logs create-log-group \
  --log-group-name /aws/lambda/policy-service 2>/dev/null || true

aws --endpoint-url=$ENDPOINT --region=$REGION logs create-log-group \
  --log-group-name /aws/ecs/policy-processor 2>/dev/null || true

echo "✅  Log groups created"

# Inject a sample log event with a known correlationId so you can test immediately
CORRELATION_ID="demo-trace-$(date +%s)"
echo "📝  Injecting test log events with correlationId: $CORRELATION_ID"

aws --endpoint-url=$ENDPOINT --region=$REGION logs put-log-events \
  --log-group-name /app/policy-api \
  --log-stream-name policy-api-stream-001 \
  --log-events \
    "timestamp=$(date +%s000),message={\"level\":\"info\",\"correlationId\":\"$CORRELATION_ID\",\"msg\":\"Policy check initiated\",\"policyNumber\":\"POL-2024-AUTO-001\"}" \
    "timestamp=$(($(date +%s)+1))000,message={\"level\":\"info\",\"correlationId\":\"$CORRELATION_ID\",\"msg\":\"MongoDB query executed\",\"duration\":\"12ms\"}" \
    "timestamp=$(($(date +%s)+2))000,message={\"level\":\"info\",\"correlationId\":\"$CORRELATION_ID\",\"msg\":\"Response sent\",\"statusCode\":200}" \
  2>/dev/null || true

echo ""
echo "🎯  Test with this correlationId in the UI:"
echo "    $CORRELATION_ID"
