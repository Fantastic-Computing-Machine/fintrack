export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function cookie(name: string) {
  if (typeof document === "undefined") return "";
  return document.cookie.split("; ").find(value => value.startsWith(`${name}=`))?.split("=").slice(1).join("=") ?? "";
}

export async function mutate(path: string, method = "POST", body?: object) {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": decodeURIComponent(cookie("fintrack_csrf")) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Request failed");
  return response.status === 204 ? null : response.json();
}

export function money(value: string | null, currency = "USD") {
  return value === null ? "Unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value));
}

export function shortDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value.length === 10 ? value + "T12:00:00" : value}`)) : "Unavailable";
}
