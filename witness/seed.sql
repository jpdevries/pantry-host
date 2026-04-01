--
-- PostgreSQL database dump
--

\restrict 9wLHROEAaK8KeQ78CITw0wH2qw5vxFdl5IRk2tCAywcu8OlZBefl9LhHRuasdYx

-- Dumped from database version 14.22 (Homebrew)
-- Dumped by pg_dump version 14.22 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cookware; Type: TABLE; Schema: public; Owner: jpdevries
--

CREATE TABLE public.cookware (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    brand character varying(255),
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    kitchen_id text,
    notes text
);


ALTER TABLE public.cookware OWNER TO jpdevries;

--
-- Name: ingredients; Type: TABLE; Schema: public; Owner: jpdevries
--

CREATE TABLE public.ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(100),
    quantity numeric,
    unit character varying(50),
    always_on_hand boolean DEFAULT false NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    kitchen_id text
);


ALTER TABLE public.ingredients OWNER TO jpdevries;

--
-- Name: kitchens; Type: TABLE; Schema: public; Owner: jpdevries
--

CREATE TABLE public.kitchens (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.kitchens OWNER TO jpdevries;

--
-- Name: menu_recipes; Type: TABLE; Schema: public; Owner: jpdevries
--

CREATE TABLE public.menu_recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    menu_id uuid NOT NULL,
    recipe_id uuid NOT NULL,
    course character varying(50),
    sort_order integer DEFAULT 0
);


ALTER TABLE public.menu_recipes OWNER TO jpdevries;

--
-- Name: menus; Type: TABLE; Schema: public; Owner: jpdevries
--

CREATE TABLE public.menus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(255),
    description text,
    kitchen_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    active boolean DEFAULT true,
    category character varying(50)
);


ALTER TABLE public.menus OWNER TO jpdevries;

--
-- Name: recipe_cookware; Type: TABLE; Schema: public; Owner: jpdevries
--

CREATE TABLE public.recipe_cookware (
    recipe_id uuid NOT NULL,
    cookware_id uuid NOT NULL
);


ALTER TABLE public.recipe_cookware OWNER TO jpdevries;

--
-- Name: recipe_ingredients; Type: TABLE; Schema: public; Owner: jpdevries
--

CREATE TABLE public.recipe_ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipe_id uuid,
    ingredient_name character varying(255) NOT NULL,
    quantity numeric,
    unit character varying(50),
    source_recipe_id uuid,
    sort_order integer DEFAULT 0
);


ALTER TABLE public.recipe_ingredients OWNER TO jpdevries;

--
-- Name: recipes; Type: TABLE; Schema: public; Owner: jpdevries
--

CREATE TABLE public.recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    instructions text NOT NULL,
    servings integer DEFAULT 2,
    prep_time integer,
    cook_time integer,
    tags text[] DEFAULT '{}'::text[],
    source character varying(20) DEFAULT 'manual'::character varying,
    photo_url text,
    last_made_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    queued boolean DEFAULT false,
    kitchen_id text,
    slug text,
    source_url text
);


ALTER TABLE public.recipes OWNER TO jpdevries;

--
-- Data for Name: cookware; Type: TABLE DATA; Schema: public; Owner: jpdevries
--

COPY public.cookware (id, name, brand, tags, created_at, kitchen_id, notes) FROM stdin;
e55cfb08-06ba-4489-9afa-0e1fcdb3a99e	Waste Cycler	Cavdle	{waste-cycler,compost,sustainable}	2026-03-24 16:38:17.218192-07	2097f77e-d172-482d-99d0-57604afc5900	We commonly waste cycle coffee grounds, paper towel, tea bags, banana peels, avocado peels, egg cartons as well as:\n\nWhat Goes In\nAlways OK: Fruit/veggie scraps and peels, food leftovers (grains, pasta, rice, bread, eggs, fish, meat scraps, dairy), coffee grounds/tea bags/paper filters, napkins/tissue/cardboard, degradable plastics, houseplants and yard trimmings, eggshells, straw, pine needles.\n\nLimited: Corn husks, pineapple, pistachio shells, apples (fibrous/hard peels) — chop first. Oily or saucy paper towels. Sticky foods (honey, nut butter, jam) — use sparingly. Large paper items — chop first.\n\nNever: Hard bones (chicken, beef, pork), cooking oils/greasy pastes, fruit pits (avocado, mango, peach, apricot), walnut shells (toxic to plants). Soaps, shampoo, lined plastic bags (chip/cookie/pet food bags), diapers, baby wipes, tampons, pet feces, cigarettes, metal, glass, foil wrap, alcohol, styrofoam, general plastics.
f1342716-0a1d-411f-b6de-dfdc4768a162	Baby Food maker	Grownsy	{baby-food,breastfeeding-safe}	2026-03-26 11:12:26.079976-07	2097f77e-d172-482d-99d0-57604afc5900	For best results with the Grownsy baby food maker, sanitize the unit before first use, steam foods in small, evenly chopped batches for even cooking, and use the built-in, one-touch blending feature for custom textures. Retain nutrient-rich steaming water, and add breastmilk or formula to adjust consistency. \ngrownsy\ngrownsy\n +4\nSetup & Maintenance Tips\nInitial Setup: Sanitize the unit by running a sterilization cycle before first use.\nWater Management: Fill the water tank to the indicated red line for steaming.\nCleaning: The bowl and blades are dishwasher-safe; you can also use the sterilize function to clean the basket and lid.\nWipe Down: Use a damp cloth to clean the exterior, ensuring the unit is unplugged. \ngrownsy\ngrownsy\n +5\nSteaming & Cooking Tips\nEven Chopping: Chop fruits and vegetables into even, small pieces to ensure they steam at the same rate.\nDon't Overcrowd: Do not fill the steaming basket too full to allow steam to circulate.\nRetain Nutrients: Do not throw away the,steaming liquid left at the bottom; use it to adjust the puree consistency.\nSteam Settings: Use the automatic steam setting for most fruits and vegetables to achieve a soft, mashable texture. \ngrownsy\ngrownsy\n +2\nBlending & Texture Tips\nCustomize Consistency: Use the manual blend function for more control, or the automatic function for easy, quick purees.\nAdjusting Liquid: Add a splash of breast milk, formula, or reserved cooking water to reach the perfect consistency.\nAge-Specific Textures:\n4–6 Months: Blend to a smooth, thin puree.\n6–8 Months: Create thicker, slightly lumpy textures.\n8+ Months: Use pulse mode for chunkier textures. \ngrownsy\ngrownsy\n +3\nPreparation & Storage Tips\nPre-Prep: Batch-prep and steam ingredients ahead of time, then freeze them for quick, future use.\nIngredient Prep: Peel and remove seeds from produce (e.g., pears, apples) before steaming for younger babies.\nPreventing Browning: Add a tiny squeeze of lemon juice to fruits like avocado or pears to prevent browning.\nBatching: Steam nutritious foods like chicken or broccoli and chop into chunks to easily produce multiple meals at once. 
815dce22-ad26-4360-937b-93aa216543ef	Cast Iron Skillet	The Lodge	{american,classic}	2026-03-28 08:19:42.855831-07	2097f77e-d172-482d-99d0-57604afc5900	Cast iron skillets are ideal for high-heat searing, frying, baking, and roasting due to their superior heat retention and even heating capabilities. They are incredibly durable, naturally non-stick when seasoned, and versatile enough to move from stovetop to oven or grill. They are best for searing steaks, frying bacon, baking cornbread, and roasting vegetables.
1624691e-6e53-484b-a843-67fd078a767f	Gas Stove Top	Maytag	{daily}	2026-03-28 08:21:02.628223-07	2097f77e-d172-482d-99d0-57604afc5900	Our go to cooking and baking appliance.\nGas stoves are highly regarded for cooking because they offer instant heat, precise temperature control, and even heat distribution, making them ideal for searing and stir-frying. They are favored by many chefs for their responsiveness and compatibility with various cookware, though they require proper ventilation and regular cleaning of burners and grates. 
3fcbd9e1-4200-47fa-8e53-425817aa2289	Propane Griddle	Blackstone	{bbq,patio}	2026-03-16 17:48:56.427114-07	2097f77e-d172-482d-99d0-57604afc5900	This is an outside flat top 'bbq' appliance we use on our back porch primarily in the summer. Great for smash burgers, pancakes, potatoes, and more!
5e1df76c-0723-4e27-9930-f624ffa32b7b	Titanium Mini Always Pan® Pro	Our Place	{non-stick,non-toxic,dishwasher-safe}	2026-03-30 02:44:56.096949-07	2097f77e-d172-482d-99d0-57604afc5900	The Titanium Always Pan Pro is a durable, coating-free, and high-performance skillet featuring a textured titanium surface that acts like nonstick while allowing for superior searing, metal utensil use, and high-heat cooking up to \n\n. It shines in versatility but requires more care than typical nonstick and can be difficult to clean, often needing oil for delicate foods. 
f4e23b46-dcf6-4d80-9f40-c8dfb74f62d7	Titanium Always Pan® Pro	Our Place	{non-stick,non-toxic,dishwasher-safe}	2026-03-17 21:31:06.227779-07	2097f77e-d172-482d-99d0-57604afc5900	The Titanium Always Pan Pro is a durable, coating-free, and high-performance skillet featuring a textured titanium surface that acts like nonstick while allowing for superior searing, metal utensil use, and high-heat cooking up to \n\n. It shines in versatility but requires more care than typical nonstick and can be difficult to clean, often needing oil for delicate foods. 
9b05576a-e57c-44e5-a5dd-1d9cd721f07f	Almond Cow	Almond Cow	{nut-milk-maker}	2026-03-16 12:06:43.621026-07	2097f77e-d172-482d-99d0-57604afc5900	Makes plant-based nut or oat milk in about 1 minute by spinning up to 10,000 RPM through a stainless steel filter basket. Use filtered water and soak nuts at least 4 hours beforehand for creamier results. Don't fill the herb basket past the MAX line, and don't use uncooked rice or unpeeled soybeans. Clean all removable parts immediately after use — they're dishwasher safe, and prompt cleaning prevents buildup.
93700ede-98ac-4586-bb11-b06fda205487	Titanium Large Always Pan® Pro	Our Place	{non-stick,non-toxic,dishwasher-safe}	2026-03-17 21:31:52.84383-07	2097f77e-d172-482d-99d0-57604afc5900	The Titanium Always Pan Pro is a durable, coating-free, and high-performance skillet featuring a textured titanium surface that acts like nonstick while allowing for superior searing, metal utensil use, and high-heat cooking up to \n\n. It shines in versatility but requires more care than typical nonstick and can be difficult to clean, often needing oil for delicate foods. 
358beee3-b3bb-44f4-9299-e3fb476796ea	Instant Pot	Instant Pot	{pressure-cooker}	2026-03-16 08:50:13.519673-07	2097f77e-d172-482d-99d0-57604afc5900	An electric pressure cooker that dramatically cuts cook times for braises, stews, beans, and grains. Always use at least 1 cup of liquid, never fill past the 2/3 max line, and check that the sealing ring is properly seated and the valve is set to Sealing before every cook. Account for pressure build-up and release time (up to 20 minutes each) in addition to the set cook time. Deglaze the pot after sautéing to prevent the burn warning and to add flavor.
3eb41879-4656-41dd-998c-51e254c9d30d	Venturist 1200	Vitamix	{shakes,smoothies,dressings}	2026-03-16 16:31:31.448773-07	2097f77e-d172-482d-99d0-57604afc5900	A full-size variable-speed blender with SELF-DETECT that adjusts blending programs to the container size automatically. Always start on Variable Speed 1 and work up; use the tamper (with the lid plug removed) to push thick ingredients into the blades rather than stopping the machine. Never blend hot liquids in the personal cup or blending bowl, and never use legacy Vitamix containers (C, G, or S Series) on this base. The container, lid, and tamper are dishwasher safe — clean promptly to prevent dried-on residue.
84997166-5ad8-4f3d-8a97-d314b2e0ef21	Coffee Brewer	Ninja	{coffee,breakfast}	2026-03-16 16:32:42.855793-07	2097f77e-d172-482d-99d0-57604afc5900	A 12-cup programmable drip coffee maker with Classic and Rich brew strengths, a warming plate, and a Delay Brew timer. Use the Rich setting for light roasts to increase extraction time, and run 2–3 water-only cycles before first use to prime the machine. Don't leave the warming plate heating an empty carafe — press Stay Warm when done. The permanent gold-tone filter is reusable, but paper filters are also compatible for easier cleanup.
b0d34e51-d9fb-430b-8c32-9e26d7340688	LĒVO II+	LĒVO	{oil-infuser}	2026-03-18 21:41:06.328719-07	2097f77e-d172-482d-99d0-57604afc5900	An herb oil and butter infuser with three cycles: Dry (removes moisture from fresh herbs), Activate (decarboxylates cannabis), and Infuse (transfers compounds into oils or butter). Always run the Activate cycle with herbs only — never add oil during activation. Pack the pod loosely so carrier oil can flow through freely, and make sure the oil level covers the herb to prevent burning. Use the companion app for temperature recommendations by herb and carrier type; infusing at lower temps for longer (up to 8 hours) increases potency.
ff2549c8-3273-46f8-8860-3fcceef9ce3e	Pizza Oven	Ooni	{electric}	2026-03-16 16:30:26.631745-07	2097f77e-d172-482d-99d0-57604afc5900	A high-heat outdoor pizza oven capable of reaching 900°F, cooking Neapolitan-style pizza in 60–90 seconds on a stone surface. Preheat for at least 30 minutes and use an infrared thermometer to confirm the stone center reaches 750°F before launching. Use a wooden peel to launch and a metal turning peel to rotate the pizza every 30 seconds for even char. Don't use pre-shredded mozzarella (the starch coating causes burning) — opt for fresh mozzarella, keep toppings light, and have everything prepped before the oven is hot.
77a6e7e8-af3d-41a2-82f5-72442d1100ba	Slow Juicer	Kuvings	{juicer,cold-press}	2026-03-19 09:59:32.695597-07	2097f77e-d172-482d-99d0-57604afc5900	A cold-press masticating juicer that operates at 50–60 RPM, preserving heat-sensitive nutrients that centrifugal juicers destroy. Cut hard produce (beets, ginger) into small pieces before feeding to avoid motor strain, and don't overload the chute — overfilling can crack the drum lid or clog the strainer. Juice staining ingredients like beets and turmeric last, and rinse the strainer immediately after. Don't wash parts in a dishwasher or with boiling water, as this makes components brittle.
76f8e134-b154-4163-aec6-e3556b3a15bd	Gas Oven	Maytag	{}	2026-03-31 18:18:34.851275-07	2097f77e-d172-482d-99d0-57604afc5900	Our go to daily oven. 
\.


--
-- Data for Name: ingredients; Type: TABLE DATA; Schema: public; Owner: jpdevries
--

COPY public.ingredients (id, name, category, quantity, unit, always_on_hand, tags, created_at, updated_at, kitchen_id) FROM stdin;
dcbef6ad-ae77-4d99-af6a-7fdbf1bb7603	Rosemary	spices	\N	\N	t	{garden-fresh}	2026-03-16 11:09:32.136689-07	2026-03-16 11:14:00.707117-07	2097f77e-d172-482d-99d0-57604afc5900
e4b65181-25cf-4e31-a23a-28666273e6bf	Almonds	produce	\N	\N	t	{bulk-order}	2026-03-16 11:18:38.024671-07	2026-03-16 11:18:38.024671-07	2097f77e-d172-482d-99d0-57604afc5900
02cf3466-62a0-4b11-a878-f26a8b7fc013	Coconut shreds	produce	\N	\N	t	{bulk-order}	2026-03-16 11:18:53.243259-07	2026-03-16 11:18:53.243259-07	2097f77e-d172-482d-99d0-57604afc5900
5f251e1b-4273-415b-a393-3b8ebbc0aa9c	Pitted Dates	fruit	\N	\N	t	{}	2026-03-16 11:19:16.926135-07	2026-03-16 11:19:16.926135-07	2097f77e-d172-482d-99d0-57604afc5900
02fe04c7-8312-416c-91de-f35b9b1f0777	All-purpose flour	pantry	\N	\N	t	{}	2026-03-16 11:19:50.37814-07	2026-03-16 11:19:50.37814-07	2097f77e-d172-482d-99d0-57604afc5900
b3ed686a-1f91-41c2-8ff0-7b3b6ef09e38	Olive Oil (Finishing)	pantry	\N	\N	t	{bulk-order}	2026-03-16 11:24:22.656036-07	2026-03-16 11:24:22.656036-07	2097f77e-d172-482d-99d0-57604afc5900
6a1a9101-b4c9-44ba-adc8-b3fe53192fee	Olive oil (High heat)	pantry	\N	\N	t	{bulk-order}	2026-03-16 11:23:57.082497-07	2026-03-16 11:24:50.254127-07	2097f77e-d172-482d-99d0-57604afc5900
3803f784-01d2-4dd1-8faf-385a62292705	Cashews	pantry	\N	\N	t	{bulk-order}	2026-03-16 11:26:03.165124-07	2026-03-16 11:26:03.165124-07	2097f77e-d172-482d-99d0-57604afc5900
6ca5f307-ebe6-4a3f-b8a3-237db13fd4e4	Butter	dairy	\N	\N	t	{overstock,frozen}	2026-03-16 11:27:22.008053-07	2026-03-16 11:27:22.008053-07	2097f77e-d172-482d-99d0-57604afc5900
15005ba3-05fa-4530-8619-b4f97c471ba5	Salted Butter	dairy	\N	\N	t	{overstock,frozen}	2026-03-16 11:27:37.358916-07	2026-03-16 11:27:37.358916-07	2097f77e-d172-482d-99d0-57604afc5900
33b1c6d6-d426-4ed0-91bd-95fef16e509c	Popcorn Kernels	pantry	\N	\N	t	{}	2026-03-16 11:28:03.129692-07	2026-03-16 11:28:03.129692-07	2097f77e-d172-482d-99d0-57604afc5900
7c83f1ae-9513-4ba7-a91b-5308ec67d79e	Himalayan Sea Salt	pantry	\N	\N	t	{}	2026-03-16 11:28:34.261634-07	2026-03-16 11:28:34.261634-07	2097f77e-d172-482d-99d0-57604afc5900
d54ac388-3010-438b-93f6-2d628844733a	Pizza sauce	pantry	\N	\N	t	{bulk-order}	2026-03-16 14:46:13.967069-07	2026-03-16 14:46:33.037353-07	2097f77e-d172-482d-99d0-57604afc5900
48b19bd9-adca-440a-aa8e-f217dc3d587e	Larrupin swedish style mustard dill sauce	pantry	3	whole	f	{}	2026-03-16 15:26:29.948091-07	2026-03-16 15:26:29.948091-07	2097f77e-d172-482d-99d0-57604afc5900
2e9694e2-87cd-454e-93da-467b0d2da8af	Hot And Spicy Japanese Barbecue Sauce	pantry	1	oz	f	{}	2026-03-16 15:26:29.948091-07	2026-03-16 15:26:29.948091-07	2097f77e-d172-482d-99d0-57604afc5900
e07729e9-e836-4768-9972-0142477e40e9	Japanese Barbecue Sauce	pantry	1	oz	f	{}	2026-03-16 15:26:29.948091-07	2026-03-16 15:26:29.948091-07	2097f77e-d172-482d-99d0-57604afc5900
d0674c0e-e9c9-4cc2-a33f-50f0c57ff623	Red sauce for barbeque dipping	pantry	1	whole	f	{}	2026-03-16 15:26:29.948091-07	2026-03-16 15:26:29.948091-07	2097f77e-d172-482d-99d0-57604afc5900
a288902c-2243-4102-9ccb-0e907f77df84	Sauerkraut	pantry	1	g	f	{}	2026-03-16 15:26:29.948091-07	2026-03-16 15:26:29.948091-07	2097f77e-d172-482d-99d0-57604afc5900
84c61dfe-9b69-45cb-b48f-e32ced100797	Garden Herb Ranch Dressing	pantry	1	whole	f	{}	2026-03-16 15:26:29.948091-07	2026-03-16 15:26:29.948091-07	2097f77e-d172-482d-99d0-57604afc5900
abb10d66-f07e-412e-a1e2-1e0360ce89cd	simply pesto traditional basil	pantry	1	oz	f	{}	2026-03-16 15:26:29.948091-07	2026-03-16 15:26:29.948091-07	2097f77e-d172-482d-99d0-57604afc5900
3c49e986-7980-4eaa-8ecb-e21a6852f323	Rosemary balsamic	pantry	1	whole	f	{}	2026-03-16 15:26:29.948091-07	2026-03-16 15:26:29.948091-07	2097f77e-d172-482d-99d0-57604afc5900
53cca3b2-efe0-4c20-97c5-df78b23c4be9	SRIRACHA CHILI SAUCE	pantry	1	whole	f	{}	2026-03-16 15:26:29.948091-07	2026-03-16 15:26:29.948091-07	2097f77e-d172-482d-99d0-57604afc5900
9523492c-2500-4729-8406-18864d35923d	Giardiniera pickled vegetables	fruit	1	ml	f	{}	2026-03-16 15:26:29.948091-07	2026-03-16 15:26:29.948091-07	2097f77e-d172-482d-99d0-57604afc5900
c22e78be-1082-4287-a212-accad9b597e6	Sweet Cream Butter	dairy	1	whole	f	{}	2026-03-16 15:44:36.818633-07	2026-03-16 15:44:36.818633-07	2097f77e-d172-482d-99d0-57604afc5900
b122dec2-f07c-44ea-a783-b13066cedd40	Pure Irish Butter	dairy	3	lb	f	{}	2026-03-16 15:44:36.818633-07	2026-03-16 15:44:36.818633-07	2097f77e-d172-482d-99d0-57604afc5900
a1b6787c-95db-4a05-8507-7834547498dc	Organic whole green beans	pantry	5	lb	f	{}	2026-03-16 15:45:56.968717-07	2026-03-16 15:45:56.968717-07	2097f77e-d172-482d-99d0-57604afc5900
606491c3-4305-4fc9-9db6-6adf2979992e	Queso Fresco Part Skim Milk Cheese	dairy	1	whole	f	{}	2026-03-16 15:57:29.511898-07	2026-03-16 15:57:29.511898-07	2097f77e-d172-482d-99d0-57604afc5900
7dceaf48-c066-4325-83ef-fcc2e50e21fe	Monterey jack cheese with jalapeno peppers, pepper jack	dairy	1	whole	f	{}	2026-03-16 15:57:29.511898-07	2026-03-16 15:57:29.511898-07	2097f77e-d172-482d-99d0-57604afc5900
6ae53c64-b6a5-4d38-a25f-be34d93a41b2	Feta Crumbles	dairy	1	whole	f	{}	2026-03-16 15:57:29.511898-07	2026-03-16 15:57:29.511898-07	2097f77e-d172-482d-99d0-57604afc5900
fd6c866a-12a1-4204-b136-27805c25c52e	Ground Beef	protein	\N	\N	t	{frozen}	2026-03-16 11:25:39.486523-07	2026-03-16 15:59:30.72838-07	2097f77e-d172-482d-99d0-57604afc5900
8ca27d6e-e857-43af-916d-95dc44cc80d0	Mozz Cheese	pantry	2	whole	f	{frozen,overstock}	2026-03-16 15:57:29.511898-07	2026-03-17 10:09:23.261881-07	2097f77e-d172-482d-99d0-57604afc5900
365704f2-9e38-4539-af54-b88612038596	Kroger lime concentrate	beverages	1	whole	f	{juice,concentrate,mixology}	2026-03-16 15:26:29.948091-07	2026-03-16 16:04:50.159299-07	2097f77e-d172-482d-99d0-57604afc5900
91b9137e-7806-4f97-bf77-a36ca07d2c27	Raspberry Kombucha	beverages	5	l	f	{bruusta,mixology}	2026-03-16 16:07:47.327925-07	2026-03-16 16:07:47.327925-07	2097f77e-d172-482d-99d0-57604afc5900
1cf59b47-ec5c-457a-8030-e973619b4d94	Ginger Kombucha	beverages	5	l	f	{bruusta,mixology}	2026-03-16 16:08:19.108243-07	2026-03-16 16:08:19.108243-07	2097f77e-d172-482d-99d0-57604afc5900
176d00a4-1d10-458d-aadc-b8bfbf16b988	Coffee beans	pantry	\N	\N	t	{}	2026-03-16 16:19:07.679815-07	2026-03-16 16:19:07.679815-07	2097f77e-d172-482d-99d0-57604afc5900
83e75c70-afbf-4630-8f3d-22bbb2805ac9	Raspberries (frozen)	fruit	\N	\N	t	{frozen,local,standing-freezer}	2026-03-16 11:22:23.944971-07	2026-03-17 20:41:25.425112-07	2097f77e-d172-482d-99d0-57604afc5900
5b71486f-3457-4bef-a39d-87875c5890ef	Tomato (frozen)	fruit	\N	\N	t	{frozen,standing-freezer}	2026-03-16 11:21:50.242492-07	2026-03-17 20:41:43.939802-07	2097f77e-d172-482d-99d0-57604afc5900
d4386887-6f66-4d45-ae4d-0267f3d1ade0	Sesame Oil Expeller Pressed Refined	produce	2	oz	f	{}	2026-03-16 16:21:40.582823-07	2026-03-16 16:21:40.582823-07	2097f77e-d172-482d-99d0-57604afc5900
27257959-963f-49dc-a51b-9654f5d630fc	Powdered Peanut Butter	pantry	1	jar	f	{shakes,smoothies}	2026-03-16 16:21:40.582823-07	2026-03-16 16:27:07.909343-07	2097f77e-d172-482d-99d0-57604afc5900
867a5999-b2f2-447d-a0ae-bd23360ac5ca	Cran-Energy Energy Drink Cranberry Raspberry	beverages	1	whole	f	{}	2026-03-16 15:26:29.948091-07	2026-03-24 17:05:26.383624-07	2097f77e-d172-482d-99d0-57604afc5900
5e2df248-cce2-41b4-ab09-6a8dff959ff8	Blueberries	fruit	\N	\N	t	{fresh,frozen,standing-freezer}	2026-03-16 11:15:35.677068-07	2026-03-24 21:53:42.823634-07	2097f77e-d172-482d-99d0-57604afc5900
9ff43d39-818b-40b5-a0eb-e14529ddf2f5	Albacore Wild Tuna	protein	3	can	f	{}	2026-03-16 16:21:40.582823-07	2026-03-26 19:59:49.471401-07	2097f77e-d172-482d-99d0-57604afc5900
91d49287-f32b-4a63-8132-e2993a264170	Caputo 00 Flour	pantry	\N	\N	t	{pizza,mail-order}	2026-03-16 11:20:54.695659-07	2026-03-26 20:46:45.929757-07	2097f77e-d172-482d-99d0-57604afc5900
c8b66278-3436-4eb1-a1c3-3671ad8790ac	Shirley Temple	beverages	12	can	f	{olipop,en-route}	2026-03-16 15:26:29.948091-07	2026-03-28 08:09:25.002206-07	2097f77e-d172-482d-99d0-57604afc5900
182b86d0-796f-4172-8e59-0f8b2a722162	Cinnamon Roll (unfrosted)	bakery	\N	\N	f	{frozen,slow-rise}	2026-03-16 16:18:18.097733-07	2026-03-28 09:14:56.56609-07	2097f77e-d172-482d-99d0-57604afc5900
9d009c6d-5f26-41b0-8f05-ba97264e2127	Spaghetti	pantry	1	whole	f	{}	2026-03-16 16:22:36.558934-07	2026-03-18 22:06:13.061269-07	2097f77e-d172-482d-99d0-57604afc5900
c87e4f9a-fb20-4a4c-afec-0cd019c5f5f6	Crushed Tomatoes In Rice Puree	pantry	1	lb	f	{}	2026-03-16 16:24:23.527205-07	2026-03-16 16:24:23.527205-07	2097f77e-d172-482d-99d0-57604afc5900
4e4b2b7d-11b7-46a6-8f15-365d66880066	Mexican hot sauce	pantry	6	oz	f	{}	2026-03-16 16:35:19.253417-07	2026-03-16 16:35:19.253417-07	2097f77e-d172-482d-99d0-57604afc5900
0c27d0c9-9b96-4b18-a906-f320157800ee	Cannabis infused coconut oil cube	frozen	\N	\N	t	{cannabis,adult-only,psychoactive,pot}	2026-03-16 16:56:06.575267-07	2026-03-16 16:56:06.575267-07	2097f77e-d172-482d-99d0-57604afc5900
6c2cad82-6738-441c-9ed0-783c2669d969	Mango chunks (frozen)	fruit	\N	\N	f	{frozen,overstock,standing-freezer}	2026-03-17 20:39:10.535367-07	2026-03-17 20:40:57.319634-07	2097f77e-d172-482d-99d0-57604afc5900
085ec5a6-3650-4bcb-a3c7-688ad3c57cb2	Vanilla Extract	pantry	16	oz	f	{}	2026-03-18 20:57:36.747087-07	2026-03-18 20:58:25.093503-07	2097f77e-d172-482d-99d0-57604afc5900
e945158a-12c3-47a7-a8a7-abb7d1ee92bf	Organic Pinto Beans	pantry	1	can	f	{}	2026-03-24 12:57:34.616378-07	2026-03-24 12:57:34.616378-07	2097f77e-d172-482d-99d0-57604afc5900
870aab9e-2e45-41c2-a8f6-f67747abddb2	Rigatoni no. 21, authentic organic pasta	pantry	1	whole	f	{}	2026-03-24 12:57:34.616378-07	2026-03-24 12:57:34.616378-07	2097f77e-d172-482d-99d0-57604afc5900
9acd82e4-d16e-45b8-b565-70da1b03ab7c	Lightly Salted Pistachios	pantry	1	whole	f	{}	2026-03-24 14:38:17.897816-07	2026-03-24 14:38:17.897816-07	2097f77e-d172-482d-99d0-57604afc5900
ece217ad-f480-495d-ae24-a1aa4b169232	TRIPLE ZERO BLENDED GREEK YOGURT	dairy	2	lb	f	{}	2026-03-24 14:40:51.269449-07	2026-03-24 14:40:51.269449-07	2097f77e-d172-482d-99d0-57604afc5900
02c4b498-cea9-41b0-89d6-d8b10fa67e4e	Philadelphia Cream Cheese	pantry	16	oz	f	{}	2026-03-24 14:41:29.361948-07	2026-03-24 14:41:29.361948-07	2097f77e-d172-482d-99d0-57604afc5900
801d6fa5-47b9-4e81-a49e-86cce5ba58f9	Medium Cheddar	dairy	16	oz	f	{}	2026-03-24 14:42:26.297623-07	2026-03-24 14:42:26.297623-07	2097f77e-d172-482d-99d0-57604afc5900
c8d2537e-55a1-4637-a49d-83b098662bcc	MERLOT BELLAVITANO CHEESE	dairy	5.5	oz	f	{}	2026-03-24 14:42:52.230355-07	2026-03-24 14:42:52.230355-07	2097f77e-d172-482d-99d0-57604afc5900
07a08a43-c475-47ce-a780-18bd16955c54	Smoked Turkey Breast	pantry	2	oz	f	{}	2026-03-24 14:46:09.904158-07	2026-03-24 14:46:09.904158-07	2097f77e-d172-482d-99d0-57604afc5900
be4801e5-c00d-472f-9ab5-09aa9df3a9db	Pastrami	protein	6	oz	f	{deli,lunch,meat}	2026-03-24 14:53:25.664679-07	2026-03-24 14:53:25.664679-07	2097f77e-d172-482d-99d0-57604afc5900
c6461241-36ff-46dc-a6a5-85553a52ebcd	Mini Vintage Cola	beverages	6	can	f	{}	2026-03-17 10:31:40.366326-07	2026-03-28 09:14:37.7669-07	2097f77e-d172-482d-99d0-57604afc5900
abfb6d55-1144-4e02-8516-849856e09459	SunButter No Sugar Added	pantry	1	jar	f	{}	2026-03-16 16:21:40.582823-07	2026-03-24 17:05:12.992813-07	2097f77e-d172-482d-99d0-57604afc5900
0020f8f8-a560-4353-8904-398031942cd0	Pork and shrimp dumplings	pantry	1	whole	f	{ready-made}	2026-03-16 15:45:56.968717-07	2026-03-24 22:35:13.896951-07	2097f77e-d172-482d-99d0-57604afc5900
a79b5abe-020d-4053-bac9-576264fd55d1	quinoa, chia & flaxseed granola	pantry	16	oz	f	{}	2026-03-26 11:52:29.83545-07	2026-03-26 11:52:29.83545-07	2097f77e-d172-482d-99d0-57604afc5900
17900cd5-ff91-4369-adeb-ef675e6ce74a	CREAMY RANCH DIP	pantry	1	whole	f	{}	2026-03-26 11:55:21.859208-07	2026-03-26 11:55:21.859208-07	2097f77e-d172-482d-99d0-57604afc5900
e8c89c09-7067-4630-90a9-aed8d7ea7fa3	Organic Bunch Carrots	fruit	6	whole	f	{}	2026-03-26 11:56:28.626944-07	2026-03-26 11:56:28.626944-07	2097f77e-d172-482d-99d0-57604afc5900
ae54a937-ca25-48ac-806f-a2681147f9ed	Organic Broccoli	produce	1	whole	f	{}	2026-03-26 11:57:42.549045-07	2026-03-26 11:57:42.549045-07	2097f77e-d172-482d-99d0-57604afc5900
d392d2f6-dc93-4db7-b7da-c3ccfa1ebd88	Peaches and Cream	dairy	0.5	qt	f	{local,dairy,ice-cream,dessert}	2026-03-24 14:50:11.093701-07	2026-03-28 10:39:38.405066-07	2097f77e-d172-482d-99d0-57604afc5900
6df0fa9a-634a-4db1-967b-17d167bd01a5	Ginger Root	produce	1	whole	f	{}	2026-03-26 12:29:59.277201-07	2026-03-26 12:29:59.277201-07	2097f77e-d172-482d-99d0-57604afc5900
a282746b-8b95-4adf-b313-de7145c4222c	Asparagus	produce	1	bunch	f	{organic}	2026-03-26 12:29:59.333913-07	2026-03-26 12:29:59.333913-07	2097f77e-d172-482d-99d0-57604afc5900
42030bc7-8ad2-45f0-86e1-319d8bffb800	Bell Pepper	fruit	1	whole	f	{organic}	2026-03-26 12:29:59.366958-07	2026-03-26 12:58:06.242333-07	2097f77e-d172-482d-99d0-57604afc5900
e049ec19-e89d-4123-9172-4aafa6779456	Cucumbers	fruit	1	whole	f	{organic}	2026-03-26 12:29:59.308745-07	2026-03-30 09:24:01.994476-07	2097f77e-d172-482d-99d0-57604afc5900
79eb7cb9-a558-4a49-a68c-382360689967	Kosher Baby Dills	pantry	24	oz	f	{}	2026-03-30 16:12:46.556373-07	2026-03-30 16:12:46.556373-07	2097f77e-d172-482d-99d0-57604afc5900
6c511c25-55a4-4736-8bd6-1718dda9ad97	Apricot, Ginger and Lemon Flavor Shot	beverages	3	whole	f	{bruusta,mixology,kombucha}	2026-03-26 15:30:45.482817-07	2026-03-26 15:30:45.482817-07	2097f77e-d172-482d-99d0-57604afc5900
a106f066-965c-46b4-87ad-30ce227e614e	Strawberry and Blueberry flavor shot	beverages	3	whole	f	{bruusta,mixology,kombucha}	2026-03-26 15:29:36.775858-07	2026-03-26 15:31:06.243253-07	2097f77e-d172-482d-99d0-57604afc5900
75341c11-a941-43fb-b3d5-a8339e5fea19	Organic Pinto Beans	pantry	2	can	f	{}	2026-03-21 16:27:35.703841-07	2026-03-26 15:31:42.583861-07	2097f77e-d172-482d-99d0-57604afc5900
41890443-a27a-4697-92ca-5b4a70c2d3cd	Strawberry and Cream Ice Cream	dairy	0.7	\N	f	{tilamook,local,ice-cream,dessert}	2026-03-26 12:21:01.366697-07	2026-03-26 17:56:15.111496-07	2097f77e-d172-482d-99d0-57604afc5900
bff38991-e175-4d97-8fe0-545df15d5bbb	Focaccia bread	bakery	\N	\N	f	{slow-rise,bread,local,sustainable}	2026-03-19 08:14:55.661695-07	2026-03-28 09:14:56.600056-07	2097f77e-d172-482d-99d0-57604afc5900
f174167f-4cf8-465a-9959-c71adeaaeb78	Slow Rise Croissants	bakery	2	whole	f	{fresh-baked,bakery,bread}	2026-03-27 16:35:47.583018-07	2026-03-28 09:13:31.208093-07	2097f77e-d172-482d-99d0-57604afc5900
a05a8ebd-6424-4e65-8a33-196689f28032	Ridge Rush	beverages	16	can	f	{olipop,soda,pop,mixology}	2026-03-16 14:46:13.967069-07	2026-03-28 08:09:20.679689-07	2097f77e-d172-482d-99d0-57604afc5900
fd4f390e-19bb-4d9b-9a24-1dc33083a8d7	Cherry Cola	beverages	6	can	f	{olipop,soda,mixology}	2026-03-28 08:15:51.456248-07	2026-03-28 08:15:51.456248-07	2097f77e-d172-482d-99d0-57604afc5900
bfdc5361-82c4-4681-befc-32faf68e3673	Eggs	dairy	44	whole	f	{common}	2026-03-16 11:26:40.646864-07	2026-03-28 08:32:56.924219-07	2097f77e-d172-482d-99d0-57604afc5900
3e15c01e-1232-4fef-b32e-eae512713cb8	English Muffins	bakery	2	whole	f	{}	2026-03-27 14:00:02.991359-07	2026-03-29 11:11:57.776372-07	2097f77e-d172-482d-99d0-57604afc5900
27188404-c7cc-41c9-acc8-595ce3a9467b	Dark Chocolate	pantry	\N	\N	f	{}	2026-03-30 10:01:53.319184-07	2026-03-30 10:01:53.319184-07	2097f77e-d172-482d-99d0-57604afc5900
119029b7-f11d-444c-855f-37fb88255559	Bananas	fruit	7	whole	f	{organic,common}	2026-03-26 12:29:59.351373-07	2026-03-30 10:03:18.567169-07	2097f77e-d172-482d-99d0-57604afc5900
956d5689-98c0-4ec5-9bd8-94f340fde9ee	THAI DRESSING	pantry	12	oz	f	{}	2026-03-30 16:12:46.556373-07	2026-03-30 16:12:46.556373-07	2097f77e-d172-482d-99d0-57604afc5900
8d955069-5dfc-4434-87c4-5004d56d49d6	Organic Dark Chocolate Fig	pantry	1	whole	f	{}	2026-03-30 16:12:46.556373-07	2026-03-30 16:12:46.556373-07	2097f77e-d172-482d-99d0-57604afc5900
fd92c0d3-62cc-480d-9cf9-c8aa0726e629	Sweet Onion	produce	1	whole	f	{}	2026-03-30 16:18:17.015841-07	2026-03-30 16:18:17.015841-07	2097f77e-d172-482d-99d0-57604afc5900
a0d56407-4204-4582-b2c6-2bf6da272e6a	White Onion	produce	1	whole	f	{}	2026-03-30 16:18:17.015841-07	2026-03-30 16:18:17.015841-07	2097f77e-d172-482d-99d0-57604afc5900
d07a15a4-65e4-4689-8ee5-4f6dc079065c	Garlic Cloves	produce	2	cloves	f	{}	2026-03-30 16:18:17.015841-07	2026-03-30 16:18:17.015841-07	2097f77e-d172-482d-99d0-57604afc5900
04aabe5d-51ab-4d42-ae4d-68ccd73a12f1	Chicken Breast	protein	8	\N	f	{frozen}	2026-03-30 16:30:48.643722-07	2026-03-30 16:41:48.603539-07	2097f77e-d172-482d-99d0-57604afc5900
fcb7d492-d4e0-4c99-935b-a5165c6a8b36	Red Onion	produce	1	whole	f	{}	2026-03-30 16:43:27.902859-07	2026-03-30 16:43:27.902859-07	2097f77e-d172-482d-99d0-57604afc5900
9600223e-cc48-4041-a627-96670ee0e72e	Lemon	fruit	2	whole	f	{}	2026-03-30 17:19:01.088612-07	2026-03-30 17:19:01.088612-07	2097f77e-d172-482d-99d0-57604afc5900
bfc4b410-56bd-406a-878a-c7de34363099	Lime	fruit	2	whole	f	{}	2026-03-30 17:19:01.088612-07	2026-03-30 17:19:01.088612-07	2097f77e-d172-482d-99d0-57604afc5900
be27fe93-119f-442a-9f9d-1860e9a1fe6f	Oven-Ready Lasagne pasta	pantry	2	whole	f	{}	2026-03-30 18:38:12.172105-07	2026-03-30 18:38:46.16363-07	2097f77e-d172-482d-99d0-57604afc5900
c3efee0a-481b-4d4f-96d6-4dcb6fc0f52f	Fettuccine Pasta Noodles	pantry	1	box	f	{}	2026-03-30 18:39:53.494075-07	2026-03-30 18:39:53.494075-07	2097f77e-d172-482d-99d0-57604afc5900
e3bf0783-9c62-4a4b-9319-10fd49f9d06e	Cube Steaks	protein	4	whole	f	{frozen}	2026-03-30 19:55:39.08601-07	2026-03-30 19:55:39.08601-07	2097f77e-d172-482d-99d0-57604afc5900
8c28cd38-187a-4bfe-869e-eb1368042c18	Avocado	fruit	1	whole	f	{}	2026-03-31 06:53:48.798603-07	2026-03-31 06:54:22.462378-07	2097f77e-d172-482d-99d0-57604afc5900
479ee995-5fdc-4f10-a3a9-17a9127ea09e	Onion	spices	1	jar	f	{}	2026-03-31 14:10:15.601958-07	2026-03-31 14:10:15.601958-07	2097f77e-d172-482d-99d0-57604afc5900
e83a2246-662c-4fda-a529-817c8e38aa6e	Red Pepper	spices	1	jar	f	{}	2026-03-31 14:10:15.601958-07	2026-03-31 14:10:15.601958-07	2097f77e-d172-482d-99d0-57604afc5900
d873f31a-3555-454e-93ad-867ed4c761d8	Parsley	spices	1	jar	f	{}	2026-03-31 14:10:15.601958-07	2026-03-31 14:10:15.601958-07	2097f77e-d172-482d-99d0-57604afc5900
6015d313-afc5-46d7-8081-3b76d9446a3e	Chili Powder	spices	1	jar	f	{}	2026-03-31 14:10:15.601958-07	2026-03-31 14:10:15.601958-07	2097f77e-d172-482d-99d0-57604afc5900
5b5311fc-346d-44cb-89f4-b1d466c01058	Season Salt	spices	1	jar	f	{}	2026-03-31 14:10:15.601958-07	2026-03-31 14:10:15.601958-07	2097f77e-d172-482d-99d0-57604afc5900
80ed21c5-8d67-4181-9bf8-1c8331341ae3	Lemon Pepper	spices	1	jar	f	{}	2026-03-31 14:10:15.601958-07	2026-03-31 14:10:15.601958-07	2097f77e-d172-482d-99d0-57604afc5900
4967c471-71d2-4304-862e-565ad536b1e1	Italian Season	spices	1	jar	f	{}	2026-03-31 14:11:45.149131-07	2026-03-31 14:11:45.149131-07	2097f77e-d172-482d-99d0-57604afc5900
b7ea407c-3d33-479d-ab22-1bca7a679260	Garlic Salt	spices	1	jar	f	{}	2026-03-31 14:11:45.149131-07	2026-03-31 14:11:45.149131-07	2097f77e-d172-482d-99d0-57604afc5900
21c91c6b-5a75-4b71-a710-6927e6c38b60	Cinnamon	spices	1	jar	f	{}	2026-03-31 14:11:45.149131-07	2026-03-31 14:11:45.149131-07	2097f77e-d172-482d-99d0-57604afc5900
7ba59726-b104-4d71-84fc-8d6d57c871b6	Smoked Paprika	spices	1	jar	f	{organic}	2026-03-31 14:12:47.821431-07	2026-03-31 14:12:47.821431-07	2097f77e-d172-482d-99d0-57604afc5900
81d9c010-3f28-4095-a184-e90ece1e9168	Garlic	spices	1	jar	f	{}	2026-03-31 14:12:47.821431-07	2026-03-31 14:12:47.821431-07	2097f77e-d172-482d-99d0-57604afc5900
65feb4ef-4fc2-49c9-8f3d-68523a158913	Minced Onion	spices	1	jar	f	{}	2026-03-31 14:12:47.821431-07	2026-03-31 14:12:47.821431-07	2097f77e-d172-482d-99d0-57604afc5900
963caeee-96e3-42e2-be54-0ae8949e8c76	Chili Powder	spices	1	jar	f	{}	2026-03-31 14:12:47.821431-07	2026-03-31 14:12:47.821431-07	2097f77e-d172-482d-99d0-57604afc5900
c34e936a-f842-44f3-8bac-86e858fde700	Coriander	spices	1	jar	f	{organic}	2026-03-31 14:12:47.821431-07	2026-03-31 14:12:47.821431-07	2097f77e-d172-482d-99d0-57604afc5900
5c4d5c90-2a27-4669-9f54-ed32f90a4061	Mediterranean Basil	spices	1	jar	f	{}	2026-03-31 14:12:47.821431-07	2026-03-31 14:12:47.821431-07	2097f77e-d172-482d-99d0-57604afc5900
39a851cb-f7f6-442c-b68d-54f5c9467250	Mexican Oregano	spices	1	jar	f	{organic}	2026-03-31 14:12:47.821431-07	2026-03-31 14:12:47.821431-07	2097f77e-d172-482d-99d0-57604afc5900
1a6167ce-d6e3-42d4-aeed-68d46e06624a	Paprika	spices	1	jar	f	{organic}	2026-03-31 14:13:43.837689-07	2026-03-31 14:13:43.837689-07	2097f77e-d172-482d-99d0-57604afc5900
6fc7380d-0268-431f-ac02-1622bbd72bfc	Cumin	spices	1	jar	f	{organic}	2026-03-31 14:13:43.837689-07	2026-03-31 14:13:43.837689-07	2097f77e-d172-482d-99d0-57604afc5900
1d512bfb-eb92-4303-a2bc-aeade2cb0912	Ground White Pepper	spices	1	jar	f	{}	2026-03-31 14:13:43.837689-07	2026-03-31 14:13:43.837689-07	2097f77e-d172-482d-99d0-57604afc5900
be03203e-22c4-41e9-b982-93477ed6edc6	Dill Weed	spices	1	jar	f	{}	2026-03-31 14:13:43.837689-07	2026-03-31 14:13:43.837689-07	2097f77e-d172-482d-99d0-57604afc5900
66ed34ee-0386-4acd-95d8-09e774c2a08f	Texas Inspired Seasoning Rub	spices	1	jar	f	{}	2026-03-31 14:13:43.837689-07	2026-03-31 14:13:43.837689-07	2097f77e-d172-482d-99d0-57604afc5900
aec7dc5f-cb3f-407a-b44b-19d8a113ff6d	Turmeric	spices	1	jar	f	{organic}	2026-03-31 14:13:43.837689-07	2026-03-31 14:13:43.837689-07	2097f77e-d172-482d-99d0-57604afc5900
7396ad66-61af-4535-9bde-685dd06b805c	Cumin Ground	spices	1	jar	f	{}	2026-03-31 14:14:30.739203-07	2026-03-31 14:14:30.739203-07	2097f77e-d172-482d-99d0-57604afc5900
3cb7ad84-4ffb-46a4-9a4a-ecd839cadb4c	Onion Powder	spices	1	jar	f	{organic}	2026-03-31 14:14:30.739203-07	2026-03-31 14:14:30.739203-07	2097f77e-d172-482d-99d0-57604afc5900
e26567c5-6dd3-4df4-9cf6-8448290d9fa3	Oregano	spices	1	jar	f	{organic}	2026-03-31 14:14:30.739203-07	2026-03-31 14:14:30.739203-07	2097f77e-d172-482d-99d0-57604afc5900
0a8cfe9c-bc48-41cf-97e5-a947f42a9dae	Diane's Sweet Heat	spices	1	jar	f	{}	2026-03-31 14:14:30.739203-07	2026-03-31 14:14:30.739203-07	2097f77e-d172-482d-99d0-57604afc5900
3007c4b9-a048-4a16-84e5-5938bd1eaccd	Cajun Seasoning	spices	1	jar	f	{organic}	2026-03-31 14:14:30.739203-07	2026-03-31 14:14:30.739203-07	2097f77e-d172-482d-99d0-57604afc5900
9b459ca4-96dd-4165-b9ea-0be1ce7ca4f7	Cayenne Pepper	spices	1	jar	f	{organic}	2026-03-31 14:14:30.739203-07	2026-03-31 14:14:30.739203-07	2097f77e-d172-482d-99d0-57604afc5900
691bab3b-5c05-47cc-a26c-3d08566103f5	Turmeric	spices	1	jar	f	{organic}	2026-03-31 14:14:30.739203-07	2026-03-31 14:14:30.739203-07	2097f77e-d172-482d-99d0-57604afc5900
1ca2058f-64b9-48e1-a386-c63063d32787	Rub with Love Steak Rub	spices	1	jar	f	{}	2026-03-31 14:15:23.188691-07	2026-03-31 14:15:23.188691-07	2097f77e-d172-482d-99d0-57604afc5900
a5a5ec84-4595-441f-a98c-f9ebd713c56e	Rub with Love Pork Rub	spices	1	jar	f	{}	2026-03-31 14:15:23.188691-07	2026-03-31 14:15:23.188691-07	2097f77e-d172-482d-99d0-57604afc5900
5540e7c2-afb1-4b97-9e46-5b96bf8e1d4e	Kember's Maplewood	spices	1	jar	f	{}	2026-03-31 14:15:23.188691-07	2026-03-31 14:15:23.188691-07	2097f77e-d172-482d-99d0-57604afc5900
48ae19f4-f988-4c80-a8f3-1d8ff839f593	Fungaia Farm Cajun Spice Mix	spices	1	jar	f	{}	2026-03-31 14:15:23.188691-07	2026-03-31 14:15:23.188691-07	2097f77e-d172-482d-99d0-57604afc5900
d3bc4029-c5bd-480a-a240-1acbacaaf139	Dark & Smoky	spices	1	jar	f	{}	2026-03-31 14:15:23.188691-07	2026-03-31 14:15:23.188691-07	2097f77e-d172-482d-99d0-57604afc5900
cb8ad9f9-34bd-4cb7-97cb-eeacee4e086c	Honey Cured Heat	spices	1	jar	f	{}	2026-03-31 14:15:23.188691-07	2026-03-31 14:15:23.188691-07	2097f77e-d172-482d-99d0-57604afc5900
a7f4cda9-f0bb-461b-a4d1-9846826a9cc9	McCormick Oregano Leaves	spices	1	jar	f	{}	2026-03-31 14:16:17.26528-07	2026-03-31 14:16:17.26528-07	2097f77e-d172-482d-99d0-57604afc5900
66334b64-77b6-49e0-a6d6-c2bb787c0376	Aged Garlic	spices	1	bottle	f	{}	2026-03-31 14:16:17.26528-07	2026-03-31 14:16:17.26528-07	2097f77e-d172-482d-99d0-57604afc5900
4c1e970a-95b3-4f5c-b70d-ffff2607a0c9	Kinders Lemon Butter Garlic	spices	1	jar	f	{}	2026-03-31 14:16:17.26528-07	2026-03-31 14:16:17.26528-07	2097f77e-d172-482d-99d0-57604afc5900
d53cf7a3-f8f7-43b1-8765-29429500f545	King Arthur Pizza Seasoning	spices	1	jar	f	{}	2026-03-31 14:16:17.26528-07	2026-03-31 14:16:17.26528-07	2097f77e-d172-482d-99d0-57604afc5900
ebcd870f-13a2-4e3b-abeb-ee4cc907bac3	New York Shuk Ras El Hanout	spices	1	jar	f	{}	2026-03-31 14:16:17.26528-07	2026-03-31 14:16:17.26528-07	2097f77e-d172-482d-99d0-57604afc5900
12dffb62-d07c-486b-a86f-732ccdb10768	Private Selection Italian Seasoning	spices	1	jar	f	{}	2026-03-31 14:16:17.26528-07	2026-03-31 14:16:17.26528-07	2097f77e-d172-482d-99d0-57604afc5900
f7d83695-40d5-447c-9c94-3c43edc2649e	Traeger Mesquite BBQ Rub	spices	1	container	f	{}	2026-03-31 14:17:12.981519-07	2026-03-31 14:17:12.981519-07	2097f77e-d172-482d-99d0-57604afc5900
855fd11a-8ac0-42f2-a09f-62ca5ad078af	Organic Onion Chopped	spices	1	jar	f	{organic}	2026-03-31 14:17:12.981519-07	2026-03-31 14:17:12.981519-07	2097f77e-d172-482d-99d0-57604afc5900
37176504-c179-4698-ae05-fd2be53beda6	Tajín	spices	1	bottle	f	{}	2026-03-31 14:17:12.981519-07	2026-03-31 14:17:12.981519-07	2097f77e-d172-482d-99d0-57604afc5900
d60ea232-f8a8-45c2-b556-434eca1f7cd1	McCormick Fine Garlic Powder	spices	1	jar	f	{}	2026-03-31 14:17:12.981519-07	2026-03-31 14:17:12.981519-07	2097f77e-d172-482d-99d0-57604afc5900
b0bdb1b3-c93a-40b4-af9a-1778d8326521	Traeger Beef Rub	spices	1	container	f	{}	2026-03-31 14:17:12.981519-07	2026-03-31 14:17:12.981519-07	2097f77e-d172-482d-99d0-57604afc5900
3a3b9a6a-06d2-492d-aef9-3da953260a8b	Larrupin swedish style mustard dill sauce	pantry	1	whole	f	{}	2026-03-31 14:18:00.370778-07	2026-03-31 14:18:00.370778-07	2097f77e-d172-482d-99d0-57604afc5900
00fbaf14-4f59-4dc2-a6eb-f22812c0561d	Caputo dry yeast	bakery	300	g	f	{}	2026-03-31 14:19:14.712311-07	2026-03-31 14:19:29.579559-07	2097f77e-d172-482d-99d0-57604afc5900
802f0432-212b-4b7c-9917-03b0f98108b7	Pumpkin Pie Spice	spices	1	box	f	{}	2026-03-31 14:20:42.213871-07	2026-03-31 14:20:42.213871-07	2097f77e-d172-482d-99d0-57604afc5900
f01427c8-16d1-46d6-9495-0e3efbf347fa	Jacobsen White Truffle Salt	spices	1	jar	f	{}	2026-03-31 14:20:42.213871-07	2026-03-31 14:20:42.213871-07	2097f77e-d172-482d-99d0-57604afc5900
6944d745-5392-4ca7-b4db-2749d2747454	Jacobsen Black Garlic Salt	spices	1	jar	f	{}	2026-03-31 14:20:42.213871-07	2026-03-31 14:20:42.213871-07	2097f77e-d172-482d-99d0-57604afc5900
94643f4b-2776-4e36-aefb-50e92e493228	Sebastiano's Calabrian Chili Garlic Seasoning	spices	1	jar	f	{}	2026-03-31 14:20:42.213871-07	2026-03-31 14:20:42.213871-07	2097f77e-d172-482d-99d0-57604afc5900
7ebfddcf-22c7-45d3-9e70-bb768d0acf2b	Jacobsen Chili Lime Salt	spices	1	jar	f	{}	2026-03-31 14:20:42.213871-07	2026-03-31 14:20:42.213871-07	2097f77e-d172-482d-99d0-57604afc5900
0190e102-3ba4-4e46-9e2f-b9fe0611c44a	Gordon Rhodes The Pig Easy American BBQ Style Pulled Pork Gourmet Sauce Mix	pantry	2	box	f	{gluten-free}	2026-03-31 14:22:43.841483-07	2026-03-31 14:22:43.841483-07	2097f77e-d172-482d-99d0-57604afc5900
3083fa51-2654-4811-afb3-0a9926739dfb	Thyme Ground	spices	1	container	f	{}	2026-03-31 14:23:11.306328-07	2026-03-31 14:23:11.306328-07	2097f77e-d172-482d-99d0-57604afc5900
78875b77-ceae-44dc-a9be-509fbdb734b8	Parsley Flakes	spices	1	container	f	{}	2026-03-31 14:23:11.306328-07	2026-03-31 14:23:11.306328-07	2097f77e-d172-482d-99d0-57604afc5900
208f86ff-a3d9-486d-99b6-d759fc960204	Jacobsen Rosemary Salt	spices	1	jar	f	{}	2026-03-31 14:23:41.946753-07	2026-03-31 14:23:41.946753-07	2097f77e-d172-482d-99d0-57604afc5900
11544b2a-5af5-4224-9d95-c8676f1775eb	Jacobsen Smoked Nori Salt	spices	1	jar	f	{}	2026-03-31 14:23:41.946753-07	2026-03-31 14:23:41.946753-07	2097f77e-d172-482d-99d0-57604afc5900
0e3545c1-5c84-4315-8b36-971df087c0cb	Jacobsen Habanero Salt	spices	1	jar	f	{}	2026-03-31 14:23:41.946753-07	2026-03-31 14:23:41.946753-07	2097f77e-d172-482d-99d0-57604afc5900
25e0acbf-498d-4ff7-a251-169919bda3ec	Jacobsen Ghost Chili Salt	spices	1	jar	f	{}	2026-03-31 14:23:41.946753-07	2026-03-31 14:23:41.946753-07	2097f77e-d172-482d-99d0-57604afc5900
76ae90c1-9fb9-440f-b6cd-d63a060667cb	Pick-A-Flavor Original Ballpark Style Popcorn Salt	spices	1	jar	f	{}	2026-03-31 14:24:31.58984-07	2026-03-31 14:24:31.58984-07	2097f77e-d172-482d-99d0-57604afc5900
beb38095-cd49-415c-95d4-b672c1a78529	Jacobsen Lemon Zest Salt	spices	1	jar	f	{}	2026-03-31 14:24:31.58984-07	2026-03-31 14:24:31.58984-07	2097f77e-d172-482d-99d0-57604afc5900
dc062efa-5e14-4397-97b5-d38d7d636cc6	Jacobsen Pinot Noir Salt	spices	1	jar	f	{}	2026-03-31 14:24:31.58984-07	2026-03-31 14:24:31.58984-07	2097f77e-d172-482d-99d0-57604afc5900
29ba69b6-e1b8-4e2f-9dcf-baa59d581c60	Kroger Oregano Leaves	spices	1	container	f	{}	2026-03-31 14:25:10.948365-07	2026-03-31 14:25:10.948365-07	2097f77e-d172-482d-99d0-57604afc5900
40e44dbb-73d7-41aa-b920-136e0ebbbae3	Kroger Basil Leaves	spices	1	container	f	{}	2026-03-31 14:25:10.948365-07	2026-03-31 14:25:10.948365-07	2097f77e-d172-482d-99d0-57604afc5900
9f6ae658-4f5f-44f7-981c-6dd4a1ec655a	Redmond Real Salt Ancient Fine Sea Salt	spices	1	bag	f	{}	2026-03-31 14:25:56.809022-07	2026-03-31 14:25:56.809022-07	2097f77e-d172-482d-99d0-57604afc5900
c8c4bef1-453b-415d-a6b1-0724510c1fac	McCormick Red Pepper Crushed	spices	1	jar	f	{}	2026-03-31 14:25:56.809022-07	2026-03-31 14:25:56.809022-07	2097f77e-d172-482d-99d0-57604afc5900
a8c56ac2-67c2-4108-b909-53315219db61	Viva Doria Rainbow Peppercorn Four Pepper Blend	spices	1	box	f	{}	2026-03-31 14:25:56.809022-07	2026-03-31 14:25:56.809022-07	2097f77e-d172-482d-99d0-57604afc5900
a3ab3942-5a66-4f65-a5c5-d65b4f84cb08	Morton Coarse Kosher Salt	spices	1	box	f	{}	2026-03-31 14:26:26.970284-07	2026-03-31 14:26:26.970284-07	2097f77e-d172-482d-99d0-57604afc5900
aaa04cf1-2603-4824-8011-d88ca97fd852	Morton Salt	spices	1	container	f	{}	2026-03-31 14:26:26.970284-07	2026-03-31 14:26:26.970284-07	2097f77e-d172-482d-99d0-57604afc5900
e6c29937-18e0-493e-b19c-509541ed0018	Organic Turmeric Powder	spices	1	bag	f	{organic}	2026-03-31 14:27:11.961846-07	2026-03-31 14:27:11.961846-07	2097f77e-d172-482d-99d0-57604afc5900
9696b8f6-3eee-41dd-a2f5-53b6ee5d81b0	Viva Doria Himalayan Pink Salt Coarse Grain	spices	2	lb	f	{}	2026-03-31 14:27:11.961846-07	2026-03-31 14:27:11.961846-07	2097f77e-d172-482d-99d0-57604afc5900
e0e5526b-3682-4248-ad92-6bf72eb0efea	_wt_1775038747135	\N	\N	\N	f	{}	2026-04-01 03:19:10.681637-07	2026-04-01 03:19:10.681637-07	2097f77e-d172-482d-99d0-57604afc5900
96bdbc67-3ff4-4850-ab66-1ce15f5bd5d0	_witness_test_1775038771964	\N	\N	\N	f	{}	2026-04-01 03:19:49.384388-07	2026-04-01 03:19:49.384388-07	2097f77e-d172-482d-99d0-57604afc5900
\.


--
-- Data for Name: kitchens; Type: TABLE DATA; Schema: public; Owner: jpdevries
--

COPY public.kitchens (id, slug, name, created_at) FROM stdin;
2097f77e-d172-482d-99d0-57604afc5900	home	Home	2026-03-16 10:53:55.887487-07
\.


--
-- Data for Name: menu_recipes; Type: TABLE DATA; Schema: public; Owner: jpdevries
--

COPY public.menu_recipes (id, menu_id, recipe_id, course, sort_order) FROM stdin;
9161b59f-224f-4a1b-b8d4-5113e92c67ab	df82626a-c9df-48bc-8752-b470933f01e9	a01888a1-eea4-40c1-adfd-26ad07288d05	main-course	0
986e7692-f1fb-4627-bd94-8eb594aad3d7	df82626a-c9df-48bc-8752-b470933f01e9	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	main-course	1
859b80f1-0438-4860-ad92-637335b6e9ec	df82626a-c9df-48bc-8752-b470933f01e9	9a633436-c166-4bd4-9a38-9d7363d99fd4	other	2
c5584928-9044-4d0a-9825-6246221dacd9	d1e8c547-a0fd-4164-ad51-282fecad5cf9	ac395333-a4dd-4c47-8aec-982159004f66	breakfast	0
57dca80f-9cb2-41d3-a137-21775f754637	d1e8c547-a0fd-4164-ad51-282fecad5cf9	a522f13a-f5b0-457b-b397-91c70f4d11da	breakfast	1
3f045688-5b17-43be-ae44-a3c5234c12e2	d1e8c547-a0fd-4164-ad51-282fecad5cf9	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	breakfast	2
38c36373-da26-4f23-b2ee-ab553c0e2e85	d1e8c547-a0fd-4164-ad51-282fecad5cf9	a39da54e-23b7-4b37-8405-ddd001072728	breakfast	3
f08640e5-04bf-4ead-a503-0e26fadeca63	d1e8c547-a0fd-4164-ad51-282fecad5cf9	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	breakfast	4
4f1fbb8a-0c97-44c1-8219-70e317299394	d1e8c547-a0fd-4164-ad51-282fecad5cf9	e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	breakfast	5
2371e572-7cce-4dc4-81f6-bbedd2f817b9	d1e8c547-a0fd-4164-ad51-282fecad5cf9	d5263db2-71c1-4435-b373-41e3b0e0c5ae	beverage	6
a9ea186a-fbd4-4ab6-b362-420185beb049	d1e8c547-a0fd-4164-ad51-282fecad5cf9	babe1759-9be6-494f-a487-7253b11b845c	beverage	7
e0cf504e-4133-4cd1-861b-ee7d2f6e1027	d1e8c547-a0fd-4164-ad51-282fecad5cf9	1672e7ba-e625-42fc-ba7f-0af9b9014621	beverage	8
a7372823-7b82-422a-8779-694c3d562ba1	d1e8c547-a0fd-4164-ad51-282fecad5cf9	617c87e7-a799-483c-8570-b9ec3d9b0517	beverage	9
40605233-873d-4398-9f27-45f6404ee220	29803c9b-6eec-4054-8fc6-6c5280099f38	9ec52826-0efc-4c32-a0e3-aedcdfb1223b	other	0
61bae6a3-e4b3-423a-82d2-6f80db3c4b15	29803c9b-6eec-4054-8fc6-6c5280099f38	7e594bdd-6831-49a5-804d-fab6975df7ef	main-course	1
3455407f-2655-4a34-a7a4-d0c5f350d589	e8a65027-dd38-4887-8337-9259d04b6d7e	a2fd26aa-5e71-402b-91c7-d6ee01062ab9	dessert	0
28e465b5-d9f8-42d7-a319-4f5ed8ed69f8	e8a65027-dd38-4887-8337-9259d04b6d7e	3523ab6d-c94e-4750-9bc9-56d210ca5702	dessert	1
8534bab1-ca88-446d-8409-e9bfc55197d6	2c451dff-a717-4e19-a576-fea71c7b4fa6	3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	beverage	0
0c8e794d-4457-4163-a082-19cefd4c0cea	2c451dff-a717-4e19-a576-fea71c7b4fa6	569487a8-197f-4776-92c3-102e86203c8b	breakfast	1
e37cef44-b3c4-4f72-a330-f81505e6f0ca	2c451dff-a717-4e19-a576-fea71c7b4fa6	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	breakfast	2
bd727663-5de8-42b3-9e29-ac89e9372cc9	2c451dff-a717-4e19-a576-fea71c7b4fa6	ac395333-a4dd-4c47-8aec-982159004f66	breakfast	3
da4c654c-ffce-4487-b4af-4d4389bacf42	2c451dff-a717-4e19-a576-fea71c7b4fa6	d4988716-d9fb-403b-9b27-fda652ab7363	breakfast	4
db34cb92-3de6-4bcc-aaa8-6350b7fc180a	2c451dff-a717-4e19-a576-fea71c7b4fa6	a2fd26aa-5e71-402b-91c7-d6ee01062ab9	dessert	5
7c6a56de-d680-48e4-9d10-62978159e3e7	2c451dff-a717-4e19-a576-fea71c7b4fa6	3523ab6d-c94e-4750-9bc9-56d210ca5702	dessert	6
0ec1e9fe-5af4-49ef-9777-bf850aecd9b8	2c451dff-a717-4e19-a576-fea71c7b4fa6	9a633436-c166-4bd4-9a38-9d7363d99fd4	main-course	7
5dd86bc1-e6cc-4df1-9d55-6509ca59a12f	2c451dff-a717-4e19-a576-fea71c7b4fa6	b947002b-5a26-450b-89b0-149a8f87089d	other	8
248ac798-7dff-48bc-af4d-235e8acad5b4	2c451dff-a717-4e19-a576-fea71c7b4fa6	2d57c883-cc8f-4f28-88dc-953483e5b51b	other	9
5bbef04c-3892-4c78-a042-54ec584b5876	2c451dff-a717-4e19-a576-fea71c7b4fa6	fdfaec68-1409-4b81-8639-a1dfb67a780b	other	10
10edb322-6890-4e9f-8427-8c9c306a9491	a4ad4e16-7501-40e6-8461-7e8487597a7d	80d9033b-d275-4687-9219-c9802918bb7e	appetizer	0
714385fb-285c-4229-93c7-9f8230a61b68	2c451dff-a717-4e19-a576-fea71c7b4fa6	4fcfff0f-56aa-4bf6-a84b-8d701f796671	other	11
3786d000-563a-4b26-ad82-6e11314b94a2	a4ad4e16-7501-40e6-8461-7e8487597a7d	c8b62ba7-ad1a-4aac-958a-7c1f8f869119	dessert	1
0dc8d40b-4617-428b-99ea-f7a33112f903	2c451dff-a717-4e19-a576-fea71c7b4fa6	78a9862e-f35e-41aa-bc48-a70db4ef3286	main-course	12
d8ea2417-caf5-40b0-8949-abf186169c6d	a4ad4e16-7501-40e6-8461-7e8487597a7d	a2fd26aa-5e71-402b-91c7-d6ee01062ab9	dessert	3
4ae2b654-5e35-46c7-9696-b06b138ae392	2c451dff-a717-4e19-a576-fea71c7b4fa6	bfc958ed-a479-4e70-a06a-632859a67ba2	main-course	13
c9c364fc-a027-4a94-b377-132f535691e9	a4ad4e16-7501-40e6-8461-7e8487597a7d	3523ab6d-c94e-4750-9bc9-56d210ca5702	dessert	2
ab24e614-c65f-405e-990b-57b52987407d	2c451dff-a717-4e19-a576-fea71c7b4fa6	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	main-course	14
f342969a-ad12-4bb9-a50a-eafdb27e86b2	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	beverage	0
2237372f-faff-4e40-9370-6831d28cdea0	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	6ccdee31-b87d-424d-a6ff-9ba2f7e352fc	beverage	1
ca128bf2-b99e-4ac9-a834-4756025b0033	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	617c87e7-a799-483c-8570-b9ec3d9b0517	beverage	2
44d7d076-fe46-4e60-8dd3-bc352d258f38	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	beverage	3
450598c1-cfaf-4e30-b3cf-59eb9b088a11	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	ac395333-a4dd-4c47-8aec-982159004f66	beverage	4
ad97a287-f799-4caa-8297-2892f375f5c5	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	d5263db2-71c1-4435-b373-41e3b0e0c5ae	beverage	5
723e2240-1c8a-4507-84c4-8966bd58c6a8	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	4b49372d-beb1-4006-8918-acec20387015	beverage	6
eb36a18f-0869-4dc7-9619-6fb3ebe13e64	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	350fa316-fd7b-4c31-84c7-18a2966cc4da	breakfast	7
2004a725-bdae-434c-9484-c1101fa00e4b	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	569487a8-197f-4776-92c3-102e86203c8b	breakfast	8
ede5f7a0-47f5-4225-bf36-cb8c7b5cab2a	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	breakfast	9
861ded6c-f3e1-4a93-a404-3e665421be01	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	95fa3787-920c-44bd-8e74-6ab31cc8fb5c	breakfast	10
c5208f3d-33e5-43bb-98fa-0b629e668f5a	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	d4988716-d9fb-403b-9b27-fda652ab7363	breakfast	11
305f5b87-af25-489f-90cd-31c5ba73e6c0	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	ba77d39d-3f2d-4b07-9ba5-2bd57598ff0a	breakfast	12
d8baa3e8-5481-4cc6-b6a1-12177098450c	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	748747fb-7ca8-4ba3-9f64-a549f009744d	breakfast	13
0697ba4d-3383-4e01-8613-1b82940974ff	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	10288612-86f9-4856-90da-79057817d759	appetizer	14
3e842b33-51bd-4ab4-a511-2e27c27afe97	a4ad4e16-7501-40e6-8461-7e8487597a7d	564bbcda-c033-472e-b45b-0cc6b331f943	main-course	4
\.


--
-- Data for Name: menus; Type: TABLE DATA; Schema: public; Owner: jpdevries
--

COPY public.menus (id, title, slug, description, kitchen_id, created_at, active, category) FROM stdin;
d1e8c547-a0fd-4164-ad51-282fecad5cf9	Brunch	brunch	Yum.	2097f77e-d172-482d-99d0-57604afc5900	2026-03-20 06:46:01.257578-07	t	sunday
df82626a-c9df-48bc-8752-b470933f01e9	Dinner	diner	What's in the queue for dinner this week.	2097f77e-d172-482d-99d0-57604afc5900	2026-03-18 21:51:45.021786-07	t	daily
29803c9b-6eec-4054-8fc6-6c5280099f38	Lunch	lunch	Often no-cook, on hand easy lunch recipes.	2097f77e-d172-482d-99d0-57604afc5900	2026-03-19 09:13:50.909446-07	t	daily
e8a65027-dd38-4887-8337-9259d04b6d7e	Dessert	dessert	Currently available desserts.	2097f77e-d172-482d-99d0-57604afc5900	2026-03-24 18:27:53.824054-07	t	todays-specials
2c451dff-a717-4e19-a576-fea71c7b4fa6	Organic Week	organic-week	Going green this week.	2097f77e-d172-482d-99d0-57604afc5900	2026-03-26 12:37:56.507365-07	t	this-week
c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	Breakfast	breakfast	Classics we always keep on hand to get the day started right.	2097f77e-d172-482d-99d0-57604afc5900	2026-03-18 21:46:32.76227-07	t	daily
a4ad4e16-7501-40e6-8461-7e8487597a7d	Pizza Night	pizza-night	Our favorite pizza night spread with homemade Neapolitan dough, charcuterie for nibbling, and smoothies to cool down.	2097f77e-d172-482d-99d0-57604afc5900	2026-03-17 23:50:15.546718-07	t	social
\.


--
-- Data for Name: recipe_cookware; Type: TABLE DATA; Schema: public; Owner: jpdevries
--

COPY public.recipe_cookware (recipe_id, cookware_id) FROM stdin;
b947002b-5a26-450b-89b0-149a8f87089d	f1342716-0a1d-411f-b6de-dfdc4768a162
a39da54e-23b7-4b37-8405-ddd001072728	3eb41879-4656-41dd-998c-51e254c9d30d
3523ab6d-c94e-4750-9bc9-56d210ca5702	3eb41879-4656-41dd-998c-51e254c9d30d
f2a439cc-0eb1-4989-a3be-93bbaf1c58c8	f4e23b46-dcf6-4d80-9f40-c8dfb74f62d7
f2a439cc-0eb1-4989-a3be-93bbaf1c58c8	93700ede-98ac-4586-bb11-b06fda205487
44ebf2b4-a456-4d37-8e3d-d88982c66714	358beee3-b3bb-44f4-9299-e3fb476796ea
f0a11b10-0580-4702-8819-56e459992a8c	815dce22-ad26-4360-937b-93aa216543ef
eaca8ab1-aab9-4819-a2fb-fce3adcbf543	9b05576a-e57c-44e5-a5dd-1d9cd721f07f
95fa3787-920c-44bd-8e74-6ab31cc8fb5c	9b05576a-e57c-44e5-a5dd-1d9cd721f07f
497e7a07-a568-45fa-852b-80863f672e4a	ff2549c8-3273-46f8-8860-3fcceef9ce3e
497e7a07-a568-45fa-852b-80863f672e4a	f4e23b46-dcf6-4d80-9f40-c8dfb74f62d7
497e7a07-a568-45fa-852b-80863f672e4a	815dce22-ad26-4360-937b-93aa216543ef
17cab84f-48c5-4dd7-9849-1a0e1ee0ddf1	b0d34e51-d9fb-430b-8c32-9e26d7340688
78a9862e-f35e-41aa-bc48-a70db4ef3286	f4e23b46-dcf6-4d80-9f40-c8dfb74f62d7
78a9862e-f35e-41aa-bc48-a70db4ef3286	93700ede-98ac-4586-bb11-b06fda205487
402c389f-38c3-4ba0-99b2-36d42cdc9992	815dce22-ad26-4360-937b-93aa216543ef
693024ba-9b16-493e-ae91-4abeacd7344f	77a6e7e8-af3d-41a2-82f5-72442d1100ba
ac395333-a4dd-4c47-8aec-982159004f66	9b05576a-e57c-44e5-a5dd-1d9cd721f07f
c6255b5f-6f20-4dc5-b4c4-ca0b300a57b7	77a6e7e8-af3d-41a2-82f5-72442d1100ba
7dd0efcd-7f9e-4805-a85d-ad044b8801b5	77a6e7e8-af3d-41a2-82f5-72442d1100ba
ab7a2b1a-add7-4a55-b10a-bb9c4648be58	77a6e7e8-af3d-41a2-82f5-72442d1100ba
646dfcb3-0121-4cdc-8280-de7783178f28	358beee3-b3bb-44f4-9299-e3fb476796ea
f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	3eb41879-4656-41dd-998c-51e254c9d30d
be7b35fd-c70d-4c8a-adfc-6d25fe255187	f4e23b46-dcf6-4d80-9f40-c8dfb74f62d7
be7b35fd-c70d-4c8a-adfc-6d25fe255187	ff2549c8-3273-46f8-8860-3fcceef9ce3e
98708958-7ead-4d57-aa3a-405a78688786	77a6e7e8-af3d-41a2-82f5-72442d1100ba
50bfe51d-e065-4cf2-858b-75d432023f51	77a6e7e8-af3d-41a2-82f5-72442d1100ba
86d2c1bb-5cb6-49fa-887d-89d0482a6f1d	358beee3-b3bb-44f4-9299-e3fb476796ea
86d2c1bb-5cb6-49fa-887d-89d0482a6f1d	93700ede-98ac-4586-bb11-b06fda205487
ba77d39d-3f2d-4b07-9ba5-2bd57598ff0a	3eb41879-4656-41dd-998c-51e254c9d30d
70163822-a1e6-4a76-b21d-d231639e3424	77a6e7e8-af3d-41a2-82f5-72442d1100ba
617c87e7-a799-483c-8570-b9ec3d9b0517	9b05576a-e57c-44e5-a5dd-1d9cd721f07f
4b49372d-beb1-4006-8918-acec20387015	77a6e7e8-af3d-41a2-82f5-72442d1100ba
748747fb-7ca8-4ba3-9f64-a549f009744d	358beee3-b3bb-44f4-9299-e3fb476796ea
bfc958ed-a479-4e70-a06a-632859a67ba2	f4e23b46-dcf6-4d80-9f40-c8dfb74f62d7
bfc958ed-a479-4e70-a06a-632859a67ba2	93700ede-98ac-4586-bb11-b06fda205487
a01888a1-eea4-40c1-adfd-26ad07288d05	358beee3-b3bb-44f4-9299-e3fb476796ea
4fcfff0f-56aa-4bf6-a84b-8d701f796671	f1342716-0a1d-411f-b6de-dfdc4768a162
a2fd26aa-5e71-402b-91c7-d6ee01062ab9	3eb41879-4656-41dd-998c-51e254c9d30d
3449a857-00b1-4ddb-a648-1cebd4d7056e	358beee3-b3bb-44f4-9299-e3fb476796ea
3449a857-00b1-4ddb-a648-1cebd4d7056e	f4e23b46-dcf6-4d80-9f40-c8dfb74f62d7
fdfaec68-1409-4b81-8639-a1dfb67a780b	f1342716-0a1d-411f-b6de-dfdc4768a162
2d57c883-cc8f-4f28-88dc-953483e5b51b	f1342716-0a1d-411f-b6de-dfdc4768a162
6455deb8-1355-48b1-a1ff-c2d8cfa136ed	3fcbd9e1-4200-47fa-8e53-425817aa2289
5bd2dcb3-ee02-4705-8c5a-45a2a9a5c2ec	358beee3-b3bb-44f4-9299-e3fb476796ea
9f91647a-c339-4cab-b351-58ed2283adac	3fcbd9e1-4200-47fa-8e53-425817aa2289
e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	3fcbd9e1-4200-47fa-8e53-425817aa2289
c31fc607-b195-4a8b-bd20-12315457dcb1	358beee3-b3bb-44f4-9299-e3fb476796ea
9a633436-c166-4bd4-9a38-9d7363d99fd4	358beee3-b3bb-44f4-9299-e3fb476796ea
384ec3bb-7128-40f0-98d1-719f7c15d544	358beee3-b3bb-44f4-9299-e3fb476796ea
b47b4db5-216c-4f3e-bee9-25ff6cef0a51	358beee3-b3bb-44f4-9299-e3fb476796ea
adba5b7a-2289-49d1-9877-b591b0ae5728	358beee3-b3bb-44f4-9299-e3fb476796ea
adabc033-1481-4af1-91d5-fe59df7da495	358beee3-b3bb-44f4-9299-e3fb476796ea
e9265d82-6e86-4176-b0e3-5359b3a9763e	358beee3-b3bb-44f4-9299-e3fb476796ea
babe1759-9be6-494f-a487-7253b11b845c	9b05576a-e57c-44e5-a5dd-1d9cd721f07f
1672e7ba-e625-42fc-ba7f-0af9b9014621	9b05576a-e57c-44e5-a5dd-1d9cd721f07f
434ebd11-a56d-4d36-87c1-eb56c25b13df	9b05576a-e57c-44e5-a5dd-1d9cd721f07f
6ccdee31-b87d-424d-a6ff-9ba2f7e352fc	9b05576a-e57c-44e5-a5dd-1d9cd721f07f
4ecc4a91-2784-4b84-a664-78eda0134c78	9b05576a-e57c-44e5-a5dd-1d9cd721f07f
d5263db2-71c1-4435-b373-41e3b0e0c5ae	9b05576a-e57c-44e5-a5dd-1d9cd721f07f
8bb904af-393a-4478-857a-90e4ff8e8272	9b05576a-e57c-44e5-a5dd-1d9cd721f07f
daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	84997166-5ad8-4f3d-8a97-d314b2e0ef21
93671294-7ce7-4386-b44e-e6489f654c69	b0d34e51-d9fb-430b-8c32-9e26d7340688
3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	77a6e7e8-af3d-41a2-82f5-72442d1100ba
f0a11b10-0580-4702-8819-56e459992a8c	3fcbd9e1-4200-47fa-8e53-425817aa2289
ce12aaee-0e38-4ebf-8eaf-eb6fcc76362d	1624691e-6e53-484b-a843-67fd078a767f
a1f05bba-01d0-4ac6-be1a-233aae393c03	1624691e-6e53-484b-a843-67fd078a767f
6661a800-c71a-4c75-9df5-0352f8ed3ba4	5e1df76c-0723-4e27-9930-f624ffa32b7b
d4988716-d9fb-403b-9b27-fda652ab7363	3eb41879-4656-41dd-998c-51e254c9d30d
564bbcda-c033-472e-b45b-0cc6b331f943	ff2549c8-3273-46f8-8860-3fcceef9ce3e
6201fab6-7993-4370-943a-21d930204e07	815dce22-ad26-4360-937b-93aa216543ef
de930450-0ec5-49e8-bfb2-e9b25e32927d	93700ede-98ac-4586-bb11-b06fda205487
1d8fce90-83cc-40f5-9c53-156da6f146a6	358beee3-b3bb-44f4-9299-e3fb476796ea
f1689f69-4359-4f71-ae5d-90853521a216	e55cfb08-06ba-4489-9afa-0e1fcdb3a99e
9b6a724b-264d-4a47-9f6b-cd598287e029	76f8e134-b154-4163-aec6-e3556b3a15bd
\.


--
-- Data for Name: recipe_ingredients; Type: TABLE DATA; Schema: public; Owner: jpdevries
--

COPY public.recipe_ingredients (id, recipe_id, ingredient_name, quantity, unit, source_recipe_id, sort_order) FROM stdin;
7f7b531a-0fa6-45bf-b4aa-5ae285c4f4a6	d5263db2-71c1-4435-b373-41e3b0e0c5ae	almonds (if using soaked almonds, you only need to use about ½ cup dry almonds, soaked in water for at least 4 hours or overnight)	1	cup	\N	0
5e39c6d4-9e12-4008-80a5-b4fb2d078348	d5263db2-71c1-4435-b373-41e3b0e0c5ae	3-4 chopped, pitted dates or 1-2 tbsp maple syrup (optional)	\N	\N	\N	0
94d38db4-9142-4e2c-aab6-5b75f0de78e3	d5263db2-71c1-4435-b373-41e3b0e0c5ae	vanilla (optional)	0.5	tsp	\N	0
e04d09cc-1441-4cff-ac83-c69b9c6df8d6	d5263db2-71c1-4435-b373-41e3b0e0c5ae	pinch of sea salt (optional)	\N	\N	\N	0
925c6da1-a065-4d4c-86f9-40dd57c28759	8bb904af-393a-4478-857a-90e4ff8e8272	cashew pieces	0.5	cup	\N	0
07104ab1-4ef7-465f-b6b4-65074433c210	8bb904af-393a-4478-857a-90e4ff8e8272	steamed rice	0.5	cup	\N	0
aaa4f7b6-f0f7-4d16-aeea-93b6859a1044	8bb904af-393a-4478-857a-90e4ff8e8272	500ml of water for brewing cinnamon	\N	\N	\N	0
49fc4600-4919-4035-a93b-2d97e6157f3f	6ccdee31-b87d-424d-a6ff-9ba2f7e352fc	pinch of sea salt (optional)	\N	whole	\N	0
f86352da-86fb-4617-83c6-0394e6cc875b	6ccdee31-b87d-424d-a6ff-9ba2f7e352fc	1-2 tbsp maple syrup (optional)	\N	whole	\N	0
e1d7752e-449e-4b3b-982b-ace06258212a	6ccdee31-b87d-424d-a6ff-9ba2f7e352fc	coconut shreds	1	cup	\N	0
abb79306-6db2-41cb-922f-9f69cffd16b4	617c87e7-a799-483c-8570-b9ec3d9b0517	½ cup coconut shreds	\N	whole	\N	0
284e23c4-d9c2-439a-af7b-597abe76cbf0	617c87e7-a799-483c-8570-b9ec3d9b0517	1-2 tsp vanilla	\N	whole	\N	0
351091ca-c262-450f-a7b3-80a112fadddf	617c87e7-a799-483c-8570-b9ec3d9b0517	½ cup cashew pieces	\N	whole	\N	0
ac47e13e-dc4c-4b79-94d4-0f24d9987170	617c87e7-a799-483c-8570-b9ec3d9b0517	¼ tsp sea salt	\N	whole	\N	0
0ad90b98-d400-40f3-b132-c124a43a3b13	babe1759-9be6-494f-a487-7253b11b845c	¼ - ½ cup caramel sauce (depending on how much caramel flavor you want)	0.25	whole	\N	0
0e6cf5fd-bfa2-4d7c-b96e-1c3193940041	babe1759-9be6-494f-a487-7253b11b845c	almonds (unsoaked)	1	cup	\N	0
c8f2e9bf-b5ef-4b48-9c48-8724a6b4aabd	434ebd11-a56d-4d36-87c1-eb56c25b13df	dash of salt	\N	whole	\N	0
27cbacfb-40c2-4be4-83c9-404cdaa3a761	434ebd11-a56d-4d36-87c1-eb56c25b13df	pili nuts	0.25	cup	\N	0
c7e31d81-3c98-4ea1-baf8-bc71c0611187	c31fc607-b195-4a8b-bd20-12315457dcb1	Ground Beef	0.5	lb	\N	0
8a2f62f4-35c8-4876-bf17-214de07c9dd4	95fa3787-920c-44bd-8e74-6ab31cc8fb5c	Pitted Dates	8	whole	\N	0
2e50c0b9-6841-4b84-9942-2256e4aa88ca	c31fc607-b195-4a8b-bd20-12315457dcb1	Tomato	2	whole	\N	0
a705e334-c73e-4f4a-88cf-998c4a207d38	95fa3787-920c-44bd-8e74-6ab31cc8fb5c	Almonds	0.25	cup	\N	0
a535175c-b24d-44dc-a0e6-83e061a0bfe4	c31fc607-b195-4a8b-bd20-12315457dcb1	Rosemary	1	sprig	\N	0
afe03d70-b85e-4726-a537-72c21078bf55	95fa3787-920c-44bd-8e74-6ab31cc8fb5c	Blueberries	0.25	cup	\N	0
b6270f5e-2cc1-40ad-8394-1327c532d617	c31fc607-b195-4a8b-bd20-12315457dcb1	Olive oil (High heat)	1	tbsp	\N	0
fa432168-ae8b-45b5-915f-285c2cb76c4c	95fa3787-920c-44bd-8e74-6ab31cc8fb5c	Coconut shreds	0.25	cup	\N	0
52ed0444-ebb9-4a9d-a0a0-88c98bf7e954	c31fc607-b195-4a8b-bd20-12315457dcb1	Himalayan Sea Salt	\N	to taste	\N	0
b127ccf7-663b-4ebe-91b8-36c11c0fe40a	95fa3787-920c-44bd-8e74-6ab31cc8fb5c	Vanilla extract	0.5	tsp	\N	0
73d9a898-1991-4867-a98b-58dbac50a727	95fa3787-920c-44bd-8e74-6ab31cc8fb5c	Himalayan Sea Salt	1	pinch	\N	0
64f88fcd-c423-4102-a03f-f60c5eea9cdd	3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	Organic Cucumber	1	whole	\N	0
98fc9464-18c8-4adf-b7e8-e3ff8f13e2a6	3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	Fresh Mint	10	leaves	\N	1
de685ccf-6a03-4361-9c0a-c22b943f6079	3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	Lime	1	whole	\N	2
59ac9fa1-364e-4d8f-ac32-d718e30cf372	3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	Water	2	cups	\N	3
d804d94e-1bec-4557-a0cc-627298ede181	3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	Honey	1	tbsp	\N	4
3e1bdb6d-5324-47eb-ae27-3aa3d0546c64	6201fab6-7993-4370-943a-21d930204e07	Cube Steaks	4	whole	\N	0
e4b73bf2-0f68-439f-ad1c-21385bcf8e2a	6201fab6-7993-4370-943a-21d930204e07	All-purpose flour	2	cup	\N	1
d0590c16-40e9-42d5-aa39-df1967837fd5	434ebd11-a56d-4d36-87c1-eb56c25b13df	macadamia nuts	0.25	cup	\N	0
b14ac338-933d-4c13-8dfa-6cdbc1f708fa	434ebd11-a56d-4d36-87c1-eb56c25b13df	sacha inchi seeds	0.5	cup	\N	0
c1e36472-a897-4421-80b2-45fa6cbfdc55	e9265d82-6e86-4176-b0e3-5359b3a9763e	dried garbanzo beans (about 1¼ cup)	8	oz	\N	0
440ef42c-6fe3-4a11-b4f5-255b420eddf3	e9265d82-6e86-4176-b0e3-5359b3a9763e	water	6	cup	\N	0
b04a755d-279d-4c91-8a6d-4e588140588c	e9265d82-6e86-4176-b0e3-5359b3a9763e	garlic (optional)	2	clove	\N	0
421f889a-4f30-45a1-bbe2-63af9e6ffe78	e9265d82-6e86-4176-b0e3-5359b3a9763e	⅓ - ½ cup lemon juice	0.3333333333333333	\N	\N	0
0e8c42f0-42f2-4c31-a687-5066dc46b418	e9265d82-6e86-4176-b0e3-5359b3a9763e	tahini paste	0.5	cup	\N	0
885bdc40-4605-4863-9da7-236521e7ad9c	e9265d82-6e86-4176-b0e3-5359b3a9763e	8-10 cloves minced garlic (or more to taste)	\N	\N	\N	0
d7937aa7-58ff-40a4-8426-0a415a78ecd3	e9265d82-6e86-4176-b0e3-5359b3a9763e	reserved chickpea water	0.5	cup	\N	0
8a77def6-92c8-41f9-8393-72f7b3e9d4b2	e9265d82-6e86-4176-b0e3-5359b3a9763e	⅓ - ½ cup olive oil	0.3333333333333333	\N	\N	0
4494c551-4850-4202-9de4-423c2982d185	e9265d82-6e86-4176-b0e3-5359b3a9763e	kosher salt	1.25	tsp	\N	0
6a8966cb-0646-4390-9ff5-7c89f8cae456	e9265d82-6e86-4176-b0e3-5359b3a9763e	cumin powder	1	tsp	\N	0
60e280f9-4f04-4830-9f63-6331a7991da1	8bb904af-393a-4478-857a-90e4ff8e8272	Sticks of Cinnamon ( we suggest ceylon cinnamon)	5	\N	\N	0
c4e0fcd7-a8c5-4f63-88b1-a2cbf609e669	617c87e7-a799-483c-8570-b9ec3d9b0517	chopped, pitted dates or 1-2 tbsp maple syrup	3	whole	\N	0
f8894134-9c79-4517-8a6d-990cb45f2264	434ebd11-a56d-4d36-87c1-eb56c25b13df	scoops chocolate collagen peptides	2	whole	\N	0
6d48b278-ba78-481d-80d0-87baa0803f67	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	chai tea bags	2	whole	\N	0
375535be-abd5-4846-8387-a0e941e85dda	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	boiling water	1	cup	\N	1
d7d49003-36ac-491d-b1f5-f7ad154f933c	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	strong brewed coffee (Rich setting)	0.25	cup	\N	2
f4058523-eb7c-498c-b6fb-fa41b43adf76	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	Almond Milk	0.5	cup	ac395333-a4dd-4c47-8aec-982159004f66	3
56fef4c7-e4a6-4239-80af-c4e26ea0f11d	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	honey or maple syrup	1	tbsp	\N	4
5fd59a7c-a3e3-4564-a20d-81284587d672	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	ground cinnamon	1	pinch	\N	5
2fbc6850-c5a9-438b-95fe-2dc9e1852ad0	6201fab6-7993-4370-943a-21d930204e07	Eggs	2	whole	\N	2
04d38586-e33e-49fe-b88f-80411eb60683	6201fab6-7993-4370-943a-21d930204e07	Butter	4	tbsp	\N	3
7e9cfdea-c3f3-40a9-9af1-e3aadbfb9c9d	f0a11b10-0580-4702-8819-56e459992a8c	medium cheddar cheese (we love thick-sliced)	4	slice	\N	0
e644304e-c36d-4fd3-8e19-c8167c45c44a	f0a11b10-0580-4702-8819-56e459992a8c	iceberg lettuce (shredded)	2	cup	\N	0
d71041b3-2344-41d4-b924-e20c3b514018	f0a11b10-0580-4702-8819-56e459992a8c	Black Pepper (added to taste)	\N	whole	\N	0
d27d0680-35db-4d3d-8206-5949dd9dae74	f0a11b10-0580-4702-8819-56e459992a8c	Salt (added to taste)	\N	whole	\N	0
aef6b15a-497c-431d-b164-2987fd65c233	f0a11b10-0580-4702-8819-56e459992a8c	garlic powder (optional, added to taste)	\N	whole	\N	0
f34aaa1e-9173-4b69-bb24-f60b3b1a70ab	f0a11b10-0580-4702-8819-56e459992a8c	mayonnaise	0.3333333333333333	cup	\N	0
f763c4a4-a2a0-45e8-9087-62e1d4c32e62	f0a11b10-0580-4702-8819-56e459992a8c	ground beef (80/20, divided into 8 portions (3oz each))	1.5	lb	\N	0
5ef167a9-2384-4726-b8e5-96fab0df1f62	f0a11b10-0580-4702-8819-56e459992a8c	yellow mustard	1	tsp	\N	0
11b6aa1b-6eee-4722-9da9-ed06dd15257b	9ec52826-0efc-4c32-a0e3-aedcdfb1223b	lean ground beef	1	lb	\N	0
4192248c-b8d7-41cb-9ab5-04ea58f0d305	9ec52826-0efc-4c32-a0e3-aedcdfb1223b	worcestershire sauce	\N	\N	\N	0
a096b87f-2083-4ef7-b1e4-4fdf9ce9a3de	9ec52826-0efc-4c32-a0e3-aedcdfb1223b	homemade seasoned salt and pepper	\N	\N	\N	0
e755c381-853f-4f2d-937e-8e7305ec5163	9ec52826-0efc-4c32-a0e3-aedcdfb1223b	romaine lettuce (chopped then washed)	3	head	\N	0
c48956f5-5105-49d2-9b08-8897c38f4e4f	9ec52826-0efc-4c32-a0e3-aedcdfb1223b	freshly shredded cheddar cheese	\N	\N	\N	0
984a068d-a57f-49f4-9c02-265357d20935	9ec52826-0efc-4c32-a0e3-aedcdfb1223b	chopped dill pickles	0.5	cup	\N	0
858f0587-e7d4-4e00-a0ca-d301022a3835	9ec52826-0efc-4c32-a0e3-aedcdfb1223b	sesame seeds (optional, for garnish)	\N	\N	\N	0
70db2946-8a6f-40b5-9977-9430070dcd04	9ec52826-0efc-4c32-a0e3-aedcdfb1223b	mayonnaise	1	cup	\N	0
6f220cff-5f10-437e-8e5a-52f33e8e7f00	9ec52826-0efc-4c32-a0e3-aedcdfb1223b	French dressing (could use ketchup)	0.25	cup	\N	0
c6fd0262-4bc2-4bd5-be07-cb7b72bf027b	9ec52826-0efc-4c32-a0e3-aedcdfb1223b	minced pickles	2	tbsp	\N	0
386ac27a-8da3-4ece-9f2d-766e3e9a455f	9ec52826-0efc-4c32-a0e3-aedcdfb1223b	minced white onion (could use red)	2	tbsp	\N	0
763a65c2-5947-4a29-af9f-a3104f18cf50	9ec52826-0efc-4c32-a0e3-aedcdfb1223b	distilled white vinegar	1	tbsp	\N	0
f90fddc1-2cf9-4649-a4bc-49d07df964ef	80d9033b-d275-4687-9219-c9802918bb7e	Tillamook sharp cheddar	6	oz	\N	0
4ecf6eeb-02b9-4770-9cc9-5b567f4ff72b	4ecc4a91-2784-4b84-a664-78eda0134c78	almonds (or milk-making ingredients of choice)	1	cup	\N	0
73abf4a8-d32e-46da-8296-f4b2eac1ef76	4ecc4a91-2784-4b84-a664-78eda0134c78	loose leaf chai tea	1	cup	\N	0
ceaa5b97-4405-472b-a23a-9e443b3f64ef	ce12aaee-0e38-4ebf-8eaf-eb6fcc76362d	heavy cream	2	cup	\N	0
4d19fe46-33d5-4e1e-92a4-56abcebcf1ed	ce12aaee-0e38-4ebf-8eaf-eb6fcc76362d	chopped bacon or bacon bits and grated parmesan cheese for topping (optional)	\N	whole	\N	0
778c54e2-027d-4039-8b9a-4331c4bd0389	ac395333-a4dd-4c47-8aec-982159004f66	sea salt	0.25	tsp	\N	0
41c49940-2992-4bdb-8a9b-589cf5c3ba15	ac395333-a4dd-4c47-8aec-982159004f66	unsoaked almonds (if using soaked almonds, you only need to use about ½ cup soaked in water for at least 4 hours or overnight)	1	cup	\N	0
1e0d4e41-fd26-43c1-9098-be20924325ab	ac395333-a4dd-4c47-8aec-982159004f66	chopped, pitted dates or 1-2 tbsp maple syrup (optional)	3	whole	\N	0
cd21cc56-21d0-4172-8f7c-9acd3ef4e571	ac395333-a4dd-4c47-8aec-982159004f66	vanilla (optional)	1	tsp	\N	0
d84ca39e-fd6c-46bf-adbd-7e4dfdd41ade	ce12aaee-0e38-4ebf-8eaf-eb6fcc76362d	salt (or to taste)	3	tsp	\N	0
e7c1f856-a61d-4d55-aeef-252b144a5566	ce12aaee-0e38-4ebf-8eaf-eb6fcc76362d	½  white onion (diced)	0.5	whole	\N	0
3f086390-3d3b-4d38-9c82-478fd2df3501	ce12aaee-0e38-4ebf-8eaf-eb6fcc76362d	water	2	cup	\N	0
448a79d0-cfc6-4dee-ac6b-98342482b095	ce12aaee-0e38-4ebf-8eaf-eb6fcc76362d	minced garlic	1	tbsp	\N	0
a8cad054-dc9b-4efe-8197-997c63460a3a	ce12aaee-0e38-4ebf-8eaf-eb6fcc76362d	chicken broth	6	cup	\N	0
20b7eb5b-f0da-47d6-adbd-9ad730130a61	ce12aaee-0e38-4ebf-8eaf-eb6fcc76362d	butter	4	tbsp	\N	0
375d6b04-b946-4a42-b9f3-4df1253663de	ce12aaee-0e38-4ebf-8eaf-eb6fcc76362d	spicy Italian ground sausage (use mild for kid-friendly)	1	lb	\N	0
0a52b562-e0d6-44a7-bcf8-ac2c5788222d	ce12aaee-0e38-4ebf-8eaf-eb6fcc76362d	4-5  yellow potatoes (cut into 1-inch pieces)	\N	whole	\N	0
f682de86-bf91-4901-b99d-a14e2538d31c	ce12aaee-0e38-4ebf-8eaf-eb6fcc76362d	black pepper	1	tsp	\N	0
33707f63-aebf-4231-b9d7-15ea0f501a4f	ce12aaee-0e38-4ebf-8eaf-eb6fcc76362d	chopped kale	4	cup	\N	0
c25c4afd-8935-4d94-8fbe-a00c99ef6405	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	Flax seed	2	tsp	\N	0
bf27a50d-ee73-4fe8-87d7-f0f541fe90ff	eaca8ab1-aab9-4819-a2fb-fce3adcbf543	pitted cherries	1	cup	\N	0
691d3e12-1a29-4298-bbc5-1d68bc92508e	eaca8ab1-aab9-4819-a2fb-fce3adcbf543	Water, to MIN line	\N	whole	\N	0
da0688e4-eae4-4b11-9e57-ab0a0f1d3d88	eaca8ab1-aab9-4819-a2fb-fce3adcbf543	almonds	1	cup	\N	0
6baf1c6b-2870-4fcc-88ad-e73a93ed2ac3	eaca8ab1-aab9-4819-a2fb-fce3adcbf543	2-4 Tbsp maple syrup	\N	whole	\N	0
51a377cd-a4d6-4dc0-81b2-6743bc89d833	eaca8ab1-aab9-4819-a2fb-fce3adcbf543	cocoa powder	2	tbsp	\N	0
60c3d31a-c110-44ab-8bf7-e1edfd32190c	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	Plain yogurt (or greek yogurt)	0.3333333333333333	cup	\N	0
89905bc1-fcd1-489a-8aa3-841472573638	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	Frozen blueberries	2	cup	\N	0
cd7f19c4-e9ed-4e70-a455-f5bf7b84112c	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	Banana	1	whole	\N	0
5b8578da-26b6-468b-92ee-e8c4a645e341	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	Almond Milk	1.5	cup	ac395333-a4dd-4c47-8aec-982159004f66	0
d84f800c-adb2-4540-9108-4b95f123ba29	b47b4db5-216c-4f3e-bee9-25ff6cef0a51	Butter	2	tbsp	\N	0
dc54bf25-a4b5-4692-8a5b-5af13dbc7ff3	b47b4db5-216c-4f3e-bee9-25ff6cef0a51	garlic, minced	4	clove	\N	0
90b42e2a-08f6-4a8e-b32b-7cf06ab68302	de930450-0ec5-49e8-bfb2-e9b25e32927d	Cube Steaks	4	whole	\N	0
a0d53208-22f0-4d9a-af52-55743b2cccec	1672e7ba-e625-42fc-ba7f-0af9b9014621	almonds	1	cup	\N	0
b9c265a0-328d-4f10-af68-93b2f3fce764	1672e7ba-e625-42fc-ba7f-0af9b9014621	chocolate chip cookies	1	cup	\N	0
f2925516-d11b-4be2-bfc9-17d376cd46a0	1672e7ba-e625-42fc-ba7f-0af9b9014621	maple syrup, optional	2	tbsp	\N	0
5fe7dac3-f287-4347-9e5d-0deecdd8327f	de930450-0ec5-49e8-bfb2-e9b25e32927d	Sweet Onion	1	whole	\N	1
e194fb20-dba6-41ce-8529-6bc6d0fb1315	de930450-0ec5-49e8-bfb2-e9b25e32927d	White Onion	1	whole	\N	2
ad69fb04-1ccb-4846-84aa-8ba6274d69a2	de930450-0ec5-49e8-bfb2-e9b25e32927d	All-purpose flour	0.5	cup	\N	3
498f5d2d-3422-4959-b613-ec75af2261f4	de930450-0ec5-49e8-bfb2-e9b25e32927d	Butter	3	tbsp	\N	4
2dc44662-991a-4e4f-8564-5f368a473127	de930450-0ec5-49e8-bfb2-e9b25e32927d	Garlic Cloves	2	cloves	\N	5
7a6d3491-83b5-40cc-9c0c-522d0f525e86	adba5b7a-2289-49d1-9877-b591b0ae5728	fresh thyme (chopped, or 3 teaspoons dried thyme)	2	tbsp	\N	0
97d7f5fe-7d49-45d5-a23e-11786ae56514	adba5b7a-2289-49d1-9877-b591b0ae5728	oil	1	tbsp	\N	0
32edc1bd-28ed-4f34-906c-22ae6a073f86	adba5b7a-2289-49d1-9877-b591b0ae5728	bacon (roughly chopped)	6	slice	\N	0
b6763515-fd85-468b-99a0-4c077e12db0d	adba5b7a-2289-49d1-9877-b591b0ae5728	beef broth	2	cup	\N	0
83eccef8-df10-4098-bcf9-ea308e77dae7	adba5b7a-2289-49d1-9877-b591b0ae5728	chopped parsley for garnish	\N	whole	\N	0
fbff845a-fa75-4259-aab9-c69380fe5dab	adba5b7a-2289-49d1-9877-b591b0ae5728	red cooking wine (may sub chicken broth)	1	cup	\N	0
838c3644-b78d-426c-85b8-96c393b741af	adba5b7a-2289-49d1-9877-b591b0ae5728	minced garlic	1	tbsp	\N	0
f92f75f4-99e7-4ace-bf7d-2fb91b4d36ba	adba5b7a-2289-49d1-9877-b591b0ae5728	fresh mushrooms (sliced)	8	oz	\N	0
316aa702-bf69-4875-9e0d-d85628067b8e	adba5b7a-2289-49d1-9877-b591b0ae5728	flour	0.25	cup	\N	0
afc6abcf-47d2-4acc-90cf-e6256331c2c6	adba5b7a-2289-49d1-9877-b591b0ae5728	chuck beef (cut into 2-inch pieces)	3	lb	\N	0
6aa64ca0-e16c-4d13-84ba-77e565cb16c6	adba5b7a-2289-49d1-9877-b591b0ae5728	pepper	0.5	tsp	\N	0
7ead0eec-61f4-492d-9ab8-845679613c0a	adba5b7a-2289-49d1-9877-b591b0ae5728	1-2 teaspoons salt (or to taste)	\N	whole	\N	0
8a81326b-d309-4696-a65c-c6cd7f6579f7	adba5b7a-2289-49d1-9877-b591b0ae5728	baby potatoes	1	lb	\N	0
fd3ce047-3da2-4917-86cf-c49c9ba8b791	adba5b7a-2289-49d1-9877-b591b0ae5728	tomato sauce	0.5	cup	\N	0
c4d0f247-e2d9-4f3c-8752-eacae0eebfd2	f0a11b10-0580-4702-8819-56e459992a8c	large tomato (sliced)	1	whole	\N	0
449a7401-3403-46a0-97c2-a60720721a64	d7070d9c-6cd3-4f52-8306-6cdc24b29512	salted butter (melted )	3	tbsp	\N	0
e024b9a9-24b4-4f8f-8d5a-dda82dd6b758	d7070d9c-6cd3-4f52-8306-6cdc24b29512	powdered sugar	2	cup	\N	0
00cd70e2-250b-42b4-848a-c073d888703d	d7070d9c-6cd3-4f52-8306-6cdc24b29512	vanilla extract	0.75	tsp	\N	0
33a64d0f-02fd-4e20-9219-ad174abaa89f	d7070d9c-6cd3-4f52-8306-6cdc24b29512	1-3 Tablespoons heavy cream ((preferred) or milk (any kind))	\N	whole	\N	0
36384714-ed23-4426-9a85-87417555aa9f	b47b4db5-216c-4f3e-bee9-25ff6cef0a51	chicken broth (To make a vegetarian dish, use vegetable broth.)	1.75	cup	\N	0
2a6d8ec7-e49a-4f54-b26b-899847cee440	b47b4db5-216c-4f3e-bee9-25ff6cef0a51	dry white rice	1	cup	\N	0
973a703f-419e-4923-9d37-787a3cdc1c0c	b47b4db5-216c-4f3e-bee9-25ff6cef0a51	Parmesan cheese	1	cup	\N	0
4b4bdbbb-d3b9-4b1e-9ca8-bad410670e20	b47b4db5-216c-4f3e-bee9-25ff6cef0a51	lemon zest	1	tbsp	\N	0
47853173-fdfd-41f2-95c9-20a2d4318f48	b47b4db5-216c-4f3e-bee9-25ff6cef0a51	peas	1	cup	\N	0
5b82e226-b08b-4cff-9833-14ec708015a5	b47b4db5-216c-4f3e-bee9-25ff6cef0a51	asparagus, chopped	1	cup	\N	0
615c6edf-4c5b-4ce8-8db9-98ca13c06284	b47b4db5-216c-4f3e-bee9-25ff6cef0a51	Parsley/microgreens, for garnish	\N	\N	\N	0
e3b9dc3b-b4c6-4ab8-a77c-b3ff79854544	f0a11b10-0580-4702-8819-56e459992a8c	burger buns (we used brioche buns)	4	whole	\N	0
a43e5b3a-297a-4cfc-97b2-76fe0da73f62	f0a11b10-0580-4702-8819-56e459992a8c	Dill Pickles (cut into 12 slices)	2	whole	\N	0
77e59a3d-3495-412d-8400-ba1544841913	f0a11b10-0580-4702-8819-56e459992a8c	red onion (sliced into thin rings)	0.5	whole	\N	0
21e78279-5ca3-4313-8f48-ae3581982918	9ec52826-0efc-4c32-a0e3-aedcdfb1223b	red onion (thinly sliced)	1	\N	\N	0
960d1506-e348-43b9-837f-d81724479f90	9ec52826-0efc-4c32-a0e3-aedcdfb1223b	Roma tomatoes (chopped, could use cherry, grape, or vine-ripened tomatoes)	3	\N	\N	0
931f95da-6c95-40c7-8ab6-904b88ea1585	b47b4db5-216c-4f3e-bee9-25ff6cef0a51	shallots, chopped	5	\N	\N	0
ad3bf2f3-3d04-4d40-beec-e690f6ddf5e9	adba5b7a-2289-49d1-9877-b591b0ae5728	white onion (chopped)	1	whole	\N	0
faeb4488-1924-4d88-b3e9-0ef115940fca	adba5b7a-2289-49d1-9877-b591b0ae5728	large carrots (cut into 2-inch pieces)	2	whole	\N	0
c085c2de-39ad-4a9a-af6a-a9a3bb0420a4	adba5b7a-2289-49d1-9877-b591b0ae5728	beef boullion cube (crushed)	1	whole	\N	0
1967896c-f77a-439f-b316-a18d77305b64	2d57c883-cc8f-4f28-88dc-953483e5b51b	Broccoli	1	cups	\N	0
c31c0421-461d-4dec-81aa-c58b6e184043	2d57c883-cc8f-4f28-88dc-953483e5b51b	Breast Milk	3	tbsp	\N	1
c4ac562d-5025-490a-865c-32249d3756d8	2d57c883-cc8f-4f28-88dc-953483e5b51b	Water	0.25	cups	\N	2
4b34a1e8-97dc-4c68-bd07-b5dbcfb7c9ca	4fcfff0f-56aa-4bf6-a84b-8d701f796671	Asparagus	8	spears	\N	0
eb239540-549b-4d98-87ba-87cf4e261a23	4fcfff0f-56aa-4bf6-a84b-8d701f796671	Breast Milk	3	tbsp	\N	1
c200ff99-1af0-43a1-a357-e7ceacd31c05	4fcfff0f-56aa-4bf6-a84b-8d701f796671	Water	0.25	cups	\N	2
8cb074ec-1542-4b63-86bd-2396d8999aeb	80d9033b-d275-4687-9219-c9802918bb7e	Rogue Creamery Smokey Blue cheese	4	oz	\N	1
5a9cd195-fe1f-4ef2-bfb4-5a4fef8c754c	80d9033b-d275-4687-9219-c9802918bb7e	brie round	1	whole	\N	2
7a338c11-eca7-412f-9d90-12286f28f27c	80d9033b-d275-4687-9219-c9802918bb7e	soppressata	4	oz	\N	3
683e3f32-45c9-44c2-b773-9f437317a678	80d9033b-d275-4687-9219-c9802918bb7e	prosciutto	3	oz	\N	4
9038902a-2ade-47e5-8521-32d522a2576e	80d9033b-d275-4687-9219-c9802918bb7e	dry salami	3	oz	\N	5
83822f07-bd35-4c15-b75c-57ba806c7c7c	80d9033b-d275-4687-9219-c9802918bb7e	Oregon hazelnuts (roasted)	0.5	cup	\N	6
37f87fe3-52a7-454d-a2d7-1dd00e4fc485	80d9033b-d275-4687-9219-c9802918bb7e	dried cranberries	0.33	cup	\N	7
8aecc895-dc77-43b1-a8db-024d32154835	80d9033b-d275-4687-9219-c9802918bb7e	Marionberry jam	3	tbsp	\N	8
789606cd-c1be-457d-91e8-bff5ee5826e3	80d9033b-d275-4687-9219-c9802918bb7e	whole grain mustard	2	tbsp	\N	9
a76275f7-4758-47d5-97ac-ba92ae646878	80d9033b-d275-4687-9219-c9802918bb7e	local honey	2	tbsp	\N	10
056627cc-d64d-4275-a17c-472b33bdf759	80d9033b-d275-4687-9219-c9802918bb7e	Bosc pear, sliced	1	whole	\N	11
438779c2-980f-448f-8ef8-bccfb3c44108	80d9033b-d275-4687-9219-c9802918bb7e	cornichons	0.25	cup	\N	12
77a5e031-2731-4fbd-bd7c-e67bdda0824c	80d9033b-d275-4687-9219-c9802918bb7e	crackers and baguette slices	1	cup	\N	13
8a99d532-ee2c-4d0b-b1cf-d0177db2a58c	80d9033b-d275-4687-9219-c9802918bb7e	fresh rosemary sprigs	3	whole	\N	14
74e89700-cc94-4f73-b550-4c083e25ad75	44ebf2b4-a456-4d37-8e3d-d88982c66714	beef brisket	4	lb	\N	0
e76aa19f-2f63-418c-82b1-8eca4cd31f2d	44ebf2b4-a456-4d37-8e3d-d88982c66714	dried Korean gochugaru (red chile flakes)	1	tbsp	\N	1
046861ef-00a9-4ad6-8139-ad987c162871	9f91647a-c339-4cab-b351-58ed2283adac	Ground Beef	1	lb	\N	0
c845118d-6bee-45d6-80eb-060ee9051892	9f91647a-c339-4cab-b351-58ed2283adac	Salted Butter	2	tbsp	\N	0
7e658b70-692b-43dd-806f-266faee2211a	9f91647a-c339-4cab-b351-58ed2283adac	Giardiniera pickled vegetables	1	ml	\N	0
d60dab2f-eec1-4635-a551-b42fddaaa2e5	9f91647a-c339-4cab-b351-58ed2283adac	Himalayan Sea Salt	1	tsp	\N	0
cb940ca7-f19d-440e-8ebc-2e1a93e1d640	9f91647a-c339-4cab-b351-58ed2283adac	Olive oil (High heat)	1	tbsp	\N	0
a9d25862-0008-4f3e-9b53-068ae29d82b2	9f91647a-c339-4cab-b351-58ed2283adac	Monterey jack cheese with jalapeno peppers, pepper jack	4	slices	\N	0
381826b8-d0a2-4185-823f-1e791581598c	9f91647a-c339-4cab-b351-58ed2283adac	Brioche Buns	4	whole	\N	0
3e197e7e-3b79-44e8-9a4e-d45b6c19a266	9f91647a-c339-4cab-b351-58ed2283adac	Japanese Barbecue Sauce	1	oz	\N	0
d8cef689-55e8-4063-b216-c2ad30d6eeea	44ebf2b4-a456-4d37-8e3d-d88982c66714	sweet paprika	1	tbsp	\N	2
1d8ea657-d275-4ed8-b555-ad1136eeeb32	44ebf2b4-a456-4d37-8e3d-d88982c66714	kosher salt	2.5	tsp	\N	3
24ab8934-944c-4667-9275-49548caa91bd	adabc033-1481-4af1-91d5-fe59df7da495	orange zest	2	tsp	\N	0
d2fc7e58-e038-4372-bf82-0c4c0b3fafc9	adabc033-1481-4af1-91d5-fe59df7da495	vegetable broth	1	cup	\N	1
627d6a46-037d-4e81-8969-0a52e1dedf54	adabc033-1481-4af1-91d5-fe59df7da495	fresh ginger, minced	2	tsp	\N	2
0f76c279-a7f9-4c7a-9dce-e5c8f81483ca	adabc033-1481-4af1-91d5-fe59df7da495	salt	1	tsp	\N	3
18ffe935-c3dc-40cd-9ebb-a5a5e3978eb3	adabc033-1481-4af1-91d5-fe59df7da495	pepper	0.25	tsp	\N	4
3257c586-5f2c-4194-aa7a-1e318ae20b39	adabc033-1481-4af1-91d5-fe59df7da495	carrots, peeled and chopped (about 8-10 carrots)	2	lb	\N	5
3505b04c-303c-4781-a58a-64f1af30dfea	adabc033-1481-4af1-91d5-fe59df7da495	Chopped chives, for garnish	\N	whole	\N	6
a8d23680-24a6-4c29-a5b2-582ffe9e7f41	adabc033-1481-4af1-91d5-fe59df7da495	(400mL) can full-fat coconut milk	1	whole	\N	8
09927243-937f-4b47-9abf-cb97c2ef292c	adabc033-1481-4af1-91d5-fe59df7da495	olive or coconut oil	1	tbsp	\N	9
c840e203-6197-492d-89af-f7d36d4645e1	adabc033-1481-4af1-91d5-fe59df7da495	garlic, minced	4	clove	\N	10
e5903d71-6990-42d5-a85d-c2b232538b67	adabc033-1481-4af1-91d5-fe59df7da495	yellow onions, chopped	3	whole	\N	7
71881225-c51b-4631-8a6d-c7e4bd2e138f	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	olive oil	0.25	cup	\N	0
6a13b52d-aa07-489c-91ea-ef6d5d974ced	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	salt	2	tsp	\N	1
573ccb0e-d847-4e39-abc8-c6f16baa1254	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	pepper	0.25	tsp	\N	2
ce7d278b-5af0-4214-a524-9282eb1a2654	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	garlic powder	1	tsp	\N	3
09177bd5-051c-4051-a682-80ad95ce3143	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	onion powder	1	tsp	\N	4
b9a95cf7-a5a5-46f5-9f86-6e0a7aadd911	384ec3bb-7128-40f0-98d1-719f7c15d544	Red Chili Flakes  (optional)	\N	whole	\N	0
c70f0925-e524-4398-ba6f-e5540291869a	384ec3bb-7128-40f0-98d1-719f7c15d544	Vegetable Broth ((only for instant pot method))	2	cup	\N	0
adbb315c-d769-4e75-9245-6249cb871fc8	384ec3bb-7128-40f0-98d1-719f7c15d544	Asparagus (fresh and cut into 2 inch pieces, bottom white part discarded*)	8	oz	\N	0
b359813b-4ed0-460b-a95b-48e7b895a197	384ec3bb-7128-40f0-98d1-719f7c15d544	Parmesan cheese (grated )	\N	whole	\N	0
10e8f55a-6033-47f1-92c7-8d4489671754	384ec3bb-7128-40f0-98d1-719f7c15d544	Green peas  (frozen, I used petite green peas )	0.5	cup	\N	0
fbc5a76d-24aa-4e80-816a-02c551b994e3	384ec3bb-7128-40f0-98d1-719f7c15d544	Lemon juice	1	tbsp	\N	0
77e75e07-4e05-4cb6-bf1d-357397c2b87a	384ec3bb-7128-40f0-98d1-719f7c15d544	Olive Oil	2	tbsp	\N	0
e214790a-db65-4eb8-86b8-d2bcab980c7c	384ec3bb-7128-40f0-98d1-719f7c15d544	Onion (diced)	0.6666666666666666	cup	\N	0
dff3f7a8-495f-4e11-a5d7-38d9c043be3e	384ec3bb-7128-40f0-98d1-719f7c15d544	Dried Thyme	0.25	tsp	\N	0
1a9996cd-fee7-4864-a4f4-175e2f0ce9b2	384ec3bb-7128-40f0-98d1-719f7c15d544	Dried Basil	0.5	tsp	\N	0
c54cce37-71c1-4cc8-9929-84a9f1544a97	384ec3bb-7128-40f0-98d1-719f7c15d544	Parmesan cheese (pecorino Romano works well too)	0.5	cup	\N	0
6e87f727-a794-4c05-89bc-12b928b0abbf	384ec3bb-7128-40f0-98d1-719f7c15d544	Salt and pepper  (to taste)	\N	whole	\N	0
1c10a9ba-71e8-4a8e-8acd-5e28da9b515e	384ec3bb-7128-40f0-98d1-719f7c15d544	Cream (I used heavy whipping cream)	0.5	cup	\N	0
bd7c720b-beae-422d-94fc-46f42545442e	384ec3bb-7128-40f0-98d1-719f7c15d544	Penne	8	oz	\N	0
ee66af54-4a23-4688-b1b1-548b9b705be4	384ec3bb-7128-40f0-98d1-719f7c15d544	Garlic (finely diced)	4	clove	\N	0
370e3409-7264-42f2-93bd-68af081a9b4b	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	oregano	1	tsp	\N	5
25d2947b-ad37-4d95-ab1b-fb1ab3c46062	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	lemon, zested and juiced	1	whole	\N	6
c2d25f6e-498c-41a6-a5a3-00aac9360b29	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	baby potatoes, halved	1	lb	\N	7
c919a3f0-8010-4364-91b5-4dfa37fa6d6f	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	red onion, cut into 1 inch pieces	1	whole	\N	8
e235f8a5-c4d0-49de-9388-4db0e726969b	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	red bell pepper, cut into 1 inch pieces	1	whole	\N	9
2fd346c4-0e66-4c5b-8be7-ad0cf5341ebf	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	broccoli florets	2	cup	\N	10
b4f6c75c-449d-4dc1-863c-9a3bb672a4a3	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	garlic, minced	4	clove	\N	11
25254f72-ca43-44a8-ab4d-2082bd81193c	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	boneless, skinless chicken breasts, cut into 1 inch pieces	2	whole	\N	12
54a15cbb-e3d2-4afc-965d-014b867d4218	a39da54e-23b7-4b37-8405-ddd001072728	Almond Milk	1.5	cup	\N	0
12cf2137-b346-40ac-ac4e-4c75f794bef4	a39da54e-23b7-4b37-8405-ddd001072728	Plain yogurt (or greek yogurt)	0.33	cup	\N	1
58b40fd1-25a3-4d97-96f9-8626196f9e0e	a39da54e-23b7-4b37-8405-ddd001072728	Mango chunks (frozen)	2	cup	\N	2
93531221-6b1c-47ac-a83e-b8f5fd2de18c	a39da54e-23b7-4b37-8405-ddd001072728	Flax seed	2	tsp	\N	3
b9ca1bdd-d408-4e9d-ba0f-7a8640dbe12d	a39da54e-23b7-4b37-8405-ddd001072728	Banana	1	whole	\N	4
03f5b491-ce34-4058-ba1f-85ee3e9fbe43	ba77d39d-3f2d-4b07-9ba5-2bd57598ff0a	Almond Milk	1.5	cup	ac395333-a4dd-4c47-8aec-982159004f66	0
35f2ed37-e6d2-460f-9ade-5ca3dc81769c	ba77d39d-3f2d-4b07-9ba5-2bd57598ff0a	Plain yogurt (or greek yogurt)	0.33	cup	\N	1
593979dd-0eae-47ca-a0e5-ed6f4434342a	ba77d39d-3f2d-4b07-9ba5-2bd57598ff0a	Frozen raspberries	2	cup	\N	2
abfa8465-117c-482d-b0af-4ba84dc04ae5	ba77d39d-3f2d-4b07-9ba5-2bd57598ff0a	Flax seed	2	tsp	\N	3
b7dd6399-cc54-4884-8b92-4b0f05c45a7a	ba77d39d-3f2d-4b07-9ba5-2bd57598ff0a	Banana	1	whole	\N	4
10f0d97b-99a4-4b8e-b4d6-dfa11b00bc43	402c389f-38c3-4ba0-99b2-36d42cdc9992	beef brisket (first or second cut)	6	lb	\N	0
3786b55d-a1d4-4709-815b-b3804fc9427b	402c389f-38c3-4ba0-99b2-36d42cdc9992	extra virgin olive oil	0.25	cup	\N	1
43a98f7f-acb3-42cb-829c-ae54520f1ee0	402c389f-38c3-4ba0-99b2-36d42cdc9992	large brown onions, sliced	2	whole	\N	2
60905cc3-8d4d-4002-ad18-2008ce9bcbb3	402c389f-38c3-4ba0-99b2-36d42cdc9992	carrots, peeled and sliced	1	lb	\N	3
f70d69b4-0d04-42af-82b2-a21a12dfd3fc	402c389f-38c3-4ba0-99b2-36d42cdc9992	celery, sliced	1	lb	\N	4
c4d26474-c2dc-4c60-b9f9-468280d0a96c	402c389f-38c3-4ba0-99b2-36d42cdc9992	canned tomatoes (whole or crushed)	28	oz	\N	5
288176d2-3878-4d05-ad48-450b9533c042	402c389f-38c3-4ba0-99b2-36d42cdc9992	whole garlic cloves, peeled	10	clove	\N	6
ec11d974-ee09-4189-ac04-6fd270eb1a58	402c389f-38c3-4ba0-99b2-36d42cdc9992	brown sugar	0.5	cup	\N	7
57cedbae-5337-4f05-b001-eba9e41f27de	402c389f-38c3-4ba0-99b2-36d42cdc9992	apple cider vinegar	0.25	cup	\N	8
358d897b-7503-4d49-a865-ff6c62f3c6fa	402c389f-38c3-4ba0-99b2-36d42cdc9992	beef or chicken broth	2	cup	\N	9
73326d57-e1a1-47ed-ae10-e1b22d3f0359	402c389f-38c3-4ba0-99b2-36d42cdc9992	salt and pepper	1	tsp	\N	10
80e45cd3-cf79-4467-a565-5942e9990731	44ebf2b4-a456-4d37-8e3d-d88982c66714	black pepper	0.5	tsp	\N	4
b84b2572-ab51-4e00-af5a-ba10d29a61ec	44ebf2b4-a456-4d37-8e3d-d88982c66714	oil for searing	2	tbsp	\N	5
da989350-c635-4b54-9112-983166d8a3d1	44ebf2b4-a456-4d37-8e3d-d88982c66714	large onion, chopped	1	whole	\N	6
65b299d3-e633-47d2-a67e-5ee8503b780b	44ebf2b4-a456-4d37-8e3d-d88982c66714	garlic, minced	4	clove	\N	7
e4f60585-ba16-444e-bc9f-c70f412a6a99	44ebf2b4-a456-4d37-8e3d-d88982c66714	fresh ginger, grated	1	tbsp	\N	8
5b41717b-49da-42a7-bc67-038ee18423c4	44ebf2b4-a456-4d37-8e3d-d88982c66714	lager beer or ginger beer	1	cup	\N	9
7ed444af-66ca-426a-aff6-3f56ef1468c8	44ebf2b4-a456-4d37-8e3d-d88982c66714	gochujang (Korean chile paste)	0.25	cup	\N	10
c3547fcb-a58f-4dd3-90bb-eec08266e3dd	44ebf2b4-a456-4d37-8e3d-d88982c66714	ketchup	2	tbsp	\N	11
743335f5-18e1-436f-81d7-7e7f1ee627ee	44ebf2b4-a456-4d37-8e3d-d88982c66714	soy sauce	2	tbsp	\N	12
c043343f-7724-428b-a3ae-1cd2337f4dad	44ebf2b4-a456-4d37-8e3d-d88982c66714	brown sugar	2	tbsp	\N	13
0e253521-4929-4802-ba09-29ad22531209	44ebf2b4-a456-4d37-8e3d-d88982c66714	Asian fish sauce	2	tsp	\N	14
a1c27279-2673-4f97-94aa-3dc5e5010430	44ebf2b4-a456-4d37-8e3d-d88982c66714	toasted sesame oil	1	tsp	\N	15
d72d8633-d587-417d-bc1c-c44b79c71623	44ebf2b4-a456-4d37-8e3d-d88982c66714	shredded cabbage	5	cup	\N	16
97f6b1e9-6042-488b-a95e-1250b03d137a	44ebf2b4-a456-4d37-8e3d-d88982c66714	chopped kimchi	0.25	cup	\N	17
1e62dca5-c697-414e-ad6c-abbeaebe8bb8	44ebf2b4-a456-4d37-8e3d-d88982c66714	lime juice	0.5	whole	\N	18
b0425338-6dd8-4613-8892-a8b908442035	e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	Caputo 00 flour	1.5	cup	\N	0
eec5d647-655e-43c1-9908-2834c7ae3476	e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	cottage cheese	1	cup	\N	1
6ef0fe2f-6773-4057-82f8-b914ed8b9d61	e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	sour cream	0.25	cup	\N	2
7b210dd9-3e28-4bd9-a138-061cf3793b74	e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	eggs	2	whole	\N	3
a73a6aec-ff81-4476-861a-66ac46325b73	e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	whole milk	0.5	cup	\N	4
78f4bfcd-8c13-4952-9c34-6c2fb7a6402f	e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	melted butter	2	tbsp	\N	5
607ceec0-019a-400b-83fd-04c50c24df9a	e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	granulated sugar	2	tbsp	\N	6
6e209813-2bfa-4103-8bf9-99b3c73071ce	e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	baking powder	1.5	tsp	\N	7
c6345f8b-72cc-45e7-9213-3fed30cd3e8c	e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	baking soda	0.5	tsp	\N	8
3113d1a6-e124-4995-9935-b432ece91845	e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	vanilla extract	1	tsp	\N	9
4deaac0b-75cb-45ec-95b3-228fa9b2f214	e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	salt	0.25	tsp	\N	10
532a9093-e14e-4583-a0d5-aa95de467a89	bfc958ed-a479-4e70-a06a-632859a67ba2	boneless skinless chicken breasts	2	lb	\N	0
857c64c8-2dd6-4e8c-bf73-8511fa603f1d	bfc958ed-a479-4e70-a06a-632859a67ba2	all-purpose flour (for dredging)	0.5	cup	\N	1
8ae7b2e5-b402-4d46-b074-5611058e10f2	bfc958ed-a479-4e70-a06a-632859a67ba2	cremini mushrooms, sliced	8	oz	\N	2
591c1776-e61b-4179-8257-79a8473f94ef	bfc958ed-a479-4e70-a06a-632859a67ba2	dry marsala wine	0.75	cup	\N	3
544d4d7d-9982-44d2-86cd-ffea07b726d4	bfc958ed-a479-4e70-a06a-632859a67ba2	chicken broth	0.5	cup	\N	4
15de1c9a-56d7-4efb-8f9e-0f2b8b1c7f41	bfc958ed-a479-4e70-a06a-632859a67ba2	butter	4	tbsp	\N	5
32a917e1-58ac-454e-b862-4e8e2d4ac7d3	bfc958ed-a479-4e70-a06a-632859a67ba2	olive oil	2	tbsp	\N	6
9bcff7a9-bef0-421b-9a64-01740fe7b248	bfc958ed-a479-4e70-a06a-632859a67ba2	shallot, minced	1	whole	\N	7
abbe3834-564a-4cac-8855-e71f49478a6b	bfc958ed-a479-4e70-a06a-632859a67ba2	garlic, minced	3	clove	\N	8
148214fe-1d79-4a6a-8dad-1122068bdefd	bfc958ed-a479-4e70-a06a-632859a67ba2	capers	1	tbsp	\N	9
8f975275-7d82-4afe-a339-04af2db1a2b9	bfc958ed-a479-4e70-a06a-632859a67ba2	lemon juice	1	tbsp	\N	10
7804020a-1ab4-4db7-bf01-f89a89cc4873	bfc958ed-a479-4e70-a06a-632859a67ba2	fresh parsley, chopped	2	tbsp	\N	11
18dbe0d3-ac4b-44a0-a2d7-8206bc40876b	bfc958ed-a479-4e70-a06a-632859a67ba2	salt and pepper	1	tsp	\N	12
8cfd44e5-5f47-4788-8795-85f8af7df23f	f2a439cc-0eb1-4989-a3be-93bbaf1c58c8	boneless skinless chicken thighs	1.5	lb	\N	0
6cd2b462-9cf0-4c12-9a21-46c0a7e8e408	f2a439cc-0eb1-4989-a3be-93bbaf1c58c8	bell peppers (mixed colors), sliced	3	whole	\N	1
c4b1f2f9-c32e-48fc-a5f2-2ef0327aa8cc	f2a439cc-0eb1-4989-a3be-93bbaf1c58c8	large yellow onion, sliced	1	whole	\N	2
2a26552b-a0b7-4073-a4d7-0b20af9dc6d7	f2a439cc-0eb1-4989-a3be-93bbaf1c58c8	chili powder	1	tbsp	\N	3
6b796521-b2a3-430f-a2eb-29817871fcfa	f2a439cc-0eb1-4989-a3be-93bbaf1c58c8	ground cumin	1	tsp	\N	4
7f700a9e-180f-4cf3-b304-10cca2b1df94	f2a439cc-0eb1-4989-a3be-93bbaf1c58c8	smoked paprika	1	tsp	\N	5
a657fcc9-f154-43ff-ba6b-5cc90fb794d3	f2a439cc-0eb1-4989-a3be-93bbaf1c58c8	garlic powder	0.5	tsp	\N	6
6f3b9717-9fbe-4f71-ac47-7a92304de2a8	f2a439cc-0eb1-4989-a3be-93bbaf1c58c8	salt	1	tsp	\N	7
3043cbf4-6ac4-4721-8a25-b95f36b038a6	f2a439cc-0eb1-4989-a3be-93bbaf1c58c8	olive oil	3	tbsp	\N	8
6bb21c7d-6926-46b6-94da-64e42e60ca4e	f2a439cc-0eb1-4989-a3be-93bbaf1c58c8	lime	2	whole	\N	9
53809025-11e3-4205-bff0-c6f0cbe45469	f2a439cc-0eb1-4989-a3be-93bbaf1c58c8	flour tortillas	8	whole	\N	10
c4c0aef4-9f36-4219-995e-62333ffed1ee	f2a439cc-0eb1-4989-a3be-93bbaf1c58c8	sour cream	0.5	cup	\N	11
89a7a9e1-54b2-4d97-b14b-aabfbcf51d2f	78a9862e-f35e-41aa-bc48-a70db4ef3286	boneless skinless chicken breasts	2	lb	\N	0
076ac958-80d6-4a58-8a2c-eefd01703985	78a9862e-f35e-41aa-bc48-a70db4ef3286	all-purpose flour (for dredging)	0.5	cup	\N	1
5c066617-75e4-4870-b7f1-90fa5aac9ae7	78a9862e-f35e-41aa-bc48-a70db4ef3286	dry white wine	0.5	cup	\N	2
86ab789d-3daf-4ec8-ab23-cf8233136247	78a9862e-f35e-41aa-bc48-a70db4ef3286	chicken broth	0.5	cup	\N	3
64f3284f-7830-4b3a-8d03-2709216d0c40	78a9862e-f35e-41aa-bc48-a70db4ef3286	lemon juice	3	tbsp	\N	4
18d47122-902e-4544-9722-1c78bf7aa6c3	78a9862e-f35e-41aa-bc48-a70db4ef3286	capers, drained	2	tbsp	\N	5
a86db4b3-1b2b-472d-a07d-9e21e5b5ed9a	78a9862e-f35e-41aa-bc48-a70db4ef3286	butter	3	tbsp	\N	6
80b2d6b0-49e1-4d3c-bf40-1f9584ff844d	78a9862e-f35e-41aa-bc48-a70db4ef3286	olive oil	3	tbsp	\N	7
53da6be7-a92b-4f8a-9936-35fe5e03f9dd	78a9862e-f35e-41aa-bc48-a70db4ef3286	baby spinach	10	oz	\N	8
f216e804-215b-4add-907c-1bff256bdb2d	78a9862e-f35e-41aa-bc48-a70db4ef3286	garlic, sliced	4	clove	\N	9
ed1ec1ec-9e5b-4d2b-abc8-e6c557e83ee4	78a9862e-f35e-41aa-bc48-a70db4ef3286	red pepper flakes	0.25	tsp	\N	10
1d10a59f-7706-4ab4-a18e-f124991099e7	78a9862e-f35e-41aa-bc48-a70db4ef3286	fresh parsley, chopped	2	tbsp	\N	11
18afb026-2670-4be7-85eb-b1ce506e2c3e	78a9862e-f35e-41aa-bc48-a70db4ef3286	salt and pepper	1	tsp	\N	12
3eef869b-dd8e-4751-a1d7-0a5168e15762	17cab84f-48c5-4dd7-9849-1a0e1ee0ddf1	coconut oil	1	cup	\N	0
58860ba1-8d5d-4490-8be8-13d59dd9abef	17cab84f-48c5-4dd7-9849-1a0e1ee0ddf1	cannabis flower (decarbed)	7	g	\N	1
f4323027-568a-4e4d-a899-46c6d4376509	b947002b-5a26-450b-89b0-149a8f87089d	Bell Pepper	1	whole	\N	0
180740dc-58a8-4a62-8bd5-899635047102	1d8fce90-83cc-40f5-9c53-156da6f146a6	Cube Steaks	4	whole	\N	0
e8dc9ffa-fbe3-48e5-91b3-16514de3e4c5	1d8fce90-83cc-40f5-9c53-156da6f146a6	Bell Pepper	1	whole	\N	1
593b15a3-0d5d-4059-b5ad-6666a9bf7938	1d8fce90-83cc-40f5-9c53-156da6f146a6	Red Onion	1	whole	\N	2
35a14095-8726-4f7f-b8c6-25651a6e8952	1d8fce90-83cc-40f5-9c53-156da6f146a6	Garlic Cloves	2	cloves	\N	3
3cfae72b-4ca7-4cf0-92c9-f3344ce67157	1d8fce90-83cc-40f5-9c53-156da6f146a6	All-purpose flour	0.25	cup	\N	4
204ffdb3-f88c-4b90-84aa-48c3c3b26fcd	1d8fce90-83cc-40f5-9c53-156da6f146a6	Olive oil	2	tbsp	\N	5
0b8162ae-1e29-4dbf-b95d-7692d3a7147e	9a633436-c166-4bd4-9a38-9d7363d99fd4	chopped fresh oregano	0.25	cup	\N	0
279961fe-c8de-401f-abdf-c5e2b19c7416	9a633436-c166-4bd4-9a38-9d7363d99fd4	grated Parmesan cheese	0.5	cup	\N	1
68de7800-57d3-42ce-a0b2-d43b62d2d3e8	9a633436-c166-4bd4-9a38-9d7363d99fd4	olive oil	1	tbsp	\N	2
b756c3dd-5d63-4d9e-b82b-9643586ef094	9a633436-c166-4bd4-9a38-9d7363d99fd4	salt	1	tsp	\N	3
3c11a720-4410-42fd-aa89-01dac70ea920	9a633436-c166-4bd4-9a38-9d7363d99fd4	Italian sausage links	4	whole	\N	4
2ba446b9-d8d5-4505-a5e9-4e5d0f33cba3	9a633436-c166-4bd4-9a38-9d7363d99fd4	ground black pepper	0.25	tsp	\N	5
cddf8489-e561-4f5e-ac9b-f0635eabe1ff	9a633436-c166-4bd4-9a38-9d7363d99fd4	yellow onion, chopped	1	whole	\N	6
e61e44e6-3e76-43f5-8c92-72e6ed8a3838	9a633436-c166-4bd4-9a38-9d7363d99fd4	bay leaf	1	whole	\N	7
0e1ff6c9-c085-471d-b6ab-dc0fcba5d045	9a633436-c166-4bd4-9a38-9d7363d99fd4	(15 ounce) can tomato sauce	1	whole	\N	8
793c83db-0493-4239-a134-e76bcbd52f6e	9a633436-c166-4bd4-9a38-9d7363d99fd4	(14.5 ounce) can whole peeled tomatoes	1	whole	\N	9
a9f5897e-c387-4c26-86a9-1ead43389cb9	9a633436-c166-4bd4-9a38-9d7363d99fd4	lean ground beef	1	lb	\N	10
be444ea1-0d96-430c-b126-1b0bb8b0bb0f	9a633436-c166-4bd4-9a38-9d7363d99fd4	dried basil	1	tsp	\N	11
000e67bc-bb4f-4795-858a-a4be38b2a50e	9a633436-c166-4bd4-9a38-9d7363d99fd4	garlic, chopped	2	clove	\N	12
28771fb8-00c5-4c4c-8765-866dabe9ecc0	9a633436-c166-4bd4-9a38-9d7363d99fd4	(16 ounce) package dry spaghetti	1	whole	\N	13
6f61e781-65aa-41b9-ab0d-e84c9acb7e15	350fa316-fd7b-4c31-84c7-18a2966cc4da	1-2  Persian cucumbers (peeled in ribbons)	\N	whole	\N	0
fade612c-b2b0-4b35-87aa-90db0cf347a1	350fa316-fd7b-4c31-84c7-18a2966cc4da	Salt and pepper (to taste)	\N	whole	\N	1
6dbb02b7-a176-4865-93f7-57f40ab36815	350fa316-fd7b-4c31-84c7-18a2966cc4da	fresh dill (plus more for serving)	1	tbsp	\N	2
d8a45d21-b28d-40a0-9e18-b45e155df434	350fa316-fd7b-4c31-84c7-18a2966cc4da	bagels (halved)	2	whole	\N	3
53229e73-2886-4a61-8dc7-cc42b3271b5c	350fa316-fd7b-4c31-84c7-18a2966cc4da	Capers (to taste)	\N	whole	\N	4
39e8bd36-3f77-4138-ad10-5dd6c0e04833	350fa316-fd7b-4c31-84c7-18a2966cc4da	Red onion  (slices, for serving)	\N	whole	\N	5
cd650ac6-c1ce-4ef7-a26a-106e51f0d9b0	350fa316-fd7b-4c31-84c7-18a2966cc4da	smoked salmon (thinly sliced)	4	oz	\N	6
1bbfd39e-6ee4-4628-9114-fc2adfd7b46a	350fa316-fd7b-4c31-84c7-18a2966cc4da	cream cheese	4	oz	\N	7
faec2348-d730-4ac5-abd4-9d8e266e5538	350fa316-fd7b-4c31-84c7-18a2966cc4da	lemon juice	2	tbsp	\N	8
dfcf73c5-2661-4b3d-b1ab-c2fa56addbe2	350fa316-fd7b-4c31-84c7-18a2966cc4da	Larrupin Mustard Dill Sauce (finishing drizzle)	\N	whole	\N	9
f62ea244-4d8c-45c1-8483-2871c68de0c5	ab7a2b1a-add7-4a55-b10a-bb9c4648be58	papaya	1	whole	\N	0
17a9c11c-2a22-4c3e-82b6-2b83a66da600	ab7a2b1a-add7-4a55-b10a-bb9c4648be58	pineapple	0.5	whole	\N	1
a49605c1-c57f-4e03-92bf-a002173a540d	ab7a2b1a-add7-4a55-b10a-bb9c4648be58	carrots	3	whole	\N	2
4e0571c5-09d2-4010-9ae0-6191fcf89973	ab7a2b1a-add7-4a55-b10a-bb9c4648be58	ginger	1	inch	\N	3
76825c77-c7ef-456c-b09e-e7c6999816f2	ab7a2b1a-add7-4a55-b10a-bb9c4648be58	papaya seeds	1	tbsp	\N	4
d9aa0e9e-cee5-40cf-8da8-c7b248db501d	50bfe51d-e065-4cf2-858b-75d432023f51	apples	5	whole	\N	0
304ac820-eaf8-43a0-9a7c-1c2be7741628	50bfe51d-e065-4cf2-858b-75d432023f51	cucumbers	3	whole	\N	1
aeee686e-f61c-4271-8386-dc7b085a4f1a	50bfe51d-e065-4cf2-858b-75d432023f51	dandelion greens	1	bunch	\N	2
1fbeb631-fdb4-40d9-a9e4-3caaac58563e	50bfe51d-e065-4cf2-858b-75d432023f51	spinach	1	bunch	\N	3
f6a22831-0a5c-4a89-9c9f-19cef698037b	50bfe51d-e065-4cf2-858b-75d432023f51	lemon	1	whole	\N	4
11655b13-1463-4773-ad2e-4ec7e0624b85	98708958-7ead-4d57-aa3a-405a78688786	carrots	4	whole	\N	0
9109b8cb-ea17-4149-966b-4205a8a0e65a	98708958-7ead-4d57-aa3a-405a78688786	beets	2	whole	\N	1
d5eaf232-f7a3-4650-8035-ce9f7db4185f	98708958-7ead-4d57-aa3a-405a78688786	granny smith apples	3	whole	\N	2
bb2376e0-0a78-40f7-9757-58b868535dfb	7dd0efcd-7f9e-4805-a85d-ad044b8801b5	carrots	2	bags	\N	0
396afbe1-c77d-49d9-8bb7-675b4adbf50c	7dd0efcd-7f9e-4805-a85d-ad044b8801b5	grapefruits	2	whole	\N	1
79a46613-14f6-46a4-91cc-77905c8f792a	7dd0efcd-7f9e-4805-a85d-ad044b8801b5	ginger	1	inch	\N	2
2c1d3798-5761-4bea-867b-769de04c9497	693024ba-9b16-493e-ae91-4abeacd7344f	sweet apples	6	whole	\N	0
165f894c-e0de-4de4-9fb8-e5d3ecfcb457	693024ba-9b16-493e-ae91-4abeacd7344f	purple sweet potatoes	2	whole	\N	1
f3ee3f92-baed-45b6-8cd2-565103131699	693024ba-9b16-493e-ae91-4abeacd7344f	beets	3	whole	\N	2
0194dadd-2521-4da5-bac7-be9b662facff	c6255b5f-6f20-4dc5-b4c4-ca0b300a57b7	mango	2	whole	\N	0
02a45d91-0c37-4766-bbad-399e6359201c	c6255b5f-6f20-4dc5-b4c4-ca0b300a57b7	oranges	2	whole	\N	1
6057a7a8-1846-49b4-8e90-5eca1691cd41	c6255b5f-6f20-4dc5-b4c4-ca0b300a57b7	pineapple	0.5	whole	\N	2
2c5571f9-5b21-4804-8e89-fe8425b42f8a	70163822-a1e6-4a76-b21d-d231639e3424	frozen dragon fruits	3	whole	\N	0
6ed474a4-0f50-4481-b48c-104dc593734a	70163822-a1e6-4a76-b21d-d231639e3424	frozen bananas	3	whole	\N	1
2570e480-4d2e-41d8-beb7-3f66a16ca18d	4b49372d-beb1-4006-8918-acec20387015	oranges	6	whole	\N	0
c30d197d-48e4-4951-b5b2-458836fdf568	a01888a1-eea4-40c1-adfd-26ad07288d05	beef brisket (2 inches thick)	2	lb	\N	0
e2017540-5d10-4617-a411-e65f8bd0a4ad	a01888a1-eea4-40c1-adfd-26ad07288d05	brown sugar	2	tbsp	\N	1
9203033d-3f17-4cb7-98e6-d4f0dae61564	a01888a1-eea4-40c1-adfd-26ad07288d05	chili powder	2	tsp	\N	2
935c57f0-c393-4a9e-a38a-ec11121eca60	a01888a1-eea4-40c1-adfd-26ad07288d05	black pepper	2	tsp	\N	3
3b7f2290-19ae-459c-a2e6-17a2b42a9c41	a01888a1-eea4-40c1-adfd-26ad07288d05	onion powder	1	tsp	\N	4
61cdd0de-c0f8-44df-9882-28c46d0af28d	a01888a1-eea4-40c1-adfd-26ad07288d05	garlic powder	1	tsp	\N	5
c1b487b0-234c-47ef-8bbf-68b63c483377	a01888a1-eea4-40c1-adfd-26ad07288d05	cinnamon	1	tsp	\N	6
c9d9b219-5f15-44c6-b096-439deed56892	a01888a1-eea4-40c1-adfd-26ad07288d05	coarse kosher salt	1	tsp	\N	7
1264c030-47db-4363-9ed7-febd30e974fa	a01888a1-eea4-40c1-adfd-26ad07288d05	ground cumin	0.5	tsp	\N	8
6c88ecca-4e50-4a28-994d-481096c2ad3c	a01888a1-eea4-40c1-adfd-26ad07288d05	ground fennel seed	0.5	tsp	\N	9
b51ac547-2098-49aa-8315-d8aab0c004b4	a01888a1-eea4-40c1-adfd-26ad07288d05	cayenne pepper	0.25	tsp	\N	10
39df4fef-3de8-4377-9dd1-4807c5c4e763	a01888a1-eea4-40c1-adfd-26ad07288d05	liquid smoke	5	whole	\N	11
31c2302a-1bab-40b6-95d2-bb88cb5a1933	a01888a1-eea4-40c1-adfd-26ad07288d05	onion, sliced	1	whole	\N	12
f238ea02-2020-42b1-a142-ea95f11a49f2	a01888a1-eea4-40c1-adfd-26ad07288d05	garlic, minced	3	clove	\N	13
1d31b450-16e4-4308-af96-1d7ed37a7e57	a01888a1-eea4-40c1-adfd-26ad07288d05	chicken stock	0.5	cup	\N	14
bf0b6762-0022-47a1-a8ab-93a55cd2c628	a01888a1-eea4-40c1-adfd-26ad07288d05	maple syrup	1	tbsp	\N	15
5cfb21dd-0608-43ee-a500-a5d76d0fbde7	a01888a1-eea4-40c1-adfd-26ad07288d05	honey	1	tbsp	\N	16
4f1de343-2d2f-4d79-8619-5a51700fec40	a01888a1-eea4-40c1-adfd-26ad07288d05	apple cider vinegar	2	tbsp	\N	17
8d516ba4-4d99-412b-bee3-890316130a83	a01888a1-eea4-40c1-adfd-26ad07288d05	ketchup	1	cup	\N	18
16b02493-3b0a-43a0-b7ac-68125c5cc773	a01888a1-eea4-40c1-adfd-26ad07288d05	Dijon mustard	2	tbsp	\N	19
dc9a0f92-ba76-4a87-b468-caec743012de	3523ab6d-c94e-4750-9bc9-56d210ca5702	Strawberry and Cream Ice Cream	1.5	cup	\N	0
80e7c7d4-3195-4289-acea-89b1687e50f0	a522f13a-f5b0-457b-b397-91c70f4d11da	Frozen Unfrosted Cinnamon Rolls	2	whole	\N	0
495f4ed5-eb97-49a2-8725-84123cdc375b	a522f13a-f5b0-457b-b397-91c70f4d11da	Cinnamon Roll Icing	1	whole	\N	1
ca0ac3e1-d086-4713-a036-1cc94b8e97aa	3523ab6d-c94e-4750-9bc9-56d210ca5702	Almond Milk	1	cup	\N	1
5af71b9c-31eb-4061-8bd3-b94e030a94ad	f1689f69-4359-4f71-ae5d-90853521a216	Paper towels (used)	3	sheets	\N	0
8f2f058a-ba25-4649-b691-a44b4cee8dd8	f1689f69-4359-4f71-ae5d-90853521a216	Coffee grounds	1	cup	\N	1
2f26658b-09f4-4adf-adcb-7c9a83c6c54c	f1689f69-4359-4f71-ae5d-90853521a216	Banana peels	2	whole	\N	2
65492378-3ee9-4772-aa08-d7d8e97d2433	f1689f69-4359-4f71-ae5d-90853521a216	Toilet paper rolls	1	whole	\N	3
e06eb860-df84-4d84-ba53-bc2eddca5f8b	f1689f69-4359-4f71-ae5d-90853521a216	Tea bags (used)	2	whole	\N	4
0d6ad6cd-4890-46e1-8aec-e6a9671bea8a	f1689f69-4359-4f71-ae5d-90853521a216	Egg shells	2	whole	\N	5
07d88154-47e2-4e6a-a228-77f7b445da46	f1689f69-4359-4f71-ae5d-90853521a216	Fruit and veggie scraps	1	cup	\N	6
4b1ed22a-4e6b-48ab-aa1b-41b3d377e358	86d2c1bb-5cb6-49fa-887d-89d0482a6f1d	Ground Beef	1	lb	\N	0
14be4235-7bb7-4b00-83bf-1125e6a40cd0	86d2c1bb-5cb6-49fa-887d-89d0482a6f1d	Organic Pinto Beans	2	cans	\N	1
60f9480a-03c1-4b60-8601-a76f42f98d01	86d2c1bb-5cb6-49fa-887d-89d0482a6f1d	Crushed Tomatoes In Rice Puree	1	lb	\N	2
f1898e4f-44cc-49bb-a1c4-5d23f1be57d8	86d2c1bb-5cb6-49fa-887d-89d0482a6f1d	SRIRACHA CHILI SAUCE	1	tbsp	\N	3
12f2c78b-df5b-4c95-847f-6aa908e2ffa2	86d2c1bb-5cb6-49fa-887d-89d0482a6f1d	Mexican hot sauce	1	tbsp	\N	4
636a9ac7-99c4-455b-ac1b-bea4502b99f7	86d2c1bb-5cb6-49fa-887d-89d0482a6f1d	Olive oil (High heat)	1	tbsp	\N	5
46d698be-48aa-4f05-8e6b-ab93139277b7	86d2c1bb-5cb6-49fa-887d-89d0482a6f1d	Himalayan Sea Salt	\N	to taste	\N	6
8cc68790-de9f-49d1-a9f9-ec55683e98ba	86d2c1bb-5cb6-49fa-887d-89d0482a6f1d	Queso Fresco Part Skim Milk Cheese	2	oz	\N	7
0e6bcf86-42c6-43f3-bd7f-bebd5c0f1bc8	7e594bdd-6831-49a5-804d-fab6975df7ef	Pastrami	4	oz	\N	0
b7712c12-22ca-4b65-bd78-825b26e82a8b	7e594bdd-6831-49a5-804d-fab6975df7ef	Medium Cheddar	2	oz	\N	1
1ac911cf-2c05-47aa-90ea-7dc9f7e29932	7e594bdd-6831-49a5-804d-fab6975df7ef	EXTRA CRISP 6 SLICED ENGLISH MUFFIN	2	whole	\N	2
584bebab-2b5e-4b53-b4c2-67c461b20a48	7e594bdd-6831-49a5-804d-fab6975df7ef	Larrupin swedish style mustard dill sauce	1	tbsp	\N	3
19b7820a-dd56-476e-8062-16190c4f17ff	ebc24be6-f7dc-4cb9-86da-9f55e26aa5c6	Pastrami	4	oz	\N	0
3912a410-49e7-4112-ac0e-0446b8ae7f0d	ebc24be6-f7dc-4cb9-86da-9f55e26aa5c6	Sauerkraut	2	tbsp	\N	1
724b969e-3c6d-4934-a193-9fe04202c4e0	ebc24be6-f7dc-4cb9-86da-9f55e26aa5c6	Monterey jack cheese with jalapeno peppers, pepper jack	2	oz	\N	2
92cc9567-4bd2-411c-8085-04a439799472	ebc24be6-f7dc-4cb9-86da-9f55e26aa5c6	EXTRA CRISP 6 SLICED ENGLISH MUFFIN	2	whole	\N	3
a004f4ca-daab-4e22-b8da-ea9f3d18c040	ebc24be6-f7dc-4cb9-86da-9f55e26aa5c6	Butter	1	tbsp	\N	4
1dc46ac5-a71f-4271-be69-0c54dd8a676d	ebc24be6-f7dc-4cb9-86da-9f55e26aa5c6	Larrupin swedish style mustard dill sauce	1	tbsp	\N	5
257ac904-514d-45dc-b267-896f4088be55	93671294-7ce7-4386-b44e-e6489f654c69	Cannabis-Infused Coconut Oil	0.25	cup	\N	0
e208b697-5678-4a1e-b4f9-70785eb7c099	93671294-7ce7-4386-b44e-e6489f654c69	granulated sugar	0.5	cup	\N	1
6b0e8e77-b237-4fe0-adb8-a0950dbf23d4	93671294-7ce7-4386-b44e-e6489f654c69	brown sugar, packed	0.5	cup	\N	2
b9ad8ca4-e4c7-4dbd-b039-bdfe43f88a75	93671294-7ce7-4386-b44e-e6489f654c69	eggs	2	whole	\N	3
8652728a-dbed-4952-bae4-28c648a96000	93671294-7ce7-4386-b44e-e6489f654c69	vanilla extract	1	tsp	\N	4
93665fa4-ad81-47fe-866a-4563095210f6	93671294-7ce7-4386-b44e-e6489f654c69	all-purpose flour	1.25	cup	\N	5
3a2b1947-f80e-49c2-b6bb-5e8d16e2ce93	93671294-7ce7-4386-b44e-e6489f654c69	unsweetened cocoa powder	0.5	cup	\N	6
cc430317-6365-4ee3-8fbb-640a682a6b19	93671294-7ce7-4386-b44e-e6489f654c69	baking soda	0.5	tsp	\N	7
eaf720e2-31bc-4b7a-bc4a-d7e3ad8d9079	93671294-7ce7-4386-b44e-e6489f654c69	salt	0.5	tsp	\N	8
8e897385-7581-4c2b-b924-902587f3685d	93671294-7ce7-4386-b44e-e6489f654c69	semi-sweet chocolate chips	1	cup	\N	9
360eac1c-5090-4365-842b-5e9bb2e9e057	be7b35fd-c70d-4c8a-adfc-6d25fe255187	Albacore Wild Tuna	2	cans	\N	0
049d5dca-4b88-4168-acdd-b742dddf8ef3	be7b35fd-c70d-4c8a-adfc-6d25fe255187	Avocado	1	whole	\N	1
a380d9b8-dbcf-4bc1-85d8-1a50be7b37b1	be7b35fd-c70d-4c8a-adfc-6d25fe255187	Focaccia bread	1	whole	\N	2
da575052-82b4-4401-b0a3-fb34051b3ae0	be7b35fd-c70d-4c8a-adfc-6d25fe255187	Mozz Cheese	1	whole	\N	3
68d0d141-8733-4fe6-b6ce-0a1492aa74f6	be7b35fd-c70d-4c8a-adfc-6d25fe255187	Garden Herb Ranch Dressing	2	tbsp	\N	4
3dc3594d-8005-4104-8e3f-00557a3c1366	be7b35fd-c70d-4c8a-adfc-6d25fe255187	SRIRACHA CHILI SAUCE	1	tsp	\N	5
7f95a230-7ffb-4494-bc42-0b16d390cfdb	be7b35fd-c70d-4c8a-adfc-6d25fe255187	Olive oil (High heat)	1	tbsp	\N	6
51b682b0-48f1-4a06-bfd7-62f8ac7b4d80	be7b35fd-c70d-4c8a-adfc-6d25fe255187	Himalayan Sea Salt	1	pinch	\N	7
a0427a80-4319-46b3-924d-759cdde423ce	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	large egg yolks	2	\N	\N	0
f9e48e37-6e0e-4138-9043-553db21fb106	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	ube halaya (purple yam jam)	3	tbsp	\N	1
de9a2181-36df-4458-99a7-b94708be8601	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	whole milk	2	tbsp	\N	2
85d010a2-91a6-46d2-9db0-be15dc17b232	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	vanilla extract	1	tsp	\N	3
d5646a8d-2fcb-48c6-b2dd-07c8123b9ccc	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	cake flour	0.25	cup	\N	4
4814e9eb-afcc-4a0b-9b9c-215cb4a032f7	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	baking powder	0.5	tsp	\N	5
e4754f6e-275d-4992-b0d8-f518f4e6edf3	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	salt	\N	pinch	\N	6
5d19985d-4d1e-4863-a82a-5b93c53022c4	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	large egg whites	3	\N	\N	7
67301837-0c2d-4c6b-98a8-c92215534769	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	cream of tartar	0.125	tsp	\N	8
8eacc27d-767f-42e0-8ea9-64f4760e4d5f	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	granulated sugar	3	tbsp	\N	9
0a8dcb33-b15f-4d1a-bbe4-681053c43f5f	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	neutral oil or butter for the pan	\N	\N	\N	10
8bd4ea21-699c-4067-9e52-eeb8b6ffe826	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	coconut cream	0.5	cup	\N	11
ebb2ab1b-e48c-4499-a811-600b02a92b5c	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	sweetened condensed milk	2	tbsp	\N	12
d6a21993-b3ec-44a9-959d-262c3f36a069	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	vanilla extract	0.5	tsp	\N	13
8f8f37a9-c6f1-43fe-b779-7f7ffbc18c74	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	salt	\N	pinch	\N	14
cee46bc5-b777-4b7d-a66c-8d21a352e552	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	mixed fresh berries (strawberries, blueberries, raspberries)	1	cup	\N	15
c4e8301b-638c-48b7-bae2-ccb049ad1039	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	honey or maple syrup	1	tbsp	\N	16
096de3ca-9935-40e9-9bcc-b0223cfb8474	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	fresh lemon juice	1	tsp	\N	17
5ab810c6-f373-4ed4-b9ec-7af1c8f6cf60	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	powdered sugar for dusting	\N	\N	\N	18
5845fb63-d686-41db-97ec-b40ce83b887c	5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	whipped cream (optional)	\N	\N	\N	19
3bf2228d-456b-43df-bd0c-281311b2aba7	a2fd26aa-5e71-402b-91c7-d6ee01062ab9	Peaches and Cream	1.5	cup	\N	0
57693db7-5b52-42f2-8981-43eda2af855b	a2fd26aa-5e71-402b-91c7-d6ee01062ab9	Almond Milk	1	cup	\N	1
00c031ba-f711-4fa5-bff2-d193c6a4d943	6455deb8-1355-48b1-a1ff-c2d8cfa136ed	Ground Beef	0.75	lb	\N	0
37b28861-d5d1-4f6b-b515-d46de0a784b7	6455deb8-1355-48b1-a1ff-c2d8cfa136ed	Brioche Buns	2	whole	\N	1
2366fdc9-949c-4203-99aa-2d7153a941db	6455deb8-1355-48b1-a1ff-c2d8cfa136ed	Avocado	1	whole	\N	2
7a4539cb-ebcc-4600-9f5e-72ad4310b9c1	6455deb8-1355-48b1-a1ff-c2d8cfa136ed	Monterey jack cheese with jalapeno peppers, pepper jack	2	slices	\N	3
e9535496-84d9-4ed5-be31-e20f9ca0180b	6455deb8-1355-48b1-a1ff-c2d8cfa136ed	Philadelphia Cream Cheese	2	tbsp	\N	4
585fd295-b2e0-4008-9214-796ef43e5cb1	6455deb8-1355-48b1-a1ff-c2d8cfa136ed	SRIRACHA CHILI SAUCE	1	tsp	\N	5
0c4e6af9-9805-421a-b509-0c515aa41069	6455deb8-1355-48b1-a1ff-c2d8cfa136ed	Himalayan Sea Salt	1	tsp	\N	6
8c7cb7f3-a6cc-42c8-a093-64caf0fb45c6	6455deb8-1355-48b1-a1ff-c2d8cfa136ed	Olive oil (High heat)	1	tbsp	\N	7
f6e204ae-ea87-4ec4-88b1-1f49bb0a6c7a	fdfaec68-1409-4b81-8639-a1dfb67a780b	Carrots	2	whole	\N	0
f07699ee-4f1b-4c59-8bf4-fb66222e4ff2	fdfaec68-1409-4b81-8639-a1dfb67a780b	Breast Milk	3	tbsp	\N	1
895db164-7b62-4481-99de-fdfdccae2b36	fdfaec68-1409-4b81-8639-a1dfb67a780b	Water	0.25	cups	\N	2
90142186-62ee-4c01-81fd-bebfe31e351c	9b6a724b-264d-4a47-9f6b-cd598287e029	Thick cut pepper bacon (Carlton Farms, Carlton OR)	1	lb	\N	0
d1e8f301-64c8-4fe4-a3af-2851662b53e4	569487a8-197f-4776-92c3-102e86203c8b	fresh blueberries	1	cup	\N	0
82a1fe60-a862-44aa-88c5-d71a5e353312	569487a8-197f-4776-92c3-102e86203c8b	granola	3	tbsp	\N	1
a8bbc56d-b0c5-49cf-8e53-32e0e53cec53	569487a8-197f-4776-92c3-102e86203c8b	1-2 teaspoons sweetener of choice (optional)	\N	whole	\N	2
5a681239-cef7-48bc-8b12-e06890750b41	569487a8-197f-4776-92c3-102e86203c8b	vanilla yogurt of choice	1	cup	\N	3
341e5999-2f28-4904-b2a1-c61e8c8bdf0b	748747fb-7ca8-4ba3-9f64-a549f009744d	maple syrup (or more as per your taste)	0.25	cup	\N	0
d4754b68-c463-4953-bedb-e07a06f61b5d	748747fb-7ca8-4ba3-9f64-a549f009744d	Juice of half lemon (about 1 tablespoon)	\N	whole	\N	1
ebf3e9bd-eabb-4f16-a9f6-1615e399d34b	748747fb-7ca8-4ba3-9f64-a549f009744d	Raspberries (frozen) (about 18 oz or 500g)	3	cup	\N	2
21d0d15a-c506-4e8f-a151-10f6d1e25c39	748747fb-7ca8-4ba3-9f64-a549f009744d	Zest of 1 lemon	\N	whole	\N	3
b81119f6-3651-4ed9-805d-7dec25a5bde9	748747fb-7ca8-4ba3-9f64-a549f009744d	Chia seeds	0.25	cup	\N	4
5acf1279-b3a7-4d48-bd63-22ee2ace4f0c	5bd2dcb3-ee02-4705-8c5a-45a2a9a5c2ec	Rigatoni no. 21, authentic organic pasta	0.5	lb	\N	0
078260dd-68eb-4f17-903d-9e552d3dcebd	5bd2dcb3-ee02-4705-8c5a-45a2a9a5c2ec	Crushed Tomatoes In Rice Puree	1	lb	\N	1
58410910-6846-4e9b-9330-8997356f2c40	5bd2dcb3-ee02-4705-8c5a-45a2a9a5c2ec	simply pesto traditional basil	1	oz	\N	2
82a067dd-3cb2-4a72-b427-27eb80401600	5bd2dcb3-ee02-4705-8c5a-45a2a9a5c2ec	Feta Crumbles	3	tbsp	\N	3
26208852-9496-4990-8042-5dff36fa6935	5bd2dcb3-ee02-4705-8c5a-45a2a9a5c2ec	Rosemary	1	sprig	\N	4
59b59d1d-ad25-4fd8-bb1a-5a79cd4cb84c	5bd2dcb3-ee02-4705-8c5a-45a2a9a5c2ec	Himalayan Sea Salt	1	tsp	\N	5
a90f1a72-930a-403d-bfc2-dba275d732f8	5bd2dcb3-ee02-4705-8c5a-45a2a9a5c2ec	Olive Oil (Finishing)	1	tbsp	\N	6
6f5d7f48-0dd8-48e0-b948-c12eb67d56cd	a1f05bba-01d0-4ac6-be1a-233aae393c03	Italian sausage, casings removed  (mild or hot)	2	lb	\N	0
8fa65bd3-5227-4244-9fd2-17e3fffe6875	a1f05bba-01d0-4ac6-be1a-233aae393c03	small    onion, chopped  (optional)	1	whole	\N	1
463fa251-0185-4730-83fb-f0fcc15cb255	a1f05bba-01d0-4ac6-be1a-233aae393c03	-4       garlic cloves, minced	3	whole	\N	2
c6028ae8-6dbf-4d06-9dd3-6a094514fe23	a1f05bba-01d0-4ac6-be1a-233aae393c03	(28   ounce) can   diced tomatoes	1	whole	\N	3
aebb3d59-dff8-40b1-9157-a475f5289926	a1f05bba-01d0-4ac6-be1a-233aae393c03	(6   ounce) cans   tomato paste	2	whole	\N	4
7c390e77-16cb-416b-9ebb-adca5ec39c6f	a1f05bba-01d0-4ac6-be1a-233aae393c03	(15   ounce) cans   tomato sauce	2	whole	\N	5
f1c5a719-d1a5-429b-a8f1-09a97657f75a	a1f05bba-01d0-4ac6-be1a-233aae393c03	water (for a long period of simmering for flavors to meld. If you don't want to simmer it as long, add less)	2	cup	\N	6
7cee0d5c-0dd0-4895-a4f6-ce01b42b680f	a1f05bba-01d0-4ac6-be1a-233aae393c03	basil	3	tsp	\N	7
e12e0a1d-113d-4ea4-bf15-24443f989dab	a1f05bba-01d0-4ac6-be1a-233aae393c03	dried parsley flakes	2	tsp	\N	8
c3364543-e089-45d5-913f-e56ea060052c	a1f05bba-01d0-4ac6-be1a-233aae393c03	brown sugar	1.5	tsp	\N	9
ceb129ca-6df3-4838-9ecd-c8472ef5e9a2	a1f05bba-01d0-4ac6-be1a-233aae393c03	salt	1	tsp	\N	10
5acc69ef-5351-4537-9667-bb26c1c64d45	a1f05bba-01d0-4ac6-be1a-233aae393c03	1/4-1/2  teaspoon    crushed red pepper flakes	\N	whole	\N	11
c74300d0-0709-4004-916e-301079805d1c	a1f05bba-01d0-4ac6-be1a-233aae393c03	fresh coarse ground black pepper	0.25	tsp	\N	12
2bf448a0-4afa-4f15-87e6-3c74a53c95a2	a1f05bba-01d0-4ac6-be1a-233aae393c03	red wine (a good Cabernet!)	0.25	cup	\N	13
cda0d572-cd72-46f5-aefc-968d55700a72	a1f05bba-01d0-4ac6-be1a-233aae393c03	thin spaghetti	1	lb	\N	14
f4cb9039-246d-4217-91d3-e6e2b63161da	a1f05bba-01d0-4ac6-be1a-233aae393c03	parmesan cheese	\N	whole	\N	15
488198da-11e1-4ae3-a068-ac4d6b096733	646dfcb3-0121-4cdc-8280-de7783178f28	Zest of 1 lemon	\N	whole	\N	0
15c183be-8cc0-460d-bc78-de898b239b84	646dfcb3-0121-4cdc-8280-de7783178f28	Chia seeds	0.25	cup	\N	1
6739aa66-de07-4709-acca-7f5f82b418c7	646dfcb3-0121-4cdc-8280-de7783178f28	Juice of half lemon (about 1 tablespoon)	\N	whole	\N	2
f5e8b5bd-2bf2-4396-8aba-e3adcbb25dc3	646dfcb3-0121-4cdc-8280-de7783178f28	maple syrup (or more as per your taste)	0.25	cup	\N	3
2064a925-49be-41e6-ba11-517fc8af9b58	646dfcb3-0121-4cdc-8280-de7783178f28	Blueberries (about 18 oz or 500g)	3	cup	\N	4
aca98338-234f-435a-a49b-c87f430d0d1e	10288612-86f9-4856-90da-79057817d759	Slow Rise Croissants	1	\N	\N	0
516ffd63-c50b-4746-a460-092948e1cee8	10288612-86f9-4856-90da-79057817d759	Raspberry Chia Seed Jam	2	tbsp	748747fb-7ca8-4ba3-9f64-a549f009744d	1
904790c0-d580-4829-b19c-b649d54e8c23	3449a857-00b1-4ddb-a648-1cebd4d7056e	Olive oil (High heat)	1	tbsp	\N	0
dbeb5707-342f-4586-8483-9f8cc071c603	3449a857-00b1-4ddb-a648-1cebd4d7056e	Yellow onion	1	whole	\N	1
ec35220b-bdec-43d9-bd05-ce99752541e6	3449a857-00b1-4ddb-a648-1cebd4d7056e	Garlic cloves	3	whole	\N	2
720a7362-b0fa-4ac3-8069-c253e20c5232	3449a857-00b1-4ddb-a648-1cebd4d7056e	Ginger Root	1	inch	\N	3
42c04416-bbd4-45c0-a06a-54613382e0cb	3449a857-00b1-4ddb-a648-1cebd4d7056e	Bell Pepper	1	whole	\N	4
594298c4-f32f-4a30-ab6f-7b7508b9d9a7	3449a857-00b1-4ddb-a648-1cebd4d7056e	Organic Broccoli	1	head	\N	5
9d66c935-b240-48e6-a2b4-c7a278ba3dae	3449a857-00b1-4ddb-a648-1cebd4d7056e	Organic Bunch Carrots	2	whole	\N	6
9f86cec9-6eea-4cae-bf31-c9fa140386db	3449a857-00b1-4ddb-a648-1cebd4d7056e	Chickpeas (canned)	1	can	\N	7
7778ed63-0c7e-43b3-91c5-630847510e1e	3449a857-00b1-4ddb-a648-1cebd4d7056e	Crushed Tomatoes In Rice Puree	14	oz	\N	8
484e5cef-36c2-4926-901a-f37a7668a5d9	3449a857-00b1-4ddb-a648-1cebd4d7056e	Coconut milk (canned)	1	can	\N	9
ca0452bc-de29-499c-ac17-bc06a4cfd4eb	3449a857-00b1-4ddb-a648-1cebd4d7056e	Curry powder	2	tbsp	\N	10
ad672408-4d48-48a6-af05-9381c2864b08	3449a857-00b1-4ddb-a648-1cebd4d7056e	Ground cumin	1	tsp	\N	11
d2e39f45-e527-4d3d-83d2-0606a419e8d4	3449a857-00b1-4ddb-a648-1cebd4d7056e	Ground turmeric	1	tsp	\N	12
8068b06c-8991-46c9-b831-1f3b8d24438d	3449a857-00b1-4ddb-a648-1cebd4d7056e	Chili powder	0.5	tsp	\N	13
48534bea-1535-45c7-b198-a4067b837895	3449a857-00b1-4ddb-a648-1cebd4d7056e	Himalayan Sea Salt	\N	to taste	\N	14
77cc91bb-fbbb-4432-86b3-e3de03769681	3449a857-00b1-4ddb-a648-1cebd4d7056e	Butter	1	tbsp	\N	15
5c6d2bc4-01d1-46e1-9f65-0de76d3187d3	3449a857-00b1-4ddb-a648-1cebd4d7056e	Cashews	\N	handful	\N	16
ac9fb9b2-c42e-42d0-bc9d-1b9291951291	3449a857-00b1-4ddb-a648-1cebd4d7056e	Lemon	0.5	whole	\N	17
62c1b05c-ef61-4206-af44-dfc2931c2a3d	e9c15d13-1a30-43c5-b61e-0bbd15b59091	Bananas (ripe)	3	whole	\N	1
803ff173-727f-48b5-baf4-1bf0dc3f216d	e9c15d13-1a30-43c5-b61e-0bbd15b59091	Butter	0.33	cup	\N	2
db45c386-186e-4953-bbf2-e1c36400662b	e9c15d13-1a30-43c5-b61e-0bbd15b59091	Sugar	0.75	cup	\N	3
78443a6a-6f27-45cc-af19-ad68157a2d6b	e9c15d13-1a30-43c5-b61e-0bbd15b59091	Eggs	1	whole	\N	4
a49d898f-a3e9-4ad0-b7a6-51825c5dddd6	e9c15d13-1a30-43c5-b61e-0bbd15b59091	Vanilla Extract	1	tsp	\N	5
2580368d-6532-43b1-a3d1-60bf268d6ea2	e9c15d13-1a30-43c5-b61e-0bbd15b59091	All-purpose flour	1	cup	\N	6
dc020fbc-47b3-4725-87bb-09e982026625	e9c15d13-1a30-43c5-b61e-0bbd15b59091	Baking soda	1	tsp	\N	7
b4ec32c0-8506-4a4e-82ac-96842479d41f	e9c15d13-1a30-43c5-b61e-0bbd15b59091	Cinnamon	0.5	tsp	\N	8
f1168a48-ace0-42c0-a262-e58bb3e6e3fd	e9c15d13-1a30-43c5-b61e-0bbd15b59091	Peanut Butter	3	tbsp	\N	9
f00196c5-5ac9-4f01-8fd5-3b8a1f65b0f4	497e7a07-a568-45fa-852b-80863f672e4a	Slow Rise Croissants	2	whole	\N	0
e5eb4784-2a31-4eba-a088-bafb29483d92	497e7a07-a568-45fa-852b-80863f672e4a	Breakfast sausage patties	2	whole	\N	1
18adbd4a-f498-48c5-9fae-a7ea65392500	497e7a07-a568-45fa-852b-80863f672e4a	Eggs	3	whole	\N	2
9fe3b0cc-8fe1-4af6-b251-8eaac92526df	497e7a07-a568-45fa-852b-80863f672e4a	Medium Cheddar	2	slice	\N	3
20fdabb4-420e-4365-b4b1-358f13696a63	497e7a07-a568-45fa-852b-80863f672e4a	Butter	1	tbsp	\N	4
9a105318-7644-4cac-8d41-c86bba93aac2	497e7a07-a568-45fa-852b-80863f672e4a	Himalayan Sea Salt	\N	to taste	\N	5
a129b3e2-a474-481a-bde1-5dda6f5d77d3	497e7a07-a568-45fa-852b-80863f672e4a	Black pepper	\N	to taste	\N	6
31b20821-f770-4873-b5da-5bb10519d399	c8b62ba7-ad1a-4aac-958a-7c1f8f869119	flour	3.25	cup	\N	0
3c99178f-5c05-4c31-837c-7e5f360278f4	c8b62ba7-ad1a-4aac-958a-7c1f8f869119	baking soda	1	tsp	\N	1
68fa2d43-fd52-4223-b1c8-059c50efcdd8	c8b62ba7-ad1a-4aac-958a-7c1f8f869119	salt	0.75	tsp	\N	2
a7f185af-b936-4a50-a4f4-5af9017bd748	c8b62ba7-ad1a-4aac-958a-7c1f8f869119	butter, softened	1.3333333333333333	cup	\N	3
41c8deaa-3d7b-467b-b15f-c42b96f5706e	c8b62ba7-ad1a-4aac-958a-7c1f8f869119	granulated sugar	1.25	cup	\N	4
98bcde03-f5e8-428f-9a32-71ac2c87ea04	c8b62ba7-ad1a-4aac-958a-7c1f8f869119	firmly packed light brown sugar	1	cup	\N	5
a20192f2-5a24-4bc5-acb5-4a31933fe4b3	c8b62ba7-ad1a-4aac-958a-7c1f8f869119	eggs	2	whole	\N	6
aff3de62-5e4b-4f99-be0c-4c316b621bc0	c8b62ba7-ad1a-4aac-958a-7c1f8f869119	McCormick® All Natural Pure Vanilla Extract {McCormick® Premium Vanilla Flavor}	4	tsp	\N	7
c585ecfa-eb1b-436a-94f6-4ec533fd2c51	c8b62ba7-ad1a-4aac-958a-7c1f8f869119	package (12 ounces) semi-sweet chocolate chips	1	whole	\N	8
b526089c-1450-4096-abd7-d8e4d22623c1	c8b62ba7-ad1a-4aac-958a-7c1f8f869119	chopped walnuts (optional)	1	cup	\N	9
a629a843-a259-4b28-a0a8-61e6d5e1f331	6661a800-c71a-4c75-9df5-0352f8ed3ba4	ripe banana	1	whole	\N	0
0c064303-e7ad-4eef-925e-b9a70837a7cc	6661a800-c71a-4c75-9df5-0352f8ed3ba4	egg	1	whole	\N	1
3a76c86c-6ea5-439c-b8ee-949ffd7e4ddb	d4988716-d9fb-403b-9b27-fda652ab7363	Bananas	2	whole	\N	0
a5dae04c-fee9-4047-810f-a7ac09340988	d4988716-d9fb-403b-9b27-fda652ab7363	Blueberries	0.5	cup	\N	1
c8f38924-1e36-4a96-8b01-a14b1dfafa2b	d4988716-d9fb-403b-9b27-fda652ab7363	Raspberries (frozen)	0.5	cup	\N	2
9495e75d-83ff-4316-8eef-d372ea373f85	d4988716-d9fb-403b-9b27-fda652ab7363	TRIPLE ZERO BLENDED GREEK YOGURT	0.75	cup	\N	3
2341d809-70e2-444a-952c-491e3ffc9f69	d4988716-d9fb-403b-9b27-fda652ab7363	Powdered Peanut Butter	2	tbsp	\N	4
79e3ed17-8fbb-41bf-910d-90daac19db7c	d4988716-d9fb-403b-9b27-fda652ab7363	Peanut Butter	2	tbsp	\N	5
96ca61a8-bd14-4f9e-a789-fe5f6923ec8e	d4988716-d9fb-403b-9b27-fda652ab7363	Almonds	0.25	cup	\N	6
0cdcb46a-8e2f-410b-aa5b-9846ed19a279	d4988716-d9fb-403b-9b27-fda652ab7363	Coconut shreds	2	tbsp	\N	7
25123079-f658-4e56-848a-d4b31ed81980	d4988716-d9fb-403b-9b27-fda652ab7363	Vanilla Extract	0.5	tsp	\N	8
bea60d40-e1e6-42c1-897f-208c4406da44	564bbcda-c033-472e-b45b-0cc6b331f943	Caputo 00 flour	1000	g	\N	0
3cef6394-9858-4edd-b00b-781a450cae66	564bbcda-c033-472e-b45b-0cc6b331f943	cool water (60–65 °F)	650	g	\N	1
49f983db-98d6-4bcd-be55-436e2b588be1	564bbcda-c033-472e-b45b-0cc6b331f943	Caputo Lievito Secco (dry yeast)	2.3	g	\N	2
0d7902b2-a45b-416a-9823-849c34316d65	564bbcda-c033-472e-b45b-0cc6b331f943	fine sea salt	30	g	\N	3
\.


--
-- Data for Name: recipes; Type: TABLE DATA; Schema: public; Owner: jpdevries
--

COPY public.recipes (id, title, description, instructions, servings, prep_time, cook_time, tags, source, photo_url, last_made_at, created_at, queued, kitchen_id, slug, source_url) FROM stdin;
b947002b-5a26-450b-89b0-149a8f87089d	Baby Bell Pepper Strips	Soft-steamed red bell pepper strips for baby-led weaning, 6+ months. Skin removed for safety, cut into easy-grip spears. A vitamin C powerhouse — one red pepper has 169% of the daily value.	1. Wash 1 organic red bell pepper. Cut in half and remove the stem, seeds, and white pith.\n2. Cut each half into 2-3 wide strips, about 1 inch wide and 2-3 inches long — big enough for baby to grip with their whole palm.\n3. Steam strips for 8-10 minutes until very soft — they should squash easily between your finger and thumb.\n4. Transfer hot strips to a container with a lid and close it. Let sit for 15 minutes — the steam loosens the skin.\n5. Peel off the skin from each strip. It should slide right off.\n6. Let cool to a safe temperature before serving.\n7. For babies 9+ months with a pincer grasp, cut into smaller fingernail-sized pieces instead.\n8. Do not serve raw bell pepper to babies under 12 months — it is a choking hazard when firm and raw.	2	5	10	{baby-food,first-foods,baby-led-weaning,gluten-free,vegan,breastfeeding-safe,pregnancy-safe}	manual	https://babyledbliss.com/wp-content/uploads/2023/08/bell-pepper-blw.jpg	\N	2026-03-26 12:34:24.796833-07	f	2097f77e-d172-482d-99d0-57604afc5900	baby-bell-pepper-strips	\N
a39da54e-23b7-4b37-8405-ddd001072728	Mango Smoothie With Almond Milk	A creamy, tropical Mango Smoothie made with frozen mango, almond milk, yogurt, and a banana. Blends up in under a minute for a refreshing breakfast or snack.	1. Gather all of the ingredients and place them in the Vitamix or your preferred blender. Blend on low then gradually increase to the highest speed. Blend for 45 seconds or until smooth.\n2. Pour in serving glass and enjoy.\n3. Compost: Banana peels can go in your Waste Cycler.	2	1	1	{mango,breakfast,probiotics,summer,gluten-free,breastfeeding-safe}	manual	/uploads/mango-smoothie.jpg	\N	2026-03-17 20:36:46.344481-07	f	2097f77e-d172-482d-99d0-57604afc5900	mango-smoothie-with-almond-milk	\N
babe1759-9be6-494f-a487-7253b11b845c	Caramel Milk	Sweeten things up with this delicious Caramel Milk. Only a few simple ingredients needed to create this nutty, sweet and creamy plant-based milk!	1. Fill the Almond Cow base to the MIN line (5 cups), with water.\n2. Place almonds and caramel sauce (working quickly) into the filter basket. Attach the filter basket to the top of the Almond Cow and twist in the direction of the close arrow to secure. Attach the top to the base.\n3. Plug in the Almond Cow and press the cow start button. It will run through 3 automatic stages. When the light stops flashing, your caramel milk is ready!	5	5	0	{milk,coffee,barista,gluten-free}	manual	//almondcow.co/cdn/shop/articles/caramel-milk_1100x.jpg?v=1757959612	\N	2026-03-16 20:31:50.070121-07	f	2097f77e-d172-482d-99d0-57604afc5900	caramel-milk	\N
ce12aaee-0e38-4ebf-8eaf-eb6fcc76362d	Easy Olive Garden Zuppa Toscana Soup	This&nbsp;Easy Olive Garden Zuppa Toscana Soup is a super quick and simple copycat recipe with rich, creamy flavor you can't resist!&nbsp;	1. In a large pot saute sausage 5-6 minutes until browned. Use a slotted spoon to transfer sausage to a plate and set aside.&nbsp;\n2. In the same pot, add butter and saute onions over medium heat until translucent. Add garlic and saute for another minute until fragrant.&nbsp;\n3. Add chicken broth, water, potatoes, salt, and pepper and bring to a boil. Boil until potatoes are tender. Stir in kale, and heavy cream. Add sausage. Taste and add salt and pepper if needed. Serve garnished with grated parmesan cheese and/or bacon if desired.\n4. Compost: Potato peels, onion skins, kale stems, and garlic skins can go in your Waste Cycler. Do not add sausage, cream, butter, or bacon.	2	10	30	{italian-soup,olive-garden,potato,sausage,fall,winter}	manual	https://www.lecremedelacrumb.com/wp-content/uploads/2019/03/easy-zuppa-toscano-soup-3.jpg	\N	2026-03-16 19:45:44.812679-07	f	2097f77e-d172-482d-99d0-57604afc5900	easy-olive-garden-zuppa-toscana-soup	\N
c31fc607-b195-4a8b-bd20-12315457dcb1	Instant Pot Ground Beef & Tomato Stew	A hearty and comforting beef and tomato stew made quickly in the Instant Pot. Simple, satisfying, and perfect for a weeknight family dinner.	1. Set the Instant Pot to Sauté mode and add 1 tablespoon of high heat olive oil.\n2. Once hot, add the ground beef and break it apart with a spoon. Season with Himalayan sea salt.\n3. Cook the beef until browned, about 5 minutes, then drain excess fat if needed.\n4. Dice the tomatoes and add them to the pot along with a sprig of fresh rosemary.\n5. Stir everything together and add a splash of water (about 1/4 cup) to deglaze the bottom of the pot.\n6. Cancel Sauté mode, secure the lid, and set the valve to Sealing.\n7. Pressure cook on High for 10 minutes.\n8. Once done, do a quick release of the pressure valve.\n9. Remove the rosemary sprig, taste and adjust salt as needed, then serve hot.\n10. Compost: Tomato cores and rosemary stems can go in your Waste Cycler. Do not add meat scraps or oil.	2	10	20	{dinner,beef,gluten-free,quick,savory,fall,winter}	ai-generated	/uploads/61b41062-3a0a-4c69-ab28-3e15952de0da.jpg	\N	2026-03-16 13:36:35.172608-07	f	2097f77e-d172-482d-99d0-57604afc5900	instant-pot-ground-beef-tomato-stew	\N
1672e7ba-e625-42fc-ba7f-0af9b9014621	Chocolate Chip Cookie Milk	Milk and cookies pair perfectly together so why not combine them to make Chocolate Chip Cookie Milk! Creamy, delicious, and tastes just like a chocolate chip cookie!	1. Add water to the MIN line of the Almond Cow base.\n2. Add almonds to the filter basket.\n3. Attach the filter basket to the top, and the top to the base.\n4. Press the cow, and when the light stops flashing, empty and rinse out the filter basket.\n5. Add chocolate chip cookies (and optional maple syrup) to the filter basket and run the machine for another cycle.\n6. When the light stops flashing, your chocolate chip cookie milk is ready!	4	10	\N	{drink}	url-import	//almondcow.co/cdn/shop/articles/chocolate-chip-cookie-milk_1100x.jpg?v=1757964603	\N	2026-03-16 20:54:41.992497-07	f	2097f77e-d172-482d-99d0-57604afc5900	chocolate-chip-cookie-milk	https://almondcow.co/blogs/milk-recipes/chocolate-chip-cookie-milk
3523ab6d-c94e-4750-9bc9-56d210ca5702	Strawberries and Cream Milkshake	A rich, creamy milkshake made with Strawberry and Cream ice cream and fresh homemade Almond Milk.	1. Make a batch of Almond Milk if you don't have some ready.\n2. Add 3 scoops of Strawberry and Cream ice cream to your Vitamix.\n3. Pour in 1 cup of Almond Milk.\n4. Blend on medium speed for 15-20 seconds until smooth and thick.\n5. Pour into a chilled glass. Top with a fresh strawberry if desired.\n6. Compost: Almond pulp from making Almond Milk can go in your Waste Cycler. Do not add dairy-based ice cream residue.	2	5	0	{milkshake,dessert,quick,local,sustainable}	manual	https://www.cookingclassy.com/wp-content/uploads/2024/05/strawberry-milkshake-4.jpg	2026-03-26 17:56:03.996792-07	2026-03-26 12:39:43.241672-07	f	2097f77e-d172-482d-99d0-57604afc5900	strawberries-and-cream-milkshake	\N
5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	Ube Soufflé Pancakes with Fresh Berries	A show-stopping brunch dish that combines the vibrant, subtly sweet flavor of Filipino ube (purple yam) with the airy, cloud-like texture of Japanese soufflé pancakes — all topped with a coconut cream drizzle and jewel-bright fresh berries.	1. Macerate the berries: Halve any strawberries, then gently toss all berries with honey and lemon juice. Set aside at room temperature while you prepare everything else.\n2. Make the coconut cream sauce: Whisk coconut cream, condensed milk, vanilla, and salt in a small bowl until smooth. Refrigerate until serving.\n3. Mix the batter base: In a large bowl, whisk egg yolks, ube halaya, milk, and vanilla until smooth and uniformly purple. Sift in the flour, baking powder, and salt. Stir until just combined.\n4. Whip the meringue: In a clean bowl, beat egg whites and cream of tartar with an electric mixer on medium speed until foamy. Gradually add sugar one tablespoon at a time, then increase speed to high and beat until stiff, glossy peaks form (about 3–4 minutes).\n5. Fold together: Scoop about one-third of the meringue into the ube batter and stir gently to lighten it. Then add the remaining meringue in two additions, folding carefully with a spatula until no white streaks remain. Work gently — the air in the meringue is what makes these soufflé pancakes rise.\n6. Cook low and slow: Heat a non-stick skillet or griddle over the lowest heat setting. Lightly oil or butter the surface. Using a large spoon or ice cream scoop, pile batter into tall mounds (about ⅓ cup each). Add 2 tablespoons of water to the pan and cover with a lid. Cook for 6–7 minutes until the bottoms are golden. Gently flip each pancake, add another splash of water, re-cover, and cook 5–6 minutes more.\n7. Plate and serve: Stack 2 pancakes per plate. Spoon macerated berries over the top, drizzle with coconut cream sauce, and finish with a light dusting of powdered sugar. Serve immediately — soufflé pancakes deflate as they cool.\n\nTips:\n- Ube halaya can be found in the frozen section of most Asian grocery stores (look for brands like Good Shepherd or Ube Queen). In a pinch, use ube powder (2 tbsp) reconstituted with a splash of coconut milk.\n- For a deeper purple color, add ½ teaspoon ube extract to the batter base.\n- Low heat is critical. These pancakes need time to cook through without burning. If your stove's lowest setting runs hot, use a heat diffuser.\n- Seasonal berry swaps: In winter, try thawed frozen berries or pomegranate seeds. In summer, add fresh mango or lychee alongside the berries.\n- The coconut cream sauce can be made a day ahead and refrigerated. Stir well before serving.	4	25	20	{brunch,pancakes,ube,Filipino,Japanese,vegetarian,berries}	manual	/uploads/5586cc2b-9a85-473c-a539-26af46aa944a.jpg	\N	2026-03-27 11:47:40.765109-07	f	2097f77e-d172-482d-99d0-57604afc5900	ube-souffl-pancakes-with-fresh-berries	\N
f2a439cc-0eb1-4989-a3be-93bbaf1c58c8	Two-Pan Chicken Fajitas	Sizzling chicken fajitas using both Titanium Always Pans: chicken thighs get a hard sear in one pan while peppers, onions, and spices cook down in the other. Combine at the end for maximum flavor without steaming the meat.	1. Slice chicken thighs into thin strips. Toss with half the fajita seasoning (chili powder, cumin, paprika, garlic powder, salt). Slice peppers and onion into strips.\n2. LARGE PAN: Heat oil over high heat until shimmering. Spread chicken strips in a single layer — don’t crowd. Sear without moving for 2–3 minutes until charred on one side. Flip and cook 2 more minutes. The large pan gives you room for proper browning.\n3. REGULAR PAN (start simultaneously): Heat oil over medium-high. Add sliced peppers and onion. Cook 6–8 minutes, tossing occasionally, until charred at the edges but still crisp. Season with remaining fajita spices and a squeeze of lime.\n4. Combine the chicken into the pepper pan or serve side by side.\n5. Warm tortillas directly on the large pan for 15–20 seconds per side.\n6. Serve with sour cream, guacamole, salsa, and lime wedges.\n7. Compost: Bell pepper cores and seeds, onion skins, and lime rinds can go in your Waste Cycler. Do not add chicken trimmings or oil.	4	15	15	{chicken,dinner,mexican,titanium,two-pan}	manual	/uploads/chicken-fajitas.jpg	\N	2026-03-17 23:00:15.632387-07	f	2097f77e-d172-482d-99d0-57604afc5900	two-pan-chicken-fajitas	\N
44ebf2b4-a456-4d37-8e3d-d88982c66714	Korean Chile-Braised Brisket	Tender brisket braised in a gochujang and gochugaru chile sauce with ginger and sesame, served with a bright kimchi-lime coleslaw.	1. Mix gochugaru, paprika, salt, and pepper. Rub onto brisket pieces. Refrigerate 1–24 hours.\n2. Set Instant Pot to Sauté. Sear brisket in batches until browned. Remove to a plate.\n3. Sauté onion 3–5 minutes. Add garlic and ginger, cook 1 minute.\n4. Return brisket. Whisk together beer, gochujang, ketchup, soy sauce, brown sugar, fish sauce, and sesame oil. Pour over beef.\n5. Close lid, seal valve. Pressure cook High for 90 minutes. Natural release 20 minutes, then vent.\n6. While brisket cooks, make coleslaw: toss cabbage with kimchi. Dress with olive oil, sesame oil, lime juice, and salt. Refrigerate.\n7. Transfer brisket to cutting board, tent with foil. Sauté braising liquid 15–20 minutes until reduced by half. Skim fat.\n8. Slice against the grain. Serve with reduced sauce and kimchi coleslaw.\n9. Compost: Onion skins, garlic skins, ginger peels, and cabbage cores can go in your Waste Cycler. Do not add meat trimmings, fat, or oil.	8	45	135	{beef,brisket,korean,asian,spicy,dinner}	url-import	/uploads/korean-brisket.jpg	\N	2026-03-17 22:39:52.170193-07	f	2097f77e-d172-482d-99d0-57604afc5900	korean-chile-braised-brisket	https://hummingbirdthyme.com/instant-pot-korean-brisket/
f0a11b10-0580-4702-8819-56e459992a8c	Smash Burger Recipe	It’s easy to make restaurant-style Smash Burgers at home. These cook quickly and it’s one of the tastiest ways to prepare a burger. You’ll love the double patty with melted cheese in between, and the sauce is a must-try!	1. Divide beef into 8 even portions, about 3 oz each. Loosely Roll them into balls then cover and refrigerate while preparing remaining ingredients (you can prep and refrigerate the balls of meat 1-2 days ahead). The meat must be cold when it hits the grill.\n2. Remove wilted leaves from lettuce to keep it crunchy then finely shred lettuce. Slice tomatoes, onions, and pickles.\n3. Butter and toast buns over medium heat until golden on the buttered side.\n4. Increase griddle to medium/high heat. Place 2-4 burger balls onto a hot griddle. Working quickly, place a square of parchment paper over the meat and use a burger press or spatula to firmly smash straight down into a thin patty.\n5. Once patties are smashed, peel back and discard parchment papers and season patties with salt, pepper and garlic powder. Add 1/2 teaspoon of burger sauce. Cook 2 minutes on the first side or until seared and juices start to come to the surface.\n6. Scrape under the burger with metal spatula facing down at a 45˚ angle to get under the caramelized part and flip. Cook another 1 minute. Top half of the patties with sliced cheese and cover cheese with the second patty. Repeat with remaining burgers and transfer them to a platter as they finish cooking.\n7. Place sauce on bottom of bun. Top with 3 pickle slices, shredded lettuce, 2 tomato slices and thin sliced onion. Add double patty and top with bun.\n8. Compost: Onion skins, tomato cores, and lettuce cores can go in your Waste Cycler. Do not add meat scraps, cheese, or dressing.	2	18	12	{smash-burger,burgers,american,dinner,summer}	manual	https://natashaskitchen.com/wp-content/uploads/2021/06/Smashed-Burgers-SQ.jpg	2026-03-24 20:11:10.985661-07	2026-03-16 09:42:06.888324-07	f	2097f77e-d172-482d-99d0-57604afc5900	smash-burger-recipe	\N
1d8fce90-83cc-40f5-9c53-156da6f146a6	Instant Pot Cube Steaks with Peppers and Onions	Quick and easy cube steaks cooked in the Instant Pot with peppers and onions, perfect for busy weeknights.	1. Thaw cube steaks and pat dry. Season with salt and pepper, then dredge lightly in flour.\n\n2. Set Instant Pot to sauté mode. Heat olive oil and brown steaks 2 minutes per side. Remove to plate.\n\n3. Slice bell pepper and red onion into strips. Mince garlic.\n\n4. Add vegetables to pot and sauté 3 minutes until softened.\n\n5. Add 1 cup water or broth, scraping up any browned bits.\n\n6. Return steaks to pot, layering over vegetables.\n\n7. Seal Instant Pot and cook on High Pressure for 15 minutes.\n\n8. Quick release pressure. Check that steaks are tender.\n\n9. Serve over rice, pasta, or with crusty bread.	4	10	15	{dinner,quick,pressure-cooker,one-pot}	ai-generated	/uploads/046b4b65-1386-4753-9876-d0912a54eeb1.jpg	\N	2026-03-30 20:09:00.931325-07	f	2097f77e-d172-482d-99d0-57604afc5900	instant-pot-cube-steaks-with-peppers-and-onions	https://www.pressurecookingtoday.com/instant-pot-cube-steak/
eaca8ab1-aab9-4819-a2fb-fce3adcbf543	Cherry Chocolate Milk	Create this decadent Cherry Chocolate Milk in moments with the Almond Cow. With just a few simple ingredients, you can have this rich, delicious milk to enjoy any time of day.	1. Fill the Milk Maker base to the MIN line (5 cups) with water.\n2. Place cherries, almonds, cocoa powder, and maple syrup in the filter basket. Attach the filter basket to the top of the Milk Maker and twist in the direction of the close arrow to secure. Attach the top to the base.\n3. Plug in the Milk Maker and press the cow start button. It will run through 3 automatic stages. When the light stops flashing, your Cherry Chocolate Milk is ready!	5	5	0	{milk,chocolate,gluten-free}	manual	//almondcow.co/cdn/shop/articles/cherry-chocolate-milk_1100x.jpg?v=1757964597	\N	2026-03-16 20:17:06.850142-07	f	2097f77e-d172-482d-99d0-57604afc5900	cherry-chocolate-milk	\N
434ebd11-a56d-4d36-87c1-eb56c25b13df	Keto Milk	This keto milk recipe contains an assortment of seeds and nuts, as well as chocolate collagen. It tastes delicious and is simple to make! Recipe by Thomas from @thomasdelauer	1. Place all ingredients in the filter basket. Attach the filter basket to the top of the Almond Cow and twist in the direction of the close arrow to secure.\n2. Fill the Almond Cow base to the MIN line (5 cups) with water, attach the top.\n3. Plug in the Almond Cow and press the cow start button.It will run through 3 automatic stages. When the light stops flashing, your milk is ready! Cheers!	5	5	0	{keto,milk,coffee,barista,gluten-free}	manual	//almondcow.co/cdn/shop/articles/keto-milk_1100x.jpg?v=1757962469	\N	2026-03-16 20:31:50.061162-07	f	2097f77e-d172-482d-99d0-57604afc5900	keto-milk	\N
6661a800-c71a-4c75-9df5-0352f8ed3ba4	Baby Banana Pancakes	A simple two-ingredient pancake perfect for babies and toddlers. No flour, no sugar, no dairy — just ripe banana and egg.	1. Peel the banana and mash thoroughly with a fork until smooth with no large lumps.\n2. Crack the egg into the bowl and whisk together with the mashed banana until well combined.\n3. Heat the Titanium Mini Always Pan® Pro over medium-low heat. No oil needed — the titanium surface releases cleanly.\n4. Pour small rounds (about 2 tablespoons each) of batter into the pan.\n5. Cook for 1–2 minutes until the edges look set and the bottom is lightly golden.\n6. Flip gently and cook 30–60 seconds more.\n7. Let cool slightly before serving. Cut into small pieces for babies under 12 months.	1	2	5	{baby-food,first-foods,breastfeeding-safe,egg,banana,quick}	manual	/uploads/96bfcd06-0923-4ca8-94ca-04cb2bc940cb.jpg	\N	2026-03-30 02:48:18.813331-07	f	2097f77e-d172-482d-99d0-57604afc5900	baby-banana-pancakes	\N
3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	Cucumber Mint Cooler	A refreshing chilled cucumber drink with fresh mint and a squeeze of lime. Light, hydrating, and perfect for hot days.	1. Wash and peel 1 large organic cucumber, then chop into chunks.\n2. Add cucumber chunks, 8-10 fresh mint leaves, juice of 1 lime, 2 cups cold water, and 1 tablespoon honey to a blender.\n3. Blend on high until smooth, about 30 seconds.\n4. Strain through a fine mesh sieve into a pitcher, pressing solids to extract all liquid.\n5. Taste and adjust sweetness or lime.\n6. Serve over ice, garnished with a cucumber slice and mint sprig.	2	10	0	{drink,no-cook,gluten-free,vegan,summer,healthy,breastfeeding-safe,pregnancy-safe}	manual	https://www.mygingergarlickitchen.com/wp-content/uploads/2022/06/cucumber-cooler-6.jpg	\N	2026-03-26 11:14:36.507695-07	f	2097f77e-d172-482d-99d0-57604afc5900	cucumber-mint-cooler	\N
9f91647a-c339-4cab-b351-58ed2283adac	Griddle Smash Burgers with Giardiniera	Juicy smash burgers on brioche buns topped with melted pepper jack cheese, tangy giardiniera pickled vegetables, and a drizzle of Japanese barbecue sauce. Quick, satisfying, and full of flavor.	1. Preheat the Propane Griddle 36" on high heat for 5 minutes.\n2. Divide ground beef into 4 equal loosely packed balls, about 3-4 oz each.\n3. Brush the griddle surface lightly with high heat olive oil.\n4. Place beef balls on the hot griddle and immediately smash flat with a spatula or burger press. Season generously with Himalayan sea salt.\n5. Cook for 2-3 minutes until edges are deeply browned and crispy.\n6. Flip each patty and immediately top with a slice of pepper jack cheese. Cook another 1-2 minutes.\n7. While patties cook, lightly butter the brioche buns with salted butter and toast them on the griddle for 1-2 minutes until golden.\n8. Assemble burgers: bottom bun, patty with melted cheese, a spoonful of giardiniera pickled vegetables, a drizzle of Japanese barbecue sauce, then top bun.\n9. Serve immediately.\n10. Compost: Onion skins can go in your Waste Cycler. Do not add meat scraps, cheese, butter, or oil.	4	10	15	{dinner,burgers,griddle,quick,family,summer}	ai-generated	https://cookswithsoul.com/wp-content/uploads/2022/09/blackstone-smashed-burger-7-scaled.jpg	\N	2026-03-16 22:02:04.457686-07	f	2097f77e-d172-482d-99d0-57604afc5900	griddle-smash-burgers-with-giardiniera	\N
95fa3787-920c-44bd-8e74-6ab31cc8fb5c	Date, Almond & Blueberry Energy Bites	No-bake energy bites packed with pitted dates, almonds, and fresh blueberries. A naturally sweet and nutritious snack the whole family will love. The Almond Cow blending cup makes quick work of processing the dates and nuts.	1. Place the pitted dates and almonds into the Almond Cow strainer cup or a bowl and soak in warm water for 10 minutes to soften, then drain.\n2. Transfer the soaked dates and almonds to a food processor or use the Almond Cow grinding attachment to pulse into a rough, sticky dough.\n3. Add vanilla extract and a pinch of Himalayan sea salt to the mixture and pulse a few more times to combine.\n4. Fold in the blueberries by hand gently so they don't fully break apart.\n5. Sprinkle coconut shreds onto a flat plate.\n6. Roll the mixture into small balls about 1 inch in diameter using your hands.\n7. Roll each ball in the coconut shreds to coat the outside.\n8. Place the bites on a parchment-lined tray and refrigerate for at least 30 minutes to firm up before serving.\n9. Compost: Coconut shell scraps can go in your Waste Cycler. Do not add date pits (large pits not accepted).	2	20	0	{snack,no-bake,gluten-free,healthy,sweet,vegan,lactation,breastfeeding-safe}	ai-generated	/uploads/e7a1b827-a6db-45ba-b49c-e5908ceee7a9.jpg	\N	2026-03-16 13:36:35.17258-07	f	2097f77e-d172-482d-99d0-57604afc5900	date-almond-blueberry-energy-bites	\N
497e7a07-a568-45fa-852b-80863f672e4a	Skillet-to-Oven Croissant Breakfast Sandwich	Flaky slow rise croissants stuffed with seared breakfast sausage, soft scrambled eggs, and melty Tillamook cheddar. Start with a quick sear in a cast iron skillet on the stovetop, then transfer the whole skillet into the electric pizza oven to toast the croissants and melt the cheese. Ready in 15 minutes.	1. Preheat the electric pizza oven to 375°F (190°C).\n\n2. Place the cast iron skillet on the stovetop over medium-high heat. Add the breakfast sausage patties and sear for 2–3 minutes per side until browned and cooked through. Remove and set aside.\n\n3. Place the Titanium Always Pan® Pro on the stovetop over medium heat and let it preheat for 1 minute. Add a drizzle of olive oil. Crack the eggs into a bowl, season with salt and pepper, and whisk lightly. Pour into the pan and drop in 3 thin slices of butter. Using a wooden spoon or titanium spatula, gently fold the eggs — 30 seconds on the heat stirring, then lift the pan off the heat for 30 seconds while continuing to fold. Repeat until the curds are soft and just barely set. Remove from heat while still slightly wet — they’ll finish in the oven.\n\n4. Slice the croissants in half. Place the bottom halves cut-side up in the cast iron skillet. Layer on the sausage patties, a scoop of scrambled eggs, and a slice of Tillamook cheddar on each. Place the croissant tops alongside.\n\n5. Transfer the cast iron skillet into the pizza oven. Bake for 3–4 minutes until the cheese is melted and bubbly and the croissant tops are lightly toasted.\n\n6. Pull the skillet out (use a towel — the handle is hot!). Cap the sandwiches with the toasted tops and serve immediately.\n\nCompost: Eggshells and any sausage packaging paper can go in the Waste Cycler.	2	5	12	{breakfast,sandwich,cast-iron,pizza-oven,quick,weekend}	manual	/uploads/991d8a3d-33be-4245-9f6f-7ac47ab3f4da.jpg	\N	2026-03-28 08:21:53.669985-07	f	2097f77e-d172-482d-99d0-57604afc5900	skillet-to-oven-croissant-breakfast-sandwich	\N
17cab84f-48c5-4dd7-9849-1a0e1ee0ddf1	Cannabis-Infused Coconut Oil	A slow-decarbed, Instant Pot-infused coconut oil for use in edibles. Start low, go slow. Store in a cool, dark place.	1. Decarboxylate (Activate): Add cannabis to the LĒVO II+ Power Pod herb basket. Select the Activate cycle at 240 °F for 30 minutes. The LĒVO’s precise temperature control ensures even decarboxylation without burning.\n\n2. Add oil: Pour coconut oil into the LĒVO II+ ceramic reservoir up to the fill line.\n\n3. Infuse: Place the Power Pod with the activated cannabis back into the reservoir. Select the Infuse cycle at 160 °F for 2–4 hours. The gentle agitation ensures thorough, consistent extraction.\n\n4. Drain: When the cycle completes, use the LĒVO’s built-in drain mechanism to dispense the infused oil directly into a storage jar. The Power Pod automatically filters out all plant material — no cheesecloth needed.\n\n5. Store in the refrigerator for up to 2 months. Label clearly: CONTAINS CANNABIS.\n\nNOTES\n\nThe LĒVO II+ handles both decarboxylation and infusion in one device with no mess or odor. No need for an oven, mason jar, or Instant Pot.\n\nFor a stronger infusion, increase infuse time to 4 hours. For a milder result, reduce to 1–2 hours.\n\nAlways start with a small amount when cooking with infused oil — effects take 45–90 minutes to onset.	48	15	240	{adult-only,420,infusion,base-ingredient,gluten-free,breastfeeding-alert}	manual	https://images.getrecipekit.com/v1625869448_how-infuse-coconut-oil-levo_b1mo45.jpg?width=650&quality=90&auto_optimize=medium	\N	2026-03-17 23:23:12.728632-07	f	2097f77e-d172-482d-99d0-57604afc5900	cannabis-infused-coconut-oil	\N
78a9862e-f35e-41aa-bc48-a70db4ef3286	Two-Pan Chicken Piccata with Garlic Spinach	Classic lemon-caper chicken piccata in one pan, garlicky wilted spinach in the other. Both finish in 20 minutes and hit the plate together, hot and fresh.	1. Slice chicken breasts horizontally into thin cutlets. Season with salt and pepper, dredge in flour.\n2. LARGE PAN: Heat olive oil and 1 tbsp butter over medium-high. Sear cutlets 3 minutes per side until golden. Remove to a plate.\n3. LARGE PAN: Deglaze with white wine, scraping up fond. Add chicken broth, lemon juice, and capers. Simmer 5 minutes until slightly reduced. Swirl in 2 tbsp cold butter. Return chicken to the sauce and spoon it over.\n4. REGULAR PAN (start while chicken sears): Heat olive oil over medium. Add sliced garlic and red pepper flakes, cook 30 seconds until fragrant.\n5. REGULAR PAN: Add spinach in handfuls, tossing with tongs as it wilts. Season with salt and a squeeze of lemon. Total cook time about 3–4 minutes.\n6. Plate the chicken over the garlic spinach, spoon the lemon-caper sauce over everything, and garnish with fresh parsley.\n7. Compost: Lemon rinds, parsley stems, and spinach stems can go in your Waste Cycler. Do not add chicken trimmings, butter, or oil.	4	10	20	{chicken,dinner,italian,titanium,two-pan,quick}	manual	/uploads/chicken-piccata.jpg	\N	2026-03-17 23:00:36.123583-07	f	2097f77e-d172-482d-99d0-57604afc5900	two-pan-chicken-piccata-with-garlic-spinach	\N
b47b4db5-216c-4f3e-bee9-25ff6cef0a51	Spring Pea Instant Pot Risotto	This Spring Pea Instant Pot Risotto is super easy to make – it’s rich and creamy with spring peas, asparagus and fresh parmesan cheese!	1. Add butter, shallots, garlic, broth, and rice to the Instant Pot, in that order. Place lid on Instant Pot and make sure the valve is set to seal.\n2. Press the pressure cook button and set to high, then cook for 3 minutes. Instant Pot will take about 10-20 minutes to come to pressure, then pressure cook for 3 minutes.\n3. Do a quick release of the pressure by flicking the switch at the top with a spoon, then open lid when pressure gauge has dropped and lid opens easily.\n4. Stir in parmesan cheese, lemon zest, peas and asparagus then replace lid and let sit on the "Keep Warm" setting for 5-10 minutes.\n5. Serve and enjoy!\n6. Compost: Shallot skins, garlic skins, asparagus ends, and lemon zest scraps can go in your Waste Cycler. Do not add butter or cheese residue.	2	15	15	{main-course,gluten-free}	manual	https://eatinginstantly.com/wp-content/uploads/2019/02/Instant-Pot-Risotto-11.jpg	\N	2026-03-17 15:57:34.144914-07	f	2097f77e-d172-482d-99d0-57604afc5900	spring-pea-instant-pot-risotto	\N
6ccdee31-b87d-424d-a6ff-9ba2f7e352fc	Coconut Creamer	Only a few simple ingredients are needed to make this creamy, delicious Coconut Creamer. Slightly sweetened with maple syrup if you choose, this creamer pairs beautifully with your morning cup o' joe.	1. Place coconut shreds and optional maple syrup in the filter basket. Attach the filter basket to the top of the Almond Cow and twist in the direction of the close arrow to secure.\n2. Add warm water (around 115F) to the 500mL line in the collector cup. Add the sea salt (optional) to the water. Place collector cup inside the Almond Cow base (no other water is added to the machine). Attach the top.\n3. Plug in the Almond Cow and press the cow start button. It will run through 3 automatic stages. When the light stops flashing, your milk is ready!	2	5	0	{coffee,creamer,gluten-free}	manual	//almondcow.co/cdn/shop/articles/coconut-creamer_1100x.jpg?v=1757952706	\N	2026-03-16 21:15:53.48532-07	f	2097f77e-d172-482d-99d0-57604afc5900	coconut-creamer	\N
402c389f-38c3-4ba0-99b2-36d42cdc9992	Holiday Braised Brisket with Onions and Carrots	A savory, aromatic braised brisket with tomatoes, onions, carrots, garlic, brown sugar, and a touch of vinegar. A classic Ashkenazi Jewish holiday dish that gets better overnight.	1. Preheat oven to 300°F. Pat brisket dry, season generously with salt and pepper.\n2. Heat 2 tbsp olive oil in a large skillet over medium-high heat. Sear brisket until deep golden brown, about 4–5 minutes per side. Set aside.\n3. In a blender, combine canned tomatoes, garlic cloves, brown sugar, vinegar, 1.5 cups broth, salt, and pepper. Blend until combined.\n4. Heat remaining olive oil. Sauté sliced onions until softened, about 5 minutes.\n5. Add carrots and celery, sauté 5–6 minutes until fragrant.\n6. Deglaze with 0.5 cup broth, scraping up browned bits.\n7. Pour half the tomato mixture into a large roasting pan.\n8. Place brisket fat-side up on top of the sauce.\n9. Spoon vegetables and pan juices over and around brisket.\n10. Pour remaining sauce over top. Cover tightly with parchment, then foil.\n11. Roast undisturbed 5–7 hours (about 1 hour per pound) until fork-tender.\n12. Rest 20–30 minutes. Slice against the grain and serve with sauce and vegetables.\n13. Compost: Onion skins, carrot peels, celery ends, and garlic skins can go in your Waste Cycler. Do not add meat trimmings, fat, or oil.	12	45	420	{beef,brisket,braised,jewish,holiday,fall,winter,gluten-free}	url-import	/uploads/braised-brisket.jpg	\N	2026-03-17 22:39:04.02785-07	f	2097f77e-d172-482d-99d0-57604afc5900	holiday-braised-brisket-with-onions-and-carrots	https://toriavey.com/holiday-brisket/
4ecc4a91-2784-4b84-a664-78eda0134c78	Cold Brew Chai Milk	Enjoy a glass of this flavorful, refreshing Cold Brew Chai Milk. Your favorite loose leaf chai tea combined with milk-making ingredients (we used almonds) creates a delightful milk right in your Almond Cow! Serving Size: 4	1. Place loose leaf chai tea into the filter basket. Attach filter basket to the top of the Almond Cow and twist in the direction of the close arrow to secure.\n2. Fill the Almond Cow base to the MIN line (5 cups) with water. Add 3 cups of ice.\n3. Attach the top and let sit for 12 hours. DO NOT RUN MACHINE!\n4. Once chai tea is ready, remove Almond Cow top and twist open filter basket. Empty and rinse filter basket.\n5. Keep the chai tea in the base. Place 1 cup of almonds (or milk-making ingredients of choice) in the filter basket. Attach the filter basket to the top of the Almond Cow.\n6. Plug in the Almond Cow and press the cow start button. It will run through 3 automatic stages. When the light stops flashing, your cold brew chai milk is ready!	1	5	\N	{coffee,barista,chai,fall,gluten-free,breastfeeding-alert}	url-import	//almondcow.co/cdn/shop/articles/cold-brew-chai-milk_1100x.jpg?v=1757959920	\N	2026-03-16 20:51:05.336115-07	f	2097f77e-d172-482d-99d0-57604afc5900	cold-brew-chai-milk	https://almondcow.co/blogs/milk-recipes/cold-brew-chai-milk
693024ba-9b16-493e-ae91-4abeacd7344f	Purple Sweet Potato Juice	Unlock the vibrant benefits of purple sweet potatoes — antioxidant-rich and naturally sweet.	1. Wash all produce thoroughly.\n2. Core apples if desired.\n3. Cut sweet potatoes into pieces that fit the juicer.\n4. Feed apples, purple sweet potatoes, and beets through the slow juicer.\n5. Stir and serve immediately.\n6. Compost: Apple cores, sweet potato peels, and beet trimmings can go in your Waste Cycler.	3	10	0	{juice,cold-press,healthy,gluten-free,vegan,breastfeeding-safe}	url-import	https://www.kuvingsusa.com/cdn/shop/articles/Purple_Sweet_Potato_600x600_Email_e4e466c8-0678-43cb-a151-d36c2b2a105d.jpg?v=1768423988&width=1024	\N	2026-03-19 10:06:13.726623-07	f	2097f77e-d172-482d-99d0-57604afc5900	purple-sweet-potato-juice	https://www.kuvingsusa.com/blogs/recipes/purple-sweet-potato-juice
ac395333-a4dd-4c47-8aec-982159004f66	Almond Milk	Fresh homemade almond milk from the Almond Cow — creamy, preservative-free, and ready in minutes.	1. Place all ingredients in the filter basket. Attach the filter basket to the top of the Almond Cow and twist in the direction of the close arrow to secure.\n2. Fill the Almond Cow base to the MIN line (5 cups) with water, attach the top.\n3.Plug in the Almond Cow and press the cow start button! It will run through 3 automatic stages.\n4. When the green light stops flashing, your milk is ready!	8	\N	\N	{daily,breakfast,smoothies,shakes,mixology,gluten-free,lactation,breastfeeding-safe}	manual	https://almondcow.co/cdn/shop/files/new-jug-with-milk_600x600.jpg?v=1765305426	\N	2026-03-16 20:05:18.620539-07	f	2097f77e-d172-482d-99d0-57604afc5900	almond-milk	\N
9a633436-c166-4bd4-9a38-9d7363d99fd4	Camp David Spaghetti with Italian Sausage	Heart burn, with love.	1. Gather all ingredients.\n2. Slice sausages lengthwise, leaving links attached along one side; lay flat in a large skillet. Cook over medium heat until browned and cooked through, 5 minutes, flipping once. Transfer to a plate; set aside.\n3. Add ground beef, onion, garlic, and olive oil to the same skillet over medium heat; cook and stir until onion is translucent and beef is browned and crumbly, about 10 minutes. Drain all but 2 tablespoons drippings from the skillet.\n4. Stir in tomato sauce, tomatoes, oregano, salt, basil, bay leaf, and black pepper; simmer, uncovered, over low heat until flavors have blended, about 1 hour, stirring occasionally. Remove and discard bay leaf.\n5. Preheat the oven to 350 degrees F (175 degrees C). Bring a large pot of lightly salted water to a boil. Cook spaghetti in the boiling water, stirring occasionally, until tender yet firm to the bite, 8 to 10 minutes. Drain.\n6. Stir spaghetti into sauce.\n7. Divide spaghetti and sauce among individual oven-safe baking dishes or plates; top each with a cooked half sausage and sprinkle with Parmesan cheese.\n8. Bake in the preheated oven until cheese is melted and begins to brown, 5 to 10 minutes.\n9. Compost: Onion skins, garlic skins, and oregano stems can go in your Waste Cycler. Do not add meat scraps or sausage casings.	2	\N	\N	{italian,sausage,fall,winter,main-course}	manual	https://www.allrecipes.com/thmb/S0cN0zI2npU0FReEquZDnkqLSWg=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/148543-camp-david-spaghetti-with-italian-sausage-VAT-016-step-04-a7c88eef089342f6a47cf9e8093cd5f8.jpg	2026-03-17 15:55:00.522376-07	2026-03-16 21:31:30.385867-07	f	2097f77e-d172-482d-99d0-57604afc5900	camp-david-spaghetti-with-italian-sausage	\N
80d9033b-d275-4687-9219-c9802918bb7e	Pacific Northwest Charcuterie Board	A wine country charcuterie board built around Oregon’s best: Tillamook cheddar, Rogue Creamery blue cheese, Oregon hazelnuts, Marionberry jam, and local honey. Pairs perfectly with a Willamette Valley Pinot Noir.	1. Pull cheeses from the fridge 30–45 minutes before serving so they come to room temperature.\n2. Place small bowls of Marionberry jam, whole grain mustard, and local honey on the board first — these anchor the layout.\n3. Slice the Tillamook sharp cheddar into thin rectangles. Break the Rogue Creamery blue into rough wedges. Leave the brie round intact with a wedge cut out.\n4. Fan the cured meats in loose folds between the cheeses — soppressata rosettes, prosciutto ribbons, and salami half-moons.\n5. Fill gaps with Oregon hazelnuts, dried cranberries, sliced Bosc pear, and cornichons.\n6. Tuck crackers and baguette slices along the edges.\n7. Garnish with fresh rosemary sprigs and a drizzle of honey over the blue cheese.\n8. Serve alongside a glass of Willamette Valley Pinot Noir.	6	15	0	{charcuterie,appetizer,wine,pacific-northwest,no-cook,entertaining,breastfeeding-alert}	manual	/uploads/charcuterie-board.jpg	\N	2026-03-17 21:16:44.717334-07	f	2097f77e-d172-482d-99d0-57604afc5900	pacific-northwest-charcuterie-board	\N
6201fab6-7993-4370-943a-21d930204e07	Country Fried Cube Steak with White Gravy	Classic Southern comfort food with tender cube steaks breaded and fried to golden perfection, served with creamy white pepper gravy.	1. Remove cube steaks from freezer and thaw completely. Pat dry and season both sides with salt and pepper.\n\n2. Set up breading station: In one shallow dish, whisk eggs. In another, combine 1.5 cups flour, paprika, garlic powder, salt, and pepper.\n\n3. Heat 2 tbsp butter in your Cast Iron Skillet over medium-high heat.\n\n4. Dredge each steak in flour mixture, then egg, then flour again. Press coating to adhere.\n\n5. Fry steaks 3-4 minutes per side until golden brown and cooked through. Remove to plate.\n\n6. For gravy: Add remaining 2 tbsp butter to skillet. Whisk in remaining 1/2 cup flour. Cook 1 minute, then gradually whisk in 2 cups milk. Season with salt and pepper. Simmer until thickened.\n\n7. Serve steaks topped with gravy alongside mashed potatoes or biscuits.	4	15	20	{dinner,comfort-food,southern,hearty}	ai-generated	/uploads/823717d5-17fe-4d8e-9ba7-b050c72b94fe.jpg	\N	2026-03-30 20:09:00.897193-07	f	2097f77e-d172-482d-99d0-57604afc5900	country-fried-cube-steak-with-white-gravy-2	https://www.southernliving.com/recipes/country-fried-steak
c6255b5f-6f20-4dc5-b4c4-ca0b300a57b7	Golden Mango Juice	Tropical flavors with a boost of vitamin C for supporting the immune system.	1. Peel and pit mango.\n2. Peel oranges.\n3. Cut pineapple into pieces.\n4. Feed mango, oranges, and pineapple through the slow juicer.\n5. Stir and serve immediately.\n6. Compost: Mango peels, orange peels, and pineapple core can go in your Waste Cycler. Do not add the mango pit.	2	10	0	{juice,cold-press,healthy,gluten-free,vegan,tropical,summer,breastfeeding-safe}	url-import	https://www.kuvingsusa.com/cdn/shop/articles/Golden_Mango_SQ.png?v=1768423342&width=1024	\N	2026-03-19 10:06:13.739855-07	f	2097f77e-d172-482d-99d0-57604afc5900	golden-mango-juice	https://www.kuvingsusa.com/blogs/recipes/golden-mango-juice
7dd0efcd-7f9e-4805-a85d-ad044b8801b5	Carrot Grapefruit Juice	Packed with vitamin C, beta-carotene, and antioxidants — supports immunity, skin health, and digestion.	1. Wash carrots and ginger.\n2. Cut grapefruits in half and peel.\n3. Feed carrots, grapefruit, and ginger through the slow juicer.\n4. Stir and serve immediately.\n5. Compost: Carrot peels, grapefruit rinds, and ginger peels can go in your Waste Cycler.	3	10	0	{juice,cold-press,healthy,gluten-free,vegan,citrus}	url-import	https://www.kuvingsusa.com/cdn/shop/articles/kuvings-recipe-carrot-grapefruit-juice_88bfed76-e597-476e-8c1a-b50773b44c1c.jpg?v=1768424056&width=1024	\N	2026-03-19 10:06:13.714521-07	f	2097f77e-d172-482d-99d0-57604afc5900	carrot-grapefruit-juice	https://www.kuvingsusa.com/blogs/recipes/carrot-grapefruit-juice
ab7a2b1a-add7-4a55-b10a-bb9c4648be58	Papaya Parasite Cleanse Juice	Anti-parasitic, high-fiber juice to support gut health. Papaya seeds should be consumed whole rather than juiced.	1. Wash all produce thoroughly.\n2. Cut papaya in half, scoop out seeds and set aside.\n3. Feed papaya flesh, pineapple, carrots, and ginger through the slow juicer.\n4. Pour juice into a glass and stir in 1 tablespoon of whole papaya seeds.\n5. Serve immediately.\n6. Compost: Papaya peels, pineapple core, carrot peels, and ginger peels can go in your Waste Cycler. Do not add papaya seeds or large pits.	2	10	0	{juice,cold-press,healthy,gluten-free,vegan,cleanse}	url-import	https://www.kuvingsusa.com/cdn/shop/articles/kuvings-recipe-parasite-cleanse-juice_c965d344-a0a8-4bac-950c-5190ae8fc6ee.jpg?v=1768424627&width=1024	\N	2026-03-19 10:06:13.663689-07	f	2097f77e-d172-482d-99d0-57604afc5900	papaya-parasite-cleanse-juice	https://www.kuvingsusa.com/blogs/recipes/papaya-parasite-cleanse-juice
646dfcb3-0121-4cdc-8280-de7783178f28	Blueberry Chia Seed Jam	Super easy and healthy Blueberry jam made in Instant pot	1. Add the blueberries to the Instant pot. Add lemon juice and lemon zest and maple syrup and stir it once.\n2. Pressure cook for 5 minutes in Manual/Pressure cook mode, vent in sealing position. Once the timer is done, let the pressure release naturally.\n3. Mash the cooked blueberries gently with a potato masher and stir in the Chia seeds. Let the jam sit in the instant pot till it cools down completely and thickens. Transfer to an airtight container and store in the refrigerator.\n4. Compost: Lemon rinds can go in your Waste Cycler.	1	5	5	{breakfast,preserves,canning,gluten-free,breastfeeding-safe}	manual	https://blissfulbitesbytay.com/wp-content/uploads/2021/07/Blueberry-Jam-720x720.jpg	\N	2026-03-16 21:24:50.87998-07	f	2097f77e-d172-482d-99d0-57604afc5900	blueberry-chia-seed-jam	\N
daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	Dirty Chai Latte	A warming dirty chai latte made with strong brewed coffee from the Ninja and homemade almond milk. All the spiced chai flavor with a coffee kick, no espresso machine needed.	1. Steep 2 chai tea bags in 1 cup of boiling water for 5 minutes. Remove bags and squeeze out excess liquid.\n2. While tea steeps, brew a small batch of strong coffee using the Ninja Coffee Brewer on the Rich setting.\n3. Heat almond milk in a small saucepan or microwave until steaming.\n4. Combine chai tea and coffee in a mug.\n5. Add honey and stir to dissolve.\n6. Pour in warm almond milk. Dust with cinnamon and serve.\n7. Compost: Used tea bags and coffee grounds can go in your Waste Cycler.	1	2	5	{coffee,chai,tea,breakfast,mixology,gluten-free,breastfeeding-alert}	manual	/uploads/dirty-chai.jpg	\N	2026-03-17 20:59:00.947891-07	f	2097f77e-d172-482d-99d0-57604afc5900	dirty-chai-latte	\N
a522f13a-f5b0-457b-b397-91c70f4d11da	Cinnamon Rolls	Warm, gooey cinnamon rolls made easy — start with frozen unfrosted rolls from your local bakery, thaw them quickly in the microwave, then top with homemade icing.	1. Place 2 frozen unfrosted cinnamon rolls on a microwave-safe plate, spaced apart.\n2. Cover loosely with a damp paper towel to keep them moist.\n3. Microwave on 50% power for 60 seconds. Flip the rolls and microwave on 50% power for another 60 seconds.\n4. Check that the centers are soft and warmed through. If still cold in the middle, microwave in 15-second bursts at 50% power until thawed and warm.\n5. While the rolls thaw, prepare the Cinnamon Roll Icing (see companion recipe).\n6. Drizzle or spread the icing generously over the warm rolls. Serve immediately.	2	5	5	{quick,breakfast,slow-rise,local}	manual	https://www.allrecipes.com/thmb/ipJekwk-rzURn9Q06_CkTRC7upA=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/229276-easy-cinnamon-rolls-DDMFS-4x3-a225ddff4e7948e9b239557f14a9c05b.jpg	\N	2026-03-20 06:29:52.245781-07	f	2097f77e-d172-482d-99d0-57604afc5900	cinnamon-rolls	\N
384ec3bb-7128-40f0-98d1-719f7c15d544	Lemon Asparagus Pasta (Instant Pot & Stovetop)	Get all the flavors of spring in a bowl with this Lemon Asparagus Pasta. Make it in the Instant Pot in just 30 minutes, and the result will be a creamy bowl of pasta, filled with fresh greens! It contains peas, asparagus, and a splash of lemon juice, creating a symphony of tangy and savory flavors. Try this delicious, vegetarian, one-pot meal tonight!	1. (Optional) If the asparagus* you are using is thick, then saute it in 2 tablespoon olive oil in the instant pot or in a pan on stovetop for 5-8 minutes until it is tender. Take out and set aside.\n2. Heat the instant pot in sauté mode and add 1 tablespoon olive oil.\n3. Add onions and garlic, and sauté for a couple of minutes.\n4. Add the dried basil, thyme, broth and deglaze the pot making sure nothing is stuck to the bottom.\n5. Add the penne pasta and stir well. Make sure all the penne is covered in broth. Close lid with vent in sealing position.\n6. Pressure Cook the pasta on high pressure for 5 minutes. The general rule of thumb is to pressure cook pasta for 1 minute less than half the time on the pasta box.\n7. When the instant pot beeps, quick release the pressure manually.\n8. Add the asparagus* and green peas. Then stir in the cream and parmesan. Keep stirring until the cheese is incorporated well into the pasta.\n9. Cover the instant pot with a lid and let it sit for 5-7 minutes.\n10. Add lemon juice. Adjust salt and pepper to taste.\n11. Garnish with parmesan and red chili flakes (if using) before serving.\n12. Cook the pasta according to package directions. Reserve one cup of cooking water, and then drain the pasta.\n13. Heat a large skillet on medium-high heat and add olive oil. Then add the onions and garlic, and sauté for a few minutes.\n14. Add the asparagus and green peas. Season with salt and pepper. Cook for 3 minutes until the asparagus is slightly tender.\n15. Add the cooked pasta to the pan along with cream, parmesan, basil, thyme, and lemon juice. Add 1/2 cup of the reserved pasta water.\n16. Toss to mix them all together. Add more pasta water if needed. Lemon Asparagus Pasta is ready to be enjoyed!\n17. Compost: Asparagus woody ends, onion skins, garlic skins, and lemon rinds can go in your Waste Cycler. Do not add cream or cheese residue.	2	5	25	{spring,instant-pot,main-course}	manual	https://pipingpotcurry.com/wp-content/uploads/2020/06/Instant-Pot-Spring-Pasta-with-Lemon-Asparagus-Piping-Pot-Curry.jpg	2026-03-17 19:24:48.990769-07	2026-03-17 15:57:34.163676-07	f	2097f77e-d172-482d-99d0-57604afc5900	lemon-asparagus-pasta-instant-pot-stovetop	\N
f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	Blueberry Smoothie With Almond Milk	This Blueberry Smoothie With Almond Milk makes an easy breakfast or snack for adults and children. Easily make this Vitamix Blueberry Smoothie Recipe with fresh or frozen berries, yogurt, almond milk, flax seeds, and banana. A fun and healthy way to start the day!	1. Gather all of the ingredients and place them in the Vitamix or your preferred blender. Blend on low then gradually increase to the highest speed. Blend for 45 seconds or until smooth.\n2. Pour in serving glass and enjoy.\n3. Compost: Banana peels can go in your Waste Cycler.	2	1	1	{blueberry,breakfast,probiotics,gluten-free,breastfeeding-safe}	url-import	https://www.savorythoughts.com/wp-content/uploads/2019/04/Blueberry-Smoothie-Recipe.jpg	\N	2026-03-16 22:09:16.111202-07	f	2097f77e-d172-482d-99d0-57604afc5900	blueberry-smoothie-with-almond-milk	https://www.savorythoughts.com/healthy-blueberry-smoothie-almond-milk/
be7b35fd-c70d-4c8a-adfc-6d25fe255187	Tuna Avocado Melt on Focaccia	A hearty open-faced tuna melt with creamy avocado and melted mozzarella on toasted focaccia, finished with a drizzle of garden herb ranch and a kick of sriracha.	1. Preheat the Titanium Always Pan® Pro over medium heat on the.\n2. Open and drain 2 cans of albacore wild tuna and place into a mixing bowl.\n3. Slice the avocado in half, remove the pit, and scoop the flesh into the bowl with the tuna.\n4. Add a pinch of Himalayan sea salt and mix the tuna and avocado together until combined.\n5. Slice the focaccia bread into 2 large serving portions.\n6. Drizzle a small amount of high heat olive oil onto the pan and toast the focaccia slices cut-side down for 2-3 minutes until golden.\n7. Remove focaccia from the pan and place on a baking surface.\n8. Spoon the tuna avocado mixture generously over each focaccia slice.\n9. Tear or slice mozzarella cheese and layer it over the tuna mixture on each slice.\n10. Place the topped focaccia slices into the pizza oven and cook for 4-5 minutes until the cheese is melted and bubbly.\n11. Remove from the pizza oven and drizzle with garden herb ranch dressing and a squeeze of sriracha chili sauce to taste.\n12. Serve immediately and enjoy.\n13. Compost: Avocado skins can go in your Waste Cycler. Do not add tuna, cheese, dressing, or oil. Do not add the avocado pit (large pits not accepted).	2	10	10	{lunch,seafood,quick,family-friendly}	ai-generated	https://dizzybusyandhungry.com/wp-content/uploads/2020/06/avocado-tuna-melt-feature.jpg	\N	2026-03-24 12:48:43.503343-07	f	2097f77e-d172-482d-99d0-57604afc5900	tuna-avocado-melt-on-focaccia	\N
569487a8-197f-4776-92c3-102e86203c8b	Blueberry Yogurt Parfait	Fresh blueberries, creamy vanilla yogurt and crunchy granola settle into loving layers in this wonderfully satisfying blueberry yogurt parfait recipe!	1. Set aside 1 glass jar or cup.\n2. Spoon 1/3 cup yogurt into the bottom of the jar, creating an even, smooth layer.\n3. Sprinkle blueberries over the yogurt, creating a single or double layer, depending on the size of your jar.\n4. Optionally, sprinkle granulated monkfruit or sweetener of choice over the berries. Add more to sweeten tart fruit, less if the fruit is already very sweet or you like your parfait on the less sweet side.\n5. Pour 1 tablespoon of your favorite granola over the sweetened fruit layer. I like baking up a fresh batch of low calorie granola or gluten free granola for my blueberry parfaits.\n6. Repeat this sequence twice more. Serve and enjoy!\n7. ★ Last Step: If you made this recipe, leave a comment and review. It truly helps our small business keep running and it helps readers like you!	2	5	\N	{blueberry,yogurt,parfait,breakfast,snack,vegetarian,breastfeeding-safe}	url-import	https://beamingbaker.com/wp-content/uploads/2022/07/IGT-blueberry-yogurt-parfait-blueberry-parfait-5.jpg	\N	2026-03-16 21:45:07.839396-07	f	2097f77e-d172-482d-99d0-57604afc5900	blueberry-yogurt-parfait	https://beamingbaker.com/blueberry-yogurt-parfait/
98708958-7ead-4d57-aa3a-405a78688786	ABC Juice	A staple juice combining fruits and vegetables without any strong flavors — apple, beet, and carrot.	1. Wash all produce thoroughly.\n2. Core apples if desired.\n3. Feed apples, beets, and carrots through the slow juicer.\n4. Stir and serve immediately.\n5. Compost: Carrot peels, beet trimmings, and apple cores can go in your Waste Cycler.	2	5	0	{juice,cold-press,healthy,gluten-free,vegan,quick,breastfeeding-safe}	url-import	https://www.kuvingsusa.com/cdn/shop/articles/kuvings-recipe-abc-juice_520x500_520x500_de7603d9-16b5-4a05-ae02-525022ec3360.png?v=1768424262&width=1024	\N	2026-03-19 10:06:13.702962-07	f	2097f77e-d172-482d-99d0-57604afc5900	abc-juice	https://www.kuvingsusa.com/blogs/recipes/abc-juice
50bfe51d-e065-4cf2-858b-75d432023f51	Glowing Skin Green Juice	A nutrient-rich green juice designed to support skin health from within.	1. Wash all produce thoroughly.\n2. Core apples if desired.\n3. Peel lemon.\n4. Feed apples, cucumbers, dandelion greens, spinach, and lemon through the slow juicer.\n5. Stir and serve immediately.\n6. Compost: Apple cores, cucumber ends, spinach stems, and lemon rinds can go in your Waste Cycler.	4	10	0	{juice,cold-press,healthy,gluten-free,vegan,green-juice,breastfeeding-safe}	url-import	https://www.kuvingsusa.com/cdn/shop/articles/kuvings-recipe-glowing-skin-green-juice.png?v=1768424604&width=1024	\N	2026-03-19 10:06:13.687085-07	f	2097f77e-d172-482d-99d0-57604afc5900	glowing-skin-green-juice	https://www.kuvingsusa.com/blogs/recipes/glowing-skin-green-juice
350fa316-fd7b-4c31-84c7-18a2966cc4da	Smoked Salmon Bagel	Quick and easy to make this cream cheese and smoked salmon bagel is the perfect brunch recipe. Full of fresh flavors, every bite is delicious!	1. In a small bowl, combine the cream cheese, lemon juice, fresh dill and salt and pepper, to taste.\n2. Toast the bagels, then spread the cream cheese mixture on both sides of the bagel. Add the cucumbers, smoked salmon, capers and red onions on the bottom of the toasted bagels. Top with the top of the bagels.\n3. Compost: Cucumber peels, dill stems, lemon rinds, and onion skins can go in your Waste Cycler. Do not add salmon scraps or cream cheese.	2	10	\N	{breakfast,brunch,main-course,pacific-northwest,no-cook}	url-import	https://feelgoodfoodie.net/wp-content/uploads/2021/03/smoked-salmon-bagel-13.jpg	\N	2026-03-16 22:11:38.94539-07	f	2097f77e-d172-482d-99d0-57604afc5900	smoked-salmon-bagel	https://feelgoodfoodie.net/recipe/smoked-salmon-bagel/
86d2c1bb-5cb6-49fa-887d-89d0482a6f1d	Slow-Cooked Pinto Bean and Ground Beef Chili	A hearty, warming chili made with ground beef, pinto beans, crushed tomatoes, and a kick of sriracha and Mexican hot sauce, slow-cooked to deep, rich flavor.	1. Heat the Titanium Large Always Pan® Pro over medium-high heat with 1 tablespoon of high-heat olive oil.\n2. Add the ground beef and break it apart, cooking until browned, about 5-7 minutes. Season with Himalayan sea salt.\n3. Transfer the browned beef into the Instant Pot.\n4. Drain and rinse both cans of pinto beans and add them to the Instant Pot.\n5. Add the crushed tomatoes in rice puree to the Instant Pot.\n6. Add 1 tablespoon of sriracha and 1 tablespoon of Mexican hot sauce and stir everything together.\n7. Secure the Instant Pot lid and set to Pressure Cook on High for 20 minutes.\n8. Allow a natural pressure release for 10 minutes, then carefully quick-release any remaining pressure.\n9. Stir the chili and taste, adjusting salt and hot sauce as desired.\n10. Ladle into bowls and top with queso fresco crumbles and serve with focaccia or on its own.\n11. Compost: Onion skins and garlic skins can go in your Waste Cycler. Do not add meat scraps or oil.	4	10	35	{dinner,comfort-food,hearty,family-friendly,gluten-free}	ai-generated	https://crinkledcookbook.com/wp-content/uploads/2023/11/f-1-pinto-bean-chili.jpg	\N	2026-03-24 12:52:13.101013-07	f	2097f77e-d172-482d-99d0-57604afc5900	slow-cooked-pinto-bean-and-ground-beef-chili	\N
ba77d39d-3f2d-4b07-9ba5-2bd57598ff0a	Raspberry Smoothie With Almond Milk	A bright, tangy Raspberry Smoothie made with frozen raspberries, homemade almond milk, yogurt, and a banana. Blends up in under a minute for a refreshing breakfast or snack.	1. Gather all of the ingredients and place them in the Vitamix or your preferred blender. Blend on low then gradually increase to the highest speed. Blend for 45 seconds or until smooth.\n2. Pour in serving glass and enjoy.\n3. Compost: Banana peels can go in your Waste Cycler.	2	1	1	{raspberry,breakfast,probiotics,gluten-free,breastfeeding-safe}	manual	/uploads/raspberry-smoothie.jpg	\N	2026-03-17 21:23:00.08104-07	f	2097f77e-d172-482d-99d0-57604afc5900	raspberry-smoothie-with-almond-milk	\N
ebc24be6-f7dc-4cb9-86da-9f55e26aa5c6	Pastrami Reuben on English Muffin	A reuben-inspired sandwich with pastrami, sauerkraut, and pepper jack on a crispy english muffin.	1. Butter the outside of both english muffin halves.\n2. Layer pastrami, sauerkraut, and pepper jack cheese on one half.\n3. Close the sandwich and grill in a pan over medium heat, pressing down with a spatula.\n4. Cook 2-3 minutes per side until golden and cheese is melted.\n5. Spread mustard dill sauce on the inside before serving.\n6. Compost: English muffin crumbs and sauerkraut juice can go in your Waste Cycler. Do not add meat, cheese, or butter.	2	5	8	{lunch,sandwich,reuben}	manual	https://www.gimmesomeoven.com/wp-content/uploads/2012/12/Breakfast-Reuben-H-560x373.jpg	\N	2026-03-24 15:44:02.973218-07	f	2097f77e-d172-482d-99d0-57604afc5900	pastrami-reuben-on-english-muffin	\N
7e594bdd-6831-49a5-804d-fab6975df7ef	Pastrami & Cheddar Melt on English Muffin	A quick, satisfying lunch sandwich with deli pastrami and melty cheddar on a toasted english muffin.	1. Split and toast the english muffin under the broiler until golden.\n2. Layer pastrami slices on each muffin half.\n3. Top with cheddar slices.\n4. Broil 1-2 minutes until cheese is melted and bubbly.\n5. Drizzle with mustard dill sauce. Serve open-faced or sandwiched.\n6. Compost: English muffin crumbs can go in your Waste Cycler. Do not add meat or cheese scraps.	2	5	5	{lunch,sandwich,quick}	manual	https://raymonds.recipes/wp-content/uploads/2019/01/DSC_0050-2048x1264.jpg	\N	2026-03-24 15:43:47.3594-07	f	2097f77e-d172-482d-99d0-57604afc5900	pastrami-cheddar-melt-on-english-muffin	\N
70163822-a1e6-4a76-b21d-d231639e3424	Dragon Fruit Sorbet	This nice cream looks too pretty to eat — dragon fruit paired with banana is a sweet duo you won't want to miss.	1. Peel and freeze dragon fruits and bananas ahead of time (at least 4 hours).\n2. Feed frozen dragon fruit and frozen bananas through the slow juicer using the sorbet strainer.\n3. Scoop into bowls and serve immediately.\n4. Compost: Dragon fruit skins and banana peels can go in your Waste Cycler.	3	10	0	{dessert,cold-press,healthy,gluten-free,vegan,no-cook,summer}	url-import	https://www.kuvingsusa.com/cdn/shop/articles/Dragon_Fruit_Sorbet_SQ.png?v=1768423370&width=1024	\N	2026-03-19 10:06:13.750531-07	f	2097f77e-d172-482d-99d0-57604afc5900	dragon-fruit-sorbet	https://www.kuvingsusa.com/blogs/recipes/dragon-fruit-sorbet
93671294-7ce7-4386-b44e-e6489f654c69	420 Double Chocolate Cookies	Rich, fudgy double chocolate cookies made with cannabis-infused coconut oil. Each cookie contains approximately 5–10 mg THC depending on your infusion strength. Start with one and wait 90 minutes before having another.	1. Preheat oven to 350 °F. Line two baking sheets with parchment paper.\n2. Melt the cannabis-infused coconut oil gently in a small saucepan or microwave. Do not overheat — high temperatures degrade THC.\n3. In a large bowl, whisk together the melted infused coconut oil, sugar, brown sugar, eggs, and vanilla until smooth.\n4. In a separate bowl, whisk together the flour, cocoa powder, baking soda, and salt.\n5. Fold the dry ingredients into the wet until just combined. Fold in the chocolate chips.\n6. Scoop 1.5 tablespoon portions onto the prepared baking sheets, spacing 2 inches apart.\n7. Bake 10–12 minutes until the edges are set but the centers still look slightly underdone. They’ll firm up as they cool.\n8. Cool on the baking sheet for 5 minutes, then transfer to a wire rack.\n9. IMPORTANT: Label clearly. Store separately from regular baked goods. Keep away from children and pets.\n\nDOSING NOTE\nWith 7 g flower infused into 1 cup oil, and 0.25 cup oil across 24 cookies, each cookie contains roughly 5–10 mg THC (varies by strain potency). Always start low and wait at least 90 minutes before consuming more.\n10. Compost: Eggshells can go in your Waste Cycler. Do not add butter or oil.	24	15	12	{adult-only,420,dessert,chocolate,cookies,pot,breastfeeding-alert}	manual	/uploads/420-cookies.jpg	\N	2026-03-17 23:23:56.72386-07	f	2097f77e-d172-482d-99d0-57604afc5900	420-double-chocolate-cookies	\N
617c87e7-a799-483c-8570-b9ec3d9b0517	CocoCash™ Milk	Need a new go-to milk? Look no further, our CocoCash™ Milk is a real treat. Our shredded coconut combined with the rich, creamy goodness of cashews makes for the most delightful blend. Having a nut milk maker like the Almond Cow allows you to make delicious plant based milk from your own home, while controlling ingredients and taste. Read more in our cashew milk and almond milk recipes.	1. Place all ingredients in the filter basket. Attach the filter basket to the top of the Almond Cow and twist in the direction of the close arrow to secure.\n2. Fill the Almond Cow base to the MIN line (5 cups) with water, attach the top.\n3. Plug in the Almond Cow and press the cow start button. It will run through 3 automatic stages. When the light stops flashing, your milk is ready!	5	5	\N	{milk,coffee,gluten-free}	manual	//almondcow.co/cdn/shop/articles/cashew-coconut-milk_0ed11b2b-9ce9-4706-88cd-f62f0a556f83_1100x.jpg?v=1760462863	2026-03-24 17:07:28.800201-07	2026-03-16 12:05:37.128469-07	f	2097f77e-d172-482d-99d0-57604afc5900	cococash-milk	\N
4b49372d-beb1-4006-8918-acec20387015	Orange Juice	The vitamin C and antioxidants in oranges are well-known to boost immunity. Oranges are also great for your skin.	1. Peel oranges, removing the bitter white pith.\n2. Feed orange segments through the slow juicer.\n3. Stir and serve immediately.\n4. Compost: Orange peels and pulp can go in your Waste Cycler.	2	5	0	{juice,cold-press,healthy,gluten-free,vegan,citrus,quick,breakfast,breastfeeding-safe}	url-import	https://www.kuvingsusa.com/cdn/shop/articles/kuvings-recipe-orange-juice.png?v=1768505239&width=1024	\N	2026-03-19 10:09:31.497383-07	f	2097f77e-d172-482d-99d0-57604afc5900	orange-juice	https://www.kuvingsusa.com/blogs/recipes/orange-juice
748747fb-7ca8-4ba3-9f64-a549f009744d	Raspberry Chia Seed Jam	Super easy and healthy Raspberry jam made in Instant pot	1. Add the raspberries to the Instant pot. Add lemon juice and lemon zest and maple syrup and stir it once.\n2. Pressure cook for 5 minutes in Manual/Pressure cook mode, vent in sealing position. Once the timer is done, let the pressure release naturally.\n3. Mash the cooked raspberries gently with a potato masher and stir in the Chia seeds. Let the jam sit in the instant pot till it cools down completely and thickens. Transfer to an airtight container and store in the refrigerator.\n4. Compost: Lemon rinds can go in your Waste Cycler.	1	5	5	{breakfast,preserves,canning,gluten-free,breastfeeding-safe}	manual	/uploads/e7b3e358-91a5-4365-a53a-21e3ab239870.jpg	\N	2026-03-27 16:17:17.674116-07	f	2097f77e-d172-482d-99d0-57604afc5900	raspberry-chia-seed-jam	\N
564bbcda-c033-472e-b45b-0cc6b331f943	Authentic Neapolitan Pizza (VPN-Approved)	A classic Neapolitan dough with a long ambient ferment for deep flavor, open crumb, and a pillowy cornicione. Yields ~10 dough balls for 10″ pizzas.	1. Dissolve salt in water: Dissolve 1.1 ounces fine sea salt fully in 23.2 ounces cool water (60–65 °F) until no grains remain visible.\n\n2. Make the barrier slurry: Add 100–150 g of the 35.7 ounces Caputo 00 flour to the salted water and mix briefly to form a loose slurry. This ‘salt barrier’ prevents direct yeast-salt contact.\n\n3. Add yeast: Sprinkle 0.1 ounces Caputo Lievito Secco (dry yeast) over the slurry and mix for ~10 seconds to disperse. Use 2.0 g if your kitchen is closer to 70 °F; 2.3 g if closer to 68 °F or cooler overnight.\n\n4. Incorporate remaining flour: Add the remaining 35.7 ounces Caputo 00 flour in 2–3 additions on KitchenAid speed 1 until a shaggy dough forms.\n\n5. Knead: Increase to speed 2 and knead for 7–8 minutes, until the dough is smooth, elastic, cleans the bowl, and is slightly tacky but not sticky. Target finished dough temp: 75–77 °F.\n\n6. Rest, then finish kneading: Rest the dough uncovered for 5 minutes, then knead one final minute on speed 2.\n\n7. Bulk ferment (~15–16 hours): Cover and ferment at 68–70 °F for 15–16 hours, until the dough has nearly doubled (90–100% rise).\n\n8. Divide and ball: Divide the dough into 10 pieces at 180 g each. Shape each piece into a tight, smooth ball using a rolling-fold technique. Seal the seam firmly underneath.\n\n9. Final proof (7–8 hours): Place dough balls seam-side down in a covered container or proofing tray. Proof at 68–70 °F for 7–8 hours. If room temp exceeds ~72 °F, refrigerate balls for 20–30 minutes as a fermentation brake. Do not reball during this window.\n\n10. Readiness check: Dough balls are ready when they are slightly flattened and relaxed, feel soft and tacky, show a slow halfway rebound on the finger poke test, and stretch easily with no snap-back. Flat balls are normal at peak readiness.\n\n11. Preheat the Ooni: Turn the Ooni electric to max and preheat for 20–25 minutes. The stone needs to fully saturate with heat. Target 750 °F — the Ooni’s built-in thermometer will confirm. If baking multiple pies, allow 3–5 minutes between launches for the stone to recover.\n\n12. Launch and bake: Dust the peel generously with semola rimacinata. Stretch the dough by hand (no rolling pin), top quickly, and launch onto the stone. Bake 60–90 seconds, using the peel to rotate the pizza 180° halfway through. The Ooni’s rear element runs hotter, so the back of the pizza chars faster — rotate to even out the leopard spotting.\n\nNOTES\n\nYeast guidance: 2.0 g → room closer to 70 °F or warmer; 2.3 g → room closer to 68 °F or cooler overnight temps.\n\nDusting: Always use semola rimacinata (not 00 flour) for launching — it rolls under the dough and won’t burn as quickly.\n\nFermentation brake: If ambient temp creeps above 72 °F during the final proof, refrigerate the balled dough for 20–30 minutes to slow things down. Don’t reball after this point.\n\nBaker’s percentages: Water 65% · Salt 3% · Yeast 0.20–0.23% — a solid baseline for Neapolitan at 68–70 °F ambient.\n\nOoni electric tips: The electric model heats more evenly than gas/wood but the rear element is still the hottest zone. Keep the door closed during bake for consistent heat. Between pies, close the door and wait for the stone temp to recover — launching on a cold stone means a soggy bottom.\n13. Compost: Excess flour and dough scraps can go in your Waste Cycler.	10	\N	\N	{pizza,dough,neapolitan,fermentation}	manual	https://i.imgur.com/RWYXP9e.jpeg	\N	2026-03-16 14:23:15.233462-07	f	2097f77e-d172-482d-99d0-57604afc5900	authentic-neapolitan-pizza-vpn-approved	\N
bfc958ed-a479-4e70-a06a-632859a67ba2	Two-Pan Chicken Marsala	A restaurant-quality chicken marsala using both Titanium Always Pans simultaneously: sear the chicken in the large pan while the mushroom-marsala sauce reduces in the regular pan. Everything finishes at the same time.	1. Slice chicken breasts in half horizontally to create thin cutlets. Season with salt and pepper, then dredge lightly in flour, shaking off excess.\n2. LARGE PAN: Heat olive oil and 1 tbsp butter over medium-high. Sear chicken cutlets 3–4 minutes per side until golden and cooked through. Work in a single layer — the large pan fits all four cutlets. Transfer to a plate and tent with foil.\n3. REGULAR PAN (start simultaneously): Heat 1 tbsp butter over medium. Add sliced mushrooms and cook 5–6 minutes until golden. Add minced garlic and shallot, cook 1 minute.\n4. REGULAR PAN: Pour in marsala wine and chicken broth. Simmer 8–10 minutes until reduced by half.\n5. REGULAR PAN: Stir in remaining 2 tbsp cold butter, lemon juice, and capers. Season with salt and pepper.\n6. Pour the marsala sauce over the chicken cutlets. Garnish with fresh parsley and serve immediately.\n7. Compost: Mushroom stems, shallot skins, parsley stems, and lemon rinds can go in your Waste Cycler. Do not add chicken trimmings, butter, or oil.	4	10	20	{chicken,dinner,italian,titanium,two-pan}	manual	/uploads/chicken-marsala.jpg	\N	2026-03-17 22:59:50.058102-07	f	2097f77e-d172-482d-99d0-57604afc5900	two-pan-chicken-marsala	\N
a01888a1-eea4-40c1-adfd-26ad07288d05	BBQ Instant Pot Brisket	Buttery tender, juicy BBQ brisket with a smoky-spicy dry rub and homemade barbecue sauce, pressure cooked in about 75 minutes.	1. Mix dry rub: brown sugar, chili powder, black pepper, onion powder, garlic powder, cinnamon, salt, cumin, fennel, and cayenne. Rub all over brisket with a few drops of liquid smoke. Wrap and marinate at least 2 hours, preferably overnight.\n2. Add sliced onion, garlic, maple syrup, honey, apple cider vinegar, liquid smoke, and chicken stock to the Instant Pot.\n3. Place brisket on top. Close lid, set valve to sealing.\n4. Pressure cook on High for 75 minutes. Natural release 15 minutes, then vent remaining pressure.\n5. Remove brisket to cutting board, tent with foil.\n6. Set Instant Pot to Sauté. Mix in ketchup, Dijon mustard, and brown sugar. Simmer 8–15 minutes until thickened.\n7. Brush BBQ sauce over brisket. Optionally broil 2–3 minutes to caramelize.\n8. Slice against the grain and serve with extra sauce.\n9. Compost: Onion skins and garlic skins can go in your Waste Cycler. Do not add meat trimmings or fat.	4	20	90	{bbq,beef,brisket,dinner,gluten-free,sustainable}	url-import	/uploads/bbq-brisket.jpg	\N	2026-03-17 22:38:42.251041-07	f	2097f77e-d172-482d-99d0-57604afc5900	bbq-instant-pot-brisket	https://www.pressurecookrecipes.com/instant-pot-brisket/
ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	Ridiculously Easy Sheet Pan Chicken with Veggies	This no-fuss, flavor-packed dinner comes together in no time. You'll love this Ridiculously Easy Sheet Pan Chicken with Veggies because of the juicy, seasoned chicken, perfectly roasted veggies, and a zesty lemon finish. Everything cooks on a single sheet pan for minimal cleanup, perfect for busy weeknights.	1. Preheat the oven to 425 degrees. If your oven runs hot, do 400 degrees. In a large bowl whisk together the olive oil, salt, pepper, garlic powder, onion powder, oregano and lemon zest. Set aside. \n2. Line a baking sheet with parchment paper and add the potatoes, onion and bell pepper. Toss with a little of the dressing (just enough to coat the veggies), spread evenly on the sheet pan and roast for 20 minutes. \n3. Add the broccoli, chicken and garlic to the large bowl with the remaining dressing. Toss until well coated. Remove the sheet pan after 20 minutes and add the coated chicken and broccoli to the pan in one even layer.\n4. Put back in the oven and roast for 20 more minutes until chicken is cooked through and veggies are golden. Finish with fresh lemon juice and serve on its own or over rice, quinoa or pasta.\n5. Compost: Potato peels, onion skins, pepper cores, broccoli stems, lemon rinds, and garlic skins can go in your Waste Cycler. Do not add chicken trimmings or oil.	2	10	40	{dinner,gluten-free}	manual	/uploads/sheet-pan-chicken.jpg	\N	2026-03-17 20:07:58.769426-07	f	2097f77e-d172-482d-99d0-57604afc5900	ridiculously-easy-sheet-pan-chicken-with-veggies	\N
e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	Blackstone Cottage Cheese Pancakes	Extra fluffy, protein-packed pancakes made with Caputo 00 flour, cottage cheese, and sour cream on the Blackstone griddle. The 00 flour gives them a tender, almost crepe-like interior while the cottage cheese adds richness and protein.	1. Preheat the Blackstone griddle to 350°F (medium-low). The surface is ready when a few drops of water dance and sizzle but don’t evaporate instantly — too hot and the outside burns before the inside cooks.\n2. In a large bowl, whisk together the Caputo 00 flour, sugar, baking powder, baking soda, and salt.\n3. In a separate bowl, blend the cottage cheese with an immersion blender or fork until mostly smooth (small curds are fine). Whisk in the eggs, sour cream, milk, melted butter, and vanilla.\n4. Pour the wet ingredients into the dry and fold gently until just combined. A few lumps are good — overmixing 00 flour makes the pancakes tough. Let the batter rest 5 minutes.\n5. Oil the griddle surface lightly with butter or a neutral oil. Pour ¼ cup batter per pancake.\n6. Cook until bubbles form on the surface and the edges look set, about 2–3 minutes. Flip and cook another 1–2 minutes until golden brown.\n7. Serve immediately with maple syrup, fresh berries, or a dollop of sour cream.\n8. Compost: Eggshells can go in your Waste Cycler. Do not add cottage cheese, sour cream, butter, or milk.	4	10	15	{breakfast,pancakes,griddle,protein}	manual	/uploads/blackstone-pancakes.jpg	\N	2026-03-17 22:48:36.318466-07	f	2097f77e-d172-482d-99d0-57604afc5900	blackstone-cottage-cheese-pancakes	\N
10288612-86f9-4856-90da-79057817d759	Croissant w/ Raspberry Jam	A simple brunch appetizer pairing a fresh slow-rise croissant with homemade raspberry chia seed jam. Best served warm.	1. Warm the croissant in a 300°F oven for 3–5 minutes until lightly crisp.\n2. Split the croissant along the side.\n3. Spoon a generous amount of Raspberry Chia Seed Jam onto the bottom half.\n4. Close and serve immediately.	1	2	5	{brunch,appetizer,pastry,quick}	manual	/uploads/9bdd8827-af7a-4b40-9dd4-5d16759fb668.png	\N	2026-03-27 16:36:02.929492-07	f	2097f77e-d172-482d-99d0-57604afc5900	croissant-raspberry-jam	\N
4fcfff0f-56aa-4bf6-a84b-8d701f796671	Baby Asparagus Purée with Breast Milk	A mild, earthy green purée introducing asparagus to babies 6+ months. Steamed tender in the Grownsy and blended with breast milk for a smooth, familiar finish.	1. Wash 6-8 asparagus spears and snap off the woody ends. Cut into 1-inch pieces.\n2. Add asparagus pieces and 1/4 cup water to the Grownsy Baby Food Maker steam basket.\n3. Steam for 12-15 minutes until asparagus is completely tender.\n4. Transfer steamed asparagus to the blending cup.\n5. Add 2-3 tablespoons of breast milk.\n6. Blend until smooth. Asparagus can be fibrous — blend longer for a silkier result.\n7. For extra smoothness, push through a fine mesh sieve.\n8. Let cool to a safe temperature before serving.\n9. Freeze leftovers in ice cube trays for up to 1 month.	4	5	15	{baby-food,first-foods,gluten-free,breastfeeding-safe,pregnancy-safe}	manual	https://babyfoode.com/wp-content/uploads/2023/11/asparagus-for-baby-puree-and-baby-led-weaning.png	\N	2026-03-26 11:15:19.887503-07	f	2097f77e-d172-482d-99d0-57604afc5900	baby-asparagus-pure-with-breast-milk	\N
adba5b7a-2289-49d1-9877-b591b0ae5728	Instant Pot Beef Bourguignon	Pull out your pressure cooker and whip up this quick and easy Instant Pot Beef Bourguignon and enjoy savory fall-apart tender beef chunks and veggies.&nbsp;If Ina Garten and Julia Child created a beef bourguignon together - this would be it!	1. Set instant pot to SAUTE. Drizzle with oil and sear bacon 3-4 minutes until cooked through. Use a slotted spoon to transfer to a paper towel lined plate and set aside.&nbsp;\n2. Add beef to pot and sear 3-4 minutes, using tongs to rotate periodically to brown all sides.&nbsp;\n3. Add red wine to the pot, scrape any brown bits off the bottom and sides of the pot and into the liquid. Simmer and reduce for about 5 minutes. Gradually add beef broth, tomato sauce, and boullion. Gradually whisk in flour.\n4. Stir in bacon, carrots, onions, garlic, thyme, potatoes, mushrooms, salt and pepper. Cover and set to PRESSURE COOK or MANUAL (high pressure). Set to 45 minutes. \n5. Do a natural release for 10 minutes (do nothing, just allow to depressurize during this time) then switch valve to VENT and do a quick release. Once float valve drops, remove lid. Set to SAUTE again and allow to thicken for 5-10 minutes.&nbsp;\n6. &nbsp;Give it a good stir and taste before adding salt and pepper if needed and garnishing with chopped parsley.&nbsp;\n7. Compost: Onion skins, carrot peels, mushroom stems, and parsley stems can go in your Waste Cycler. Do not add meat trimmings, bacon fat, or oil.	2	15	45	{fall,winter}	manual	https://www.lecremedelacrumb.com/wp-content/uploads/2019/01/instant-pot-beef-bourguignon-1.jpg	\N	2026-03-16 21:28:45.740135-07	f	2097f77e-d172-482d-99d0-57604afc5900	instant-pot-beef-bourguignon	\N
adabc033-1481-4af1-91d5-fe59df7da495	Instant Pot Carrot Ginger Soup	This Instant Pot Carrot Ginger Soup is a quick and easy vegan soup recipe made with creamy coconut milk that's super nutritious!	1. Add everything except for chives to Instant Pot in the order in which they are listed. Place lid on Instant Pot and make sure the valve is set to seal.\n2. Press the pressure cook button and set to high, then cook for 3 minutes. Instant Pot will take about 10-20 minutes to come to pressure, then pressure cook for 3 minutes.\n3. Do a quick release of the pressure by flicking the switch at the top with a spoon, then open lid when pressure gauge has dropped and lid opens easily.\n4. Puree mixture with an immersion blender, then serve among bowls with chives or parsley as garnish. Serve and enjoy!\n5. Compost: Carrot peels, onion skins, ginger peels, and chive trimmings can go in your Waste Cycler. Do not add coconut milk residue.	2	15	15	{instant-pot,soup,vegan,gluten-free}	manual	https://eatinginstantly.com/wp-content/uploads/2019/03/Instant-Pot-Carrot-Ginger-Soup-13.jpg	2026-03-17 19:02:51.53574-07	2026-03-17 15:57:34.17311-07	f	2097f77e-d172-482d-99d0-57604afc5900	instant-pot-carrot-ginger-soup	\N
a2fd26aa-5e71-402b-91c7-d6ee01062ab9	Peaches and Cream Milkshake	A rich, creamy milkshake made with Peaches and Cream ice cream and fresh homemade Almond Milk.	1. Make a batch of Almond Milk if you don't have some ready.\n2. Add 3 scoops of Peaches and Cream ice cream to your Vitamix.\n3. Pour in 1 cup of Almond Milk.\n4. Blend on medium speed for 15-20 seconds until smooth and thick.\n5. Pour into a chilled glass. Top with a pinch of cinnamon if desired.\n6. Compost: Almond pulp from making Almond Milk can go in your Waste Cycler. Do not add dairy-based ice cream residue.	2	5	0	{milkshake,dessert,quick,local,sustainable}	manual	https://domesticallyblissful.com/wp-content/uploads/2015/07/Peaches-Cream-Milkshake.png	2026-03-24 20:26:56.859283-07	2026-03-24 18:25:50.038521-07	f	2097f77e-d172-482d-99d0-57604afc5900	peaches-and-cream-milkshake	\N
3449a857-00b1-4ddb-a648-1cebd4d7056e	Beginner Chickpea & Veggie Curry	A forgiving, one-pot Indian curry perfect for absolute beginners. Uses everyday pantry staples and whatever vegetables you have on hand. Works in the Instant Pot (15 min pressure cook) or on the stovetop in your Always Pan (25 min simmer).	1. Prep all your vegetables: dice the onion and bell pepper, grate the ginger, mince the garlic, slice the carrots into coins, and cut broccoli into bite-sized florets. Drain and rinse the chickpeas.\n\n2. INSTANT POT: Set to Sauté mode. Add olive oil and let it heat for 1 minute. STOVETOP: Heat olive oil in your Always Pan over medium heat.\n\n3. Add the diced onion and cook for 3–4 minutes until soft and translucent. Slightly golden is fine too.\n\n4. Add the garlic and grated ginger. Stir for 30 seconds until fragrant. This is the flavor base of the whole dish.\n\n5. Add curry powder, cumin, turmeric, and chili powder (if using). Stir into the onion mixture for 1 minute. The spices should smell toasty and coat everything. If it sticks, add a splash of water.\n\n6. Pour in the crushed tomatoes and coconut milk. Stir well, scraping up any bits from the bottom.\n\n7. Add the chickpeas, carrots, bell pepper, and broccoli. Stir to combine.\n\n8. INSTANT POT: Cancel Sauté. Lock the lid, set the valve to Sealing, and Pressure Cook on High for 3 minutes. Let it Natural Release for 10 minutes, then Quick Release any remaining pressure. STOVETOP: Bring to a gentle boil, then reduce heat to low. Cover and simmer for 20–25 minutes until the carrots are tender.\n\n9. Stir in the butter and a squeeze of lemon juice. Taste and add salt as needed.\n\n10. Serve over rice or with naan. Top with chopped cashews.\n\nCompost: Onion skins, garlic skins, ginger peels, broccoli stems, carrot tops, bell pepper core and seeds, chickpea can label, and lemon rinds can all go in the Waste Cycler.	4	10	30	{indian,curry,beginner,one-pot,instant-pot,vegetarian,weeknight}	manual	/uploads/084997ca-0693-40bb-8348-9fc739f37142.jpg	\N	2026-03-27 22:46:00.970742-07	f	2097f77e-d172-482d-99d0-57604afc5900	beginner-chickpea-veggie-curry	\N
d5263db2-71c1-4435-b373-41e3b0e0c5ae	Almond Creamer	Enjoy this simple but delicious Almond Creamer made in moments with your Almond Cow. Pairs perfectly with your morning coffee or tea!	1. Place almonds and optional dates (or maple syrup) in the filter basket. Attach the filter basket to the top of the Almond Cow and twist in the direction of the close arrow to secure.\n2. Add water to the 500mL line in the collector cup. Add the sea salt (optional) to the water. Place collector cup inside the Almond Cow base (no other water is added to the machine). Attach the top.\n3. Plug in the Almond Cow and press the cow start button. It will run through 3 automatic stages. When the light stops flashing, your almond creamer is ready!	4	5	0	{drink,gluten-free,lactation}	manual	//almondcow.co/cdn/shop/articles/almond_creamer_8eda633e-bd48-4511-992d-cb04e98be447_1100x.jpg?v=1742337148	\N	2026-03-16 21:15:53.458322-07	f	2097f77e-d172-482d-99d0-57604afc5900	almond-creamer	\N
a1f05bba-01d0-4ac6-be1a-233aae393c03	Jo Mama's World Famous Spaghetti	My kids will give up a steak dinner for this spaghetti. It is a recipe I have been perfecting for years and it is so good (if I may humbly say) that my kids are disappointed when they eat spaghetti anywhere else but home! In fact they tell me I should open a restaurant and serve only this spaghetti and garlic bread. In response to requests, I have posted the recipe for Recipe #28559 that uses approximately 1/2 of the sauce from this \r\nrecipe. Have spaghetti one night and lasagna later!  Thanks to all of you who have tried my recipe and have written a review.  I read and appreciate every one of them!  Chef Note:  After I posted this recipe I remembered a funny incident--my dear husband usually has a nice bottle of wine handy so when I make a batch of spaghetti I just help myself to a splash of it. On one occasion, there wasn't a bottle opened, but there was a bottle sitting on the counter so I got out the corkscrew and helped myself. For some reason, the spaghetti that night was the best ever. My husband asked what wine I put in it and I showed him the bottle. He nearly fell off the chair. I had opened a rather expensive bottle he had bought to give his boss. Goes to show you--don't use a wine for cooking you wouldn't drink. You get the best results from a good wine!	1. In large, heavy stockpot, brown Italian sausage, breaking up as you stir.\n2. Add onions and continue to cook, stirring occasionally until onions are softened.\n3. Add garlic, tomatoes, tomato paste, tomato sauce and water.\n4. Add basil, parsley, brown sugar, salt, crushed red pepper, and black pepper.\n5. Stir well and barely bring to a boil.\n6. Stir in red wine.\n7. Simmer on low, stirring frequently for at least an hour.  A longer simmer makes for a better sauce, just be careful not to let it burn!\n8. Cook spaghetti according to package directions.\n9. Spoon sauce over drained spaghetti noodles and sprinkle with parmesan cheese.	4	20	60	{easy,kid-friendly,main-course}	url-import	https://img.sndimg.com/food/image/upload/q_92,fl_progressive,w_1200,c_scale/v1/img/recipes/22/78/2/xy39o2sOTtudkgyDgZtv_spaghettisauce.jpg	\N	2026-03-25 11:57:13.239143-07	f	2097f77e-d172-482d-99d0-57604afc5900	jo-mamas-world-famous-spaghetti	https://www.food.com/recipe/jo-mamas-world-famous-spaghetti-22782
fdfaec68-1409-4b81-8639-a1dfb67a780b	Baby Carrot Purée with Breast Milk	A smooth, naturally sweet first food for babies 6+ months. Carrots steamed in the Grownsy baby food maker and blended with breast milk for a familiar, comforting flavor.	1. Wash and peel 2 medium carrots, then cut into small chunks.\n2. Add carrot chunks and 1/4 cup water to the Grownsy Baby Food Maker steam basket.\n3. Steam for 15 minutes until carrots are completely tender and easily pierced with a fork.\n4. Transfer steamed carrots to the blending cup.\n5. Add 2-3 tablespoons of breast milk.\n6. Blend until perfectly smooth, adding more breast milk as needed for desired consistency.\n7. Let cool to a safe temperature before serving.\n8. Store extras in ice cube trays for easy portioning — freeze up to 1 month.	4	5	15	{baby-food,first-foods,gluten-free,breastfeeding-safe,pregnancy-safe}	manual	https://babyfoode.com/wp-content/uploads/2020/07/carrot-baby-food-puree-1.png	\N	2026-03-26 11:15:19.776362-07	f	2097f77e-d172-482d-99d0-57604afc5900	baby-carrot-pure-with-breast-milk	\N
2d57c883-cc8f-4f28-88dc-953483e5b51b	Baby Broccoli Purée with Breast Milk	A nutrient-dense green purée for babies 6+ months. Broccoli florets steamed until tender in the Grownsy and blended smooth with breast milk.	1. Wash 1 cup of broccoli florets and cut into small, even pieces.\n2. Add broccoli florets and 1/4 cup water to the Grownsy Baby Food Maker steam basket.\n3. Steam for 12-15 minutes until florets are very soft.\n4. Transfer steamed broccoli to the blending cup.\n5. Add 2-3 tablespoons of breast milk.\n6. Blend until smooth, scraping down sides as needed. Add more breast milk for thinner consistency.\n7. Let cool to a safe temperature before serving.\n8. Freeze leftovers in ice cube trays for up to 1 month.	4	5	15	{baby-food,first-foods,gluten-free,breastfeeding-safe,pregnancy-safe}	manual	https://babyfoode.com/wp-content/uploads/2022/02/broccoli_puree_for_baby.jpg	\N	2026-03-26 11:15:19.839712-07	f	2097f77e-d172-482d-99d0-57604afc5900	baby-broccoli-pure-with-breast-milk	\N
c8b62ba7-ad1a-4aac-958a-7c1f8f869119	Vanilla Rich Chocolate Chip Cookies	Flavors of premium vanilla and chocolate blend together to make a wonderful combination in these favorite chocolate chip cookies.	1. Preheat oven to 375°F. Mix flour, baking soda and salt in medium bowl. Set aside. Beat butter and sugars in large bowl with electric mixer on medium speed until light and fluffy. Add eggs and vanilla; mix well. Gradually beat in flour mixture on low speed until well mixed. Stir in chocolate chips and walnuts, if desired.\n2. Drop by rounded tablespoons about 2 inches apart onto ungreased baking sheets.\n3. Bake 8 to 10 minutes or until lightly browned. Cool on baking sheets 1 minute. Remove to wire racks; cool completely.	30	15	8	{easy,gluten,dessert}	url-import	https://cdn.shopify.com/s/files/1/0686/4283/2583/files/Vanilla_rich_chocolate_chip_cookies_006.jpg	\N	2026-03-28 11:03:49.905668-07	f	2097f77e-d172-482d-99d0-57604afc5900	vanilla-rich-chocolate-chip-cookies	https://www.mccormick.com/blogs/recipes/vanilla-rich-chocolate-chip-cookies
f1689f69-4359-4f71-ae5d-90853521a216	Daily Compost	A daily waste cycling routine for the Cavdle Waste Cycler. Collect kitchen scraps throughout the day and run a cycle to produce nutrient-rich compost for your garden. Reduces landfill waste while feeding your soil.	1. Throughout the day, collect compostable scraps in a countertop bin.\n2. Tear paper towels and toilet paper rolls into small pieces (2–3 inch strips).\n3. Break up any large fruit peels or vegetable scraps — the smaller the pieces, the faster the cycle.\n4. Add coffee grounds and used tea bags directly (remove staples from tea bags if present).\n5. Layer wet scraps (banana peels, food waste) with dry scraps (paper, cardboard) for best results.\n6. Load the Waste Cycler — fill to the max line but do not pack tightly.\n7. Close the lid and run a standard cycle.\n8. When complete, transfer the finished compost to a garden bed or compost bin.\n\nCompost: All scraps in this recipe go directly into the Waste Cycler. Coffee grounds, banana peels, and paper products are always OK. For oily paper towels, use sparingly. Never add: hard bones, cooking oils, fruit pits, walnut shells, plastic bags, metal, glass, or styrofoam.	1	5	0	{compost,sustainable,waste-cycler,daily,no-cook}	manual	/uploads/72271feb-2fbc-4e31-bf3e-cee24eccabc1.jpg	\N	2025-03-30 17:00:00-07	f	2097f77e-d172-482d-99d0-57604afc5900	daily-compost	\N
6455deb8-1355-48b1-a1ff-c2d8cfa136ed	Griddle Smash Burgers with Avocado and Pepper Jack	Juicy smash burgers cooked hot and fast on the propane griddle, topped with creamy avocado, spicy pepper jack, and a tangy sriracha mayo spread on toasted brioche buns.	1. Divide the ground beef into 4 equal loose balls (about 3–4 oz each). Do not overwork the meat.\n2. Halve and pit the avocado. Scoop out the flesh and slice thinly. Season with a pinch of Himalayan sea salt.\n3. In a small bowl, mix 2 tablespoons of Philadelphia cream cheese with 1 teaspoon of sriracha chili sauce to create a spicy spread. Set aside.\n4. Preheat the propane griddle on high heat for 3–4 minutes until very hot. Brush lightly with high-heat olive oil.\n5. Place the brioche buns cut-side down on the griddle and toast for 1–2 minutes until golden. Remove and set aside.\n6. Place the beef balls on the griddle and immediately smash flat with a sturdy spatula. Press firmly and hold for 10 seconds. Season the tops generously with Himalayan sea salt.\n7. Cook for 2–3 minutes until the edges are deeply browned and crispy. Flip each patty.\n8. Immediately lay a slice of pepper jack cheese on each patty. Cook for 1 more minute until cheese is melted.\n9. Spread the sriracha cream cheese mixture on the bottom bun. Stack one patty, then avocado slices, then the top bun. For double burgers, stack two patties per bun.\n10. Serve immediately.\n11. Compost: Avocado peel is OK to compost. Avocado pit CANNOT go in the composter (fruit pit — never allowed). Any egg carton used for staging is OK. Sriracha sauce residue on paper towels is limited (saucy paper towel — use sparingly). Brioche bun crumbs or scraps are OK.	2	10	15	{burgers,griddle,quick-dinner,family-favorite,beef}	ai-generated	/uploads/b9a13391-6a29-46dc-b207-4428804cd205.jpg	\N	2026-03-25 16:51:24.388531-07	f	2097f77e-d172-482d-99d0-57604afc5900	griddle-smash-burgers-with-avocado-and-pepper-jack	\N
9b6a724b-264d-4a47-9f6b-cd598287e029	Bacon	Simple oven-baked thick cut pepper bacon from Carlton Farms in Carlton, Oregon. Crispy, peppery, and hands-off — the oven does all the work.	1. Preheat the gas oven to 400°F.\n2. Line a sheet pan with parchment paper or aluminum foil.\n3. Arrange the bacon slices in a single layer on the pan — don't overlap.\n4. Place on the middle rack and bake for 18–22 minutes until crispy to your liking.\n5. Transfer to a paper towel-lined plate to drain.\n6. Serve immediately.	4	2	20	{local,common,side,breakfast}	manual	/uploads/eafdfb05-b4e9-4429-b20a-9e480cea0ebf.jpg	\N	2025-10-01 03:37:41.509635-07	t	2097f77e-d172-482d-99d0-57604afc5900	bacon	\N
e9c15d13-1a30-43c5-b61e-0bbd15b59091	Peanut Butter Banana Bread	A moist, rich banana bread swirled with peanut butter. Uses pantry staples — just grab bananas and baking soda.	Preheat oven to 350°F. Grease a 9x5 loaf pan with butter.\nIn a large bowl, mash 3 ripe bananas until smooth.\nStir in 1/3 cup melted butter, 3/4 cup sugar, 1 beaten egg, and 1 tsp vanilla extract.\nIn a separate bowl, whisk together 1 cup all-purpose flour, 1 tsp baking soda, and 1/2 tsp cinnamon.\nFold dry ingredients into wet ingredients until just combined — do not overmix.\nDrop spoonfuls of peanut butter (about 3 tbsp) across the top and swirl with a knife.\nPour batter into prepared pan.\nBake for 55–65 minutes until a toothpick inserted in the center comes out clean.\nLet cool in the pan for 10 minutes, then transfer to a wire rack.	8	10	60	{breakfast,baking,snack,lactation}	pantry-generated	/uploads/5dcbff75-00d3-4795-a82b-4eb891631b1c.jpg	\N	2026-03-25 18:26:42.870788-07	f	2097f77e-d172-482d-99d0-57604afc5900	peanut-butter-banana-bread	\N
8bb904af-393a-4478-857a-90e4ff8e8272	Horchata Creamer	Horchata Creamer made in moments with your Almond Cow. Creamy cashews pieces, steamed rice and steeped cinnamon. This cashew creamer will get your day off to a great start!	1. Directions:\n2. Steep 5 sticks of cinnamon in 500ml of boiling water for minimum of 15 mins or overnight for full flavor.\n3. Add cinnamon brew to collector cup and place in base of Almond Cow. \n4. Place 1/2 cup cashews and 1/2 cup steamed rice in the filter basket. Attach the filter basket to the top of the Almond Cow and twist in the direction of the close arrow to secure. Once attached place in base.\n5. Press the cow start button to run the machine. When the light is solid, your horchata cashew creamer is ready!	33	2	0	{drink,summer,gluten-free}	manual	//almondcow.co/cdn/shop/articles/CM200943_1100x.jpg?v=1770832508	\N	2026-03-16 21:15:53.495699-07	f	2097f77e-d172-482d-99d0-57604afc5900	horchata-creamer	\N
d7070d9c-6cd3-4f52-8306-6cdc24b29512	Cinnamon Roll Icing	My quick and easy cinnamon roll icing is anything but basic! It's made without cream cheese and has a rich, but not too sweet flavor that's perfect for topping rolls, sweet breads, and more.	1. Combine melted butter, powdered sugar, and vanilla extract and stir to combine (it’s OK if the mixture is too dry to completely combine, just move on to the next step!)\n2. Add 1-2 Tablespoons of cream or milk and stir. Add additional cream as needed, a splash at a time, until icing has reached desired consistency. I like my icing to drizzle smoothly off of my whisk, holding its shape only a brief second before it dissolves back into the bowl. I find I usually need the full 3 Tablespoons (hint: It’s OK if you like your frosting thinner and want to add a splash more!).\n3. Drizzle or spread gently over cinnamon rolls. It’s best to add the frosting when they’re still somewhat warm (I wait about 10-15 minutes after the cinnamon rolls come out of the oven)	2	5	\N	{breakfast,frosting,fall,winter,gluten-free}	url-import	https://sugarspunrun.com/wp-content/uploads/2025/03/Cinnamon-Roll-Icing-1-of-1-2.jpg	\N	2026-03-17 10:10:40.179408-07	f	2097f77e-d172-482d-99d0-57604afc5900	cinnamon-roll-icing	https://sugarspunrun.com/cinnamon-roll-icing/
9ec52826-0efc-4c32-a0e3-aedcdfb1223b	Big Mac Salad	A Big Mac Salad will fill you up without weighing you down. This low-carb, gluten free version of the drive thru classic is healthy, satisfying, and full of protein!	1. Add the ingredients to a small mixing bowl then whisk to combine and set aside. Can be made several days ahead of time — the dressing just gets better as it sits.\n2. Heat a large skillet over medium-high heat then add the ground beef. Let the beef sear undisturbed until the bottom has browned then add a few shakes of worcestershire sauce, and season with homemade seasoned salt and pepper. Saute until the beef is cooked through then scoop onto a paper towel-lined plate to drain and cool slightly.\n3. Once slightly cooled, divy the chopped lettuce between plates or bowls then top with the cooked ground beef, sliced red onion, shredded cheddar cheese, chopped tomatoes, and dill pickles. Drizzle with Special Sauce Salad Dressing and sesame seeds if using, then serve.\n4. Compost: Lettuce cores, onion skins, tomato cores, and pickle ends can go in your Waste Cycler. Do not add meat scraps, cheese, or dressing.	2	20	10	{gluten-free,low-carb,salad,summer}	manual	https://iowagirleats.com/wp-content/uploads/2021/04/Big-Mac-Salad-iowagirleats-NEW-Featured.jpg	\N	2026-03-16 19:46:33.768237-07	f	2097f77e-d172-482d-99d0-57604afc5900	big-mac-salad	\N
e9265d82-6e86-4176-b0e3-5359b3a9763e	Instant Pot Hummus	Learn how to make instant pot hummus. There's no presoaking required for the beans. Almost everything is a pantry staple ingredient so you can whip up homemade hummus and customize it to your liking anytime!	1. PRESSURE COOK: Add the beans, water, and whole garlic cloves to the instant pot. Cover and seal the vent. Set the instant pot on manual ‘high pressure’ for 38-40 minutes. When the timer goes off, allow the pressure to release naturally for 30 minutes. This is important because the chickpeas will continue to cook for a bit here. Reserve 1 cup of chickpea cooking water, then drain the beans; set aside.\n2. BLEND: Place the tahini paste, minced garlic, and 1/3 cup of lemon juice in a food processor and blend until everything is smooth and airy. Add half the chickpeas, 1 tablespoon of cooking liquid, and half the olive oil and continue to process until smooth. Add the salt, cumin powder, the remaining chickpeas, and olive oil. Process until the paste is smooth. Taste and adjust. If the hummus is still thick, add more lemon juice or another tablespoon of cooking liquid with the food processor running. Stop the machine scrape down the sides and continue to mix and add a tablespoon of cooking liquid at a time until it reaches your desired consistency. I used just 2 tablespoons because I went with a ½ cup of lemon juice. But this part is really up to you!\n3. Spoon the hummus into a bowl, drizzle with additional olive oil, and garnish with za’atar or smoked paprika. Sometimes I like to add caramelized onions to the top!\n4. Compost: Garlic skins and lemon rinds can go in your Waste Cycler.	2	5	40	{appetizer,dips,sides,vegetarian,gluten-free,breastfeeding-safe}	manual	https://www.littlespicejar.com/wp-content/uploads/2018/08/Instant-Pot-Hummus-4.jpg	\N	2026-03-16 21:28:45.723515-07	f	2097f77e-d172-482d-99d0-57604afc5900	instant-pot-hummus	\N
d4988716-d9fb-403b-9b27-fda652ab7363	Banana Blueberry Peanut Butter Smoothie Bowls	A thick, creamy breakfast or snack bowl made by blending frozen fruit, banana, and Greek yogurt in the Venturist 1200 blender. Topped with almonds, coconut shreds, and a drizzle of peanut butter for satisfying crunch and protein.	1. Peel the bananas and break them into chunks. If they are fresh, place them in the freezer for 20 minutes for a thicker result.\n2. Add the banana chunks, frozen blueberries, frozen raspberries, and Greek yogurt to the Venturist 1200 blender jar.\n3. Add 2 tablespoons of powdered peanut butter and a small splash of vanilla extract.\n4. Blend on high for 30–45 seconds, stopping to scrape down sides as needed. The mixture should be very thick — like soft-serve ice cream. Add a tablespoon of water only if the blender struggles, but keep it thick.\n5. Divide the mixture evenly between two bowls using a spatula.\n6. Top each bowl with a small handful of almonds, a sprinkle of coconut shreds, and a few extra fresh or frozen blueberries.\n7. Warm 1 tablespoon of peanut butter in a small dish until just drizzleable (10 seconds in a warm pan or brief microwave). Drizzle over each bowl.\n8. Serve immediately with a spoon.\n9. Compost: Banana peels are always OK to compost. Blueberry stems or any fruit scraps are OK.	2	10	0	{breakfast,smoothie-bowl,no-cook,vegetarian,high-protein,kid-friendly,breastfeeding-safe}	ai-generated	/uploads/99a95ef0-6000-4983-b6c7-1e635b0bdf24.jpg	2026-04-01 03:43:31.891839-07	2026-03-25 16:51:24.388866-07	f	2097f77e-d172-482d-99d0-57604afc5900	banana-blueberry-peanut-butter-smoothie-bowls	\N
de930450-0ec5-49e8-bfb2-e9b25e32927d	Smothered Cube Steaks with Caramelized Onions	Tender cube steaks smothered in caramelized onions and rich brown gravy, cooked low and slow for maximum flavor.	1. Thaw cube steaks completely and pat dry. Season both sides with salt and pepper.\n\n2. Slice both onions into thin strips. Mince garlic cloves.\n\n3. Heat 2 tbsp butter in your Titanium Large Always Pan® Pro over medium heat.\n\n4. Dredge steaks lightly in flour and brown 2-3 minutes per side. Remove to plate.\n\n5. Add remaining butter to pan. Add sliced onions and cook 8-10 minutes until golden and caramelized.\n\n6. Add garlic and cook 1 minute. Sprinkle in remaining flour and stir.\n\n7. Gradually add 1.5 cups water or broth, scraping up browned bits. Bring to simmer.\n\n8. Return steaks to pan, cover, and simmer 15 minutes until tender.\n\n9. Adjust seasoning and serve over mashed potatoes or rice.	4	10	25	{dinner,comfort-food,one-pan,hearty}	ai-generated	/uploads/edbb69e4-379d-4324-82af-fed845e4ddd6.jpg	\N	2026-03-30 20:09:00.897379-07	f	2097f77e-d172-482d-99d0-57604afc5900	smothered-cube-steaks-with-caramelized-onions	https://www.tasteofhome.com/recipes/smothered-cube-steaks/
5bd2dcb3-ee02-4705-8c5a-45a2a9a5c2ec	Creamy Rigatoni with Crushed Tomato, Pesto, and Feta	A hearty weeknight pasta made in the Instant Pot. Rigatoni is pressure cooked in crushed tomatoes and finished with basil pesto, crumbled feta, and a drizzle of finishing olive oil. Quick, satisfying, and packed with flavor.	1. Open the can of crushed tomatoes in rice puree and pour into the Instant Pot inner pot.\n2. Add 1.5 cups of water to the pot and stir to combine with the tomatoes.\n3. Add the rigatoni to the pot, pressing it down so it is mostly submerged in the liquid. Break pieces if needed to fit.\n4. Add a generous pinch of Himalayan sea salt and a sprig of fresh rosemary.\n5. Seal the Instant Pot lid and set the valve to sealing. Cook on Manual (High Pressure) for 5 minutes. Note: This is roughly half the pasta's package cooking time, which is the standard Instant Pot pasta rule.\n6. When the cook time ends, carefully do a quick pressure release by switching the valve to venting.\n7. Open the lid and stir the pasta well. The sauce should be thick and coating the noodles. If too thick, add a splash of water and stir.\n8. Remove and discard the rosemary sprig.\n9. Stir in 1 oz of basil pesto until fully incorporated.\n10. Spoon into bowls. Top each bowl generously with crumbled feta.\n11. Finish with a drizzle of finishing olive oil and a few grinds of Himalayan sea salt.\n12. Serve immediately.\n13. Compost: Rosemary stem is OK to compost. Any tomato can residue on a paper towel is limited (saucy paper towel — sparingly). Empty cardboard pasta box can be chopped and composted.	2	5	20	{pasta,vegetarian,instant-pot,quick-dinner,tomato}	ai-generated	/uploads/f3cf2e7e-1961-474f-a9b3-df81d7c470cd.jpg	\N	2026-03-25 16:51:24.388343-07	f	2097f77e-d172-482d-99d0-57604afc5900	creamy-rigatoni-with-crushed-tomato-pesto-and-feta	\N
\.


--
-- Name: cookware cookware_pkey; Type: CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.cookware
    ADD CONSTRAINT cookware_pkey PRIMARY KEY (id);


--
-- Name: ingredients ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_pkey PRIMARY KEY (id);


--
-- Name: kitchens kitchens_pkey; Type: CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.kitchens
    ADD CONSTRAINT kitchens_pkey PRIMARY KEY (id);


--
-- Name: kitchens kitchens_slug_key; Type: CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.kitchens
    ADD CONSTRAINT kitchens_slug_key UNIQUE (slug);


--
-- Name: menu_recipes menu_recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.menu_recipes
    ADD CONSTRAINT menu_recipes_pkey PRIMARY KEY (id);


--
-- Name: menus menus_pkey; Type: CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.menus
    ADD CONSTRAINT menus_pkey PRIMARY KEY (id);


--
-- Name: menus menus_slug_key; Type: CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.menus
    ADD CONSTRAINT menus_slug_key UNIQUE (slug);


--
-- Name: recipe_cookware recipe_cookware_pkey; Type: CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.recipe_cookware
    ADD CONSTRAINT recipe_cookware_pkey PRIMARY KEY (recipe_id, cookware_id);


--
-- Name: recipe_ingredients recipe_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: idx_cookware_tags; Type: INDEX; Schema: public; Owner: jpdevries
--

CREATE INDEX idx_cookware_tags ON public.cookware USING gin (tags);


--
-- Name: idx_ingredients_tags; Type: INDEX; Schema: public; Owner: jpdevries
--

CREATE INDEX idx_ingredients_tags ON public.ingredients USING gin (tags);


--
-- Name: idx_menu_recipes_menu; Type: INDEX; Schema: public; Owner: jpdevries
--

CREATE INDEX idx_menu_recipes_menu ON public.menu_recipes USING btree (menu_id);


--
-- Name: idx_menus_kitchen; Type: INDEX; Schema: public; Owner: jpdevries
--

CREATE INDEX idx_menus_kitchen ON public.menus USING btree (kitchen_id);


--
-- Name: idx_recipe_cookware_cookware; Type: INDEX; Schema: public; Owner: jpdevries
--

CREATE INDEX idx_recipe_cookware_cookware ON public.recipe_cookware USING btree (cookware_id);


--
-- Name: idx_recipe_cookware_recipe; Type: INDEX; Schema: public; Owner: jpdevries
--

CREATE INDEX idx_recipe_cookware_recipe ON public.recipe_cookware USING btree (recipe_id);


--
-- Name: idx_recipes_tags; Type: INDEX; Schema: public; Owner: jpdevries
--

CREATE INDEX idx_recipes_tags ON public.recipes USING gin (tags);


--
-- Name: recipes_slug_idx; Type: INDEX; Schema: public; Owner: jpdevries
--

CREATE UNIQUE INDEX recipes_slug_idx ON public.recipes USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: cookware cookware_kitchen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.cookware
    ADD CONSTRAINT cookware_kitchen_id_fkey FOREIGN KEY (kitchen_id) REFERENCES public.kitchens(id) ON DELETE CASCADE;


--
-- Name: ingredients ingredients_kitchen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_kitchen_id_fkey FOREIGN KEY (kitchen_id) REFERENCES public.kitchens(id) ON DELETE CASCADE;


--
-- Name: menu_recipes menu_recipes_menu_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.menu_recipes
    ADD CONSTRAINT menu_recipes_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES public.menus(id) ON DELETE CASCADE;


--
-- Name: menu_recipes menu_recipes_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.menu_recipes
    ADD CONSTRAINT menu_recipes_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: menus menus_kitchen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.menus
    ADD CONSTRAINT menus_kitchen_id_fkey FOREIGN KEY (kitchen_id) REFERENCES public.kitchens(id) ON DELETE CASCADE;


--
-- Name: recipe_cookware recipe_cookware_cookware_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.recipe_cookware
    ADD CONSTRAINT recipe_cookware_cookware_id_fkey FOREIGN KEY (cookware_id) REFERENCES public.cookware(id) ON DELETE CASCADE;


--
-- Name: recipe_cookware recipe_cookware_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.recipe_cookware
    ADD CONSTRAINT recipe_cookware_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: recipe_ingredients recipe_ingredients_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: recipe_ingredients recipe_ingredients_source_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_source_recipe_id_fkey FOREIGN KEY (source_recipe_id) REFERENCES public.recipes(id) ON DELETE SET NULL;


--
-- Name: recipes recipes_kitchen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jpdevries
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_kitchen_id_fkey FOREIGN KEY (kitchen_id) REFERENCES public.kitchens(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 9wLHROEAaK8KeQ78CITw0wH2qw5vxFdl5IRk2tCAywcu8OlZBefl9LhHRuasdYx

