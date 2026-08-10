import { NextResponse, type NextRequest } from "next/server";

const local = {
  candidate: "localhost:3001",
  admin: "console.admin.localhost:3001",
  recruiter: "console.recruiter.localhost:3001",
};

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
  if (host === expectedHost("admin")) {
    const url = request.nextUrl.clone();
    url.pathname = `/__admin${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }
  if (host === expectedHost("recruiter")) {
    const url = request.nextUrl.clone();
    url.pathname = `/__recruiter${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }
  if (host === expectedHost("candidate")) return NextResponse.next();
  return new NextResponse(null, { status: 404 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
