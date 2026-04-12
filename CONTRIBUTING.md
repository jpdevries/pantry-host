# Contributing to Pantry Host

## Project Context

Before contributing, read [SOVEREIGNTY.md](SOVEREIGNTY.md).

This project was built on land ceded under the 1855 Willamette Valley Treaty. That history is not a disclaimer — it is part of the project's identity. Contributors should be aware of the geographical and historical context in which Pantry Host was founded and continues to be developed.

## Code of Conduct

- Treat all contributors and users with respect.
- Write accessible, inclusive code. Pantry Host targets WCAG 2.1 Level AA.
- Privacy is a core value — no telemetry, no external data collection, no tracking.
- When in doubt, ask. Open an issue or start a discussion.

## Principles

### Integrate, don't rebuild

Pantry Host is a kitchen app, not a platform. We export `.ics` instead of building a calendar. We export `.cook` instead of inventing a recipe format. We ship an MCP server instead of building chat UIs. We adopt `exchange.recipe.recipe` instead of defining a competing lexicon.

When a standard, format, or community already exists, use it. When the user's data can travel to another tool, let it. Features that duplicate what the ecosystem already provides well are out of scope — interoperability is in scope.

### Borrowed, not owned

External data (Pixabay images, NutritionFacts from recipe-api.com, community recipes from federated sources) is displayed with attribution but never persisted as if it were ours. Borrowed data can be cleared at any time, is never written to Postgres or PGlite, and the UI makes clear what is local and what is sourced.

### Your data, your hardware

No cloud accounts, no subscriptions. Data lives in PostgreSQL on your server or PGlite in your browser. The only outbound request is the optional AI feature (to Anthropic, with your own key). Remote access is opt-in via Tailscale or SSH — the app is LAN-only by default.

## Development

See [CLAUDE.md](CLAUDE.md) for the full development guide, monorepo structure, and conventions.

## Submitting Changes

1. Fork the repository and create a branch.
2. Follow existing code conventions (semantic CSS tokens, Tailwind v4, shared components).
3. Test on both the self-hosted app (:3000) and the web demo (:5174) when applicable.
4. Open a pull request with a clear description of the change.
