import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const REGION_COOKIE = "lb_region";
const REGION_HEADER = "x-lb-region";

function readRegion(value: string | null | undefined) {
  return value === "757" || value === "rva" ? value : null;
}

export function proxy(request: NextRequest) {
  const fromQuery = readRegion(request.nextUrl.searchParams.get("region"));
  const fromCookie = readRegion(request.cookies.get(REGION_COOKIE)?.value);
  const region = fromQuery ?? fromCookie ?? "757";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REGION_HEADER, region);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (request.cookies.get(REGION_COOKIE)?.value !== region) {
    response.cookies.set(REGION_COOKIE, region, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
