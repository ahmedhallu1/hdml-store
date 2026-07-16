import type { Metadata } from "next";
import {
  CatalogListing,
  parseCatalogParams,
  type RawSearchParams,
} from "@/components/site/catalog-listing";

export const metadata: Metadata = {
  title: "Catalog",
  description:
    "Browse the full HDML wholesale catalog — phone accessories, chargers, audio, storage, networking and more at bulk prices in EGP.",
};

export default async function CatalogPage(props: {
  searchParams: Promise<RawSearchParams>;
}) {
  const searchParams = await props.searchParams;
  const params = parseCatalogParams(searchParams);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Catalog</h1>
      <p className="mt-1 text-sm text-gray-600">
        Wholesale prices in EGP. Minimum order quantities apply per product.
      </p>
      <div className="mt-6">
        <CatalogListing params={params} basePath="/catalog" />
      </div>
    </div>
  );
}
