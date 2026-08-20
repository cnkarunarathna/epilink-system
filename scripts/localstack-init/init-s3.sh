#!/usr/bin/env bash
set -euo pipefail

BUCKET="${AWS_S3_BUCKET:-epilink-system}"

if ! awslocal s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  awslocal s3 mb "s3://$BUCKET"
fi

awslocal s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration '{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
      "AllowedHeaders": ["*"]
    }
  ]
}'

echo "LocalStack S3 bucket '$BUCKET' ready."
