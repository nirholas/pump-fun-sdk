export const config = { runtime: 'edge' };

/**
 * Get list of active grant programs
 * 
 * Parameters:
 * // category: string - Filter by category (defi, infrastructure, tooling)
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    
    // TODO: Implement getActiveGrants logic here
    // This is a markdown plugin - return formatted text
    
    const markdown = `## Grants Finder

**Get list of active grant programs**

| Parameter | Value |
|-----------|-------|
${Object.entries(body).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

---
*Implementation pending*
`;

    return new Response(markdown, {
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    return new Response(`## Error\n\n${error instanceof Error ? error.message : 'Unknown error'}`, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
