import { AuthPanel } from "@/components/AuthPanel";
import { AuthRoute } from "@/components/auth/AuthRoute";
import { AuthShell } from "@/components/auth/AuthShell";

export default function LoginPage() {
  return (
    <AuthShell>
      <AuthRoute>
        <AuthPanel mode="login" />
      </AuthRoute>
    </AuthShell>
  );
}
