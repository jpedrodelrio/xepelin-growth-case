import type { NextRequest } from "next/server";

const backendUrl = process.env.API_URL ?? "http://localhost:3001/api";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const target = `${backendUrl}/${path.map(encodeURIComponent).join("/")}`;
  const contentType = request.headers.get("content-type");
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();

  const response = await fetch(target, {
    method: request.method,
    headers: contentType ? { "content-type": contentType } : undefined,
    body,
    cache: "no-store",
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}

export const GET = proxy;
export const POST = proxy;
