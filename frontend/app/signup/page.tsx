import { AuthPanel } from "@/components/AuthPanel";
import { AuthShell } from "@/components/auth/AuthShell";

export default function SignupPage() {
  return <AuthShell eyebrow="Your learning network"><AuthPanel mode="register" /></AuthShell>;
}
