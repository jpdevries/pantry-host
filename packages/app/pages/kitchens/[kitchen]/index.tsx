import HomePage, { type HomeData } from '@/components/pages/HomePage';
import { getPageData, type PageDataContext, type PageDataProps } from '@/lib/pageData';

export async function getServerSideProps(ctx: PageDataContext) {
  return getPageData<HomeData>('/kitchens/:kitchen', ctx);
}

export default function KitchenDashboard({ initialData }: PageDataProps<HomeData>) {
  return <HomePage initialData={initialData} />;
}
