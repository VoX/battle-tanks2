export async function proxyRequestHandler(req: Request) {
  try {
    const url = new URL(req.url);
    url.protocol = "http:";
    url.port = (url.pathname === "/connectionInfo" ? 8000 : 3000).toString();
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
