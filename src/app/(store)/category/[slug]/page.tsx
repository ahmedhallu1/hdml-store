import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryBySlug } from "@/lib/catalog";
import {
  CatalogListing,
  parseCatalogParams,
  type RawSearchParams,
} from "@/components/site/catalog-listing";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };
  return {
    title: category.name,
    description: `Wholesale ${category.name} at bulk prices in EGP from HDML — delivered across Egypt.`,
  };
}

export default async function CategoryPage(props: Props) {
  const [{ slug }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const params = parseCatalogParams(searchParams);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand-700">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="font-medium text-gray-900">
            {category.name}
          </li>
        </ol>
      </nav>

      <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        {category.name}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Wholesale prices in EGP. Minimum order quantities apply per product.
      </p>

      <div className="mt-6">
        <CatalogListing
          params={params}
          basePath={`/category/${category.slug}`}
          lockedCategory={category}
        />
      </div>
    </div>
  );
}
