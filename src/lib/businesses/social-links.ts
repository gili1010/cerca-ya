export type BusinessSocialNetwork = "instagram" | "facebook";

// Null means an optional empty field; undefined means invalid input.
export function normalizeSocialLink(value: string, network: BusinessSocialNetwork): string | null | undefined {
  const input = value.trim();
  if (!input) return null;
  if (input.length > 300 || /[%\\\s]/.test(input)) return undefined;
  let candidate = input;
  if (network === "instagram" && candidate.startsWith("@")) candidate = candidate.slice(1);
  if (/^[a-zA-Z0-9._-]+$/.test(candidate)) candidate = `${network}.com/${candidate}`;
  if (candidate.startsWith(`${network}.com/`) || candidate.startsWith(`www.${network}.com/`)) candidate = `https://${candidate}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || ![`${network}.com`, `www.${network}.com`].includes(url.hostname)
      || url.username || url.password || url.port || url.hash
      || !/^\/[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*\/?$/.test(url.pathname)
      || (url.search && !(network === "facebook" && url.pathname === "/profile.php" && /^\?id=[0-9]+$/.test(url.search)))) return undefined;
    if (/(?:^|\/)\.{1,2}(?:\/|$)/.test(candidate.replace("https://", ""))) return undefined;
    const normalized = `https://${network}.com${url.pathname.replace(/\/$/, "")}${url.search}`;
    return normalized.length <= 300 ? normalized : undefined;
  } catch { return undefined; }
}
