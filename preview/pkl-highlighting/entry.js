var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../../fork/build/bb/packages/shared-ui/src/lib/pkl-highlight.ts
var keywords = new Set(
  "abstract amends as class const else extends external false fixed for function hidden if import in is let local module new nothing null open out outer read super this throw trace true typealias unknown when".split(
    " "
  )
);
var types = new Set(
  "Any Boolean Class Collection DataSize Duration Dynamic Float Int Int8 Int16 Int32 Int64 List Listing Map Mapping Module NonNull Number Pair Regex Set String Typed UInt UInt8 UInt16 UInt32 UInt64 VarArgs".split(
    " "
  )
);
function tokenizePklLine(line, previous = []) {
  const state = previous.map((frame) => ({ ...frame }));
  const tokens = [];
  let index = 0;
  function emit(kind, length) {
    const value = line.slice(index, index + length);
    const last = tokens.at(-1);
    if (last?.kind === kind) last.value += value;
    else tokens.push({ startIndex: index, value, kind });
    index += length;
  }
  while (index < line.length) {
    const frame = state.at(-1);
    if (frame?.kind === "comment") {
      if (line.startsWith("/*", index)) {
        state.push({ kind: "comment" });
        emit("comment", 2);
      } else if (line.startsWith("*/", index)) {
        state.pop();
        emit("comment", 2);
      } else emit("comment", 1);
      continue;
    }
    if (frame?.kind === "string") {
      if (line.startsWith(frame.close, index)) {
        state.pop();
        emit("string", frame.close.length);
      } else if (line.startsWith(frame.escape + "(", index)) {
        emit("delimiter", frame.escape.length + 1);
        state.push({ kind: "interpolation", depth: 1 });
      } else if (line.startsWith(frame.escape, index))
        emit("string", Math.min(frame.escape.length + 1, line.length - index));
      else emit("string", 1);
      continue;
    }
    if (line.startsWith("//", index)) {
      emit("comment", line.length - index);
      continue;
    }
    if (line.startsWith("/*", index)) {
      state.push({ kind: "comment" });
      emit("comment", 2);
      continue;
    }
    const rest = line.slice(index);
    const string = /^(#*)("""|")/.exec(rest);
    if (string) {
      const hashes = string[1];
      const quote = string[2];
      state.push({
        kind: "string",
        close: quote + hashes,
        escape: "\\" + hashes,
        multiline: quote.length === 3
      });
      emit("string", string[0].length);
      continue;
    }
    if (line[index] === "`") {
      const end = line.indexOf("`", index + 1);
      emit("identifier", end < 0 ? line.length - index : end - index + 1);
      continue;
    }
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) {
      emit("white", whitespace[0].length);
      continue;
    }
    const number = /^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?[\d_]+)?|\.\d[\d_]*(?:[eE][+-]?[\d_]+)?)/.exec(
      rest
    );
    if (number) {
      emit("number", number[0].length);
      continue;
    }
    const word = /^[\p{L}_$][\p{L}\p{N}_$]*/u.exec(rest);
    if (word) {
      const value = word[0];
      emit(
        keywords.has(value) ? "keyword" : types.has(value) || /^\p{Lu}/u.test(value) ? "type" : "identifier",
        value.length
      );
      continue;
    }
    if (frame?.kind === "interpolation") {
      if (line[index] === "(") frame.depth++;
      if (line[index] === ")" && --frame.depth === 0) state.pop();
    }
    emit("delimiter", 1);
  }
  const singleLine = state.findIndex(
    (frame) => frame.kind === "string" && !frame.multiline
  );
  if (singleLine >= 0) state.splice(singleLine);
  return { tokens, state };
}

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/shared.js
var TokenTypes = (
  /** @type {const} */
  "identifier keyword string class property entity jsxliterals sign comment break space".split(" ")
);
var [
  T_IDENTIFIER,
  T_KEYWORD,
  T_STRING,
  T_CLASS,
  T_PROPERTY,
  T_ENTITY,
  T_JSX_LITERALS,
  T_SIGN,
  T_COMMENT,
  T_BREAK,
  T_SPACE
] = TokenTypes.map((_, index) => index);
var SugarHigh = (
  /** @type {const} */
  {
    TokenTypes,
    TokenMap: new Map(TokenTypes.map((type, index) => [type, index]))
  }
);
function assemble(value, tokens) {
  const lines = [];
  let lineIndex = 0;
  const lineTokens = [];
  let lastWasBreak = false;
  function flushLine(tokens2) {
    lines.push({
      index: lineIndex++,
      value: tokens2.map(([, tokenValue]) => tokenValue).join(""),
      tokens: tokens2.map(([type, tokenValue]) => ({
        type: TokenTypes[type],
        value: tokenValue
      })),
      annotations: []
    });
  }
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const [type, value2] = token;
    if (type !== T_BREAK) {
      if (value2.includes("\n")) {
        const values = value2.split("\n");
        for (let part = 0; part < values.length; part++) {
          lineTokens.push([type, values[part]]);
          if (part < values.length - 1) {
            flushLine(lineTokens);
            lineTokens.length = 0;
          }
        }
      } else {
        lineTokens.push(token);
      }
      lastWasBreak = false;
    } else {
      if (lastWasBreak) flushLine([]);
      else {
        flushLine(lineTokens);
        lineTokens.length = 0;
      }
      if (index === tokens.length - 1) flushLine([]);
      lastWasBreak = true;
    }
  }
  if (lineTokens.length) flushLine(lineTokens);
  return { value, lines };
}
function generate(parsed, options) {
  const cx = options?.cx;
  const mark = options?.mark;
  const markLine = options?.markLine;
  return parsed.lines.map((parsedLine) => {
    const line = {
      index: parsedLine.index,
      value: parsedLine.value,
      tokens: parsedLine.tokens,
      annotations: parsedLine.annotations,
      className: `sh__line${parsedLine.annotations.map((annotation) => ` sh__line--${annotation}`).join("")}`,
      style: {},
      properties: {}
    };
    markLine?.(line);
    return {
      type: "element",
      tagName: "span",
      children: parsedLine.tokens.map(({ type, value }) => {
        const extraClassName = cx?.[type];
        const token = {
          type,
          value,
          className: `sh__token--${type}${extraClassName ? ` ${extraClassName}` : ""}`,
          style: { color: `var(--sh-${type})` },
          properties: {}
        };
        mark?.(token);
        return {
          type: "element",
          tokenType: token.type,
          tagName: "span",
          children: [{ type: "text", value: token.value }],
          properties: {
            ...token.properties,
            className: token.className,
            style: token.style
          }
        };
      }),
      properties: {
        ...line.properties,
        className: line.className,
        style: line.style
      }
    };
  });
}
var entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
var encode = (value) => value.replace(/[&<>"']/g, (character) => entities[character]);
function attributes(values) {
  const style = Object.entries(values.style || {}).map(([key, value]) => `${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}:${value}`).join(";");
  const properties = Object.entries(values).filter(([key, value]) => /^[\w:-]+$/.test(key) && key !== "className" && key !== "style" && value !== false && value != null).map(([key, value]) => value === true ? key : `${key}="${encode(String(value))}"`).join(" ");
  return `class="${encode(values.className || "")}"${style ? ` style="${encode(style)}"` : ""}${properties ? ` ${properties}` : ""}`;
}
function toHtml(lines) {
  return lines.map((line) => {
    const children = line.children.map((token) => {
      return `<${token.tagName} ${attributes(token.properties)}>${encode(token.children[0].value)}</${token.tagName}>`;
    }).join("");
    return `<${line.tagName} ${attributes(line.properties)}>${children}</${line.tagName}>`;
  }).join("\n");
}

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/core.js
var signs = new Set("+-*/%=!&|^~?:.,;()[]{}<>#@\\".split(""));
var noComment = () => 0;
var isWord = (value) => value === "_" || value === "$" || /[\p{L}\p{N}]/u.test(value);
function isQuotedKey(code, index) {
  while (index < code.length && /\s/.test(code[index])) index++;
  return code[index] === ":";
}
function tokenize(code, options) {
  if (typeof options?.tokenize === "function") return options.tokenize(code, options);
  const keywords25 = options?.keywords || /* @__PURE__ */ new Set();
  const typeKeywords11 = options?.typeKeywords || /* @__PURE__ */ new Set();
  const onCommentStart11 = options?.onCommentStart || noComment;
  const onCommentEnd11 = options?.onCommentEnd || noComment;
  const normalize = options?.caseInsensitive ? (value) => value.toLowerCase() : (value) => value;
  const tokens = [];
  let lastSignificant = "";
  function append(type, value) {
    if (!value) return;
    tokens.push([type, value]);
    if (type !== T_SPACE && type !== T_BREAK) lastSignificant = value;
  }
  for (let i = 0; i < code.length; ) {
    const curr = code[i];
    const next = code[i + 1];
    const commentType = onCommentStart11(curr, next, i, code);
    if (commentType) {
      const start = i++;
      while (i < code.length) {
        if (onCommentEnd11(code[i - 1], code[i], i, code) == commentType) {
          i++;
          break;
        }
        i++;
      }
      append(T_COMMENT, code.slice(start, i));
      continue;
    }
    const literalLength = options?.onLiteral?.(curr, i, code);
    if (literalLength) {
      append(T_STRING, code.slice(i, i + literalLength));
      i += literalLength;
      continue;
    }
    if (typeof options?.onQuote === "function" && curr === "'") {
      const length = options.onQuote(curr, i, code);
      if (typeof length === "number" && length >= 1) {
        append(T_IDENTIFIER, code.slice(i, i + length));
        i += length;
        continue;
      }
    }
    if (curr === '"' || curr === "'" || options?.templateStrings && curr === "`") {
      const quote = curr;
      const start = i++;
      while (i < code.length) {
        if (code[i] === quote && code[i - 1] !== "\\") {
          i++;
          break;
        }
        i++;
      }
      const value = code.slice(start, i);
      append(options?.quotedKeys && isQuotedKey(code, i) ? T_PROPERTY : T_STRING, value);
      continue;
    }
    if (curr === "\n") {
      append(T_BREAK, curr);
      i++;
      continue;
    }
    if (/[^\S\r\n]/.test(curr)) {
      const start = i++;
      while (i < code.length && /[^\S\r\n]/.test(code[i])) i++;
      append(T_SPACE, code.slice(start, i));
      continue;
    }
    if (isWord(curr)) {
      const start = i++;
      while (i < code.length && isWord(code[i])) i++;
      const value = code.slice(start, i);
      const normalized = normalize(value);
      const type = typeKeywords11.has(normalized) ? T_CLASS : keywords25.has(normalized) ? T_KEYWORD : lastSignificant === "." ? T_PROPERTY : /^\d/.test(value) || value === "null" || /^\p{Lu}/u.test(value) ? T_CLASS : T_IDENTIFIER;
      append(type, value);
      continue;
    }
    if (signs.has(curr)) {
      append(T_SIGN, curr);
      i++;
      continue;
    }
    append(T_STRING, curr);
    i++;
  }
  return tokens;
}
function parse(code, options) {
  const parsed = assemble(code, tokenize(code, options));
  if (options?.annotateLine) {
    for (const line of parsed.lines) options.annotateLine(line);
  }
  return parsed;
}
function render(parsed, options) {
  return toHtml(generate(parsed, options));
}

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/c.js
var c_exports = {};
__export(c_exports, {
  keywords: () => keywords2,
  onCommentEnd: () => onCommentEnd,
  onCommentStart: () => onCommentStart,
  typeKeywords: () => typeKeywords
});

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/clike-base.js
var onCommentStart = (currentChar, nextChar) => {
  const pair = currentChar + nextChar;
  if (pair === "//") return 1;
  if (pair === "/*") return 1;
  return 0;
};
var onCommentEnd = (prevChar, currChar) => {
  if (currChar === "\n") return 1;
  return prevChar + currChar === "*/" ? 1 : 0;
};

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/c.js
var typeKeywords = /* @__PURE__ */ new Set([
  "void",
  "char",
  "short",
  "int",
  "long",
  "float",
  "double",
  "signed",
  "unsigned",
  "_Bool",
  "_Complex",
  "_Imaginary"
]);
var keywords2 = /* @__PURE__ */ new Set([
  "auto",
  "break",
  "case",
  "const",
  "continue",
  "default",
  "do",
  "else",
  "enum",
  "extern",
  "for",
  "goto",
  "if",
  "inline",
  "register",
  "restrict",
  "return",
  "sizeof",
  "static",
  "struct",
  "switch",
  "typedef",
  "union",
  "volatile",
  "while",
  "_Alignas",
  "_Alignof",
  "_Atomic",
  "_Generic",
  "_Noreturn",
  "_Static_assert",
  "_Thread_local"
]);

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/cpp.js
var cpp_exports = {};
__export(cpp_exports, {
  keywords: () => keywords3,
  onCommentEnd: () => onCommentEnd,
  onCommentStart: () => onCommentStart,
  typeKeywords: () => typeKeywords2
});
var keywords3 = /* @__PURE__ */ new Set([
  "alignas",
  "alignof",
  "and",
  "and_eq",
  "asm",
  "auto",
  "bitand",
  "bitor",
  "break",
  "case",
  "catch",
  "class",
  "compl",
  "concept",
  "const",
  "consteval",
  "constexpr",
  "constinit",
  "const_cast",
  "continue",
  "co_await",
  "co_return",
  "co_yield",
  "decltype",
  "default",
  "delete",
  "do",
  "dynamic_cast",
  "else",
  "enum",
  "explicit",
  "export",
  "extern",
  "false",
  "for",
  "friend",
  "goto",
  "if",
  "inline",
  "mutable",
  "namespace",
  "new",
  "noexcept",
  "not",
  "not_eq",
  "nullptr",
  "operator",
  "or",
  "or_eq",
  "private",
  "protected",
  "public",
  "register",
  "reinterpret_cast",
  "requires",
  "return",
  "sizeof",
  "static",
  "static_assert",
  "static_cast",
  "struct",
  "switch",
  "template",
  "this",
  "thread_local",
  "throw",
  "true",
  "try",
  "typedef",
  "typeid",
  "typename",
  "union",
  "using",
  "virtual",
  "volatile",
  "while",
  "xor",
  "xor_eq"
]);
var typeKeywords2 = /* @__PURE__ */ new Set([
  "bool",
  "char",
  "char8_t",
  "char16_t",
  "char32_t",
  "double",
  "float",
  "int",
  "long",
  "short",
  "signed",
  "unsigned",
  "void",
  "wchar_t"
]);

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/csharp.js
var csharp_exports = {};
__export(csharp_exports, {
  keywords: () => keywords4,
  onCommentEnd: () => onCommentEnd,
  onCommentStart: () => onCommentStart,
  typeKeywords: () => typeKeywords3
});
var keywords4 = /* @__PURE__ */ new Set([
  "abstract",
  "as",
  "async",
  "await",
  "base",
  "break",
  "case",
  "catch",
  "checked",
  "class",
  "const",
  "continue",
  "default",
  "delegate",
  "do",
  "else",
  "enum",
  "event",
  "explicit",
  "extern",
  "false",
  "finally",
  "fixed",
  "for",
  "foreach",
  "from",
  "get",
  "global",
  "goto",
  "if",
  "implicit",
  "in",
  "init",
  "interface",
  "internal",
  "into",
  "is",
  "join",
  "let",
  "lock",
  "namespace",
  "new",
  "null",
  "on",
  "operator",
  "orderby",
  "out",
  "override",
  "params",
  "partial",
  "private",
  "protected",
  "public",
  "readonly",
  "record",
  "ref",
  "remove",
  "required",
  "return",
  "sealed",
  "select",
  "set",
  "sizeof",
  "stackalloc",
  "static",
  "struct",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "unchecked",
  "unsafe",
  "using",
  "value",
  "virtual",
  "volatile",
  "when",
  "where",
  "while",
  "with",
  "yield"
]);
var typeKeywords3 = /* @__PURE__ */ new Set([
  "bool",
  "byte",
  "char",
  "decimal",
  "double",
  "dynamic",
  "float",
  "int",
  "long",
  "nint",
  "nuint",
  "object",
  "sbyte",
  "short",
  "string",
  "uint",
  "ulong",
  "ushort",
  "void"
]);

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/css.js
var css_exports = {};
__export(css_exports, {
  keywords: () => keywords5,
  onCommentEnd: () => onCommentEnd2,
  onCommentStart: () => onCommentStart2,
  onLiteral: () => onLiteral,
  tokenize: () => tokenize2
});
var keywords5 = /* @__PURE__ */ new Set([
  // css keywords like @media, @import, @keyframes, etc.
  "@media",
  "@import",
  "@keyframes",
  "@font-face",
  "@supports",
  "@page",
  "@counter-style",
  "@font-feature-values",
  "@viewport",
  "@counter-style",
  "@font-feature-values",
  "@document"
]);
var onCommentStart2 = (currentChar, nextChar) => {
  return "/*" === currentChar + nextChar ? 1 : 0;
};
var onCommentEnd2 = (prevChar, currChar) => {
  return "*/" === prevChar + currChar ? 1 : 0;
};
var onLiteral = (curr, index, code) => {
  if (curr !== "#") return 0;
  return code.slice(index).match(/^#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})(?![\w-])/i)?.[0].length || 0;
};
var isIgnored = (type) => type === T_SPACE || type === T_BREAK || type === T_COMMENT;
var isPropertyPart = ([type, value]) => type === T_IDENTIFIER || type === T_CLASS || type === T_SIGN && value === "-";
var opensBlock = (tokens, start) => {
  let parentheses = 0;
  let brackets = 0;
  for (let index = start; index < tokens.length; index++) {
    const [type, value] = tokens[index];
    if (type !== T_SIGN) continue;
    if (value === "(") parentheses++;
    else if (value === ")") parentheses--;
    else if (value === "[") brackets++;
    else if (value === "]") brackets--;
    else if (!parentheses && !brackets && value === "{") return true;
    else if (!parentheses && !brackets && (value === ";" || value === "}")) return false;
  }
  return false;
};
var tokenize2 = (code, options) => {
  const tokens = tokenize(code, { ...options, tokenize: void 0 });
  let blockDepth = 0;
  let declarationStart = false;
  for (let index = 0; index < tokens.length; index++) {
    const [type, value] = tokens[index];
    if (type === T_SIGN && value === "{") {
      blockDepth++;
      declarationStart = true;
      continue;
    }
    if (type === T_SIGN && value === "}") {
      blockDepth--;
      declarationStart = false;
      continue;
    }
    if (type === T_SIGN && value === ";") {
      declarationStart = blockDepth > 0;
      continue;
    }
    if (!declarationStart || isIgnored(type)) continue;
    const propertyStart = index;
    let propertyEnd = index;
    while (propertyEnd < tokens.length && isPropertyPart(tokens[propertyEnd])) {
      propertyEnd++;
    }
    let colon = propertyEnd;
    while (colon < tokens.length && isIgnored(tokens[colon][0])) colon++;
    if (propertyEnd > propertyStart && tokens[colon]?.[0] === T_SIGN && tokens[colon][1] === ":" && !opensBlock(tokens, colon + 1)) {
      const property = tokens.slice(propertyStart, propertyEnd).map(([, part]) => part).join("");
      tokens.splice(propertyStart, propertyEnd - propertyStart, [T_PROPERTY, property]);
    }
    declarationStart = false;
  }
  return tokens;
};

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/diff.js
var diff_exports = {};
__export(diff_exports, {
  annotateLine: () => annotateLine,
  keywords: () => keywords6
});
var keywords6 = /* @__PURE__ */ new Set([]);
var annotateLine = (line) => {
  let annotation = "";
  if (line.value.startsWith("+") && !line.value.startsWith("+++")) annotation = "diff-add";
  else if (line.value.startsWith("-") && !line.value.startsWith("---")) annotation = "diff-remove";
  else if (line.value.startsWith("@@")) annotation = "diff-hunk";
  else if (/^(diff --git|index |--- |\+\+\+ )/.test(line.value)) {
    annotation = "diff-meta";
    for (const token of line.tokens) {
      if (token.type === "property") token.type = "identifier";
    }
  }
  if (annotation) line.annotations.push(annotation);
};

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/dockerfile.js
var dockerfile_exports = {};
__export(dockerfile_exports, {
  caseInsensitive: () => caseInsensitive,
  keywords: () => keywords7,
  onCommentEnd: () => onCommentEnd3,
  onCommentStart: () => onCommentStart3
});

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/hash-comment-base.js
var onCommentStart3 = (currentChar) => currentChar === "#" ? 1 : 0;
var onCommentEnd3 = (_prevChar, currChar) => currChar === "\n" ? 1 : 0;

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/dockerfile.js
var caseInsensitive = true;
var keywords7 = /* @__PURE__ */ new Set(["add", "arg", "cmd", "copy", "entrypoint", "env", "expose", "from", "healthcheck", "label", "maintainer", "onbuild", "run", "shell", "stopsignal", "user", "volume", "workdir"]);

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/go.js
var go_exports = {};
__export(go_exports, {
  keywords: () => keywords8,
  onCommentEnd: () => onCommentEnd,
  onCommentStart: () => onCommentStart,
  typeKeywords: () => typeKeywords4
});
var typeKeywords4 = /* @__PURE__ */ new Set([
  "bool",
  "byte",
  "complex64",
  "complex128",
  "error",
  "float32",
  "float64",
  "int",
  "int8",
  "int16",
  "int32",
  "int64",
  "rune",
  "string",
  "uint",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "uintptr"
]);
var keywords8 = /* @__PURE__ */ new Set([
  "break",
  "case",
  "chan",
  "const",
  "continue",
  "default",
  "defer",
  "else",
  "fallthrough",
  "for",
  "func",
  "go",
  "goto",
  "if",
  "import",
  "interface",
  "map",
  "package",
  "range",
  "return",
  "select",
  "struct",
  "switch",
  "type",
  "var"
]);

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/html.js
var html_exports = {};
__export(html_exports, {
  jsx: () => jsx,
  keywords: () => keywords9,
  onCommentEnd: () => onCommentEnd4,
  onCommentStart: () => onCommentStart4,
  regex: () => regex,
  templateStrings: () => templateStrings,
  tokenize: () => tokenize4
});

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/javascript-runtime.js
var JSXBrackets = /* @__PURE__ */ new Set(["<", ">", "{", "}", "[", "]"]);
var Keywords_Js = /* @__PURE__ */ new Set([
  "for",
  "do",
  "while",
  "if",
  "else",
  "return",
  "function",
  "var",
  "let",
  "const",
  "true",
  "false",
  "undefined",
  "this",
  "new",
  "delete",
  "typeof",
  "in",
  "instanceof",
  "void",
  "break",
  "continue",
  "switch",
  "case",
  "default",
  "throw",
  "try",
  "catch",
  "finally",
  "debugger",
  "with",
  "yield",
  "async",
  "await",
  "class",
  "extends",
  "super",
  "import",
  "export",
  "from",
  "static"
]);
var Keywords_Ts = /* @__PURE__ */ new Set([
  ...Keywords_Js,
  "type",
  "interface",
  "enum",
  "implements",
  "readonly",
  "abstract",
  "declare",
  "namespace",
  "module",
  "private",
  "protected",
  "public",
  "override",
  "keyof",
  "infer",
  "is",
  "asserts",
  "satisfies",
  "as",
  "unknown",
  "never",
  "any",
  "number",
  "string",
  "boolean",
  "bigint",
  "symbol",
  "object"
]);
var Signs = /* @__PURE__ */ new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "=",
  "!",
  "&",
  "|",
  "^",
  "~",
  "!",
  "?",
  ":",
  ".",
  ",",
  ";",
  `'`,
  '"',
  ".",
  "(",
  ")",
  "[",
  "]",
  "#",
  "@",
  "\\",
  ...JSXBrackets
]);
var DefaultOptions = {
  keywords: Keywords_Js,
  onCommentStart: isCommentStart_Js,
  onCommentEnd: isCommentEnd_Js,
  jsx: true,
  regex: true,
  templateStrings: true
};
function resolveHighlightOptions(options) {
  return {
    ...DefaultOptions,
    ...options
  };
}
function isLikelyTypeScript(code) {
  let tsScore = 0;
  if (/\binterface\s+[A-Za-z_$][\w$]*/.test(code)) tsScore += 2;
  if (/\btype\s+[A-Za-z_$][\w$]*\s*=/.test(code)) tsScore += 2;
  if (/\benum\s+[A-Za-z_$][\w$]*/.test(code)) tsScore += 2;
  if (/\b(?:implements|readonly|declare|namespace|satisfies|infer|keyof|asserts)\b/.test(code)) tsScore += 2;
  if (/:\s*[A-Za-z_$][\w$]*(?:<[^>\n]+>)?(?:\[\])?(?=\s*[,)=;{])/m.test(code)) tsScore += 1;
  if (/\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*:\s*/.test(code)) tsScore += 1;
  if (/\)\s*:\s*[A-Za-z_$][\w$]*(?:<[^>\n]+>)?(?:\[\])?\s*(?:=>|\{)/.test(code)) tsScore += 1;
  return tsScore >= 2;
}
function isTypeParameterListStart(code, startIndex) {
  if (code[startIndex] !== "<") return false;
  let depth = 0;
  let sawIdentifierStart = false;
  for (let i = startIndex; i < code.length; i++) {
    const ch = code[i];
    if (ch === "<") {
      depth++;
      continue;
    }
    if (ch === ">") {
      depth--;
      if (depth === 0) {
        let next = i + 1;
        while (next < code.length && /\s/.test(code[next])) next++;
        if (!(sawIdentifierStart && code[next] === "(")) return false;
        const tail = code.slice(next, next + 320);
        return /\)\s*(?::[\s\S]{0,120}?)?=>/.test(tail);
      }
      continue;
    }
    if (depth === 0) continue;
    if (/[$A-Za-z_]/.test(ch)) {
      sawIdentifierStart = true;
      continue;
    }
    if (/[\s,\.\=\?\:\|\&\[\]]/.test(ch)) continue;
    return false;
  }
  return false;
}
function isSpaces(str) {
  return /^[^\S\r\n]+$/g.test(str);
}
function isSign(ch) {
  return Signs.has(ch);
}
function isWord2(chr) {
  return /^[\w_]+$/.test(chr) || hasUnicode(chr);
}
function isCls(str) {
  const chr0 = str[0];
  return isWord2(chr0) && chr0 === chr0.toUpperCase() || str === "null";
}
function hasUnicode(s) {
  return /[^\u0000-\u007f]/.test(s);
}
function isAlpha(chr) {
  return /^[a-zA-Z]$/.test(chr);
}
function isIdentifierChar(chr) {
  return isAlpha(chr) || hasUnicode(chr);
}
function isIdentifier(str) {
  return isIdentifierChar(str[0]) && (str.length === 1 || isWord2(str.slice(1)));
}
function isStrTemplateChr(chr) {
  return chr === "`";
}
function isSingleQuotes(chr) {
  return chr === '"' || chr === "'";
}
function isCommentStart_Js(curr, next) {
  const str = curr + next;
  if (str === "/*") return 2;
  return str === "//" ? 1 : 0;
}
function isCommentEnd_Js(prev, curr) {
  return prev + curr === "*/" ? 2 : curr === "\n" ? 1 : 0;
}
function isRegexStart(str) {
  return str[0] === "/" && !isCommentStart_Js(str[0], str[1]);
}
function isPropertyKey(code, quoteEnd) {
  let i = quoteEnd + 1;
  while (i < code.length && /\s/.test(code[i])) i++;
  return code[i] === ":";
}
function tokenize3(code, options) {
  const mergedOptions = resolveHighlightOptions(options);
  const hasCustomKeywords = mergedOptions.keywords !== DefaultOptions.keywords;
  const isTs = typeof mergedOptions.typescript === "boolean" ? mergedOptions.typescript : isLikelyTypeScript(code);
  const resolvedKeywords = hasCustomKeywords ? mergedOptions.keywords : isTs ? Keywords_Ts : Keywords_Js;
  const {
    onCommentStart: onCommentStart11,
    onCommentEnd: onCommentEnd11
  } = mergedOptions;
  const resolvedTypeKeywords = mergedOptions.typeKeywords instanceof Set ? mergedOptions.typeKeywords : null;
  const supportsJsx = mergedOptions.jsx !== false;
  const supportsRegex = mergedOptions.regex !== false;
  const supportsTemplateStrings = mergedOptions.templateStrings !== false;
  const normalizeKeyword = mergedOptions.caseInsensitive ? (token) => token.toLowerCase() : (token) => token;
  const isTemplateQuote = (chr) => supportsTemplateStrings && isStrTemplateChr(chr);
  let current = "";
  let type = -1;
  let last = [-1, ""];
  let beforeLast = [-2, ""];
  const tokens = [];
  let __jsxEnter = false;
  let __jsxTag = 0;
  let __jsxExpr = false;
  let __jsxStack = 0;
  const __jsxChild = () => __jsxEnter && !__jsxExpr && !__jsxTag;
  const inJsxTag = () => __jsxTag && !__jsxChild();
  const inJsxLiterals = () => !__jsxTag && __jsxChild() && !__jsxExpr && __jsxStack > 0;
  let __strQuote = null;
  let __strTokenStart = 0;
  let __regexQuoteStart = false;
  let __strTemplateExprStack = 0;
  let __strTemplateQuoteStack = 0;
  const inStringQuotes = () => __strQuote !== null;
  const inRegexQuotes = () => __regexQuoteStart;
  const inStrTemplateLiterals = () => __strTemplateQuoteStack > __strTemplateExprStack;
  const inStrTemplateExpr = () => __strTemplateQuoteStack > 0 && __strTemplateQuoteStack === __strTemplateExprStack;
  const inStringContent = () => inStringQuotes() || inStrTemplateLiterals();
  function classify(token) {
    const isLineBreak = token === "\n";
    if (inJsxTag()) {
      if (inStringQuotes()) {
        return T_STRING;
      }
      const [, lastToken] = last;
      if (isIdentifier(token)) {
        if (lastToken === "<" || lastToken === "</")
          return T_ENTITY;
      }
    }
    const isJsxLiterals = inJsxLiterals();
    if (isJsxLiterals) return T_JSX_LITERALS;
    if (inStringQuotes() || inStrTemplateLiterals()) {
      return T_STRING;
    } else if (resolvedTypeKeywords && resolvedTypeKeywords.has(normalizeKeyword(token))) {
      return last[1] === "." ? T_IDENTIFIER : T_CLASS;
    } else if (resolvedKeywords.has(normalizeKeyword(token))) {
      return last[1] === "." ? T_IDENTIFIER : T_KEYWORD;
    } else if (isLineBreak) {
      return T_BREAK;
    } else if (isSpaces(token)) {
      return T_SPACE;
    } else if (token.split("").every(isSign)) {
      return T_SIGN;
    } else if (isCls(token)) {
      return inJsxTag() ? T_IDENTIFIER : T_CLASS;
    } else {
      if (isIdentifier(token)) {
        const isLastPropDot = last[1] === "." && isIdentifier(beforeLast[1]);
        if (!inStringContent() && !isLastPropDot) return T_IDENTIFIER;
        if (isLastPropDot) return T_PROPERTY;
      }
      return T_STRING;
    }
  }
  const append = (type_, token_) => {
    if (token_) {
      current = token_;
    }
    if (current) {
      type = typeof type_ === "number" ? type_ : classify(current);
      const pair = [type, current];
      if (type !== T_SPACE && type !== T_BREAK) {
        beforeLast = last;
        last = pair;
      }
      tokens.push(pair);
    }
    current = "";
  };
  for (let i = 0; i < code.length; i++) {
    const curr = code[i];
    const prev = code[i - 1];
    const next = code[i + 1];
    const p_c = prev + curr;
    const c_n = curr + next;
    if (typeof mergedOptions.onQuote === "function" && curr === "'" && !inStringQuotes() && !inJsxLiterals() && !inStrTemplateLiterals()) {
      const rawLen = mergedOptions.onQuote(curr, i, code);
      if (typeof rawLen === "number" && rawLen >= 1 && !Number.isNaN(rawLen)) {
        const len = Math.min(rawLen, code.length - i);
        const end = i + len;
        append();
        current = code.slice(i, end);
        append(T_IDENTIFIER);
        i = end - 1;
        continue;
      }
    }
    if (isSingleQuotes(curr) && !inJsxLiterals() && !inStrTemplateLiterals()) {
      append();
      let isStringClose = false;
      if (prev !== `\\`) {
        if (__strQuote && curr === __strQuote) {
          __strQuote = null;
          isStringClose = true;
        } else if (!__strQuote) {
          __strQuote = curr;
          __strTokenStart = tokens.length;
        }
      }
      append(T_STRING, curr);
      if (mergedOptions.quotedKeys && isStringClose && isPropertyKey(code, i)) {
        for (let tokenIndex = __strTokenStart; tokenIndex < tokens.length; tokenIndex++) {
          tokens[tokenIndex][0] = T_PROPERTY;
        }
      }
      continue;
    }
    if (!inStrTemplateLiterals()) {
      if (prev !== "\\n" && isTemplateQuote(curr)) {
        append();
        append(T_STRING, curr);
        __strTemplateQuoteStack++;
        continue;
      }
    }
    if (inStrTemplateLiterals()) {
      if (prev !== "\\n" && isTemplateQuote(curr)) {
        if (__strTemplateQuoteStack > 0) {
          append();
          __strTemplateQuoteStack--;
          append(T_STRING, curr);
          continue;
        }
      }
      if (c_n === "${") {
        __strTemplateExprStack++;
        append(T_STRING);
        append(T_SIGN, c_n);
        i++;
        continue;
      }
    }
    if (inStrTemplateExpr() && curr === "}") {
      append();
      __strTemplateExprStack--;
      append(T_SIGN, curr);
      continue;
    }
    if (__jsxChild()) {
      if (curr === "{") {
        append();
        append(T_SIGN, curr);
        __jsxExpr = true;
        continue;
      }
    }
    if (__jsxEnter) {
      if (!__jsxTag && curr === "<") {
        append();
        if (next === "/") {
          __jsxTag = 2;
          current = c_n;
          i++;
        } else {
          __jsxTag = 1;
          current = curr;
        }
        append(T_SIGN);
        continue;
      }
      if (__jsxTag) {
        if (curr === ">" && !"/=".includes(prev)) {
          append();
          if (__jsxTag === 1) {
            __jsxTag = 0;
            __jsxStack++;
          } else {
            __jsxTag = 0;
            __jsxEnter = false;
          }
          append(T_SIGN, curr);
          continue;
        }
        if (c_n === "/>" || c_n === "</") {
          if (current !== "<" && current !== "/") {
            append();
          }
          if (c_n === "/>") {
            __jsxTag = 0;
          } else {
            __jsxStack--;
          }
          if (!__jsxStack)
            __jsxEnter = false;
          current = c_n;
          i++;
          append(T_SIGN);
          continue;
        }
        if (curr === "<") {
          append();
          current = curr;
          append(T_SIGN);
          continue;
        }
        if (curr === "-" && current && !inStringContent() && !inJsxLiterals()) {
          let end = i + 1;
          while (end < code.length && /[$\w-]/.test(code[end])) end++;
          append(T_PROPERTY, current + code.slice(i, end));
          i = end - 1;
          continue;
        }
        if (next === "=" && !inStringContent()) {
          if (!isSpaces(curr)) {
            if (isSpaces(current)) {
              append();
            }
            const prop = current + curr;
            if (isIdentifier(prop)) {
              append(T_PROPERTY, prop);
              continue;
            }
          }
        }
      }
    }
    if (supportsJsx && !__jsxTag && (curr === "<" && isIdentifierChar(next) || c_n === "</")) {
      let prevNonSpace = i - 1;
      while (prevNonSpace >= 0 && /\s/.test(code[prevNonSpace])) prevNonSpace--;
      const prevChar = prevNonSpace >= 0 ? code[prevNonSpace] : "";
      const [lastType, lastTok] = last;
      let typeArgFromPending = false;
      let jsxFromPending = false;
      if (current && !isSpaces(current)) {
        const w = current;
        if (isCls(w) || w === "true" || w === "false") {
          typeArgFromPending = true;
        } else if (resolvedKeywords.has(w) && isIdentifier(w)) {
          jsxFromPending = true;
        } else if (isIdentifier(w)) {
          typeArgFromPending = true;
        }
      }
      const isTsTypeArgStart = curr === "<" && /[$\w\]\)]/.test(prevChar) && (typeArgFromPending || !jsxFromPending && (lastType === T_IDENTIFIER || lastType === T_CLASS || lastType === T_SIGN && (lastTok === ")" || lastTok === "]")));
      const isTsGenericStart = curr === "<" && isTypeParameterListStart(code, i);
      if (!isTsTypeArgStart && !isTsGenericStart) {
        __jsxTag = next === "/" ? 2 : 1;
      }
      if (curr === "<" && (next === "/" || isAlpha(next))) {
        if (!isTsTypeArgStart && !isTsGenericStart && !inStringContent() && !inJsxLiterals() && !inRegexQuotes()) {
          __jsxEnter = true;
        }
      }
    }
    const isQuotationChar = isSingleQuotes(curr) || isTemplateQuote(curr);
    const isStringTemplateLiterals = inStrTemplateLiterals();
    const isRegexChar = supportsRegex && !__jsxEnter && isRegexStart(c_n);
    const isJsxLiterals = inJsxLiterals();
    if (isQuotationChar || isStringTemplateLiterals || isSingleQuotes(__strQuote)) {
      current += curr;
    } else if (isRegexChar) {
      append();
      const [lastType, lastToken] = last;
      if (isRegexChar && lastType !== -1 && !(lastType === T_SIGN && ")" !== lastToken || lastType === T_COMMENT)) {
        current = curr;
        append();
        continue;
      }
      __regexQuoteStart = true;
      const start = i++;
      const isEof = () => i >= code.length;
      const isEol = () => isEof() || code[i] === "\n";
      let foundClose = false;
      let inCharClass = false;
      for (; !isEol(); i++) {
        const ch = code[i];
        const escaped = code[i - 1] === "\\";
        if (!escaped && ch === "[") inCharClass = true;
        if (!escaped && ch === "]") inCharClass = false;
        if (ch === "/" && !inCharClass && !escaped) {
          foundClose = true;
          while (start !== i && /^[a-z]$/.test(code[i + 1]) && !isEol()) {
            i++;
          }
          break;
        }
      }
      __regexQuoteStart = false;
      if (start !== i && foundClose) {
        current = code.slice(start, i + 1);
        append(T_STRING);
      } else {
        current = curr;
        append();
        i = start;
      }
    } else if (onCommentStart11(curr, next, i, code)) {
      append();
      const start = i;
      const startCommentType = onCommentStart11(curr, next, i, code);
      if (startCommentType) {
        for (; i < code.length; i++) {
          const endCommentType = onCommentEnd11(code[i - 1], code[i], i, code);
          if (endCommentType == startCommentType) break;
        }
      }
      current = code.slice(start, i + 1);
      append(T_COMMENT);
    } else if (curr === " " || curr === "\n") {
      if (curr === " " && (isSpaces(current) || !current || isJsxLiterals)) {
        let end = i + 1;
        while (code[end] === " ") end++;
        current += code.slice(i, end);
        i = end - 1;
        if (code[end] === "<") {
          append();
        }
      } else {
        append();
        current = curr;
        append();
      }
    } else {
      if (__jsxExpr && curr === "}") {
        append();
        current = curr;
        append();
        __jsxExpr = false;
      } else if (
        // it's jsx literals and is not a jsx bracket
        isJsxLiterals && !JSXBrackets.has(curr) || // it's template literal content (including quotes)
        inStrTemplateLiterals() || // same type char as previous one in current token
        (isWord2(curr) === isWord2(current[current.length - 1]) || __jsxChild()) && !Signs.has(curr)
      ) {
        current += curr;
      } else {
        if (p_c === "</") {
          current = p_c;
        }
        append();
        if (p_c !== "</") {
          current = curr;
        }
        if (c_n === "</" || c_n === "/>") {
          current = c_n;
          append();
          i++;
        } else if (JSXBrackets.has(curr)) append();
      }
    }
  }
  append();
  return tokens;
}

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/html.js
var keywords9 = /* @__PURE__ */ new Set([]);
var jsx = true;
var regex = false;
var templateStrings = false;
var tokenize4 = tokenize3;
var onCommentStart4 = (_currentChar, _nextChar, index, code) => code.startsWith("<!--", index) ? 2 : 0;
var onCommentEnd4 = (_prevChar, _currChar, index, code) => code.slice(index - 2, index + 1) === "-->" ? 2 : 0;

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/graphql.js
var graphql_exports = {};
__export(graphql_exports, {
  keywords: () => keywords10,
  onCommentEnd: () => onCommentEnd3,
  onCommentStart: () => onCommentStart3,
  typeKeywords: () => typeKeywords5
});
var keywords10 = /* @__PURE__ */ new Set(["directive", "enum", "extend", "fragment", "implements", "input", "interface", "mutation", "on", "query", "repeatable", "scalar", "schema", "subscription", "type", "union"]);
var typeKeywords5 = /* @__PURE__ */ new Set(["Boolean", "Float", "ID", "Int", "String"]);

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/hcl.js
var hcl_exports = {};
__export(hcl_exports, {
  keywords: () => keywords11,
  onCommentEnd: () => onCommentEnd5,
  onCommentStart: () => onCommentStart5
});
var keywords11 = /* @__PURE__ */ new Set(["false", "for", "if", "in", "null", "true"]);
var onCommentStart5 = (curr, next) => curr === "#" ? 1 : curr + next === "//" ? 1 : curr + next === "/*" ? 2 : 0;
var onCommentEnd5 = (prev, curr) => curr === "\n" ? 1 : prev + curr === "*/" ? 2 : 0;

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/java.js
var java_exports = {};
__export(java_exports, {
  keywords: () => keywords12,
  onCommentEnd: () => onCommentEnd,
  onCommentStart: () => onCommentStart,
  typeKeywords: () => typeKeywords6
});
var typeKeywords6 = /* @__PURE__ */ new Set([
  "boolean",
  "byte",
  "char",
  "double",
  "float",
  "int",
  "long",
  "short",
  "void"
]);
var keywords12 = /* @__PURE__ */ new Set([
  "abstract",
  "assert",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "do",
  "else",
  "enum",
  "extends",
  "final",
  "finally",
  "for",
  "goto",
  "if",
  "implements",
  "import",
  "instanceof",
  "interface",
  "native",
  "new",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "strictfp",
  "super",
  "switch",
  "synchronized",
  "this",
  "throw",
  "throws",
  "transient",
  "try",
  "volatile",
  "while"
]);

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/json.js
var json_exports = {};
__export(json_exports, {
  keywords: () => keywords13,
  onCommentEnd: () => onCommentEnd,
  onCommentStart: () => onCommentStart,
  quotedKeys: () => quotedKeys
});
var keywords13 = /* @__PURE__ */ new Set(["true", "false", "null"]);
var quotedKeys = true;

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/javascript.js
var javascript_exports = {};
__export(javascript_exports, {
  tokenize: () => tokenize5
});
var tokenize5 = tokenize3;

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/kotlin.js
var kotlin_exports = {};
__export(kotlin_exports, {
  keywords: () => keywords14,
  onCommentEnd: () => onCommentEnd,
  onCommentStart: () => onCommentStart,
  typeKeywords: () => typeKeywords7
});
var keywords14 = /* @__PURE__ */ new Set(["as", "break", "by", "catch", "class", "companion", "const", "constructor", "continue", "data", "do", "else", "enum", "false", "finally", "for", "fun", "get", "if", "import", "in", "infix", "init", "interface", "internal", "is", "lateinit", "noinline", "null", "object", "open", "operator", "out", "override", "package", "private", "protected", "public", "reified", "return", "sealed", "set", "suspend", "tailrec", "this", "throw", "true", "try", "typealias", "val", "var", "vararg", "when", "where", "while"]);
var typeKeywords7 = /* @__PURE__ */ new Set(["Any", "Boolean", "Byte", "Char", "Double", "Float", "Int", "Long", "Nothing", "Short", "String", "Unit"]);

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/markdown.js
var markdown_exports = {};
__export(markdown_exports, {
  annotateLine: () => annotateLine2,
  keywords: () => keywords15,
  onCommentEnd: () => onCommentEnd6,
  onCommentStart: () => onCommentStart6
});

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/plain-base.js
var onCommentStart6 = () => 0;
var onCommentEnd6 = () => 0;

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/markdown.js
var keywords15 = /* @__PURE__ */ new Set([]);
var annotateLine2 = (line) => {
  let annotation = "";
  if (/^#{1,6}\s/.test(line.value)) annotation = "markdown-heading";
  else if (/^\s*>/.test(line.value)) annotation = "markdown-quote";
  else if (/^\s*(?:[-*+] |\d+[.)] )/.test(line.value)) annotation = "markdown-list";
  else if (/^\s*```/.test(line.value)) annotation = "markdown-fence";
  if (annotation) line.annotations.push(annotation);
};

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/php.js
var php_exports = {};
__export(php_exports, {
  keywords: () => keywords16,
  onCommentEnd: () => onCommentEnd7,
  onCommentStart: () => onCommentStart7,
  typeKeywords: () => typeKeywords8
});
var keywords16 = /* @__PURE__ */ new Set(["abstract", "and", "array", "as", "break", "callable", "case", "catch", "class", "clone", "const", "continue", "declare", "default", "do", "echo", "else", "elseif", "empty", "enddeclare", "endfor", "endforeach", "endif", "endswitch", "endwhile", "enum", "eval", "exit", "extends", "false", "final", "finally", "fn", "for", "foreach", "from", "function", "global", "goto", "if", "implements", "include", "include_once", "instanceof", "insteadof", "interface", "isset", "list", "match", "namespace", "new", "null", "or", "print", "private", "protected", "public", "readonly", "require", "require_once", "return", "static", "switch", "throw", "trait", "true", "try", "unset", "use", "var", "while", "xor", "yield"]);
var typeKeywords8 = /* @__PURE__ */ new Set(["bool", "float", "int", "iterable", "mixed", "never", "object", "string", "void"]);
var onCommentStart7 = (curr, next) => curr === "#" ? 1 : curr + next === "//" ? 1 : curr + next === "/*" ? 2 : 0;
var onCommentEnd7 = (prev, curr) => curr === "\n" ? 1 : prev + curr === "*/" ? 2 : 0;

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/powershell.js
var powershell_exports = {};
__export(powershell_exports, {
  caseInsensitive: () => caseInsensitive2,
  keywords: () => keywords17,
  onCommentEnd: () => onCommentEnd8,
  onCommentStart: () => onCommentStart8
});
var caseInsensitive2 = true;
var keywords17 = /* @__PURE__ */ new Set(["begin", "break", "catch", "class", "continue", "data", "define", "do", "dynamicparam", "else", "elseif", "end", "enum", "exit", "filter", "finally", "for", "foreach", "from", "function", "if", "in", "param", "process", "return", "switch", "throw", "trap", "try", "until", "using", "while"]);
var onCommentStart8 = (curr, next) => curr === "#" ? 1 : curr + next === "<#" ? 2 : 0;
var onCommentEnd8 = (prev, curr) => curr === "\n" ? 1 : prev + curr === "#>" ? 2 : 0;

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/python.js
var python_exports = {};
__export(python_exports, {
  keywords: () => keywords18,
  onCommentEnd: () => onCommentEnd9,
  onCommentStart: () => onCommentStart9
});
var keywords18 = /* @__PURE__ */ new Set([
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield"
]);
var onCommentStart9 = (currentChar, _nextChar) => {
  return currentChar === "#" ? 1 : 0;
};
var onCommentEnd9 = (_prevChar, currChar) => {
  return currChar === "\n" ? 1 : 0;
};

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/rust.js
var rust_exports = {};
__export(rust_exports, {
  keywords: () => keywords19,
  onQuote: () => onQuote
});
var keywords19 = /* @__PURE__ */ new Set([
  "as",
  "break",
  "const",
  "continue",
  "crate",
  "else",
  "enum",
  "extern",
  "false",
  "fn",
  "for",
  "if",
  "impl",
  "in",
  "let",
  "loop",
  "match",
  "mod",
  "move",
  "mut",
  "pub",
  "ref",
  "return",
  "self",
  "Self",
  "static",
  "struct",
  "super",
  "trait",
  "true",
  "type",
  "unsafe",
  "use",
  "where",
  "while",
  "async",
  "await",
  "dyn",
  "abstract",
  "become",
  "box",
  "do",
  "final",
  "macro",
  "override",
  "priv",
  "typeof",
  "unsized",
  "virtual",
  "yield",
  "try"
]);
function onQuote(curr, i, code) {
  if (curr !== "'" || i + 1 >= code.length) return 1;
  const n1 = code[i + 1];
  if (n1 === "\\") {
    let j = i + 2;
    while (j < code.length) {
      if (code[j] === "\\") {
        j += 2;
        continue;
      }
      if (code[j] === "'") return j - i + 1;
      j++;
    }
    return code.length - i;
  }
  if (n1 === "_") {
    return 2;
  }
  if (/[a-zA-Z]/.test(n1)) {
    let j = i + 2;
    while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
    if (j < code.length && code[j] === "'") {
      return j - i + 1;
    }
    return j - i;
  }
  return 1;
}

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/shell.js
var shell_exports = {};
__export(shell_exports, {
  keywords: () => keywords20,
  onCommentEnd: () => onCommentEnd3,
  onCommentStart: () => onCommentStart3
});
var keywords20 = /* @__PURE__ */ new Set([
  "case",
  "coproc",
  "do",
  "done",
  "elif",
  "else",
  "esac",
  "export",
  "fi",
  "for",
  "function",
  "if",
  "in",
  "local",
  "readonly",
  "return",
  "select",
  "then",
  "time",
  "until",
  "while"
]);

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/sql.js
var sql_exports = {};
__export(sql_exports, {
  caseInsensitive: () => caseInsensitive3,
  keywords: () => keywords21,
  onCommentEnd: () => onCommentEnd10,
  onCommentStart: () => onCommentStart10,
  typeKeywords: () => typeKeywords9
});
var keywords21 = /* @__PURE__ */ new Set([
  "add",
  "all",
  "alter",
  "and",
  "as",
  "asc",
  "between",
  "by",
  "case",
  "check",
  "column",
  "constraint",
  "create",
  "cross",
  "database",
  "default",
  "delete",
  "desc",
  "distinct",
  "drop",
  "else",
  "end",
  "exists",
  "foreign",
  "from",
  "full",
  "group",
  "having",
  "in",
  "index",
  "inner",
  "insert",
  "into",
  "is",
  "join",
  "key",
  "left",
  "like",
  "limit",
  "not",
  "null",
  "offset",
  "on",
  "or",
  "order",
  "outer",
  "primary",
  "references",
  "right",
  "select",
  "set",
  "table",
  "then",
  "union",
  "unique",
  "update",
  "values",
  "view",
  "when",
  "where",
  "with"
]);
var typeKeywords9 = /* @__PURE__ */ new Set([
  "bigint",
  "binary",
  "bit",
  "blob",
  "boolean",
  "char",
  "date",
  "datetime",
  "decimal",
  "double",
  "float",
  "int",
  "integer",
  "interval",
  "json",
  "numeric",
  "real",
  "smallint",
  "text",
  "time",
  "timestamp",
  "uuid",
  "varchar"
]);
var caseInsensitive3 = true;
var onCommentStart10 = (currentChar, nextChar) => {
  const pair = currentChar + nextChar;
  if (pair === "--") return 1;
  if (pair === "/*") return 2;
  return 0;
};
var onCommentEnd10 = (prevChar, currChar) => {
  if (currChar === "\n") return 1;
  return prevChar + currChar === "*/" ? 2 : 0;
};

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/swift.js
var swift_exports = {};
__export(swift_exports, {
  keywords: () => keywords22,
  onCommentEnd: () => onCommentEnd,
  onCommentStart: () => onCommentStart,
  typeKeywords: () => typeKeywords10
});
var keywords22 = /* @__PURE__ */ new Set(["as", "associatedtype", "break", "case", "catch", "class", "continue", "convenience", "default", "defer", "deinit", "didSet", "do", "dynamic", "else", "enum", "extension", "fallthrough", "false", "fileprivate", "final", "for", "func", "get", "guard", "if", "import", "in", "indirect", "infix", "init", "inout", "internal", "is", "lazy", "let", "mutating", "nil", "nonmutating", "open", "operator", "override", "precedencegroup", "private", "protocol", "public", "repeat", "required", "rethrows", "return", "self", "set", "some", "static", "struct", "subscript", "super", "switch", "throw", "throws", "true", "try", "typealias", "unowned", "var", "weak", "where", "while", "willSet"]);
var typeKeywords10 = /* @__PURE__ */ new Set(["Any", "Bool", "Character", "Double", "Float", "Int", "Never", "String", "UInt", "Void"]);

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/toml.js
var toml_exports = {};
__export(toml_exports, {
  keywords: () => keywords23,
  onCommentEnd: () => onCommentEnd3,
  onCommentStart: () => onCommentStart3,
  quotedKeys: () => quotedKeys2
});
var keywords23 = /* @__PURE__ */ new Set(["false", "true"]);
var quotedKeys2 = true;

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/typescript.js
var typescript_exports = {};
__export(typescript_exports, {
  tokenize: () => tokenize6
});
var tokenize6 = (code, options) => tokenize3(code, {
  ...options,
  typescript: true
});

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/presets/lang/yaml.js
var yaml_exports = {};
__export(yaml_exports, {
  keywords: () => keywords24,
  onCommentEnd: () => onCommentEnd3,
  onCommentStart: () => onCommentStart3,
  quotedKeys: () => quotedKeys3
});
var keywords24 = /* @__PURE__ */ new Set([
  "false",
  "False",
  "FALSE",
  "no",
  "No",
  "NO",
  "null",
  "Null",
  "NULL",
  "off",
  "Off",
  "OFF",
  "on",
  "On",
  "ON",
  "true",
  "True",
  "TRUE",
  "yes",
  "Yes",
  "YES"
]);
var quotedKeys3 = true;

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/lang.js
function nonJavaScript(config) {
  return {
    ...config,
    jsx: false,
    regex: false,
    templateStrings: false
  };
}
var languages = [
  { id: "javascript", extension: "js", aliases: ["js", "jsx", "node"], config: javascript_exports },
  { id: "typescript", extension: "ts", aliases: ["ts", "tsx"], config: typescript_exports },
  { id: "css", extension: "css", aliases: ["scss"], config: nonJavaScript(css_exports) },
  { id: "python", extension: "py", aliases: ["py", "python3"], config: nonJavaScript(python_exports) },
  { id: "c", extension: "c", aliases: [], config: nonJavaScript(c_exports) },
  { id: "go", extension: "go", aliases: ["golang"], config: nonJavaScript(go_exports) },
  { id: "java", extension: "java", aliases: [], config: nonJavaScript(java_exports) },
  { id: "rust", extension: "rs", aliases: ["rs"], config: nonJavaScript(rust_exports) },
  { id: "json", extension: "json", aliases: ["jsonc"], config: nonJavaScript(json_exports) },
  { id: "diff", extension: "diff", aliases: ["patch"], config: nonJavaScript(diff_exports) },
  { id: "shell", extension: "sh", aliases: ["sh", "bash", "zsh"], config: nonJavaScript(shell_exports) },
  { id: "cpp", extension: "cpp", aliases: ["c++", "cc", "cxx"], config: nonJavaScript(cpp_exports) },
  { id: "csharp", extension: "cs", aliases: ["c#", "cs", "dotnet"], config: nonJavaScript(csharp_exports) },
  { id: "sql", extension: "sql", aliases: [], config: nonJavaScript(sql_exports) },
  { id: "html", extension: "html", aliases: ["htm", "xml"], config: html_exports },
  { id: "yaml", extension: "yaml", aliases: ["yml"], config: nonJavaScript(yaml_exports) },
  { id: "markdown", extension: "md", aliases: ["md", "mdx"], config: nonJavaScript(markdown_exports) },
  { id: "kotlin", extension: "kt", aliases: ["kts"], config: nonJavaScript(kotlin_exports) },
  { id: "swift", extension: "swift", aliases: [], config: nonJavaScript(swift_exports) },
  { id: "php", extension: "php", aliases: [], config: nonJavaScript(php_exports) },
  { id: "toml", extension: "toml", aliases: [], config: nonJavaScript(toml_exports) },
  { id: "powershell", extension: "ps1", aliases: ["pwsh"], config: nonJavaScript(powershell_exports) },
  { id: "dockerfile", extension: "dockerfile", aliases: ["docker"], config: nonJavaScript(dockerfile_exports) },
  { id: "graphql", extension: "graphql", aliases: ["gql"], config: nonJavaScript(graphql_exports) },
  { id: "hcl", extension: "hcl", aliases: ["terraform", "tf"], config: nonJavaScript(hcl_exports) }
];
function normalizeLanguageName(value) {
  return value.trim().toLowerCase().replace(/^\./, "");
}
var languageLookup = /* @__PURE__ */ new Map();
for (const language of languages) {
  const names = /* @__PURE__ */ new Set([language.id, language.extension, ...language.aliases]);
  for (const name of names) {
    const normalized = normalizeLanguageName(name);
    const existing = languageLookup.get(normalized);
    if (existing && existing !== language) {
      throw new Error(
        `Language name "${normalized}" is shared by "${existing.id}" and "${language.id}"`
      );
    }
    languageLookup.set(normalized, language);
  }
}
function findLanguage(name) {
  if (typeof name !== "string") return void 0;
  return languageLookup.get(normalizeLanguageName(name));
}
function lang(name) {
  return findLanguage(name)?.id;
}

// ../../fork/build/bb/node_modules/.pnpm/sugar-high@2.0.1/node_modules/sugar-high/lib/index.js
function configFor(name) {
  return languages.find(({ id }) => id === (name || "javascript"))?.config;
}
function highlight(code, options) {
  const { lang: lang2, cx, mark, markLine } = options || {};
  const parsed = parse(code, configFor(lang2));
  return render(parsed, { cx, mark, markLine });
}

// ../../fork/build/bb/apps/app/src/components/ui/markdown-code-highlight.ts
var EXTRA_LANGUAGE_ALIASES = {
  console: "shell",
  shellscript: "shell",
  h: "c",
  hpp: "cpp",
  hh: "cpp",
  hxx: "cpp",
  less: "css"
};
function highlightMarkdownCode({
  code,
  language
}) {
  if (language?.trim().toLowerCase().replace(/^\./, "") === "pkl")
    return highlightPkl(code);
  const resolved = language === null ? void 0 : lang(language) ?? EXTRA_LANGUAGE_ALIASES[language];
  return highlight(code, { lang: resolved });
}
var PKL_TOKEN_TYPES = {
  keyword: "keyword",
  type: "class",
  identifier: "identifier",
  number: "class",
  string: "string",
  comment: "comment",
  delimiter: "sign",
  white: "space"
};
function highlightPkl(code) {
  let state = [];
  const lines = code.split("\n").map((value, index) => {
    const parsed = tokenizePklLine(value, state);
    state = parsed.state;
    return {
      index,
      value,
      annotations: [],
      tokens: parsed.tokens.map(({ kind, value: value2 }) => ({
        type: PKL_TOKEN_TYPES[kind],
        value: value2
      }))
    };
  });
  return render({ value: code, lines });
}

// <stdin>
window.highlightPkl = (code) => highlightMarkdownCode({ code, language: "pkl" });
