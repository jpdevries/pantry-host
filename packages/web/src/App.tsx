import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import HomePage from './pages/HomePage';
import RecipesPage from './pages/RecipesPage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import RecipeNewPage from './pages/RecipeNewPage';
import RecipeEditPage from './pages/RecipeEditPage';
import IngredientsPage from './pages/IngredientsPage';
import GroceryListPage from './pages/GroceryListPage';
import CookwarePage from './pages/CookwarePage';
import CookwareDetailPage from './pages/CookwareDetailPage';
import MenusPage from './pages/MenusPage';
import MenuDetailPage from './pages/MenuDetailPage';
import MenuNewPage from './pages/MenuNewPage';
import MenuEditPage from './pages/MenuEditPage';
import BlueskyFeedsPage from './pages/BlueskyFeedsPage';
import BlueskyMenuFeedsPage from './pages/BlueskyMenuFeedsPage';
import RecipeImportPage from './pages/RecipeImportPage';
import KitchensPage from './pages/KitchensPage';
import AccessibilityPage from './pages/AccessibilityPage';
import SettingsPage from './pages/SettingsPage';
import AtImportPage from './pages/AtImportPage';
import UrlImportPage from './pages/UrlImportPage';
import BlueskyCallbackPage from './pages/BlueskyCallbackPage';
import { BlueskyAuthProvider } from '@pantry-host/shared/contexts/BlueskyAuth';

/**
 * Kitchen-scoped routes — rendered at both top level (home kitchen)
 * and under /kitchens/:kitchen/. The :kitchen param is read by
 * useKitchen() hook; when absent (top-level), defaults to 'home'.
 */
const KITCHEN_ROUTES = [
  { path: 'recipes', element: <RecipesPage /> },
  { path: 'recipes/new', element: <RecipeNewPage /> },
  { path: 'recipes/import', element: <RecipeImportPage /> },
  { path: 'recipes/feeds/bluesky', element: <BlueskyFeedsPage /> },
  { path: 'recipes/:slug', element: <RecipeDetailPage /> },
  { path: 'recipes/:slug/edit', element: <RecipeEditPage /> },
  { path: 'ingredients', element: <IngredientsPage /> },
  { path: 'list', element: <GroceryListPage /> },
  { path: 'cookware', element: <CookwarePage /> },
  { path: 'cookware/:id', element: <CookwareDetailPage /> },
  { path: 'menus', element: <MenusPage /> },
  { path: 'menus/new', element: <MenuNewPage /> },
  { path: 'menus/feeds/bluesky', element: <BlueskyMenuFeedsPage /> },
  { path: 'menus/:slug', element: <MenuDetailPage /> },
  { path: 'menus/:slug/edit', element: <MenuEditPage /> },
];

export default function App() {
  return (
    <BrowserRouter>
      <BlueskyAuthProvider callbackPath="/oauth/bluesky/callback">
        <Routes>
          <Route path="/oauth/bluesky/callback" element={<BlueskyCallbackPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            {/* Top-level = home kitchen */}
            {KITCHEN_ROUTES.map((r) => (
              <Route key={r.path} path={`/${r.path}`} element={r.element} />
            ))}
            {/* Kitchen-scoped */}
            <Route path="/kitchens" element={<KitchensPage />} />
            {KITCHEN_ROUTES.map((r) => (
              <Route key={`k-${r.path}`} path={`/kitchens/:kitchen/${r.path}`} element={r.element} />
            ))}
            <Route path="/at/*" element={<AtImportPage />} />
            <Route path="/http/*" element={<UrlImportPage scheme="http" />} />
            <Route path="/https/*" element={<UrlImportPage scheme="https" />} />
            <Route path="/accessibility" element={<AccessibilityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BlueskyAuthProvider>
    </BrowserRouter>
  );
}
