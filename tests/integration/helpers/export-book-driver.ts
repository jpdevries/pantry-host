// Runs @pantry-host/shared/export-book under tsx for export-book.test.ts.
// Node's own type stripping can't follow the shared package's extensionless
// imports, so the test spawns this instead of importing the module.
//
// stdin:  { "book": BookInput, "escape": string[], "quantities": number[] }
// stdout: { "book": Book, "escaped": string[], "quantities": string[] }
import { readFileSync } from 'node:fs';
// packages/shared compiles as CommonJS, so take the exports off the default import.
import exportBook from '../../../packages/shared/src/export-book.ts';

const { buildBook, escapeMarkdown, formatQuantity } = exportBook;

const input = JSON.parse(readFileSync(0, 'utf8'));
console.log(JSON.stringify({
  book: input.book ? buildBook(input.book) : null,
  escaped: (input.escape ?? []).map(escapeMarkdown),
  quantities: (input.quantities ?? []).map(formatQuantity),
}));
