import { getAddress, type Address } from "viem";

export type ChainEnvironment = Readonly<{
  chainId: 31337 | 10143;
  rpcUrl: string;
  registryAddress: Address;
  label: "Local Anvil" | "Monad Testnet";
}>;

const CHAIN_LABELS = {
  31337: "Local Anvil",
  10143: "Monad Testnet",
} as const;

function requireVariable(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function loadChainEnvironment(env: NodeJS.ProcessEnv): ChainEnvironment {
  const rawChainId = requireVariable(env, "CHAIN_ID");
  const chainId = Number(rawChainId);
  if (chainId !== 31337 && chainId !== 10143) {
    throw new Error(`Unsupported chain: ${rawChainId}`);
  }

  return {
    chainId,
    rpcUrl: requireVariable(env, "CHAIN_RPC_URL"),
    registryAddress: getAddress(requireVariable(env, "MANDATE_REGISTRY_ADDRESS")),
    label: CHAIN_LABELS[chainId],
  };
}
