
# OPS API — Backend com CORS + Dockerfile (Koyeb)

**Use Dockerfile no Koyeb** para não precisar de lockfile.

Passos rápidos:
1) Suba estes arquivos para a raiz do repositório no GitHub.
2) Koyeb → Create Service → Source: GitHub → **Builder: Dockerfile**.
3) Ports: HTTP 8080, Public HTTPS access ✓, Health check: HTTP `/healthz` (Grace 20s).
4) Env vars: FB_PIXEL_ID, FB_ACCESS_TOKEN, TEST_EVENT_CODE, GEMINI_API_KEY, GEMINI_MODEL.
5) Deploy e copie a URL pública para usar no frontend como `NEXT_PUBLIC_API_BASE`.
