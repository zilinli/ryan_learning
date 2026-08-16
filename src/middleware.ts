import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rewriteEntertainStudioSearch } from "@/lib/entertain/studio-path";

/** Legacy Studio nested under Games → first-class `/studio`. */
export function middleware(request: NextRequest) {
  const dest = rewriteEntertainStudioSearch(request.nextUrl.search);
  if (!dest) return NextResponse.next();
  return NextResponse.redirect(new URL(dest, request.url));
}

export const config = {
  matcher: ["/entertain"],
};
