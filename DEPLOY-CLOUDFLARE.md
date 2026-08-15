# Deploy Resource Bank v7.0 to Cloudflare

This is a Worker + Static Assets project, not a static-only ZIP.

## Recommended deployment

From this project folder on a computer with Node.js:

1. `npm install`
2. `npx wrangler login`
3. `npx wrangler deploy`
4. Add the OpenAI secret once:
   `npx wrangler secret put OPENAI_API_KEY`

Paste the OpenAI API key only when Wrangler prompts you.

You can also add the secret afterward in:
Cloudflare Dashboard → Workers & Pages → resource-bank → Settings → Variables and secrets

Secret name:
`OPENAI_API_KEY`

Optional normal variable:
`OPENAI_MODEL`

If no model variable is set, Resource Bank uses `gpt-5-mini`.

## Verify

Open Resource Bank → Settings → AI Backend → Check AI Connection.

After the secret is configured, it should report that the Worker is active and the API key is configured.

## Important

Do not use the old static drag-and-drop upload for this build. That creates a static-assets-only Worker,
which is exactly why Cloudflare would not let you add Variables and secrets.

This package deliberately excludes restricted Distribution D C-17 technical-order content and its
extracted technical data from the public Cloudflare deployment.
