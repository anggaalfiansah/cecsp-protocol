import fs from "fs";
import path from "path";
import { uid } from "radash";
import * as ts from "typescript";
import * as vm from "vm";

/**
 * generate-secret-setup.ts (fixed + verifier)
 * - Reads or generates .env secrets
 * - Generates obfuscated secret.ts
 * - Verifies generated getters match .env values by executing the generated file in a sandbox
 *
 * Usage: npx ts-node scripts/generate-secret-setup.ts
 */

const ENV_PATH = path.join(process.cwd(), "secure-server/.env");
const OUTPUT_FILE = path.join(process.cwd(), "secure-client/src/utils/secret.ts"); // adjust as needed
const TOTAL_DUMMIES = 15;

/* -----------------------------
   Helpers
   ----------------------------- */
function ensureFile(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/* -----------------------------
   Read or generate secrets
   ----------------------------- */
function readEnvSecrets(keys: string[]): Record<string, string> | null {
  if (!fs.existsSync(ENV_PATH)) return null;
  const txt = fs.readFileSync(ENV_PATH, "utf8");
  const out: Record<string, string> = {};
  for (const k of keys) {
    const m = txt.match(new RegExp(`^${k}=(?:["']?)(.+?)(?:["']?)$`, "m"));
    if (m && m[1]) out[k] = m[1];
  }
  return Object.keys(out).length === keys.length ? out : null;
}

function writeEnvSecrets(secrets: Record<string, string>) {
  let envContent = "";
  if (fs.existsSync(ENV_PATH)) envContent = fs.readFileSync(ENV_PATH, "utf8");

  for (const [k, v] of Object.entries(secrets)) {
    const regex = new RegExp(`^${k}=.*$`, "m");
    const line = `${k}="${v}"`;
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, line);
    } else {
      envContent += (envContent.endsWith("\n") || envContent === "" ? "" : "\n") + line + "\n";
    }
  }
  fs.writeFileSync(ENV_PATH, envContent.trim() + "\n", "utf8");
}

/* -----------------------------
   Secret keys & generators
   ----------------------------- */
const KEYS = ["APP_KEY", "APP_IV", "CCE_SECRET", "CCE_BASE"];
const generators: Record<string, () => string> = {
  APP_KEY: () => uid(32),
  APP_IV: () => uid(32),
  CCE_SECRET: () => uid(32),
  CCE_BASE: () => uid(50),
};

// If .env exists and contains keys, use them. Otherwise generate and write.
let SECRETS: Record<string, string> | null = readEnvSecrets(KEYS);
if (!SECRETS) {
  SECRETS = {};
  for (const k of KEYS) SECRETS[k] = generators[k]();
  writeEnvSecrets(SECRETS);
  console.log("🆕 .env created/rotated with new secrets.");
} else {
  console.log("🔁 Using existing secrets from .env (no rotation).");
}

/* -----------------------------
   Strategies to encode parts (produce expression strings)
   ----------------------------- */
const strategyReverseB64 = (value: string) => {
  const b64 = Buffer.from(value, "utf8").toString("base64");
  const rev = b64.split("").reverse().join("");
  return `((() => { const _s = "${esc(
    rev
  )}".split('').reverse().join(''); try { if (typeof atob !== "undefined") return atob(_s); } catch(e){e?.toString()} return Buffer.from(_s, "base64").toString("utf8"); })())`;
};
const strategyCharShift = (value: string) => {
  const shift = Math.floor(Math.random() * 5) + 1;
  const arr = value.split("").map((c) => c.charCodeAt(0) + shift);
  return `String.fromCharCode(...[${arr.join(",")}].map(n => n - ${shift}))`;
};
const strategySplitJunk = (value: string) => {
  const candidates = ["_", "|", "~", "!", "$", "%", "^", "&", "*"];
  const junk = candidates.find((c) => !value.includes(c)) || "__SEP__";
  const parts = value.split("").join(junk);
  return `"${esc(parts)}".split("${esc(junk)}").join("")`;
};
const strategyHex = (value: string) => {
  const hex = Buffer.from(value, "utf8").toString("hex");
  return `("${hex}".match(/.{1,2}/g) || []).map(b => String.fromCharCode(parseInt(b,16))).join("")`;
};
const strategies = [strategyReverseB64, strategyCharShift, strategySplitJunk, strategyHex];

/* -----------------------------
   Dummy templates (definition + safe call)
   ----------------------------- */
type DummyTpl = {
  def: (idx: number) => string;
  call: (name: string) => string;
};

const DUMMY_TEMPLATES: DummyTpl[] = [
  {
    def: (idx) => `const calculateMetric${idx} = (val: number): number => Math.floor(val * Math.random()) + Date.now();`,
    call: (name) => `${name}(42), ""`,
  },
  {
    def: (idx) => `const formatStringUtil${idx} = (s: string): string => s.split('').reverse().map(c=>c.toUpperCase()).join('');`,
    call: (name) => `${name}("rnd"), ""`,
  },
  {
    def: (idx) => `const checkBrowserEnv${idx} = (): boolean => typeof window !== 'undefined' && !!(window).navigator;`,
    call: (name) => `${name}(), ""`,
  },
  {
    def: (idx) => `const sanitizeArray${idx} = (arr: unknown[]): unknown[] => arr.filter(Boolean);`,
    call: (name) => `${name}([]), ""`,
  },
  {
    def: (idx) => `const loggerDebug${idx} = (msg: string): void => { msg?.toString(); };`,
    call: (name) => `${name}("init"), ""`,
  },
];

/* -----------------------------
   Chunk secret into pieces and generate parts
   ----------------------------- */
function chunkString(str: string): string[] {
  const numChunks = Math.floor(Math.random() * 3) + 2; // 2..4
  const len = str.length;
  const size = Math.max(1, Math.ceil(len / numChunks));
  const out: string[] = [];
  for (let i = 0; i < len; i += size) out.push(str.substring(i, i + size));
  return out;
}

/* -----------------------------
   Build definitions: part functions + dummy defs
   ----------------------------- */
const defs: string[] = [];
const wrappersPerSecret: Record<string, { parts: string[]; dummies: string[] }> = {};

let dummyCounter = 1;

// build part functions and track parts per secret
for (const k of KEYS) {
  const val = SECRETS![k];
  const chunks = chunkString(val);
  wrappersPerSecret[k] = { parts: [], dummies: [] };

  chunks.forEach((chunk, idx) => {
    const partName = `part_${k}_${idx + 1}`;
    const strat = strategies[Math.floor(Math.random() * strategies.length)];
    const expr = strat(chunk);
    defs.push(`const ${partName} = (): string => { return ${expr}; };`);
    wrappersPerSecret[k].parts.push(`${partName}()`);
  });
}

// generate dummy functions and assign them to secrets (distribution)
const allDummyNames: string[] = [];
for (let i = 0; i < TOTAL_DUMMIES; i++) {
  const tpl = DUMMY_TEMPLATES[Math.floor(Math.random() * DUMMY_TEMPLATES.length)];
  const defStr = tpl.def(dummyCounter);
  const m = defStr.match(/^const\s+([A-Za-z0-9_]+)\s*=/);
  const name = m ? m[1] : `dummy${dummyCounter}`;
  defs.push(defStr);
  allDummyNames.push(name);
  const callExpr = tpl.call(name);
  const secretIndex = i % KEYS.length;
  const secretKey = KEYS[secretIndex];
  wrappersPerSecret[secretKey].dummies.push(callExpr);
  dummyCounter++;
}

// Shuffle definitions lightly
defs.sort(() => Math.random() - 0.5);

/* -----------------------------
   Create wrapper exports:
   Each getKEY() will:
     - execute all assigned dummy calls (in order)
     - then return concatenation of parts (in correct order).
   ----------------------------- */
const exportsArr: string[] = [];

for (const k of KEYS) {
  const info = wrappersPerSecret[k];
  const dummyLines = info.dummies.length ? info.dummies.map((c) => `  void (${c});`).join("\n") : "";
  const partsExpr = info.parts.join(" + ");
  const wrapper = `export const get${k} = (): string => {\n${dummyLines}\n  return ${partsExpr};\n};`;
  exportsArr.push(wrapper);
}

/* -----------------------------
   Finalize file content
   ----------------------------- */
let fileContent = `/**
 * AUTO-GENERATED SECRETS (FIXED)
 * Generated: ${new Date().toISOString()}
 * NOTE: This file is auto-generated. Do not edit.
 */

/* Minimal ambient declarations to keep generated code valid in both Node and some TS configs */
declare const Buffer: { from(input: string, encoding?: string): { toString(enc?: string): string } };
declare function atob(s: string): string;

`;

// append defs and exports
fileContent += defs.join("\n\n");
fileContent += "\n\n// --- PUBLIC ACCESSORS ---\n\n";
fileContent += exportsArr.join("\n\n") + "\n";

/* -----------------------------
   Write to disk
   ----------------------------- */
ensureFile(OUTPUT_FILE);
fs.writeFileSync(OUTPUT_FILE, fileContent, "utf8");
console.log(`✅ Obfuscated Secrets Code generated at: ${OUTPUT_FILE}`);
console.log("Secrets used (for debugging):");
console.log(SECRETS);

function verifyGeneratedSecrets(tsCode: string, originalSecrets: Record<string, string>) {
  console.log("\n🕵️  Running internal verification...");

  // 1. Transpile TS code string menjadi JS agar bisa dijalankan oleh Node VM
  const result = ts.transpileModule(tsCode, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, // Ubah export const jadi exports.xxx
      target: ts.ScriptTarget.ES2020,
      removeComments: true,
    },
  });

  const jsCode = result.outputText;

  // 2. Siapkan Sandbox Context
  // Kita perlu mock 'exports', 'Buffer', dan 'atob' karena script berjalan di VM raw
  const sandbox = {
    exports: {},
    Buffer: Buffer, // Pass Node Buffer
    atob: (str: string) => Buffer.from(str, "base64").toString("binary"), // Polyfill atob
    console: console, // Agar dummy function bisa log jika perlu (opsional)
  };

  const context = vm.createContext(sandbox);

  try {
    // 3. Eksekusi script di dalam sandbox
    vm.runInContext(jsCode, context);
  } catch (err) {
    console.error("❌ Verification Failed: Generated code threw an error during execution.");
    throw err;
  }

  // 4. Bandingkan nilai output fungsi dengan original secrets
  const exportedFuncs = sandbox.exports as Record<string, () => string>;
  let allMatch = true;

  for (const [key, originalValue] of Object.entries(originalSecrets)) {
    const funcName = `get${key}`;
    if (typeof exportedFuncs[funcName] !== "function") {
      console.error(`❌ Verification Failed: Function ${funcName} not found in exports.`);
      allMatch = false;
      continue;
    }

    // Panggil fungsi getter hasil generate
    const generatedValue = exportedFuncs[funcName]();

    if (generatedValue !== originalValue) {
      console.error(`❌ Verification Failed for [${key}]`);
      console.error(`   Expected: ${originalValue}`);
      console.error(`   Got:      ${generatedValue}`);
      allMatch = false;
    } else {
      console.log(`   ✅ ${key} matches.`);
    }
  }

  if (!allMatch) {
    throw new Error("Verification failed! Generated code does not produce correct secrets.");
  }
  console.log("🎉 Verification Passed: All generated getters function correctly.\n");
}

/* -----------------------------
   Write to disk & Verify
   ----------------------------- */

// Jalankan Verifikasi DULU sebelum menulis file (Fail-fast)
// Jika verifikasi gagal, script akan error dan tidak akan menimpa file lama (opsional)
try {
  verifyGeneratedSecrets(fileContent, SECRETS!);

  ensureFile(OUTPUT_FILE);
  fs.writeFileSync(OUTPUT_FILE, fileContent, "utf8");

  console.log(`✅ Obfuscated Secrets Code generated at: ${OUTPUT_FILE}`);
  // console.log("Secrets used (for debugging):", SECRETS);
} catch (error) {
  console.error("⛔ Generation aborted due to verification errors.");
  process.exit(1);
}
