import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { gql } from '../graphql-client.js';
import {
  reviewPantry,
  REVIEW_SIGNALS,
  type PantryRowForReview,
  type ReviewFinding,
  type ReviewSignal,
} from '@pantry-host/shared/pantry-review';

/**
 * review_pantry — the same engine the review page runs, over MCP.
 *
 * Read-only. Agents that import recipes and cook through the pantry rarely
 * keep it current; this tells them what to ask the user about and which
 * tool answers each finding. The engine (`@pantry-host/shared/pantry-review`)
 * is shared with both UIs, so an agent and the page never disagree.
 */

const REVIEW_FIELDS = `id name aliases category quantity unit itemSize itemSizeUnit alwaysOnHand tags barcode productMeta expiresAt stockedAt updatedAt createdAt`;

const NEXT_STEP: Record<ReviewSignal, string> = {
  expired: 'Ask whether each is still good. Still good → touch_ingredients (restarts the estimate from today). Gone → update_ingredients with { quantity: 0, expiresAt: null } (keeps tags, aliases and barcode data; the date belonged to the finished carton), or remove_ingredients only if the user says to toss the row for good. Knows the real date → update_ingredients with expiresAt.',
  expiring: 'Suggest recipes that use them (search_recipes), or touch_ingredients if the user says they are fine for longer.',
  stale: 'Ask whether each is still here. Yes → touch_ingredients. No → update_ingredients with { quantity: 0, expiresAt: null }; remove_ingredients only if the user says to drop the row.',
  duplicate: 'Confirm the survivor with the user (default: survivorId), then merge_ingredients(survivorId, the other ids).',
  outOfStock: 'Ask whether to restock (add to a list / update_ingredients quantity) or remove_ingredients.',
};

export async function fetchReview(args: {
  kitchenSlug?: string;
  signals?: ReviewSignal[];
  staleDays?: number;
  expiringWithinDays?: number;
  outOfStockDays?: number;
}) {
  const data = await gql<{ ingredients: PantryRowForReview[] }>(
    `query($kitchenSlug: String) { ingredients(kitchenSlug: $kitchenSlug) { ${REVIEW_FIELDS} } }`,
    { kitchenSlug: args.kitchenSlug },
  );
  const byId = new Map(data.ingredients.map((r) => [r.id, r]));
  const result = reviewPantry(data.ingredients, {
    signals: args.signals,
    staleDays: args.staleDays,
    expiringWithinDays: args.expiringWithinDays,
    outOfStockDays: args.outOfStockDays,
  });
  const findings = result.findings.map((f: ReviewFinding) => ({
    signal: f.signal,
    ids: f.ids,
    names: f.ids.map((id) => byId.get(id)?.name ?? id),
    reason: f.reason,
    ...(f.date ? { date: f.date, provenance: f.provenance } : {}),
    ...(f.since ? { since: f.since } : {}),
    ...(f.survivorId ? { survivorId: f.survivorId, matchedOn: f.matchedOn } : {}),
    rows: f.ids.map((id) => {
      const r = byId.get(id);
      return r ? { id: r.id, name: r.name, quantity: r.quantity, unit: r.unit, category: r.category, tags: r.tags, expiresAt: r.expiresAt, stockedAt: r.stockedAt } : { id };
    }),
  }));
  return {
    kitchenSlug: args.kitchenSlug ?? 'home',
    reviewedAt: new Date().toISOString(),
    rowsReviewed: data.ingredients.length,
    counts: result.counts,
    nextSteps: Object.fromEntries(REVIEW_SIGNALS.filter((s) => result.counts[s] > 0).map((s) => [s, NEXT_STEP[s]])),
    findings,
  };
}

export function registerReviewTools(server: McpServer) {
  server.tool(
    'review_pantry',
    'Review the pantry for things worth a look: expired (past a stated best-by, or past the estimate for its category), expiring (within 3 days), stale (no date and no shelf-life estimate, untouched 180 days), duplicate (same name after normalizing, alias overlap, or shared barcode), and outOfStock (at 0 for 14+ days). Read-only. Estimates come from each row\'s category (or barcode product category) plus stockedAt; `provenance` says whether a date was stated or estimated, so present estimates as questions ("still good?"), not facts. Each finding lists the row ids and names, a reason, and for duplicates a suggested survivorId. `nextSteps` names the tool that answers each signal: touch_ingredients (still have it), update_ingredients (quantity 0 / expiresAt), merge_ingredients, remove_ingredients. Run it after a cooking session or an import, and before suggesting recipes from the pantry.',
    {
      kitchenSlug: z.string().optional().describe('Kitchen slug (default: home)'),
      signals: z.array(z.enum(['expired', 'expiring', 'stale', 'duplicate', 'outOfStock'])).optional().describe('Only these signals (default: all)'),
      expiringWithinDays: z.number().int().min(0).optional().describe('"Expiring soon" horizon in days (default 3)'),
      staleDays: z.number().int().min(1).optional().describe('Days untouched before a row with no shelf-life basis is stale (default 180)'),
      outOfStockDays: z.number().int().min(0).optional().describe('Days at quantity 0 before a row is flagged (default 14)'),
    },
    async (args) => {
      const review = await fetchReview(args);
      const total = review.findings.length;
      const head = total === 0
        ? `Nothing needs attention in the ${review.kitchenSlug} pantry (${review.rowsReviewed} rows reviewed).`
        : `${total} finding(s) across ${review.rowsReviewed} rows in the ${review.kitchenSlug} pantry: ${REVIEW_SIGNALS.filter((s) => review.counts[s] > 0).map((s) => `${review.counts[s]} ${s}`).join(', ')}.`;
      return { content: [{ type: 'text' as const, text: `${head}\n${JSON.stringify(review, null, 2)}` }] };
    },
  );
}
