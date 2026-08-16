import { AuthPanel } from "@/components/AuthPanel";
import { AuthShell } from "@/components/auth/AuthShell";

export default function LoginPage() { return <AuthShell><AuthPanel mode="login" /></AuthShell>; }
