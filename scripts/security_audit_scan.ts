import fs from "fs";
import path from "path";

console.log("==================================================");
console.log("VOYAGELEDGER ERP — GITHUB PRE-COMMIT SECURITY SCAN");
console.log("==================================================");

const ROOT_DIR = path.resolve(__dirname, "..");
const IGNORED_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build"]);

interface FileScanResult {
  file: string;
  isSecretFile: boolean;
  sensitiveMatches: string[];
}

const SECRET_FILE_PATTERNS = [
  /^\.env$/,
  /^\.env\.local$/,
  /^\.env\.staging$/,
  /^\.env\.production$/,
  /.*\.key$/,
  /.*\.pem$/,
  /.*service-account.*\.json$/i,
  /.*credentials.*\.json$/i,
  /.*\.sqlite$/,
  /.*\.db$/,
];

const SENSITIVE_CONTENT_PATTERNS = [
  { name: "Private Key", pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: "GCP Service Account Key", pattern: /"type":\s*"service_account"/g },
  { name: "Live Production Cloud SQL Host", pattern: /travel-accounting-2026:asia-south1/g },
  { name: "Unsanitized Production Password in URL", pattern: /postgresql:\/\/(?!postgres:|user:|staging_user:|CHANGE_ME)[^:]+:[^@]+@35\./g },
  { name: "AWS Secret Access Key", pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "Generic Secret Key Assignment", pattern: /(api_key|apikey|secret_key|private_key|nextauth_secret|session_secret)\s*=\s*["'][a-zA-Z0-9_\-]{32,}["']/gi },
];

function scanDirectory(dir: string): FileScanResult[] {
  const results: FileScanResult[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      results.push(...scanDirectory(fullPath));
    } else if (entry.isFile()) {
      const isSecretFile = SECRET_FILE_PATTERNS.some((p) => p.test(entry.name) || p.test(relPath));
      const sensitiveMatches: string[] = [];

      // Check content if not binary
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        for (const { name, pattern } of SENSITIVE_CONTENT_PATTERNS) {
          if (pattern.test(content)) {
            // Check if it's an example template or documentation
            const isExampleOrDoc =
              relPath.includes(".example") ||
              relPath.includes("LOCAL_SETUP.md") ||
              relPath.includes("README.md") ||
              relPath.includes("tests/");
            
            if (!isExampleOrDoc || name === "Private Key" || name === "GCP Service Account Key") {
              sensitiveMatches.push(name);
            }
          }
        }
      } catch {
        // Binary or unreadable file
      }

      results.push({
        file: relPath,
        isSecretFile,
        sensitiveMatches,
      });
    }
  }

  return results;
}

const allFiles = scanDirectory(ROOT_DIR);

console.log("\n1. SENSITIVE / SECRET FILES DETECTED (MUST BE GIT-IGNORED):");
const secretFiles = allFiles.filter((f) => f.isSecretFile);
secretFiles.forEach((f) => console.log(`   ⛔ ${f.file}`));

console.log("\n2. HARD-CODED REAL SECRETS DETECTED IN TRACKABLE CODE:");
const secretContentFiles = allFiles.filter((f) => f.sensitiveMatches.length > 0);
if (secretContentFiles.length === 0) {
  console.log("   ✅ NONE. Zero private keys, live credentials, or service account JSON files found.");
} else {
  secretContentFiles.forEach((f) => console.log(`   ⚠️ ${f.file}: ${f.sensitiveMatches.join(", ")}`));
}

console.log("\n3. EXAMPLE CONFIG TEMPLATES (SAFE TO COMMIT):");
const exampleFiles = allFiles.filter((f) => f.file.endsWith(".example"));
exampleFiles.forEach((f) => console.log(`   📄 ${f.file}`));

console.log("\n4. TOTAL REPOSITORY SCAN SUMMARY:");
console.log(`   Total Files Scanned: ${allFiles.length}`);
console.log(`   Sensitive Files (Excluded): ${secretFiles.length}`);
console.log(`   Trackable Safe Files: ${allFiles.length - secretFiles.length}`);
console.log("==================================================");
