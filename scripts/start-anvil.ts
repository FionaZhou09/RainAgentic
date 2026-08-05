import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";

export interface RunningAnvil {
  rpcUrl: string;
  stop(): Promise<void>;
}

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate an Anvil port"));
        return;
      }
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitUntilReady(rpcUrl: string, child: ChildProcess): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Anvil exited before startup (${child.exitCode})`);
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (response.ok) return;
    } catch {
      // The process is still binding its socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for Anvil");
}

export async function startAnvil(): Promise<RunningAnvil> {
  const port = await availablePort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  const child = spawn("/Users/yingzhou/.foundry/bin/anvil", [
    "--host", "127.0.0.1",
    "--port", String(port),
    "--chain-id", "31337",
    "--silent",
  ], { stdio: "ignore" });

  try {
    await waitUntilReady(rpcUrl, child);
  } catch (error) {
    child.kill("SIGTERM");
    throw error;
  }

  return {
    rpcUrl,
    stop: () => new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", () => resolve());
      child.kill("SIGTERM");
    }),
  };
}
