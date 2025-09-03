import { Interface, AbiCoder } from "ethers";
import fs from "node:fs";

const RPC = "https://linea-mainnet.infura.io/v3/9d60b7d314be4567adf4530f4b9dd801";

let addresses = [
  "your adress1",
  "your adress2",
  "your adress3",
  "...",
];


const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const TARGET = "0x87baa1694381AE3eCAe2660d97fE60404080eB64".toLowerCase();
const INNER_SELECTOR = "0x7debb959";
const DECIMALS = 18n;
const BATCH_SIZE = 150;

if (process.argv[2]) {
  const arg = process.argv[2];
  if (fs.existsSync(arg)) {
    addresses = fs.readFileSync(arg, "utf8")
      .split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  } else {
    addresses = arg.split(",").map(s => s.trim()).filter(Boolean);
  }
}
addresses = addresses.map(a => a.toLowerCase());

const multicallAbi = [
  "function aggregate3(tuple(address target,bool allowFailure,bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)"
];
const mc = new Interface(multicallAbi);
const coder = AbiCoder.defaultAbiCoder();

function encodeInnerCall(address) {
  const clean = address.replace(/^0x/, "").padStart(40, "0");
  const encodedAddress = "0".repeat(24) + clean;
  return INNER_SELECTOR + encodedAddress;
}

async function rpcCall(payload) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`${res.status} ${JSON.stringify(json.error || json)}`);
  }
  return json.result;
}

async function queryBatch(batch) {
  const calls = batch.map(addr => ({
    target: TARGET,
    allowFailure: true,
    callData: encodeInnerCall(addr),
  }));

  const data = mc.encodeFunctionData("aggregate3", [calls]);

  const resultHex = await rpcCall({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: MULTICALL3, data }, "latest"],
  });

  const [results] = mc.decodeFunctionResult("aggregate3", resultHex);
  const out = new Map();

  results.forEach((r, i) => {
    const addr = batch[i];
    if (!r.success) {
      out.set(addr, { ok: false, value: 0n });
      return;
    }
    const [val] = coder.decode(["uint256"], r.returnData);
    out.set(addr, { ok: true, value: val });
  });

  return out;
}

async function main() {
  const chunks = [];
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    chunks.push(addresses.slice(i, i + BATCH_SIZE));
  }

  const results = new Map();
  for (const chunk of chunks) {
    const r = await queryBatch(chunk);
    r.forEach((v, k) => results.set(k, v));
  }

  const lines = ["address,allocation"];
  for (const addr of addresses) {
    const rec = results.get(addr);
    const whole = rec?.ok ? (rec.value / (10n ** DECIMALS)).toString() : "ERROR";
    lines.push(`${addr},${whole}`);
  }

  const file = "allocations.csv";
  fs.writeFileSync(file, lines.join("\n"), "utf8");
  console.log(`Saved: ${file}`);
}

main().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
