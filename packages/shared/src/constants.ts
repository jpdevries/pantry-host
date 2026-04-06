export const CATEGORY_GROUPS = [
  {
    label: 'Fresh',
    categories: ['vegetables', 'fruit', 'fresh herbs', 'dairy'],
  },
  {
    label: 'Protein',
    categories: ['meat & poultry', 'seafood & fish', 'eggs', 'tofu & tempeh', 'legumes & pulses', 'nuts & seeds'],
  },
  {
    label: 'Shelf Stable',
    categories: ['dry goods & grains', 'canned & jarred', 'condiments & sauces', 'herbs & spices', 'oils & vinegars', 'baking'],
  },
  {
    label: 'Cold & Frozen',
    categories: ['frozen', 'deli & charcuterie'],
  },
  {
    label: 'Other',
    categories: ['beverages', 'snacks', 'other'],
  },
] as const;

export const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap((g) => g.categories);
export type Category = typeof ALL_CATEGORIES[number];

/** Flat alias for backward compatibility */
export const CATEGORIES = ALL_CATEGORIES;


export const UNIT_GROUPS = [
  {
    label: 'Volume',
    units: ['tsp', 'tbsp', 'fl oz', 'cup', 'pt', 'qt', 'gal', 'ml', 'L'],
  },
  {
    label: 'Weight',
    units: ['oz', 'lb', 'g', 'kg'],
  },
  {
    label: 'Count',
    units: ['whole', 'dozen', 'can', 'jar', 'bunch', 'head', 'clove', 'stalk', 'slice'],
  },
  {
    label: 'Pinch / Taste',
    units: ['pinch', 'dash', 'to taste'],
  },
] as const;

export const ALL_UNITS = UNIT_GROUPS.flatMap((g) => g.units);

export const COMMON_INGREDIENTS = [
  // Produce
  'Apple', 'Avocado', 'Banana', 'Bell pepper', 'Broccoli', 'Carrot', 'Celery',
  'Cherry tomato', 'Cucumber', 'Garlic', 'Ginger', 'Green beans', 'Jalapeño',
  'Kale', 'Lemon', 'Lettuce', 'Lime', 'Mushrooms', 'Onion', 'Orange',
  'Potato', 'Red onion', 'Scallion', 'Shallot', 'Spinach', 'Sweet potato',
  'Tomato', 'Zucchini',
  // Dairy
  'Butter', 'Cheddar cheese', 'Cream cheese', 'Eggs', 'Greek yogurt',
  'Heavy cream', 'Milk', 'Mozzarella', 'Parmesan', 'Sour cream',
  // Protein
  'Bacon', 'Beef ground', 'Chicken breast', 'Chicken thighs', 'Chorizo',
  'Cod', 'Ground turkey', 'Ham', 'Italian sausage', 'Pork chops',
  'Salmon', 'Shrimp', 'Steak', 'Tuna (canned)',
  // Pantry
  'All-purpose flour', 'Baking powder', 'Baking soda', 'Black beans',
  'Brown sugar', 'Chicken broth', 'Chickpeas', 'Coconut milk', 'Cornstarch',
  'Diced tomatoes', 'Honey', 'Lentils', 'Maple syrup', 'Oats', 'Olive oil',
  'Panko breadcrumbs', 'Pasta', 'Peanut butter', 'Rice', 'Sesame oil',
  'Soy sauce', 'Sugar', 'Tomato paste', 'Vanilla extract', 'Vegetable broth',
  'White wine vinegar', 'Worcestershire sauce',
  // Spices
  'Black pepper', 'Cayenne pepper', 'Chili powder', 'Cinnamon', 'Cumin',
  'Garlic powder', 'Italian seasoning', 'Onion powder', 'Oregano', 'Paprika',
  'Red pepper flakes', 'Salt', 'Smoked paprika', 'Thyme', 'Turmeric',
];

/** Tags used internally but hidden from user-facing tag clouds */
export const HIDDEN_TAGS = new Set(['common']);

/** Menu category options and their display order */
export const MENU_CATEGORIES: { value: string; label: string }[] = [
  { value: 'todays-specials', label: "Today's Specials" },
  { value: 'this-week', label: 'This Week' },
  { value: 'daily', label: 'Daily' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
  { value: 'social', label: 'Social' },
  { value: 'baby', label: 'Baby' },
];

export const MENU_CATEGORY_ORDER: Record<string, number> = Object.fromEntries(
  MENU_CATEGORIES.map((c, i) => [c.value, i])
);

export const COMMON_COOKWARE = [
  'Air Fryer',
  'Cast Iron Skillet',
  'Dutch Oven',
  'Food Processor',
  'Grill',
  'Immersion Blender',
  'Instant Pot',
  'Mandoline',
  'Pizza Oven',
  'Pressure Cooker',
  'Slow Cooker',
  'Smoker',
  'Sous Vide',
  'Stand Mixer',
  'Vitamix',
  'Waffle Iron',
  'Wok',
];

// ── Menu course classification ──

export const COURSE_TAGS: Record<string, string[]> = {
  appetizer: ['appetizer', 'apps', 'starter', 'charcuterie'],
  breakfast: ['breakfast', 'brunch', 'pancakes', 'eggs'],
  'main-course': ['main-course', 'dinner', 'entree', 'lunch'],
  side: ['side', 'sides'],
  beverage: ['beverage', 'drink', 'coffee', 'tea', 'chai', 'smoothies', 'shakes', 'milk', 'creamer', 'mixology'],
  dessert: ['dessert', 'sweets', 'baking'],
};

export const COURSE_LABELS: Record<string, string> = {
  appetizer: 'Appetizers',
  breakfast: 'Breakfast',
  'main-course': 'Main Course',
  side: 'Sides',
  beverage: 'Beverages',
  dessert: 'Dessert',
  baby: 'Baby',
  other: 'Other',
};

/** Auto-classify a recipe's course from its tags. */
export function classifyRecipeCourse(tags: string[]): string {
  const lower = tags.map((t) => t.toLowerCase());
  for (const [course, courseTags] of Object.entries(COURSE_TAGS)) {
    if (lower.some((t) => courseTags.includes(t))) return course;
  }
  return 'other';
}
