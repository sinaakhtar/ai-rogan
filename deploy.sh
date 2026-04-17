#!/bin/bash

# Get current project ID
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
  echo "Error: No active Google Cloud project found. Please run 'gcloud config set project <PROJECT_ID>'"
  exit 1
fi

REGION="us-central1" # Default region

echo "Using project: $PROJECT_ID"
echo "Using region: $REGION"

# 1. Deploy Backend
echo "Deploying backend..."
cd backend
gcloud run deploy ai-rogan-backend \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT_ID

if [ $? -ne 0 ]; then
  echo "Backend deployment failed."
  exit 1
fi

# 2. Get Backend URL
BACKEND_URL=$(gcloud run services describe ai-rogan-backend --region $REGION --format 'value(status.url)')
echo "Backend deployed at: $BACKEND_URL"

# 3. Deploy Frontend
echo "Deploying frontend..."
cd ..
gcloud run deploy ai-rogan-frontend \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_API_URL=$BACKEND_URL

if [ $? -ne 0 ]; then
  echo "Frontend deployment failed."
  exit 1
fi

echo "Deployment complete!"
