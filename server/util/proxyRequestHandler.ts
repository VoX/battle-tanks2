export async function proxyRequestHandler(req: Request, proxyUrl: URL) {
  try {
    const reqUrl = new URL(req.url);

    const url = new URL(proxyUrl);
    url.pathname = reqUrl.pathname;
    url.search = reqUrl.search;
    const options = {
      headers: req.headers,
      method: req.method,
      body: req.body,
    };

    return await fetch(url.toString(), options);
  } catch (error) {
    console.error("Error in proxyRequestHandler:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
