export function onRequestGet({request}) {
  const origin = new URL(request.url).origin;
  const body = `User-agent: *\nAllow: /\nAllow: /llms.txt\nAllow: /ai-index.json\nDisallow: /checkout.html\nDisallow: /payment-result.html\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`;
  return new Response(body,{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=3600'}});
}
