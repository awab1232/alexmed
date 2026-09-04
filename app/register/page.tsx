import RegisterForm from "@/components/RegisterForm";
import { googleEnabled } from "@/lib/auth";

export default function RegisterPage() {
  return <RegisterForm googleEnabled={googleEnabled} />;
}
