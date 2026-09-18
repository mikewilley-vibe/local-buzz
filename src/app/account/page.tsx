import { ContributorAccount } from "@/components/ContributorAccount";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata = {
  title: `Contributor account — ${PRODUCT_NAME}`,
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <ContributorAccount />;
}
