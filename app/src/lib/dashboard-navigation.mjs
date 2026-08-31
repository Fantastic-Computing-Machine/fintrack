export const dashboardNavigation = [
  { href: "/", label: "Overview" },
  { href: "/transactions", label: "Transactions" },
  { href: "/insights", label: "Insights" },
  { href: "/settings", label: "Settings" },
];

export function isDashboardPath(pathname, href) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/accounts/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
