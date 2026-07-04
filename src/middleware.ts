// Route-protection middleware.
//
// Runs before matched requests reach a page. It is the COARSE, first-line gate
// (ADR-013): it redirects obviously-wrong access early. The precise gate is the
// layout components, which run on the Node runtime and can call `auth()`.
//
// Middleware runs on the Edge runtime: no bcrypt, no full Node APIs, no direct
// DB work of its own. It only inspects the Auth.js session exposed as `req.auth`.

import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const role = session?.user?.role;

  // Admin area — everything under /admin except the login page itself.
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    // Unauthenticated, or a customer trying to reach staff pages → admin login.
    if (!session || role === "CUSTOMER") {
      return NextResponse.redirect(new URL("/admin/login", req.nextUrl));
    }
  }

  // Customer account area.
  if (pathname.startsWith("/account")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", req.nextUrl));
    }
    // Staff shouldn't linger on customer pages — send them to the admin home.
    if (role !== "CUSTOMER") {
      return NextResponse.redirect(new URL("/admin", req.nextUrl));
    }
  }

  return NextResponse.next();
});

// Only run middleware for the protected trees. Public pages, API routes, and
// static assets are untouched.
export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
