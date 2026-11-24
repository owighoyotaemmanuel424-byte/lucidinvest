/**
 * Splits a PostgreSQL script into individual statements so each one can be sent
 * over the Neon HTTP driver, which accepts a single statement per query.
 *
 * Semicolons inside line comments, block comments, quoted strings, quoted
 * identifiers and dollar-quoted bodies (`$$ ... $$`, `$tag$ ... $tag$`) do not
 * terminate a statement.
 */
export function splitSqlStatements(source: string): string[] {
  const statements: string[] = [];
  let current = "";
  let index = 0;
  let dollarTag: string | null = null;

  const push = () => {
    const statement = current.trim();
    if (statement) statements.push(statement);
    current = "";
  };

  while (index < source.length) {
    if (dollarTag) {
      if (source.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length;
        dollarTag = null;
      } else {
        current += source[index];
        index += 1;
      }
      continue;
    }

    const char = source[index];
    const next = source[index + 1];

    if (char === "-" && next === "-") {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end + 1;
      current += source.slice(index, stop);
      index = stop;
      continue;
    }

    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      const stop = end === -1 ? source.length : end + 2;
      current += source.slice(index, stop);
      index = stop;
      continue;
    }

    if (char === "'" || char === '"') {
      const quote = char;
      current += char;
      index += 1;
      while (index < source.length) {
        const inner = source[index];
        current += inner;
        index += 1;
        if (inner === quote) {
          // A doubled quote is an escaped quote inside the literal.
          if (source[index] === quote) {
            current += quote;
            index += 1;
            continue;
          }
          break;
        }
      }
      continue;
    }

    if (char === "$") {
      const match = /^\$[A-Za-z_0-9]*\$/.exec(source.slice(index));
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        index += dollarTag.length;
        continue;
      }
    }

    if (char === ";") {
      push();
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  push();
  return statements;
}
