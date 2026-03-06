# 🚀 Deployment Guide

## Quick Start

**The repo auto-detects your deployment preference:**

| If you... | Then... |
|-----------|---------|
| Add `OPENAI_API_KEY` secret to GitHub | → GitHub Pages deploys automatically |
| Don't add the secret | → Workflow skips, use Vercel instead |

---

## Option 1: GitHub Pages (Automatic)

**Best for:** Free hosting, fully automatic

### Setup (2 steps)

1. **Add your OpenAI API key:**
   - Go to repo **Settings → Secrets → Actions → New secret**
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key

2. **Enable GitHub Pages:**
   - Go to repo **Settings → Pages**
   - Source: `gh-pages` branch
   - Click Save

**That's it!** Every push to `main` will:
- Translate agents to 18 languages
- Build the index
- Deploy to GitHub Pages

### Custom Domain (Optional)

```bash
# Update CNAME file with your domain
echo "agents.yourdomain.com" > CNAME
git add CNAME && git commit -m "Set custom domain" && git push
```

Then add DNS: `CNAME` record pointing to `[username].github.io`

---

## Option 2: Vercel (Manual Setup)

**Best for:** CORS control, analytics, rate limiting

### Setup (5 steps)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your repository
3. Configure:
   | Setting | Value |
   |---------|-------|
   | Framework | Other |
   | Build Command | `bun run build` |
   | Output Directory | `public` |
4. Add environment variable: `OPENAI_API_KEY`
5. Deploy!

### Benefits

- ✅ CORS control (restrict which sites can access your agents)
- ✅ Analytics and usage metrics
- ✅ Rate limiting
- ✅ Faster global CDN

The included `vercel.json` has sensible defaults for CORS and caching.

---

## Comparison

| Feature | GitHub Pages | Vercel |
|---------|--------------|--------|
| Cost | Free | Free tier |
| Setup | Add 1 secret | Import + configure |
| CORS Control | ❌ | ✅ |
| Analytics | ❌ | ✅ |
| Custom Domain | ✅ | ✅ |
| Auto-deploy | ✅ | ✅ |

---

## FAQ

**Q: What if I don't add the OpenAI secret?**
A: The GitHub Action will skip gracefully and show instructions for Vercel.

**Q: Can I use both?**
A: Yes, but they'll serve the same content. Pick one.

**Q: How do I switch from GitHub Pages to Vercel?**
A: Just import to Vercel. Optionally remove the secret from GitHub to stop those builds.

**Q: What's the OPENAI_API_KEY for?**
A: Translating your agents to 18 languages automatically.

