/**
 * Worker that serves videos from R2 with proper HTTP range request support.
 * Only handles /videos/* requests — everything else falls through to static assets.
 *
 * iOS Safari requires 206 Partial Content responses to play video.
 * Cloudflare Pages strips Accept-Ranges headers, so we need this Worker.
 */

interface Env {
  VIDEOS: R2Bucket;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Only handle /videos/* — everything else goes to static assets
    if (!url.pathname.startsWith('/videos/')) {
      return env.ASSETS.fetch(request);
    }

    const key = url.pathname.replace('/videos/', '');
    if (!key) return new Response('Not Found', { status: 404 });

    // HEAD request — iOS Safari probes with HEAD before range-requesting video
    if (request.method === 'HEAD') {
      const head = await env.VIDEOS.head(key);
      if (!head) return env.ASSETS.fetch(request); // Fallback to static assets
      return new Response(null, {
        status: 200,
        headers: {
          'Content-Length': head.size.toString(),
          'Content-Type': contentType(key),
          'Accept-Ranges': 'bytes',
          'ETag': head.etag,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    const rangeHeader = request.headers.get('Range');

    // Full request (no Range header)
    if (!rangeHeader) {
      const object = await env.VIDEOS.get(key);
      if (!object) return env.ASSETS.fetch(request); // Fallback to static assets
      return new Response(object.body, {
        status: 200,
        headers: {
          'Content-Length': object.size.toString(),
          'Content-Type': contentType(key),
          'Accept-Ranges': 'bytes',
          'ETag': object.etag,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // Range request — parse "bytes=START-END"
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (!match) return new Response('Bad Range', { status: 416 });

    const head = await env.VIDEOS.head(key);
    if (!head) return env.ASSETS.fetch(request); // Fallback to static assets
    const totalSize = head.size;

    let start: number;
    let end: number;

    if (match[1] === '' && match[2] !== '') {
      // Suffix range: "bytes=-500" → last 500 bytes
      const suffix = parseInt(match[2], 10);
      start = totalSize - suffix;
      end = totalSize - 1;
    } else {
      start = parseInt(match[1], 10);
      end = match[2] !== '' ? parseInt(match[2], 10) : totalSize - 1;
    }

    end = Math.min(end, totalSize - 1);

    if (start >= totalSize || start < 0) {
      return new Response('Range Not Satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${totalSize}` },
      });
    }

    const length = end - start + 1;

    const object = await env.VIDEOS.get(key, {
      range: { offset: start, length },
    });
    if (!object) return new Response('Not Found', { status: 404 });

    return new Response(object.body, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': length.toString(),
        'Content-Type': contentType(key),
        'Accept-Ranges': 'bytes',
        'ETag': head.etag,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  },
} satisfies ExportedHandler<Env>;

function contentType(key: string): string {
  if (key.endsWith('.webm')) return 'video/webm';
  if (key.endsWith('.mp4')) return 'video/mp4';
  return 'application/octet-stream';
}
