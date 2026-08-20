// Guard support for #871: a nullable scalar (`string | null`, `number | null`,
// `boolean | null`, or a nullable string-literal union) must be documented
// with its real type — never left to reflect-metadata's fallback of
// `type: object`, which is what happens whenever `@ApiProperty[Optional]`
// unions a scalar with `null` and omits an explicit `type:`.
//
// Lives under test/ (excluded from tsconfig.build.json) rather than src/ —
// it's guard-only tooling, not application code, and has no reason to ship
// in the compiled API.
import * as ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type ScalarType = 'string' | 'number' | 'boolean';

export interface NullableScalarCandidate {
  file: string;
  className: string;
  propertyName: string;
  expectedType: ScalarType;
}

export interface NullableScalarViolation {
  className: string;
  propertyName: string;
  key: string;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    out.push(...(statSync(p).isDirectory() ? walk(p) : [p]));
  }
  return out;
}

function isNullLiteral(m: ts.TypeNode): boolean {
  return ts.isLiteralTypeNode(m) && m.literal.kind === ts.SyntaxKind.NullKeyword;
}

/**
 * Classifies a `X | null` (or `X | null | undefined`) union as its scalar
 * type, or returns null if it isn't one — including when the union has no
 * `null` member at all (a non-nullable string-literal enum like
 * `'a' | 'b'` looks structurally identical to a nullable scalar enum once
 * `null` is stripped, so presence of `null` must be checked explicitly).
 */
function classifyUnion(members: readonly ts.TypeNode[]): ScalarType | null {
  if (!members.some(isNullLiteral)) return null;

  const rest = members.filter((m) => !isNullLiteral(m) && m.kind !== ts.SyntaxKind.UndefinedKeyword);
  if (rest.length === 0) return null;

  const kinds = new Set(rest.map((m) => m.kind));
  if (kinds.size === 1) {
    const kind = [...kinds][0];
    if (kind === ts.SyntaxKind.StringKeyword) return 'string';
    if (kind === ts.SyntaxKind.NumberKeyword) return 'number';
    if (kind === ts.SyntaxKind.BooleanKeyword) return 'boolean';
  }
  // A nullable scalar enum (`'a' | 'b' | null`) is still a string underneath.
  if (rest.every((m) => ts.isLiteralTypeNode(m) && ts.isStringLiteral(m.literal))) return 'string';
  return null;
}

/**
 * Parses a single DTO source file (syntax-level, no type-checker) and returns
 * every property whose *declared TS type* is a nullable scalar and which
 * carries an `@ApiProperty`/`@ApiPropertyOptional` decorator — regardless of
 * what that decorator's options say. Candidacy is deliberately TS-type-driven
 * rather than decorator-option-driven: a decorator that omits `nullable: true`
 * entirely on a genuinely nullable field is the same undocumented-scalar bug
 * this guard exists to catch, not a reason to skip it (#871).
 * A property typed as a genuine object/array (e.g. `Record<string, unknown> | null`)
 * never matches — it isn't a union of `null` with only scalar members, so it's
 * excluded from the candidate set entirely rather than needing a baseline entry.
 */
export function scanFileForNullableScalarCandidates(file: string): NullableScalarCandidate[] {
  const text = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const out: NullableScalarCandidate[] = [];

  const visitClass = (node: ts.ClassDeclaration) => {
    if (!node.name) return;
    const className = node.name.text;
    for (const member of node.members) {
      if (!ts.isPropertyDeclaration(member) || !member.type || !ts.isUnionTypeNode(member.type)) continue;
      const expectedType = classifyUnion(member.type.types);
      if (!expectedType) continue;

      const decorators = ts.canHaveDecorators(member) ? ts.getDecorators(member) : undefined;
      if (!decorators) continue;

      for (const decorator of decorators) {
        if (!ts.isCallExpression(decorator.expression)) continue;
        const decoratorName = ts.isIdentifier(decorator.expression.expression)
          ? decorator.expression.expression.text
          : null;
        if (decoratorName !== 'ApiProperty' && decoratorName !== 'ApiPropertyOptional') continue;

        const propertyName = ts.isIdentifier(member.name) ? member.name.text : member.name.getText();
        out.push({ file, className, propertyName, expectedType });
      }
    }
  };

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isClassDeclaration(node)) visitClass(node);
  });
  return out;
}

/** Scans every `*.dto.ts` file under `srcRoot` for nullable-scalar candidates. */
export function findNullableScalarCandidates(srcRoot: string): NullableScalarCandidate[] {
  return walk(srcRoot)
    .filter((f) => f.endsWith('.dto.ts'))
    .flatMap(scanFileForNullableScalarCandidates);
}

export interface OpenApiDocumentLike {
  components?: {
    schemas?: Record<string, { properties?: Record<string, { nullable?: boolean; type?: string; enum?: unknown[] }> }>;
  };
}

/**
 * Checks each candidate against the *generated* OpenAPI document — the whole
 * point of this guard is that a well-formed-looking decorator can still
 * generate `type: object`, so decorator source text is never enough.
 */
export function checkNullableScalarCandidates(
  document: OpenApiDocumentLike,
  candidates: NullableScalarCandidate[],
): NullableScalarViolation[] {
  const schemas = document.components?.schemas ?? {};
  const violations: NullableScalarViolation[] = [];

  for (const candidate of candidates) {
    const prop = schemas[candidate.className]?.properties?.[candidate.propertyName];
    if (!prop) continue; // Not reachable from any route — nothing generated to check.

    const compliant =
      prop.nullable === true &&
      (prop.type === candidate.expectedType || (Array.isArray(prop.enum) && prop.enum.length > 0));

    if (!compliant) {
      violations.push({
        className: candidate.className,
        propertyName: candidate.propertyName,
        key: `${candidate.className}.${candidate.propertyName}`,
      });
    }
  }
  return violations;
}
