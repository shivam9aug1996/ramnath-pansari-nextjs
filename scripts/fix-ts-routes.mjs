#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "../src");

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
      files.push(full);
  }
  return files;
}

const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];

for (const file of walk(srcDir)) {
  let content = fs.readFileSync(file, "utf8");
  const original = content;

  if (
    !/export async function (GET|POST|PUT|PATCH|DELETE)\(req(?![:\w])/.test(
      content,
    )
  )
    continue;

  if (!content.includes("NextRequest")) {
    if (content.includes('from "next/server"')) {
      content = content.replace(
        /import \{([^}]+)\} from "next\/server";/,
        (match, imports) => {
          const parts = imports.split(",").map((s) => s.trim());
          if (!parts.includes("NextRequest")) parts.unshift("NextRequest");
          return `import { ${parts.join(", ")} } from "next/server";`;
        },
      );
    } else {
      content = `import { NextRequest } from "next/server";\n${content}`;
    }
  }

  for (const method of methods) {
    content = content.replace(
      new RegExp(`export async function ${method}\\(req, res\\)`, "g"),
      `export async function ${method}(req: NextRequest)`,
    );
    content = content.replace(
      new RegExp(`export async function ${method}\\(req\\)`, "g"),
      `export async function ${method}(req: NextRequest)`,
    );
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log("Updated:", path.relative(srcDir, file));
  }
}
