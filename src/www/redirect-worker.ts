// The Worker for vibes.pixelheart.io and www.pixelheart.io. It sends every request to the same path on
// pixelheart.io. The browser keeps the #vibe part of the address across the redirect.
export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);
    url.hostname = "pixelheart.io";
    url.protocol = "https:";
    return Response.redirect(url.href, 301);
  },
};
