CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE kitchens (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO kitchens (slug, name) VALUES ('home', 'Home') ON CONFLICT (slug) DO NOTHING;

CREATE TABLE ingredients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  category       VARCHAR(100),
  quantity       DECIMAL,            -- NULL = unset, number = tracked amount
  unit           VARCHAR(50),
  always_on_hand BOOLEAN NOT NULL DEFAULT false, -- if true, never decrement from recipe completion
  tags           TEXT[] DEFAULT '{}',
  kitchen_id     TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE DEFAULT (SELECT id FROM kitchens WHERE slug = 'home'),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ingredients_tags ON ingredients USING GIN(tags);

CREATE TABLE recipes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             VARCHAR(255) NOT NULL,
  description       TEXT,
  instructions      TEXT NOT NULL,
  servings          INTEGER DEFAULT 2,
  prep_time         INTEGER,
  cook_time         INTEGER,
  tags              TEXT[] DEFAULT '{}',
  required_cookware TEXT[] DEFAULT '{}',
  source            VARCHAR(20) DEFAULT 'manual',
  source_url        TEXT,
  photo_url         TEXT,
  last_made_at      TIMESTAMPTZ,     -- set when user marks recipe as complete
  queued            BOOLEAN DEFAULT FALSE,
  kitchen_id        TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE DEFAULT (SELECT id FROM kitchens WHERE slug = 'home'),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recipes_tags ON recipes USING GIN(tags);
CREATE INDEX idx_recipes_cookware ON recipes USING GIN(required_cookware);

CREATE TABLE cookware (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  brand       VARCHAR(255),
  tags        TEXT[] DEFAULT '{}',
  kitchen_id  TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE DEFAULT (SELECT id FROM kitchens WHERE slug = 'home'),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cookware_tags ON cookware USING GIN(tags);

CREATE TABLE recipe_ingredients (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id        UUID REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_name  VARCHAR(255) NOT NULL,
  quantity         DECIMAL,
  unit             VARCHAR(50),
  -- Optionally links to another recipe used as an ingredient (e.g. homemade Almond Milk)
  source_recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  sort_order       INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menus (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) UNIQUE,
  description TEXT,
  active      BOOLEAN DEFAULT TRUE,
  category    VARCHAR(50),
  kitchen_id  TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menus_kitchen ON menus(kitchen_id);

CREATE TABLE IF NOT EXISTS menu_recipes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id    UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  recipe_id  UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  course     VARCHAR(50),
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_menu_recipes_menu ON menu_recipes(menu_id);
