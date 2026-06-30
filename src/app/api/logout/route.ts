import { clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  await clearSessionCookie();
  return Response.redirect(new URL("/login", process.env.APP_URL ?? "http://localhost:3000"));
}
