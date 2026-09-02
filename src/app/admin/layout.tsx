export const metadata = {
  title: "Admin — Local Buzz",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
