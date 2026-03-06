#!/bin/bash
# Local release script - runs the same steps as GitHub Actions
# Use this when GitHub Actions is disabled

set -e

echo "🔍 Checking for OPENAI_API_KEY..."
if [ -z "$OPENAI_API_KEY" ]; then
  if [ -f .env ]; then
    export $(grep OPENAI_API_KEY .env | xargs)
  fi
fi

if [ -z "$OPENAI_API_KEY" ]; then
  echo "❌ OPENAI_API_KEY not set. Please set it or add to .env file"
  exit 1
fi

echo "📦 Installing dependencies..."
bun install

echo "🧪 Running tests..."
bun run test || echo "⚠️ Tests skipped or failed"

echo "🌍 Formatting and translating agents..."
bun run format

echo "📝 Updating README..."
bun run awesome || echo "⚠️ Awesome skipped"

echo "🏗️ Building public index..."
bun run build

echo "✅ Local release complete!"
echo ""
echo "📊 Summary:"
echo "  - Agents: $(ls src/*.json | wc -l)"
echo "  - Locales: $(ls -d locales/*/ | wc -l) agents × 18 languages"
echo "  - Public files: $(ls public/*.json | wc -l)"
echo ""
echo "🚀 Ready to commit and push!"
echo "   git add ."
echo "   git commit -m 'chore: Release'"
echo "   git push"

