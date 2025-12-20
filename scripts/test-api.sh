#!/bin/bash
source .env.local 2>/dev/null || true
if [ -z "$GOOGLE_GENERATIVE_AI_API_KEY" ]; then
  export $(grep GOOGLE_GENERATIVE_AI_API_KEY .env.local | xargs)
fi
echo "Testing API key..."
echo "Key length: ${#GOOGLE_GENERATIVE_AI_API_KEY}"
echo "Key prefix: ${GOOGLE_GENERATIVE_AI_API_KEY:0:4}..."
echo ""
echo "Listing available models:"
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_GENERATIVE_AI_API_KEY" | head -100
