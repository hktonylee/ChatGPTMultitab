import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const buildDir = path.join(distDir, "build");
const packageName = "chatgpt-multitab-system";
const packageFiles = [
  "manifest.json",
  "options.html",
  "extension-icon.png",
  "src",
  "styles",
];

function getTarget() {
  const target = process.argv[2] || "chromium";

  if (!["chromium", "firefox"].includes(target)) {
    throw new Error(`Unknown package target "${target}". Use "chromium" or "firefox".`);
  }

  return target;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function copyEntry(sourcePath, destinationPath) {
  const stat = await fs.stat(sourcePath);

  if (stat.isDirectory()) {
    await fs.mkdir(destinationPath, { recursive: true });
    const entries = await fs.readdir(sourcePath);
    await Promise.all(entries.map((entry) => (
      copyEntry(path.join(sourcePath, entry), path.join(destinationPath, entry))
    )));
    return;
  }

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
}

async function writeTargetManifest(target, destinationPath) {
  const manifestPath = path.join(rootDir, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

  if (target === "firefox") {
    manifest.background = {
      scripts: [
        "src/rules.js",
        "src/background.js",
      ],
    };
  }

  await fs.writeFile(destinationPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function createPackageZip(sourceDir, zipPath) {
  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  await fs.rm(zipPath, { force: true });
  await execFileAsync("zip", ["-q", "-r", zipPath, ...packageFiles], { cwd: sourceDir });
}

async function main() {
  const target = getTarget();
  const targetBuildDir = path.join(buildDir, target);
  const targetPackageName = target === "chromium" ? packageName : `${packageName}-firefox`;
  const zipPath = path.join(distDir, `${targetPackageName}.zip`);

  await fs.rm(targetBuildDir, { recursive: true, force: true });
  await fs.mkdir(targetBuildDir, { recursive: true });

  for (const entry of packageFiles) {
    if (entry === "manifest.json") {
      await writeTargetManifest(target, path.join(targetBuildDir, entry));
      continue;
    }

    const sourcePath = path.join(rootDir, entry);

    if (!(await pathExists(sourcePath))) {
      throw new Error(`Package file does not exist: ${entry}`);
    }

    await copyEntry(sourcePath, path.join(targetBuildDir, entry));
  }

  await createPackageZip(targetBuildDir, zipPath);
  console.log(`Created ${path.relative(rootDir, zipPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
