import HomePage, { type HomeData } from '@/components/pages/HomePage';
import { getPageData, type PageDataContext, type PageDataProps } from '@/lib/pageData';

export async function getServerSideProps(ctx: PageDataContext) {
  return getPageData<HomeData>('/', ctx);
}

export default function Home({ initialData }: PageDataProps<HomeData>) {
  return <HomePage initialData={initialData} />;
}
