import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/admin/login-form";
import logoIcon from "@/public/logo-icon.png";

export const metadata: Metadata = { title: "Sign In" };

export default function AdminLoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-line bg-white p-8 shadow-sm">
        <Image src={logoIcon} alt="" className="h-14 w-auto" />
        <h1 className="mt-4 font-serif text-2xl font-semibold text-ink">KTY Admin</h1>
        <p className="mt-1 text-sm text-ink/60">Sign in to manage holidays and signups.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
