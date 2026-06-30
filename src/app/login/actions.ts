"use server";

import { redirect } from "next/navigation";
import { isValidLogin, setSessionCookie } from "@/lib/auth/session";

export async function loginAction(_: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!isValidLogin(email, password)) {
    return { error: "Invalid email or password." };
  }

  await setSessionCookie(email);
  redirect("/");
}
