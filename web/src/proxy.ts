import { NextResponse, type NextRequest } from "next/server";

const local = {
  candidate: "localhost:3001",
  admin: "console.admin.localhost:3001",
  recruiter: "console.recruiter.localhost:3001",
};

export const INTERNAL_ADMIN_ROUTE = "/admin-console";
export const INTERNAL_RECRUITER_ROUTE = "/recruiter-entitlement";
export const INTERNAL_SHELL_HEADER = "x-smarthire-internal-shell";

function isInternalShellPath(pathname: string) {
  return [INTERNAL_ADMIN_ROUTE, INTERNAL_RECRUITER_ROUTE].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function expectedHost(kind: "candidate" | "admin" | "recruiter") {
  const configured =
    kind === "candidate"
      ? process.env.CANDIDATE_ORIGIN
      : kind === "admin"
        ? process.env.ADMIN_ORIGIN
        : process.env.RECRUITER_ORIGIN;
  return configured ? new URL(configured).host : local[kind];
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/")) return NextResponse.next();
  if (isInternalShellPath(pathname)) {
    const shell = request.headers.get(INTERNAL_SHELL_HEADER);
    const trustedAdminRoute =
      shell === "admin" &&
      host === expectedHost("admin") &&
      (pathname === INTERNAL_ADMIN_ROUTE ||
        pathname.startsWith(`${INTERNAL_ADMIN_ROUTE}/`));
    const trustedRecruiterRoute =
      shell === "recruiter" &&
      host === expectedHost("recruiter") &&
      (pathname === INTERNAL_RECRUITER_ROUTE ||
        pathname.startsWith(`${INTERNAL_RECRUITER_ROUTE}/`));
    return trustedAdminRoute || trustedRecruiterRoute
      ? NextResponse.next()
      : new NextResponse(null, { status: 404 });
  }
  if (host === expectedHost("admin")) {
    const url = request.nextUrl.clone();
    url.pathname = `${INTERNAL_ADMIN_ROUTE}${pathname === "/" ? "" : pathname}`;
    const headers = new Headers(request.headers);
    headers.set(INTERNAL_ADMIN_SHELL_HEADER, "1");
    return NextResponse.rewrite(url, { request: { headers } });
  }
  if (host === expectedHost("recruiter")) {
    const url = request.nextUrl.clone();
    url.pathname = `${INTERNAL_RECRUITER_ROUTE}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }
  if (host === expectedHost("candidate")) return NextResponse.next();
  return new NextResponse(null, { status: 404 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
