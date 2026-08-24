import { AuthPanel } from "@/components/AuthPanel";
import { AuthRoute } from "@/components/auth/AuthRoute";
import { AuthShell } from "@/components/auth/AuthShell";

export default function SignupPage() {
  return (
    <AuthShell eyebrow="Create your account">
      <AuthRoute>
        <AuthPanel mode="register" />
      </AuthRoute>
    </AuthShell>
  );
}
