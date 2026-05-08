#!/bin/bash
set -e

# EpiLink GCP Secrets Setup Script
# This script creates all secrets in Secret Manager and grants IAM permissions
# Run this once, then re-run the deploy workflow to inject secrets into Cloud Run

echo "================================"
echo "EpiLink GCP Secrets Setup"
echo "================================"
echo ""

# Get project ID
PROJECT_ID="${1}"
if [ -z "$PROJECT_ID" ]; then
  read -p "Enter GCP Project ID (e.g., epilink-495606): " PROJECT_ID
fi

if [ -z "$PROJECT_ID" ]; then
  echo "Error: Project ID is required"
  exit 1
fi

echo "Using Project ID: $PROJECT_ID"
echo ""

# Get deployer service account
DEPLOYER_SA="${2}"
if [ -z "$DEPLOYER_SA" ]; then
  read -p "Enter GitHub Deployer Service Account (e.g., github-deployer@epilink-495606.iam.gserviceaccount.com): " DEPLOYER_SA
fi

if [ -z "$DEPLOYER_SA" ]; then
  echo "Error: Service account is required"
  exit 1
fi

echo "Using Service Account: $DEPLOYER_SA"
echo ""

# Get project number (needed for compute SA)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)' 2>/dev/null || echo "")
if [ -z "$PROJECT_NUMBER" ]; then
  echo "Error: Could not retrieve project number. Check if project exists and you have access."
  exit 1
fi

RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "Using Runtime Service Account: $RUNTIME_SA"
echo ""
echo "================================"
echo "Collecting Secret Values"
echo "================================"
echo ""
echo "Note: Leave blank to skip creating a secret (if you already created it)"
echo ""

# Array to store created secrets
declare -a CREATED_SECRETS

# 1. JWT_SECRET
read -sp "Enter JWT_SECRET (secret key for JWT tokens): " JWT_SECRET
echo ""
if [ ! -z "$JWT_SECRET" ]; then
  echo "Creating JWT_SECRET..."
  gcloud secrets create JWT_SECRET --replication-policy="automatic" --project=$PROJECT_ID 2>/dev/null || echo "  (secret already exists, updating...)"
  printf "%s" "$JWT_SECRET" | gcloud secrets versions add JWT_SECRET --data-file=- --project=$PROJECT_ID > /dev/null
  CREATED_SECRETS+=("JWT_SECRET")
  echo "  ✓ JWT_SECRET created"
fi
echo ""

# 2. PGPASSWORD
read -sp "Enter PGPASSWORD (Heroku Postgres password): " PGPASSWORD
echo ""
if [ ! -z "$PGPASSWORD" ]; then
  echo "Creating PGPASSWORD..."
  gcloud secrets create PGPASSWORD --replication-policy="automatic" --project=$PROJECT_ID 2>/dev/null || echo "  (secret already exists, updating...)"
  printf "%s" "$PGPASSWORD" | gcloud secrets versions add PGPASSWORD --data-file=- --project=$PROJECT_ID > /dev/null
  CREATED_SECRETS+=("PGPASSWORD")
  echo "  ✓ PGPASSWORD created"
fi
echo ""

# 3. REDIS_PASSWORD
read -sp "Enter REDIS_PASSWORD (from VM docker-compose, e.g., ZytgpWDhcFeosIzeheccQsRj4Sq1BOqx): " REDIS_PASSWORD
echo ""
if [ ! -z "$REDIS_PASSWORD" ]; then
  echo "Creating REDIS_PASSWORD..."
  gcloud secrets create REDIS_PASSWORD --replication-policy="automatic" --project=$PROJECT_ID 2>/dev/null || echo "  (secret already exists, updating...)"
  printf "%s" "$REDIS_PASSWORD" | gcloud secrets versions add REDIS_PASSWORD --data-file=- --project=$PROJECT_ID > /dev/null
  CREATED_SECRETS+=("REDIS_PASSWORD")
  echo "  ✓ REDIS_PASSWORD created"
fi
echo ""

# 4. GEMINI_API_KEY
read -sp "Enter GEMINI_API_KEY (Google Gemini API key for chatbot): " GEMINI_API_KEY
echo ""
if [ ! -z "$GEMINI_API_KEY" ]; then
  echo "Creating GEMINI_API_KEY..."
  gcloud secrets create GEMINI_API_KEY --replication-policy="automatic" --project=$PROJECT_ID 2>/dev/null || echo "  (secret already exists, updating...)"
  printf "%s" "$GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=- --project=$PROJECT_ID > /dev/null
  CREATED_SECRETS+=("GEMINI_API_KEY")
  echo "  ✓ GEMINI_API_KEY created"
fi
echo ""

# 5. EXPLAIN_GEMINI_API_KEY
read -sp "Enter EXPLAIN_GEMINI_API_KEY (Google Gemini API key for explain-analytics, can be same as above): " EXPLAIN_GEMINI_API_KEY
echo ""
if [ ! -z "$EXPLAIN_GEMINI_API_KEY" ]; then
  echo "Creating EXPLAIN_GEMINI_API_KEY..."
  gcloud secrets create EXPLAIN_GEMINI_API_KEY --replication-policy="automatic" --project=$PROJECT_ID 2>/dev/null || echo "  (secret already exists, updating...)"
  printf "%s" "$EXPLAIN_GEMINI_API_KEY" | gcloud secrets versions add EXPLAIN_GEMINI_API_KEY --data-file=- --project=$PROJECT_ID > /dev/null
  CREATED_SECRETS+=("EXPLAIN_GEMINI_API_KEY")
  echo "  ✓ EXPLAIN_GEMINI_API_KEY created"
fi
echo ""

# 6. AWS_ACCESS_KEY_ID
read -p "Enter AWS_ACCESS_KEY_ID (for S3 storage): " AWS_ACCESS_KEY_ID
echo ""
if [ ! -z "$AWS_ACCESS_KEY_ID" ]; then
  echo "Creating AWS_ACCESS_KEY_ID..."
  gcloud secrets create AWS_ACCESS_KEY_ID --replication-policy="automatic" --project=$PROJECT_ID 2>/dev/null || echo "  (secret already exists, updating...)"
  printf "%s" "$AWS_ACCESS_KEY_ID" | gcloud secrets versions add AWS_ACCESS_KEY_ID --data-file=- --project=$PROJECT_ID > /dev/null
  CREATED_SECRETS+=("AWS_ACCESS_KEY_ID")
  echo "  ✓ AWS_ACCESS_KEY_ID created"
fi
echo ""

# 7. AWS_SECRET
read -sp "Enter AWS_SECRET (AWS secret access key): " AWS_SECRET
echo ""
if [ ! -z "$AWS_SECRET" ]; then
  echo "Creating AWS_SECRET..."
  gcloud secrets create AWS_SECRET --replication-policy="automatic" --project=$PROJECT_ID 2>/dev/null || echo "  (secret already exists, updating...)"
  printf "%s" "$AWS_SECRET" | gcloud secrets versions add AWS_SECRET --data-file=- --project=$PROJECT_ID > /dev/null
  CREATED_SECRETS+=("AWS_SECRET")
  echo "  ✓ AWS_SECRET created"
fi
echo ""

# 8. ADMIN_API_KEY
read -sp "Enter ADMIN_API_KEY (admin key for chatbot ingest endpoints): " ADMIN_API_KEY
echo ""
if [ ! -z "$ADMIN_API_KEY" ]; then
  echo "Creating ADMIN_API_KEY..."
  gcloud secrets create ADMIN_API_KEY --replication-policy="automatic" --project=$PROJECT_ID 2>/dev/null || echo "  (secret already exists, updating...)"
  printf "%s" "$ADMIN_API_KEY" | gcloud secrets versions add ADMIN_API_KEY --data-file=- --project=$PROJECT_ID > /dev/null
  CREATED_SECRETS+=("ADMIN_API_KEY")
  echo "  ✓ ADMIN_API_KEY created"
fi
echo ""

# 9. ZOHO_SMTP_PASS
read -sp "Enter ZOHO_SMTP_PASS (Zoho email password): " ZOHO_SMTP_PASS
echo ""
if [ ! -z "$ZOHO_SMTP_PASS" ]; then
  echo "Creating ZOHO_SMTP_PASS..."
  gcloud secrets create ZOHO_SMTP_PASS --replication-policy="automatic" --project=$PROJECT_ID 2>/dev/null || echo "  (secret already exists, updating...)"
  printf "%s" "$ZOHO_SMTP_PASS" | gcloud secrets versions add ZOHO_SMTP_PASS --data-file=- --project=$PROJECT_ID > /dev/null
  CREATED_SECRETS+=("ZOHO_SMTP_PASS")
  echo "  ✓ ZOHO_SMTP_PASS created"
fi
echo ""

echo "================================"
echo "Granting IAM Permissions"
echo "================================"
echo ""

# Grant deployer SA access to read secrets
echo "Granting $DEPLOYER_SA access to Secret Manager..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$DEPLOYER_SA" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet 2>/dev/null || echo "  (already granted or role update)"
echo "  ✓ Deployer SA can read secrets"
echo ""

# Grant runtime SA access to read secrets
echo "Granting $RUNTIME_SA access to Secret Manager..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet 2>/dev/null || echo "  (already granted or role update)"
echo "  ✓ Runtime SA can read secrets"
echo ""

echo "================================"
echo "✓ Setup Complete!"
echo "================================"
echo ""
echo "Created ${#CREATED_SECRETS[@]} secrets:"
for secret in "${CREATED_SECRETS[@]}"; do
  echo "  - $secret"
done
echo ""
echo "Next steps:"
echo "1. Go to GitHub → Settings → Secrets → update any GitHub-only secrets if needed"
echo "2. Re-run the deploy workflow: Actions → Deploy → Re-run jobs"
echo "3. The deploy workflow will now inject all secrets into Cloud Run services"
echo ""
echo "To verify secrets were created:"
echo "  gcloud secrets list --project=$PROJECT_ID"
echo ""
