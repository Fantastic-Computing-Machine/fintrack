import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_URL } from "./api";

export async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1${path}`, { headers: { cookie: (await cookies()).toString() }, cache: "no-store" });
  if (response.status === 401) redirect("/login");
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return response.json();
}
