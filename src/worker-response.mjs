const HTML_CONTENT_TYPE = "text/html; charset=utf-8";

export function buildIndexResponse(indexHtml) {
  return new Response(indexHtml, {
    headers: {
      "content-type": HTML_CONTENT_TYPE,
      "cache-control": "no-store",
    },
  });
}

export function createWorker(indexHtml) {
  return {
    fetch() {
      return buildIndexResponse(indexHtml);
    },
  };
}

