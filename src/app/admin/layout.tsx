import { PRODUCT_NAME } from "@/lib/brand";

export const metadata = {
  title: `Admin — ${PRODUCT_NAME}`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
