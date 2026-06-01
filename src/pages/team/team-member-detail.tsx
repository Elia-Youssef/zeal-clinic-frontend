import { useParams } from "react-router-dom";
import { EmployeeDetailView } from "@/components/shared/employee-detail-view";
import { usePageTitle } from "@/hooks/use-page-title";

export default function EmployeeDetailPage() {
  usePageTitle("Employee");
  const { id = "" } = useParams<{ id: string }>();
  return <EmployeeDetailView employeeId={id} />;
}
