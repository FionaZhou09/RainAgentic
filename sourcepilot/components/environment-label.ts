export type EnvironmentLabel =
  | "Local Anvil"
  | "Monad Testnet"
  | "Environment not configured"
  | `Unsupported chain (${string})`;

export function environmentLabel(chainId: string | number | undefined): EnvironmentLabel {
  if (chainId === undefined || String(chainId).trim() === "") return "Environment not configured";
  const normalized = String(chainId).trim();
  if (normalized === "31337") return "Local Anvil";
  if (normalized === "10143") return "Monad Testnet";
  return `Unsupported chain (${normalized})`;
}

export function publicEnvironmentLabel(
  env: Readonly<Record<string, string | undefined>>,
): EnvironmentLabel {
  return environmentLabel(env.NEXT_PUBLIC_CHAIN_ID ?? env.CHAIN_ID ?? "10143");
}
