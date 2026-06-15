import TopNav from "@/components/layout/TopNav";
import DashboardContent from "@/components/dashboard/DashboardContent";

export default function DashboardPage() {
  return (
    <>
      <TopNav />
      <main className="main-content">
        <DashboardContent />
      </main>
    </>
  );
}
