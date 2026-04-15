const HTML_CONTENT_TYPE = "text/html; charset=utf-8";
const SVG_CONTENT_TYPE = "image/svg+xml; charset=utf-8";

export function buildIndexResponse(indexHtml) {
  return new Response(indexHtml, {
    headers: {
      "content-type": HTML_CONTENT_TYPE,
      "cache-control": "no-store",
    },
  });
}

export function buildFaviconResponse(faviconSvg) {
  return new Response(faviconSvg, {
    headers: {
      "content-type": SVG_CONTENT_TYPE,
      "cache-control": "public, max-age=86400",
    },
  });
}

export function createWorker(indexHtml, assets = {}) {
  return {
    fetch(request) {
      const url = new URL(request.url);

      if (url.pathname.endsWith("/favicon-inverted.svg") && assets.faviconSvg) {
        return buildFaviconResponse(assets.faviconSvg);
      }

      return buildIndexResponse(indexHtml);
    },
  };
}
