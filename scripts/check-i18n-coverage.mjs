import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const catalogPath = path.join(sourceRoot, "i18n", "index.tsx");
const translatedPropComponents = new Set([
  "DialogTabs",
  "EmptyState",
  "Fact",
  "ManagerDialogShell",
  "PathRow",
  "SensitiveActionConfirmDialog",
  "SourceCard",
  "SourceRow",
  "StatusBadge",
  "StatusItem",
  "TaskDialogTitle",
]);
const ignoredJsxText = new Set(["中"]);

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    if (/\.test\.(ts|tsx)$/.test(entry.name) || entry.name === "mock-data.ts") return [];
    return [absolute];
  });
}

function catalogKeys() {
  const source = fs.readFileSync(catalogPath, "utf8");
  return new Set(
    [...source.matchAll(/^  "((?:[^"\\]|\\.)*)":/gm)]
      .map((match) => JSON.parse(`"${match[1]}"`)),
  );
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

const keys = catalogKeys();
const findings = [];

for (const file of sourceFiles(sourceRoot)) {
  if (file === catalogPath) continue;
  const sourceFile = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node) {
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === "t"
      && node.arguments.length > 0
      && ts.isStringLiteral(node.arguments[0])
      && !keys.has(node.arguments[0].text)
    ) {
      findings.push({
        file,
        line: lineOf(sourceFile, node),
        message: `Missing English catalog entry: ${node.arguments[0].text}`,
      });
    }

    if (ts.isJsxText(node)) {
      const text = node.text.trim().replace(/\s+/g, " ");
      if (text && /[\u4e00-\u9fff]/.test(text) && !ignoredJsxText.has(text)) {
        findings.push({
          file,
          line: lineOf(sourceFile, node),
          message: `Raw Chinese JSX text: ${text}`,
        });
      }
    }

    if (
      ts.isJsxAttribute(node)
      && node.initializer
      && ts.isStringLiteral(node.initializer)
      && /[\u4e00-\u9fff]/.test(node.initializer.text)
    ) {
      const element = node.parent.parent;
      const component = "tagName" in element ? element.tagName.getText() : "";
      if (!translatedPropComponents.has(component)) {
        findings.push({
          file,
          line: lineOf(sourceFile, node),
          message: `Raw Chinese ${node.name.getText()} prop on <${component}>: ${node.initializer.text}`,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`${path.relative(root, finding.file)}:${finding.line} ${finding.message}`);
  }
  process.exitCode = 1;
} else {
  console.log("i18n coverage check passed");
}
