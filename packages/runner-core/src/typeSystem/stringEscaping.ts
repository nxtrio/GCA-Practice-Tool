function escapeQuotedString(value: string): string {
  let output = '"';

  for (const character of value) {
    switch (character) {
      case '"':
        output += '\\"';
        break;
      case "\\":
        output += "\\\\";
        break;
      case "\b":
        output += "\\b";
        break;
      case "\f":
        output += "\\f";
        break;
      case "\n":
        output += "\\n";
        break;
      case "\r":
        output += "\\r";
        break;
      case "\t":
        output += "\\t";
        break;
      default: {
        const codePoint = character.codePointAt(0);
        if (codePoint !== undefined && codePoint < 0x20) {
          output += `\\${codePoint.toString(8).padStart(3, "0")}`;
        } else {
          output += character;
        }
      }
    }
  }

  return `${output}"`;
}

export const javaStringLiteral = escapeQuotedString;
export const cppStringContents = escapeQuotedString;

export function pythonStringLiteral(value: string): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("Unable to serialize Python string literal.");
  }
  return serialized;
}

