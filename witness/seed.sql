--
-- PostgreSQL database dump
--

\restrict loJVFLBOhFtOF5LVNp2ahSBLuGYfeIAMjbpIOttrUg0XRvbaJERANkSMHfkfplU

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
21c91c6b-5a75-4b71-a710-6927e6c38b60	Cinnamon	spices	1	jar	f	{}	2026-03-31 14:11:45.149131-07	2026-03-31 14:11:45.149131-07	2097f77e-d172-482d-99d0-57604afc5900
6fc7380d-0268-431f-ac02-1622bbd72bfc	Cumin	spices	1	jar	f	{organic}	2026-03-31 14:13:43.837689-07	2026-03-31 14:13:43.837689-07	2097f77e-d172-482d-99d0-57604afc5900
3a3b9a6a-06d2-492d-aef9-3da953260a8b	Larrupin swedish style mustard dill sauce	pantry	1	whole	f	{}	2026-03-31 14:18:00.370778-07	2026-03-31 14:18:00.370778-07	2097f77e-d172-482d-99d0-57604afc5900
00fbaf14-4f59-4dc2-a6eb-f22812c0561d	Caputo dry yeast	bakery	300	g	f	{}	2026-03-31 14:19:14.712311-07	2026-03-31 14:19:29.579559-07	2097f77e-d172-482d-99d0-57604afc5900
0190e102-3ba4-4e46-9e2f-b9fe0611c44a	Gordon Rhodes The Pig Easy American BBQ Style Pulled Pork Gourmet Sauce Mix	pantry	2	box	f	{gluten-free}	2026-03-31 14:22:43.841483-07	2026-03-31 14:22:43.841483-07	2097f77e-d172-482d-99d0-57604afc5900
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
986e7692-f1fb-4627-bd94-8eb594aad3d7	df82626a-c9df-48bc-8752-b470933f01e9	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	main-course	1
c5584928-9044-4d0a-9825-6246221dacd9	d1e8c547-a0fd-4164-ad51-282fecad5cf9	ac395333-a4dd-4c47-8aec-982159004f66	breakfast	0
3f045688-5b17-43be-ae44-a3c5234c12e2	d1e8c547-a0fd-4164-ad51-282fecad5cf9	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	breakfast	2
38c36373-da26-4f23-b2ee-ab553c0e2e85	d1e8c547-a0fd-4164-ad51-282fecad5cf9	a39da54e-23b7-4b37-8405-ddd001072728	breakfast	3
f08640e5-04bf-4ead-a503-0e26fadeca63	d1e8c547-a0fd-4164-ad51-282fecad5cf9	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	breakfast	4
4f1fbb8a-0c97-44c1-8219-70e317299394	d1e8c547-a0fd-4164-ad51-282fecad5cf9	e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	breakfast	5
3455407f-2655-4a34-a7a4-d0c5f350d589	e8a65027-dd38-4887-8337-9259d04b6d7e	a2fd26aa-5e71-402b-91c7-d6ee01062ab9	dessert	0
28e465b5-d9f8-42d7-a319-4f5ed8ed69f8	e8a65027-dd38-4887-8337-9259d04b6d7e	3523ab6d-c94e-4750-9bc9-56d210ca5702	dessert	1
8534bab1-ca88-446d-8409-e9bfc55197d6	2c451dff-a717-4e19-a576-fea71c7b4fa6	3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	beverage	0
0c8e794d-4457-4163-a082-19cefd4c0cea	2c451dff-a717-4e19-a576-fea71c7b4fa6	569487a8-197f-4776-92c3-102e86203c8b	breakfast	1
e37cef44-b3c4-4f72-a330-f81505e6f0ca	2c451dff-a717-4e19-a576-fea71c7b4fa6	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	breakfast	2
bd727663-5de8-42b3-9e29-ac89e9372cc9	2c451dff-a717-4e19-a576-fea71c7b4fa6	ac395333-a4dd-4c47-8aec-982159004f66	breakfast	3
da4c654c-ffce-4487-b4af-4d4389bacf42	2c451dff-a717-4e19-a576-fea71c7b4fa6	d4988716-d9fb-403b-9b27-fda652ab7363	breakfast	4
db34cb92-3de6-4bcc-aaa8-6350b7fc180a	2c451dff-a717-4e19-a576-fea71c7b4fa6	a2fd26aa-5e71-402b-91c7-d6ee01062ab9	dessert	5
7c6a56de-d680-48e4-9d10-62978159e3e7	2c451dff-a717-4e19-a576-fea71c7b4fa6	3523ab6d-c94e-4750-9bc9-56d210ca5702	dessert	6
248ac798-7dff-48bc-af4d-235e8acad5b4	2c451dff-a717-4e19-a576-fea71c7b4fa6	2d57c883-cc8f-4f28-88dc-953483e5b51b	other	9
5bbef04c-3892-4c78-a042-54ec584b5876	2c451dff-a717-4e19-a576-fea71c7b4fa6	fdfaec68-1409-4b81-8639-a1dfb67a780b	other	10
714385fb-285c-4229-93c7-9f8230a61b68	2c451dff-a717-4e19-a576-fea71c7b4fa6	4fcfff0f-56aa-4bf6-a84b-8d701f796671	other	11
d8ea2417-caf5-40b0-8949-abf186169c6d	a4ad4e16-7501-40e6-8461-7e8487597a7d	a2fd26aa-5e71-402b-91c7-d6ee01062ab9	dessert	3
c9c364fc-a027-4a94-b377-132f535691e9	a4ad4e16-7501-40e6-8461-7e8487597a7d	3523ab6d-c94e-4750-9bc9-56d210ca5702	dessert	2
ab24e614-c65f-405e-990b-57b52987407d	2c451dff-a717-4e19-a576-fea71c7b4fa6	ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	main-course	14
f342969a-ad12-4bb9-a50a-eafdb27e86b2	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	beverage	0
44d7d076-fe46-4e60-8dd3-bc352d258f38	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	beverage	3
450598c1-cfaf-4e30-b3cf-59eb9b088a11	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	ac395333-a4dd-4c47-8aec-982159004f66	beverage	4
723e2240-1c8a-4507-84c4-8966bd58c6a8	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	4b49372d-beb1-4006-8918-acec20387015	beverage	6
eb36a18f-0869-4dc7-9619-6fb3ebe13e64	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	350fa316-fd7b-4c31-84c7-18a2966cc4da	breakfast	7
2004a725-bdae-434c-9484-c1101fa00e4b	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	569487a8-197f-4776-92c3-102e86203c8b	breakfast	8
ede5f7a0-47f5-4225-bf36-cb8c7b5cab2a	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	breakfast	9
c5208f3d-33e5-43bb-98fa-0b629e668f5a	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	d4988716-d9fb-403b-9b27-fda652ab7363	breakfast	11
d8baa3e8-5481-4cc6-b6a1-12177098450c	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	748747fb-7ca8-4ba3-9f64-a549f009744d	breakfast	13
0697ba4d-3383-4e01-8613-1b82940974ff	c13d5c53-0752-4ce3-89f4-a1fae1dfe00a	10288612-86f9-4856-90da-79057817d759	appetizer	14
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
a39da54e-23b7-4b37-8405-ddd001072728	3eb41879-4656-41dd-998c-51e254c9d30d
3523ab6d-c94e-4750-9bc9-56d210ca5702	3eb41879-4656-41dd-998c-51e254c9d30d
497e7a07-a568-45fa-852b-80863f672e4a	ff2549c8-3273-46f8-8860-3fcceef9ce3e
497e7a07-a568-45fa-852b-80863f672e4a	f4e23b46-dcf6-4d80-9f40-c8dfb74f62d7
497e7a07-a568-45fa-852b-80863f672e4a	815dce22-ad26-4360-937b-93aa216543ef
ac395333-a4dd-4c47-8aec-982159004f66	9b05576a-e57c-44e5-a5dd-1d9cd721f07f
c6255b5f-6f20-4dc5-b4c4-ca0b300a57b7	77a6e7e8-af3d-41a2-82f5-72442d1100ba
ab7a2b1a-add7-4a55-b10a-bb9c4648be58	77a6e7e8-af3d-41a2-82f5-72442d1100ba
f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	3eb41879-4656-41dd-998c-51e254c9d30d
70163822-a1e6-4a76-b21d-d231639e3424	77a6e7e8-af3d-41a2-82f5-72442d1100ba
4b49372d-beb1-4006-8918-acec20387015	77a6e7e8-af3d-41a2-82f5-72442d1100ba
748747fb-7ca8-4ba3-9f64-a549f009744d	358beee3-b3bb-44f4-9299-e3fb476796ea
4fcfff0f-56aa-4bf6-a84b-8d701f796671	f1342716-0a1d-411f-b6de-dfdc4768a162
a2fd26aa-5e71-402b-91c7-d6ee01062ab9	3eb41879-4656-41dd-998c-51e254c9d30d
3449a857-00b1-4ddb-a648-1cebd4d7056e	358beee3-b3bb-44f4-9299-e3fb476796ea
3449a857-00b1-4ddb-a648-1cebd4d7056e	f4e23b46-dcf6-4d80-9f40-c8dfb74f62d7
fdfaec68-1409-4b81-8639-a1dfb67a780b	f1342716-0a1d-411f-b6de-dfdc4768a162
2d57c883-cc8f-4f28-88dc-953483e5b51b	f1342716-0a1d-411f-b6de-dfdc4768a162
e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	3fcbd9e1-4200-47fa-8e53-425817aa2289
adabc033-1481-4af1-91d5-fe59df7da495	358beee3-b3bb-44f4-9299-e3fb476796ea
daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	84997166-5ad8-4f3d-8a97-d314b2e0ef21
3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	77a6e7e8-af3d-41a2-82f5-72442d1100ba
6661a800-c71a-4c75-9df5-0352f8ed3ba4	5e1df76c-0723-4e27-9930-f624ffa32b7b
d4988716-d9fb-403b-9b27-fda652ab7363	3eb41879-4656-41dd-998c-51e254c9d30d
\.


--
-- Data for Name: recipe_ingredients; Type: TABLE DATA; Schema: public; Owner: jpdevries
--

COPY public.recipe_ingredients (id, recipe_id, ingredient_name, quantity, unit, source_recipe_id, sort_order) FROM stdin;
64f88fcd-c423-4102-a03f-f60c5eea9cdd	3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	Organic Cucumber	1	whole	\N	0
98fc9464-18c8-4adf-b7e8-e3ff8f13e2a6	3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	Fresh Mint	10	leaves	\N	1
de685ccf-6a03-4361-9c0a-c22b943f6079	3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	Lime	1	whole	\N	2
59ac9fa1-364e-4d8f-ac32-d718e30cf372	3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	Water	2	cups	\N	3
d804d94e-1bec-4557-a0cc-627298ede181	3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	Honey	1	tbsp	\N	4
6d48b278-ba78-481d-80d0-87baa0803f67	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	chai tea bags	2	whole	\N	0
375535be-abd5-4846-8387-a0e941e85dda	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	boiling water	1	cup	\N	1
d7d49003-36ac-491d-b1f5-f7ad154f933c	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	strong brewed coffee (Rich setting)	0.25	cup	\N	2
f4058523-eb7c-498c-b6fb-fa41b43adf76	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	Almond Milk	0.5	cup	ac395333-a4dd-4c47-8aec-982159004f66	3
56fef4c7-e4a6-4239-80af-c4e26ea0f11d	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	honey or maple syrup	1	tbsp	\N	4
5fd59a7c-a3e3-4564-a20d-81284587d672	daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	ground cinnamon	1	pinch	\N	5
778c54e2-027d-4039-8b9a-4331c4bd0389	ac395333-a4dd-4c47-8aec-982159004f66	sea salt	0.25	tsp	\N	0
41c49940-2992-4bdb-8a9b-589cf5c3ba15	ac395333-a4dd-4c47-8aec-982159004f66	unsoaked almonds (if using soaked almonds, you only need to use about ½ cup soaked in water for at least 4 hours or overnight)	1	cup	\N	0
1e0d4e41-fd26-43c1-9098-be20924325ab	ac395333-a4dd-4c47-8aec-982159004f66	chopped, pitted dates or 1-2 tbsp maple syrup (optional)	3	whole	\N	0
cd21cc56-21d0-4172-8f7c-9acd3ef4e571	ac395333-a4dd-4c47-8aec-982159004f66	vanilla (optional)	1	tsp	\N	0
c25c4afd-8935-4d94-8fbe-a00c99ef6405	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	Flax seed	2	tsp	\N	0
60c3d31a-c110-44ab-8bf7-e1edfd32190c	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	Plain yogurt (or greek yogurt)	0.3333333333333333	cup	\N	0
89905bc1-fcd1-489a-8aa3-841472573638	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	Frozen blueberries	2	cup	\N	0
cd7f19c4-e9ed-4e70-a455-f5bf7b84112c	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	Banana	1	whole	\N	0
5b8578da-26b6-468b-92ee-e8c4a645e341	f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	Almond Milk	1.5	cup	ac395333-a4dd-4c47-8aec-982159004f66	0
1967896c-f77a-439f-b316-a18d77305b64	2d57c883-cc8f-4f28-88dc-953483e5b51b	Broccoli	1	cups	\N	0
c31c0421-461d-4dec-81aa-c58b6e184043	2d57c883-cc8f-4f28-88dc-953483e5b51b	Breast Milk	3	tbsp	\N	1
c4ac562d-5025-490a-865c-32249d3756d8	2d57c883-cc8f-4f28-88dc-953483e5b51b	Water	0.25	cups	\N	2
4b34a1e8-97dc-4c68-bd07-b5dbcfb7c9ca	4fcfff0f-56aa-4bf6-a84b-8d701f796671	Asparagus	8	spears	\N	0
eb239540-549b-4d98-87ba-87cf4e261a23	4fcfff0f-56aa-4bf6-a84b-8d701f796671	Breast Milk	3	tbsp	\N	1
c200ff99-1af0-43a1-a357-e7ceacd31c05	4fcfff0f-56aa-4bf6-a84b-8d701f796671	Water	0.25	cups	\N	2
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
0194dadd-2521-4da5-bac7-be9b662facff	c6255b5f-6f20-4dc5-b4c4-ca0b300a57b7	mango	2	whole	\N	0
02a45d91-0c37-4766-bbad-399e6359201c	c6255b5f-6f20-4dc5-b4c4-ca0b300a57b7	oranges	2	whole	\N	1
6057a7a8-1846-49b4-8e90-5eca1691cd41	c6255b5f-6f20-4dc5-b4c4-ca0b300a57b7	pineapple	0.5	whole	\N	2
2c5571f9-5b21-4804-8e89-fe8425b42f8a	70163822-a1e6-4a76-b21d-d231639e3424	frozen dragon fruits	3	whole	\N	0
6ed474a4-0f50-4481-b48c-104dc593734a	70163822-a1e6-4a76-b21d-d231639e3424	frozen bananas	3	whole	\N	1
2570e480-4d2e-41d8-beb7-3f66a16ca18d	4b49372d-beb1-4006-8918-acec20387015	oranges	6	whole	\N	0
dc9a0f92-ba76-4a87-b468-caec743012de	3523ab6d-c94e-4750-9bc9-56d210ca5702	Strawberry and Cream Ice Cream	1.5	cup	\N	0
ca0ac3e1-d086-4713-a036-1cc94b8e97aa	3523ab6d-c94e-4750-9bc9-56d210ca5702	Almond Milk	1	cup	\N	1
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
f6e204ae-ea87-4ec4-88b1-1f49bb0a6c7a	fdfaec68-1409-4b81-8639-a1dfb67a780b	Carrots	2	whole	\N	0
f07699ee-4f1b-4c59-8bf4-fb66222e4ff2	fdfaec68-1409-4b81-8639-a1dfb67a780b	Breast Milk	3	tbsp	\N	1
895db164-7b62-4481-99de-fdfdccae2b36	fdfaec68-1409-4b81-8639-a1dfb67a780b	Water	0.25	cups	\N	2
d1e8f301-64c8-4fe4-a3af-2851662b53e4	569487a8-197f-4776-92c3-102e86203c8b	fresh blueberries	1	cup	\N	0
82a1fe60-a862-44aa-88c5-d71a5e353312	569487a8-197f-4776-92c3-102e86203c8b	granola	3	tbsp	\N	1
a8bbc56d-b0c5-49cf-8e53-32e0e53cec53	569487a8-197f-4776-92c3-102e86203c8b	1-2 teaspoons sweetener of choice (optional)	\N	whole	\N	2
5a681239-cef7-48bc-8b12-e06890750b41	569487a8-197f-4776-92c3-102e86203c8b	vanilla yogurt of choice	1	cup	\N	3
341e5999-2f28-4904-b2a1-c61e8c8bdf0b	748747fb-7ca8-4ba3-9f64-a549f009744d	maple syrup (or more as per your taste)	0.25	cup	\N	0
d4754b68-c463-4953-bedb-e07a06f61b5d	748747fb-7ca8-4ba3-9f64-a549f009744d	Juice of half lemon (about 1 tablespoon)	\N	whole	\N	1
ebf3e9bd-eabb-4f16-a9f6-1615e399d34b	748747fb-7ca8-4ba3-9f64-a549f009744d	Raspberries (frozen) (about 18 oz or 500g)	3	cup	\N	2
21d0d15a-c506-4e8f-a151-10f6d1e25c39	748747fb-7ca8-4ba3-9f64-a549f009744d	Zest of 1 lemon	\N	whole	\N	3
b81119f6-3651-4ed9-805d-7dec25a5bde9	748747fb-7ca8-4ba3-9f64-a549f009744d	Chia seeds	0.25	cup	\N	4
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
\.


--
-- Data for Name: recipes; Type: TABLE DATA; Schema: public; Owner: jpdevries
--

COPY public.recipes (id, title, description, instructions, servings, prep_time, cook_time, tags, source, photo_url, last_made_at, created_at, queued, kitchen_id, slug, source_url) FROM stdin;
3523ab6d-c94e-4750-9bc9-56d210ca5702	Strawberries and Cream Milkshake	A rich, creamy milkshake made with Strawberry and Cream ice cream and fresh homemade Almond Milk.	1. Make a batch of Almond Milk if you don't have some ready.\n2. Add 3 scoops of Strawberry and Cream ice cream to your Vitamix.\n3. Pour in 1 cup of Almond Milk.\n4. Blend on medium speed for 15-20 seconds until smooth and thick.\n5. Pour into a chilled glass. Top with a fresh strawberry if desired.\n6. Compost: Almond pulp from making Almond Milk can go in your Waste Cycler. Do not add dairy-based ice cream residue.	2	5	0	{milkshake,dessert,quick,local,sustainable}	manual	https://www.cookingclassy.com/wp-content/uploads/2024/05/strawberry-milkshake-4.jpg	2026-03-26 17:56:03.996792-07	2026-03-26 12:39:43.241672-07	f	2097f77e-d172-482d-99d0-57604afc5900	strawberries-and-cream-milkshake	\N
a39da54e-23b7-4b37-8405-ddd001072728	Mango Smoothie With Almond Milk	A creamy, tropical Mango Smoothie made with frozen mango, almond milk, yogurt, and a banana. Blends up in under a minute for a refreshing breakfast or snack.	1. Gather all of the ingredients and place them in the Vitamix or your preferred blender. Blend on low then gradually increase to the highest speed. Blend for 45 seconds or until smooth.\n2. Pour in serving glass and enjoy.\n3. Compost: Banana peels can go in your Waste Cycler.	2	1	1	{mango,breakfast,probiotics,summer,gluten-free,breastfeeding-safe}	manual	https://i2.wp.com/www.downshiftology.com/wp-content/uploads/2018/08/Mango-Smoothie-3-2.jpg	\N	2026-03-17 20:36:46.344481-07	f	2097f77e-d172-482d-99d0-57604afc5900	mango-smoothie-with-almond-milk	\N
5cc0e0b9-1e5c-4db6-bf2a-6da7e7c28195	Ube Soufflé Pancakes with Fresh Berries	A show-stopping brunch dish that combines the vibrant, subtly sweet flavor of Filipino ube (purple yam) with the airy, cloud-like texture of Japanese soufflé pancakes — all topped with a coconut cream drizzle and jewel-bright fresh berries.	1. Macerate the berries: Halve any strawberries, then gently toss all berries with honey and lemon juice. Set aside at room temperature while you prepare everything else.\n2. Make the coconut cream sauce: Whisk coconut cream, condensed milk, vanilla, and salt in a small bowl until smooth. Refrigerate until serving.\n3. Mix the batter base: In a large bowl, whisk egg yolks, ube halaya, milk, and vanilla until smooth and uniformly purple. Sift in the flour, baking powder, and salt. Stir until just combined.\n4. Whip the meringue: In a clean bowl, beat egg whites and cream of tartar with an electric mixer on medium speed until foamy. Gradually add sugar one tablespoon at a time, then increase speed to high and beat until stiff, glossy peaks form (about 3–4 minutes).\n5. Fold together: Scoop about one-third of the meringue into the ube batter and stir gently to lighten it. Then add the remaining meringue in two additions, folding carefully with a spatula until no white streaks remain. Work gently — the air in the meringue is what makes these soufflé pancakes rise.\n6. Cook low and slow: Heat a non-stick skillet or griddle over the lowest heat setting. Lightly oil or butter the surface. Using a large spoon or ice cream scoop, pile batter into tall mounds (about ⅓ cup each). Add 2 tablespoons of water to the pan and cover with a lid. Cook for 6–7 minutes until the bottoms are golden. Gently flip each pancake, add another splash of water, re-cover, and cook 5–6 minutes more.\n7. Plate and serve: Stack 2 pancakes per plate. Spoon macerated berries over the top, drizzle with coconut cream sauce, and finish with a light dusting of powdered sugar. Serve immediately — soufflé pancakes deflate as they cool.\n\nTips:\n- Ube halaya can be found in the frozen section of most Asian grocery stores (look for brands like Good Shepherd or Ube Queen). In a pinch, use ube powder (2 tbsp) reconstituted with a splash of coconut milk.\n- For a deeper purple color, add ½ teaspoon ube extract to the batter base.\n- Low heat is critical. These pancakes need time to cook through without burning. If your stove's lowest setting runs hot, use a heat diffuser.\n- Seasonal berry swaps: In winter, try thawed frozen berries or pomegranate seeds. In summer, add fresh mango or lychee alongside the berries.\n- The coconut cream sauce can be made a day ahead and refrigerated. Stir well before serving.	4	25	20	{brunch,pancakes,ube,Filipino,Japanese,vegetarian,berries}	manual	https://i0.wp.com/www.feedmi.org/wp-content/uploads/2023/05/ube-pancakes-coconut-sauce.jpg?fit=1200%2C1600&ssl=1	\N	2026-03-27 11:47:40.765109-07	f	2097f77e-d172-482d-99d0-57604afc5900	ube-souffl-pancakes-with-fresh-berries	\N
3ee35469-dddf-4dfe-b24b-0ef3ddea29a9	Cucumber Mint Cooler	A refreshing chilled cucumber drink with fresh mint and a squeeze of lime. Light, hydrating, and perfect for hot days.	1. Wash and peel 1 large organic cucumber, then chop into chunks.\n2. Add cucumber chunks, 8-10 fresh mint leaves, juice of 1 lime, 2 cups cold water, and 1 tablespoon honey to a blender.\n3. Blend on high until smooth, about 30 seconds.\n4. Strain through a fine mesh sieve into a pitcher, pressing solids to extract all liquid.\n5. Taste and adjust sweetness or lime.\n6. Serve over ice, garnished with a cucumber slice and mint sprig.	2	10	0	{drink,no-cook,gluten-free,vegan,summer,healthy,breastfeeding-safe,pregnancy-safe}	manual	https://www.mygingergarlickitchen.com/wp-content/uploads/2022/06/cucumber-cooler-6.jpg	\N	2026-03-26 11:14:36.507695-07	f	2097f77e-d172-482d-99d0-57604afc5900	cucumber-mint-cooler	\N
497e7a07-a568-45fa-852b-80863f672e4a	Skillet-to-Oven Croissant Breakfast Sandwich	Flaky slow rise croissants stuffed with seared breakfast sausage, soft scrambled eggs, and melty Tillamook cheddar. Start with a quick sear in a cast iron skillet on the stovetop, then transfer the whole skillet into the electric pizza oven to toast the croissants and melt the cheese. Ready in 15 minutes.	1. Preheat the electric pizza oven to 375°F (190°C).\n\n2. Place the cast iron skillet on the stovetop over medium-high heat. Add the breakfast sausage patties and sear for 2–3 minutes per side until browned and cooked through. Remove and set aside.\n\n3. Place the Titanium Always Pan® Pro on the stovetop over medium heat and let it preheat for 1 minute. Add a drizzle of olive oil. Crack the eggs into a bowl, season with salt and pepper, and whisk lightly. Pour into the pan and drop in 3 thin slices of butter. Using a wooden spoon or titanium spatula, gently fold the eggs — 30 seconds on the heat stirring, then lift the pan off the heat for 30 seconds while continuing to fold. Repeat until the curds are soft and just barely set. Remove from heat while still slightly wet — they’ll finish in the oven.\n\n4. Slice the croissants in half. Place the bottom halves cut-side up in the cast iron skillet. Layer on the sausage patties, a scoop of scrambled eggs, and a slice of Tillamook cheddar on each. Place the croissant tops alongside.\n\n5. Transfer the cast iron skillet into the pizza oven. Bake for 3–4 minutes until the cheese is melted and bubbly and the croissant tops are lightly toasted.\n\n6. Pull the skillet out (use a towel — the handle is hot!). Cap the sandwiches with the toasted tops and serve immediately.\n\nCompost: Eggshells and any sausage packaging paper can go in the Waste Cycler.	2	5	12	{breakfast,sandwich,cast-iron,pizza-oven,quick,weekend}	manual	https://www.thespeckledpalate.com/wp-content/uploads/2016/03/The-Speckled-Palate-Croissant-Breakfast-Sandwiches-Image.jpg	\N	2026-03-28 08:21:53.669985-07	f	2097f77e-d172-482d-99d0-57604afc5900	skillet-to-oven-croissant-breakfast-sandwich	\N
ac395333-a4dd-4c47-8aec-982159004f66	Almond Milk	Fresh homemade almond milk from the Almond Cow — creamy, preservative-free, and ready in minutes.	1. Place all ingredients in the filter basket. Attach the filter basket to the top of the Almond Cow and twist in the direction of the close arrow to secure.\n2. Fill the Almond Cow base to the MIN line (5 cups) with water, attach the top.\n3.Plug in the Almond Cow and press the cow start button! It will run through 3 automatic stages.\n4. When the green light stops flashing, your milk is ready!	8	\N	\N	{daily,breakfast,smoothies,shakes,mixology,gluten-free,lactation,breastfeeding-safe}	manual	https://almondcow.co/cdn/shop/files/new-jug-with-milk_600x600.jpg?v=1765305426	\N	2026-03-16 20:05:18.620539-07	f	2097f77e-d172-482d-99d0-57604afc5900	almond-milk	\N
c6255b5f-6f20-4dc5-b4c4-ca0b300a57b7	Golden Mango Juice	Tropical flavors with a boost of vitamin C for supporting the immune system.	1. Peel and pit mango.\n2. Peel oranges.\n3. Cut pineapple into pieces.\n4. Feed mango, oranges, and pineapple through the slow juicer.\n5. Stir and serve immediately.\n6. Compost: Mango peels, orange peels, and pineapple core can go in your Waste Cycler. Do not add the mango pit.	2	10	0	{juice,cold-press,healthy,gluten-free,vegan,tropical,summer,breastfeeding-safe}	url-import	https://www.kuvingsusa.com/cdn/shop/articles/Golden_Mango_SQ.png?v=1768423342&width=1024	\N	2026-03-19 10:06:13.739855-07	f	2097f77e-d172-482d-99d0-57604afc5900	golden-mango-juice	https://www.kuvingsusa.com/blogs/recipes/golden-mango-juice
ab7a2b1a-add7-4a55-b10a-bb9c4648be58	Papaya Parasite Cleanse Juice	Anti-parasitic, high-fiber juice to support gut health. Papaya seeds should be consumed whole rather than juiced.	1. Wash all produce thoroughly.\n2. Cut papaya in half, scoop out seeds and set aside.\n3. Feed papaya flesh, pineapple, carrots, and ginger through the slow juicer.\n4. Pour juice into a glass and stir in 1 tablespoon of whole papaya seeds.\n5. Serve immediately.\n6. Compost: Papaya peels, pineapple core, carrot peels, and ginger peels can go in your Waste Cycler. Do not add papaya seeds or large pits.	2	10	0	{juice,cold-press,healthy,gluten-free,vegan,cleanse}	url-import	https://www.kuvingsusa.com/cdn/shop/articles/kuvings-recipe-parasite-cleanse-juice_c965d344-a0a8-4bac-950c-5190ae8fc6ee.jpg?v=1768424627&width=1024	\N	2026-03-19 10:06:13.663689-07	f	2097f77e-d172-482d-99d0-57604afc5900	papaya-parasite-cleanse-juice	https://www.kuvingsusa.com/blogs/recipes/papaya-parasite-cleanse-juice
f8dd344b-3d01-40b8-9b4d-57f1c9a11f07	Blueberry Smoothie With Almond Milk	This Blueberry Smoothie With Almond Milk makes an easy breakfast or snack for adults and children. Easily make this Vitamix Blueberry Smoothie Recipe with fresh or frozen berries, yogurt, almond milk, flax seeds, and banana. A fun and healthy way to start the day!	1. Gather all of the ingredients and place them in the Vitamix or your preferred blender. Blend on low then gradually increase to the highest speed. Blend for 45 seconds or until smooth.\n2. Pour in serving glass and enjoy.\n3. Compost: Banana peels can go in your Waste Cycler.	2	1	1	{blueberry,breakfast,probiotics,gluten-free,breastfeeding-safe}	url-import	https://www.savorythoughts.com/wp-content/uploads/2019/04/Blueberry-Smoothie-Recipe.jpg	\N	2026-03-16 22:09:16.111202-07	f	2097f77e-d172-482d-99d0-57604afc5900	blueberry-smoothie-with-almond-milk	https://www.savorythoughts.com/healthy-blueberry-smoothie-almond-milk/
569487a8-197f-4776-92c3-102e86203c8b	Blueberry Yogurt Parfait	Fresh blueberries, creamy vanilla yogurt and crunchy granola settle into loving layers in this wonderfully satisfying blueberry yogurt parfait recipe!	1. Set aside 1 glass jar or cup.\n2. Spoon 1/3 cup yogurt into the bottom of the jar, creating an even, smooth layer.\n3. Sprinkle blueberries over the yogurt, creating a single or double layer, depending on the size of your jar.\n4. Optionally, sprinkle granulated monkfruit or sweetener of choice over the berries. Add more to sweeten tart fruit, less if the fruit is already very sweet or you like your parfait on the less sweet side.\n5. Pour 1 tablespoon of your favorite granola over the sweetened fruit layer. I like baking up a fresh batch of low calorie granola or gluten free granola for my blueberry parfaits.\n6. Repeat this sequence twice more. Serve and enjoy!\n7. ★ Last Step: If you made this recipe, leave a comment and review. It truly helps our small business keep running and it helps readers like you!	2	5	\N	{blueberry,yogurt,parfait,breakfast,snack,vegetarian,breastfeeding-safe}	url-import	https://beamingbaker.com/wp-content/uploads/2022/07/IGT-blueberry-yogurt-parfait-blueberry-parfait-5.jpg	\N	2026-03-16 21:45:07.839396-07	f	2097f77e-d172-482d-99d0-57604afc5900	blueberry-yogurt-parfait	https://beamingbaker.com/blueberry-yogurt-parfait/
daaf1fef-ffc7-41ef-ad4a-7bc6f14d3306	Dirty Chai Latte	A warming dirty chai latte made with strong brewed coffee from the Ninja and homemade almond milk. All the spiced chai flavor with a coffee kick, no espresso machine needed.	1. Steep 2 chai tea bags in 1 cup of boiling water for 5 minutes. Remove bags and squeeze out excess liquid.\n2. While tea steeps, brew a small batch of strong coffee using the Ninja Coffee Brewer on the Rich setting.\n3. Heat almond milk in a small saucepan or microwave until steaming.\n4. Combine chai tea and coffee in a mug.\n5. Add honey and stir to dissolve.\n6. Pour in warm almond milk. Dust with cinnamon and serve.\n7. Compost: Used tea bags and coffee grounds can go in your Waste Cycler.	1	2	5	{coffee,chai,tea,breakfast,mixology,gluten-free,breastfeeding-alert}	manual	https://myeverydaytable.com/wp-content/uploads/DirtyChaiLatte-6.jpg	\N	2026-03-17 20:59:00.947891-07	f	2097f77e-d172-482d-99d0-57604afc5900	dirty-chai-latte	\N
350fa316-fd7b-4c31-84c7-18a2966cc4da	Smoked Salmon Bagel	Quick and easy to make this cream cheese and smoked salmon bagel is the perfect brunch recipe. Full of fresh flavors, every bite is delicious!	1. In a small bowl, combine the cream cheese, lemon juice, fresh dill and salt and pepper, to taste.\n2. Toast the bagels, then spread the cream cheese mixture on both sides of the bagel. Add the cucumbers, smoked salmon, capers and red onions on the bottom of the toasted bagels. Top with the top of the bagels.\n3. Compost: Cucumber peels, dill stems, lemon rinds, and onion skins can go in your Waste Cycler. Do not add salmon scraps or cream cheese.	2	10	\N	{breakfast,brunch,main-course,pacific-northwest,no-cook}	url-import	https://feelgoodfoodie.net/wp-content/uploads/2021/03/smoked-salmon-bagel-13.jpg	\N	2026-03-16 22:11:38.94539-07	f	2097f77e-d172-482d-99d0-57604afc5900	smoked-salmon-bagel	https://feelgoodfoodie.net/recipe/smoked-salmon-bagel/
70163822-a1e6-4a76-b21d-d231639e3424	Dragon Fruit Sorbet	This nice cream looks too pretty to eat — dragon fruit paired with banana is a sweet duo you won't want to miss.	1. Peel and freeze dragon fruits and bananas ahead of time (at least 4 hours).\n2. Feed frozen dragon fruit and frozen bananas through the slow juicer using the sorbet strainer.\n3. Scoop into bowls and serve immediately.\n4. Compost: Dragon fruit skins and banana peels can go in your Waste Cycler.	3	10	0	{dessert,cold-press,healthy,gluten-free,vegan,no-cook,summer}	url-import	https://www.kuvingsusa.com/cdn/shop/articles/Dragon_Fruit_Sorbet_SQ.png?v=1768423370&width=1024	\N	2026-03-19 10:06:13.750531-07	f	2097f77e-d172-482d-99d0-57604afc5900	dragon-fruit-sorbet	https://www.kuvingsusa.com/blogs/recipes/dragon-fruit-sorbet
4b49372d-beb1-4006-8918-acec20387015	Orange Juice	The vitamin C and antioxidants in oranges are well-known to boost immunity. Oranges are also great for your skin.	1. Peel oranges, removing the bitter white pith.\n2. Feed orange segments through the slow juicer.\n3. Stir and serve immediately.\n4. Compost: Orange peels and pulp can go in your Waste Cycler.	2	5	0	{juice,cold-press,healthy,gluten-free,vegan,citrus,quick,breakfast,breastfeeding-safe}	url-import	https://www.kuvingsusa.com/cdn/shop/articles/kuvings-recipe-orange-juice.png?v=1768505239&width=1024	\N	2026-03-19 10:09:31.497383-07	f	2097f77e-d172-482d-99d0-57604afc5900	orange-juice	https://www.kuvingsusa.com/blogs/recipes/orange-juice
748747fb-7ca8-4ba3-9f64-a549f009744d	Raspberry Chia Seed Jam	Super easy and healthy Raspberry jam made in Instant pot	1. Add the raspberries to the Instant pot. Add lemon juice and lemon zest and maple syrup and stir it once.\n2. Pressure cook for 5 minutes in Manual/Pressure cook mode, vent in sealing position. Once the timer is done, let the pressure release naturally.\n3. Mash the cooked raspberries gently with a potato masher and stir in the Chia seeds. Let the jam sit in the instant pot till it cools down completely and thickens. Transfer to an airtight container and store in the refrigerator.\n4. Compost: Lemon rinds can go in your Waste Cycler.	1	5	5	{breakfast,preserves,canning,gluten-free,breastfeeding-safe}	manual	https://www.gimmesomeoven.com/wp-content/uploads/2018/01/Homemade-10-Minute-Chia-Seed-Jam-Recipe-8.jpg	\N	2026-03-27 16:17:17.674116-07	f	2097f77e-d172-482d-99d0-57604afc5900	raspberry-chia-seed-jam	\N
4fcfff0f-56aa-4bf6-a84b-8d701f796671	Baby Asparagus Purée with Breast Milk	A mild, earthy green purée introducing asparagus to babies 6+ months. Steamed tender in the Grownsy and blended with breast milk for a smooth, familiar finish.	1. Wash 6-8 asparagus spears and snap off the woody ends. Cut into 1-inch pieces.\n2. Add asparagus pieces and 1/4 cup water to the Grownsy Baby Food Maker steam basket.\n3. Steam for 12-15 minutes until asparagus is completely tender.\n4. Transfer steamed asparagus to the blending cup.\n5. Add 2-3 tablespoons of breast milk.\n6. Blend until smooth. Asparagus can be fibrous — blend longer for a silkier result.\n7. For extra smoothness, push through a fine mesh sieve.\n8. Let cool to a safe temperature before serving.\n9. Freeze leftovers in ice cube trays for up to 1 month.	4	5	15	{baby-food,first-foods,gluten-free,breastfeeding-safe,pregnancy-safe}	manual	https://babyfoode.com/wp-content/uploads/2023/11/asparagus-for-baby-puree-and-baby-led-weaning.png	\N	2026-03-26 11:15:19.887503-07	f	2097f77e-d172-482d-99d0-57604afc5900	baby-asparagus-pure-with-breast-milk	\N
adabc033-1481-4af1-91d5-fe59df7da495	Instant Pot Carrot Ginger Soup	This Instant Pot Carrot Ginger Soup is a quick and easy vegan soup recipe made with creamy coconut milk that's super nutritious!	1. Add everything except for chives to Instant Pot in the order in which they are listed. Place lid on Instant Pot and make sure the valve is set to seal.\n2. Press the pressure cook button and set to high, then cook for 3 minutes. Instant Pot will take about 10-20 minutes to come to pressure, then pressure cook for 3 minutes.\n3. Do a quick release of the pressure by flicking the switch at the top with a spoon, then open lid when pressure gauge has dropped and lid opens easily.\n4. Puree mixture with an immersion blender, then serve among bowls with chives or parsley as garnish. Serve and enjoy!\n5. Compost: Carrot peels, onion skins, ginger peels, and chive trimmings can go in your Waste Cycler. Do not add coconut milk residue.	2	15	15	{instant-pot,soup,vegan,gluten-free}	manual	https://eatinginstantly.com/wp-content/uploads/2019/03/Instant-Pot-Carrot-Ginger-Soup-13.jpg	2026-03-17 19:02:51.53574-07	2026-03-17 15:57:34.17311-07	f	2097f77e-d172-482d-99d0-57604afc5900	instant-pot-carrot-ginger-soup	\N
ab76c10a-356a-4e4a-b0e7-cf3c938b2e1e	Ridiculously Easy Sheet Pan Chicken with Veggies	This no-fuss, flavor-packed dinner comes together in no time. You'll love this Ridiculously Easy Sheet Pan Chicken with Veggies because of the juicy, seasoned chicken, perfectly roasted veggies, and a zesty lemon finish. Everything cooks on a single sheet pan for minimal cleanup, perfect for busy weeknights.	1. Preheat the oven to 425 degrees. If your oven runs hot, do 400 degrees. In a large bowl whisk together the olive oil, salt, pepper, garlic powder, onion powder, oregano and lemon zest. Set aside. \n2. Line a baking sheet with parchment paper and add the potatoes, onion and bell pepper. Toss with a little of the dressing (just enough to coat the veggies), spread evenly on the sheet pan and roast for 20 minutes. \n3. Add the broccoli, chicken and garlic to the large bowl with the remaining dressing. Toss until well coated. Remove the sheet pan after 20 minutes and add the coated chicken and broccoli to the pan in one even layer.\n4. Put back in the oven and roast for 20 more minutes until chicken is cooked through and veggies are golden. Finish with fresh lemon juice and serve on its own or over rice, quinoa or pasta.\n5. Compost: Potato peels, onion skins, pepper cores, broccoli stems, lemon rinds, and garlic skins can go in your Waste Cycler. Do not add chicken trimmings or oil.	2	10	40	{dinner,gluten-free}	manual	https://thebigmansworld.com/wp-content/uploads/2024/11/sheet-pan-chicken-and-veggies-recipe.jpg	\N	2026-03-17 20:07:58.769426-07	f	2097f77e-d172-482d-99d0-57604afc5900	ridiculously-easy-sheet-pan-chicken-with-veggies	\N
a2fd26aa-5e71-402b-91c7-d6ee01062ab9	Peaches and Cream Milkshake	A rich, creamy milkshake made with Peaches and Cream ice cream and fresh homemade Almond Milk.	1. Make a batch of Almond Milk if you don't have some ready.\n2. Add 3 scoops of Peaches and Cream ice cream to your Vitamix.\n3. Pour in 1 cup of Almond Milk.\n4. Blend on medium speed for 15-20 seconds until smooth and thick.\n5. Pour into a chilled glass. Top with a pinch of cinnamon if desired.\n6. Compost: Almond pulp from making Almond Milk can go in your Waste Cycler. Do not add dairy-based ice cream residue.	2	5	0	{milkshake,dessert,quick,local,sustainable}	manual	https://domesticallyblissful.com/wp-content/uploads/2015/07/Peaches-Cream-Milkshake.png	2026-03-24 20:26:56.859283-07	2026-03-24 18:25:50.038521-07	f	2097f77e-d172-482d-99d0-57604afc5900	peaches-and-cream-milkshake	\N
fdfaec68-1409-4b81-8639-a1dfb67a780b	Baby Carrot Purée with Breast Milk	A smooth, naturally sweet first food for babies 6+ months. Carrots steamed in the Grownsy baby food maker and blended with breast milk for a familiar, comforting flavor.	1. Wash and peel 2 medium carrots, then cut into small chunks.\n2. Add carrot chunks and 1/4 cup water to the Grownsy Baby Food Maker steam basket.\n3. Steam for 15 minutes until carrots are completely tender and easily pierced with a fork.\n4. Transfer steamed carrots to the blending cup.\n5. Add 2-3 tablespoons of breast milk.\n6. Blend until perfectly smooth, adding more breast milk as needed for desired consistency.\n7. Let cool to a safe temperature before serving.\n8. Store extras in ice cube trays for easy portioning — freeze up to 1 month.	4	5	15	{baby-food,first-foods,gluten-free,breastfeeding-safe,pregnancy-safe}	manual	https://babyfoode.com/wp-content/uploads/2020/07/carrot-baby-food-puree-1.png	\N	2026-03-26 11:15:19.776362-07	f	2097f77e-d172-482d-99d0-57604afc5900	baby-carrot-pure-with-breast-milk	\N
2d57c883-cc8f-4f28-88dc-953483e5b51b	Baby Broccoli Purée with Breast Milk	A nutrient-dense green purée for babies 6+ months. Broccoli florets steamed until tender in the Grownsy and blended smooth with breast milk.	1. Wash 1 cup of broccoli florets and cut into small, even pieces.\n2. Add broccoli florets and 1/4 cup water to the Grownsy Baby Food Maker steam basket.\n3. Steam for 12-15 minutes until florets are very soft.\n4. Transfer steamed broccoli to the blending cup.\n5. Add 2-3 tablespoons of breast milk.\n6. Blend until smooth, scraping down sides as needed. Add more breast milk for thinner consistency.\n7. Let cool to a safe temperature before serving.\n8. Freeze leftovers in ice cube trays for up to 1 month.	4	5	15	{baby-food,first-foods,gluten-free,breastfeeding-safe,pregnancy-safe}	manual	https://babyfoode.com/wp-content/uploads/2022/02/broccoli_puree_for_baby.jpg	\N	2026-03-26 11:15:19.839712-07	f	2097f77e-d172-482d-99d0-57604afc5900	baby-broccoli-pure-with-breast-milk	\N
3449a857-00b1-4ddb-a648-1cebd4d7056e	Beginner Chickpea & Veggie Curry	A forgiving, one-pot Indian curry perfect for absolute beginners. Uses everyday pantry staples and whatever vegetables you have on hand. Works in the Instant Pot (15 min pressure cook) or on the stovetop in your Always Pan (25 min simmer).	1. Prep all your vegetables: dice the onion and bell pepper, grate the ginger, mince the garlic, slice the carrots into coins, and cut broccoli into bite-sized florets. Drain and rinse the chickpeas.\n\n2. INSTANT POT: Set to Sauté mode. Add olive oil and let it heat for 1 minute. STOVETOP: Heat olive oil in your Always Pan over medium heat.\n\n3. Add the diced onion and cook for 3–4 minutes until soft and translucent. Slightly golden is fine too.\n\n4. Add the garlic and grated ginger. Stir for 30 seconds until fragrant. This is the flavor base of the whole dish.\n\n5. Add curry powder, cumin, turmeric, and chili powder (if using). Stir into the onion mixture for 1 minute. The spices should smell toasty and coat everything. If it sticks, add a splash of water.\n\n6. Pour in the crushed tomatoes and coconut milk. Stir well, scraping up any bits from the bottom.\n\n7. Add the chickpeas, carrots, bell pepper, and broccoli. Stir to combine.\n\n8. INSTANT POT: Cancel Sauté. Lock the lid, set the valve to Sealing, and Pressure Cook on High for 3 minutes. Let it Natural Release for 10 minutes, then Quick Release any remaining pressure. STOVETOP: Bring to a gentle boil, then reduce heat to low. Cover and simmer for 20–25 minutes until the carrots are tender.\n\n9. Stir in the butter and a squeeze of lemon juice. Taste and add salt as needed.\n\n10. Serve over rice or with naan. Top with chopped cashews.\n\nCompost: Onion skins, garlic skins, ginger peels, broccoli stems, carrot tops, bell pepper core and seeds, chickpea can label, and lemon rinds can all go in the Waste Cycler.	4	10	30	{indian,curry,beginner,one-pot,instant-pot,vegetarian,weeknight}	manual	https://rainbowplantlife.com/wp-content/uploads/2023/02/chickpea-curry-cover-photo-1-of-1.jpg	\N	2026-03-27 22:46:00.970742-07	f	2097f77e-d172-482d-99d0-57604afc5900	beginner-chickpea-veggie-curry	\N
e9c15d13-1a30-43c5-b61e-0bbd15b59091	Peanut Butter Banana Bread	A moist, rich banana bread swirled with peanut butter. Uses pantry staples — just grab bananas and baking soda.	Preheat oven to 350°F. Grease a 9x5 loaf pan with butter.\nIn a large bowl, mash 3 ripe bananas until smooth.\nStir in 1/3 cup melted butter, 3/4 cup sugar, 1 beaten egg, and 1 tsp vanilla extract.\nIn a separate bowl, whisk together 1 cup all-purpose flour, 1 tsp baking soda, and 1/2 tsp cinnamon.\nFold dry ingredients into wet ingredients until just combined — do not overmix.\nDrop spoonfuls of peanut butter (about 3 tbsp) across the top and swirl with a knife.\nPour batter into prepared pan.\nBake for 55–65 minutes until a toothpick inserted in the center comes out clean.\nLet cool in the pan for 10 minutes, then transfer to a wire rack.	8	10	60	{breakfast,baking,snack,lactation}	pantry-generated	https://www.ambitiouskitchen.com/wp-content/uploads/2022/10/Peanut-Butter-Lovers-Banana-Bread-4.jpg	\N	2026-03-25 18:26:42.870788-07	f	2097f77e-d172-482d-99d0-57604afc5900	peanut-butter-banana-bread	\N
d4988716-d9fb-403b-9b27-fda652ab7363	Banana Blueberry Peanut Butter Smoothie Bowls	A thick, creamy breakfast or snack bowl made by blending frozen fruit, banana, and Greek yogurt in the Venturist 1200 blender. Topped with almonds, coconut shreds, and a drizzle of peanut butter for satisfying crunch and protein.	1. Peel the bananas and break them into chunks. If they are fresh, place them in the freezer for 20 minutes for a thicker result.\n2. Add the banana chunks, frozen blueberries, frozen raspberries, and Greek yogurt to the Venturist 1200 blender jar.\n3. Add 2 tablespoons of powdered peanut butter and a small splash of vanilla extract.\n4. Blend on high for 30–45 seconds, stopping to scrape down sides as needed. The mixture should be very thick — like soft-serve ice cream. Add a tablespoon of water only if the blender struggles, but keep it thick.\n5. Divide the mixture evenly between two bowls using a spatula.\n6. Top each bowl with a small handful of almonds, a sprinkle of coconut shreds, and a few extra fresh or frozen blueberries.\n7. Warm 1 tablespoon of peanut butter in a small dish until just drizzleable (10 seconds in a warm pan or brief microwave). Drizzle over each bowl.\n8. Serve immediately with a spoon.\n9. Compost: Banana peels are always OK to compost. Blueberry stems or any fruit scraps are OK.	2	10	0	{breakfast,smoothie-bowl,no-cook,vegetarian,high-protein,kid-friendly,breastfeeding-safe}	ai-generated	https://www.ambitiouskitchen.com/wp-content/uploads/2020/02/Peanut-Butter-Blueberry-Banana-Smoothie-2.jpg	2026-04-01 03:43:31.891839-07	2026-03-25 16:51:24.388866-07	f	2097f77e-d172-482d-99d0-57604afc5900	banana-blueberry-peanut-butter-smoothie-bowls	\N
e5b53596-0e23-4a4a-b08b-8cc368ce7a4e	Blackstone Cottage Cheese Pancakes	Extra fluffy, protein-packed pancakes made with Caputo 00 flour, cottage cheese, and sour cream on the Blackstone griddle. The 00 flour gives them a tender, almost crepe-like interior while the cottage cheese adds richness and protein.	1. Preheat the Blackstone griddle to 350°F (medium-low). The surface is ready when a few drops of water dance and sizzle but don’t evaporate instantly — too hot and the outside burns before the inside cooks.\n2. In a large bowl, whisk together the Caputo 00 flour, sugar, baking powder, baking soda, and salt.\n3. In a separate bowl, blend the cottage cheese with an immersion blender or fork until mostly smooth (small curds are fine). Whisk in the eggs, sour cream, milk, melted butter, and vanilla.\n4. Pour the wet ingredients into the dry and fold gently until just combined. A few lumps are good — overmixing 00 flour makes the pancakes tough. Let the batter rest 5 minutes.\n5. Oil the griddle surface lightly with butter or a neutral oil. Pour ¼ cup batter per pancake.\n6. Cook until bubbles form on the surface and the edges look set, about 2–3 minutes. Flip and cook another 1–2 minutes until golden brown.\n7. Serve immediately with maple syrup, fresh berries, or a dollop of sour cream.\n8. Compost: Eggshells can go in your Waste Cycler. Do not add cottage cheese, sour cream, butter, or milk.	4	10	15	{breakfast,pancakes,griddle,protein}	manual	https://feelgoodfoodie.net/wp-content/uploads/2023/04/Cottage-Cheese-Pancakes-12.jpg	\N	2026-03-17 22:48:36.318466-07	f	2097f77e-d172-482d-99d0-57604afc5900	blackstone-cottage-cheese-pancakes	\N
10288612-86f9-4856-90da-79057817d759	Croissant w/ Raspberry Jam	A simple brunch appetizer pairing a fresh slow-rise croissant with homemade raspberry chia seed jam. Best served warm.	1. Warm the croissant in a 300°F oven for 3–5 minutes until lightly crisp.\n2. Split the croissant along the side.\n3. Spoon a generous amount of Raspberry Chia Seed Jam onto the bottom half.\n4. Close and serve immediately.	1	2	5	{brunch,appetizer,pastry,quick}	manual	https://cooking-without-limits.com/wp-content/uploads/2013/09/gab_0351_res_mix.jpg	\N	2026-03-27 16:36:02.929492-07	f	2097f77e-d172-482d-99d0-57604afc5900	croissant-raspberry-jam	\N
6661a800-c71a-4c75-9df5-0352f8ed3ba4	Baby Banana Pancakes	A simple two-ingredient pancake perfect for babies and toddlers. No flour, no sugar, no dairy — just ripe banana and egg.	1. Peel the banana and mash thoroughly with a fork until smooth with no large lumps.\n2. Crack the egg into the bowl and whisk together with the mashed banana until well combined.\n3. Heat the Titanium Mini Always Pan® Pro over medium-low heat. No oil needed — the titanium surface releases cleanly.\n4. Pour small rounds (about 2 tablespoons each) of batter into the pan.\n5. Cook for 1–2 minutes until the edges look set and the bottom is lightly golden.\n6. Flip gently and cook 30–60 seconds more.\n7. Let cool slightly before serving. Cut into small pieces for babies under 12 months.	1	2	5	{baby-food,first-foods,breastfeeding-safe,egg,banana,quick}	manual	https://babyfoode.com/wp-content/uploads/2020/12/banana_pancakes_baby-5.jpg	\N	2026-03-30 02:48:18.813331-07	f	2097f77e-d172-482d-99d0-57604afc5900	baby-banana-pancakes	\N
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

\unrestrict loJVFLBOhFtOF5LVNp2ahSBLuGYfeIAMjbpIOttrUg0XRvbaJERANkSMHfkfplU

