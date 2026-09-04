import LoginForm from "@/components/LoginForm";
import { googleEnabled } from "@/lib/auth";

export default function LoginPage() {
  return <LoginForm googleEnabled={googleEnabled} />;
}
