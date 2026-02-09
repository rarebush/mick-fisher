const vscode = require("vscode");

const COLOR_ARRAY_REGEX =
  /\[\s*(?:0?\.\d+|0|1(?:\.0+)?)\s*,\s*(?:0?\.\d+|0|1(?:\.0+)?)\s*,\s*(?:0?\.\d+|0|1(?:\.0+)?)\s*\]/g;

const HEX_COLOR_REGEX = /0x[0-9A-Fa-f]{6}\b/g;

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

function parseHexColor(text) {
  const hex = text.slice(2); // strip "0x"
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function toHex(value) {
  const byte = Math.round(clamp01(value) * 255);
  return byte.toString(16).padStart(2, "0");
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

      for (const match of text.matchAll(HEX_COLOR_REGEX)) {
        const [r, g, b] = parseHexColor(match[0]);
        const start = document.positionAt(match.index);
        const end = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(start, end);
        const color = new vscode.Color(r, g, b, 1);

        results.push(new vscode.ColorInformation(range, color));
      }

      return results;
    },
    provideColorPresentations(color, context) {
      const originalText = context.document.getText(context.range);
      const isHex = originalText.startsWith("0x");

      if (isHex) {
        const label = `0x${toHex(color.red)}${toHex(color.green)}${toHex(color.blue)}`;
        return [new vscode.ColorPresentation(label)];
      }

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
