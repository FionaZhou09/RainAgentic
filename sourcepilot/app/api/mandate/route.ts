import { createPublicClient, createWalletClient, http, isAddress, isHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { MandateRequest, MandateResponse } from "@/lib/contracts/api";
import { loadChainEnvironment, type ChainEnvironment } from "@/lib/chain/config";
import { createViemRegistryClient, type RegistryClient } from "@/lib/chain/registry";
import { events as defaultEvents, type EventStore } from "@/lib/events";
import { PR_1042 } from "@/lib/fixtures/pr-1042";
import { computePayeeScope, recoverMandateSigner } from "@/lib/mandate";
import { deserializeMandate } from "@/lib/mandate/serialize";
import type { SerializedMandate } from "@/lib/mandate/types";

export type MandateRouteDependencies = {
  registry: RegistryClient;
  environment: ChainEnvironment;
  events: EventStore;
};

function createMandateHandler({ registry, environment, events }: MandateRouteDependencies) {
  return async function mandateRoute(request: Request): Promise<Response> {
    let input: unknown;
    try { input = await request.json(); } catch { return error("Invalid JSON", 400); }
    if (!isMandateRequest(input)) return error("Invalid mandate request", 400);

    let mandate;
    try { mandate = deserializeMandate(input.mandate); } catch { return error("Invalid serialized mandate", 400); }
    if (mandate.purchaseRequestId !== PR_1042.idHash) return error("Unknown purchase request", 404);

    let scope;
    try { scope = computePayeeScope(input.payeeRefs); } catch { return error("Invalid payee preimage", 400); }
    if (scope.scope !== mandate.payeeScope) return error("Payee preimage does not match signed scope", 400);

    let recoveredSigner;
    try {
      recoveredSigner = recoverMandateSigner(mandate, {
        chainId: environment.chainId,
        verifyingContract: environment.registryAddress,
      }, input.signature);
    } catch { return error("Invalid mandate signature", 400); }
    if (recoveredSigner.toLowerCase() !== mandate.principal.toLowerCase()) return error("Signature does not match principal", 422);

    const created = await registry.create(mandate, input.signature);
    const response: MandateResponse = {
      mandateHash: created.mandateHash,
      monadTxHash: created.txHash,
      explorerUrl: registry.explorerTx(created.txHash),
      payeeScope: scope.scope,
      payeePreimage: scope.preimage,
      recoveredSigner,
      constraints: {
        maxTotalMinor: mandate.maxTotal.toString(),
        autonomousMaxMinor: mandate.autonomousMax.toString(),
        maxDepositBps: Number(mandate.maxDepositBps),
        validAfter: Number(mandate.validAfter),
        validUntil: Number(mandate.validUntil),
      },
    };
    events.append({ purchaseRequestId: PR_1042.id, type: "mandate_registered", actor: "system", payload: { mandateHash: created.mandateHash, txHash: created.txHash, environment: environment.label } });
    return Response.json(response);
  };
}

function isMandateRequest(input: unknown): input is MandateRequest {
  if (typeof input !== "object" || input === null) return false;
  const value = input as Record<string, unknown>;
  return isSerializedMandate(value.mandate)
    && typeof value.signature === "string" && isHex(value.signature) && value.signature.length === 132
    && Array.isArray(value.payeeRefs) && value.payeeRefs.length > 0 && value.payeeRefs.every((ref) => typeof ref === "string");
}

function isSerializedMandate(input: unknown): input is SerializedMandate {
  if (typeof input !== "object" || input === null) return false;
  const value = input as Record<string, unknown>;
  const hex32 = (field: string) => typeof value[field] === "string" && isHex(value[field] as Hex) && (value[field] as string).length === 66;
  const decimal = (field: string) => typeof value[field] === "string" && /^(0|[1-9]\d*)$/.test(value[field] as string);
  return typeof value.principal === "string" && isAddress(value.principal)
    && typeof value.agent === "string" && isAddress(value.agent)
    && hex32("purchaseRequestId") && hex32("fundingSource") && hex32("payeeScope") && hex32("nonce")
    && decimal("maxTotal") && decimal("autonomousMax") && decimal("maxDepositBps") && decimal("validAfter") && decimal("validUntil")
    && typeof value.purpose === "string";
}

function error(message: string, status: number): Response { return Response.json({ error: message }, { status }); }

async function runtimeDependencies(): Promise<MandateRouteDependencies> {
  const environment = loadChainEnvironment(process.env);
  const rawPrivateKey = process.env.AGENT_PRIVATE_KEY;
  if (!rawPrivateKey || !isHex(rawPrivateKey) || rawPrivateKey.length !== 66) throw new Error("Missing or invalid AGENT_PRIVATE_KEY");
  const account = privateKeyToAccount(rawPrivateKey);
  const transport = http(environment.rpcUrl);
  return {
    environment,
    events: defaultEvents,
    registry: createViemRegistryClient({
      environment,
      publicClient: createPublicClient({ transport }),
      walletClient: createWalletClient({ account, transport }),
    }),
  };
}

async function runtimePost(request: Request): Promise<Response> {
  return createMandateHandler(await runtimeDependencies())(request);
}

export const POST = Object.assign(runtimePost, { withDependencies: createMandateHandler });
