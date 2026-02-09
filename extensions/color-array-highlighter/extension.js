const vscode = require("vscode");

const COLOR_ARRAY_REGEX =
  /\[\s*(?:0?\.\d+|0|1(?:\.0+)?)\s*,\s*(?:0?\.\d+|0|1(?:\.0+)?)\s*,\s*(?:0?\.\d+|0|1(?:\.0+)?)\s*\]/g;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function formatChannel(value) {
  const fixed = value.toFixed(3);
  return fixed.replace(/\.?0+$/, "");
}

function parseColorArray(text) {
  const raw = text
    .replace("[", "")
    .replace("]", "")
    .split(",")
    .map((part) => Number.parseFloat(part.trim()));
  if (raw.length !== 3 || raw.some((value) => Number.isNaN(value))) {
    return null;
  }
  return raw.map((value) => clamp01(value));
}

function activate(context) {
  const selector = [
    { language: "javascript", scheme: "file" },
    { language: "typescript", scheme: "file" },
    { language: "javascriptreact", scheme: "file" },
    { language: "typescriptreact", scheme: "file" },
    { language: "json", scheme: "file" },
  ];

  const provider = {
    provideDocumentColors(document) {
      const text = document.getText();
      const results = [];

      for (const match of text.matchAll(COLOR_ARRAY_REGEX)) {
        const colorArray = parseColorArray(match[0]);
        if (!colorArray) continue;

        const [r, g, b] = colorArray;
        const start = document.positionAt(match.index);
        const end = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(start, end);
        const color = new vscode.Color(r, g, b, 1);

        results.push(new vscode.ColorInformation(range, color));
      }

      return results;
    },
    provideColorPresentations(color) {
      const r = formatChannel(color.red);
      const g = formatChannel(color.green);
      const b = formatChannel(color.blue);
      const label = `[${r}, ${g}, ${b}]`;
      return [new vscode.ColorPresentation(label)];
    },
  };

  context.subscriptions.push(vscode.languages.registerColorProvider(selector, provider));
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
