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
import RecipeImportPage from './pages/RecipeImportPage';
import AccessibilityPage from './pages/AccessibilityPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/recipes/new" element={<RecipeNewPage />} />
          <Route path="/recipes/import" element={<RecipeImportPage />} />
          <Route path="/recipes/:slug" element={<RecipeDetailPage />} />
          <Route path="/recipes/:slug/edit" element={<RecipeEditPage />} />
          <Route path="/ingredients" element={<IngredientsPage />} />
          <Route path="/list" element={<GroceryListPage />} />
          <Route path="/cookware" element={<CookwarePage />} />
          <Route path="/cookware/:id" element={<CookwareDetailPage />} />
          <Route path="/menus" element={<MenusPage />} />
          <Route path="/accessibility" element={<AccessibilityPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
