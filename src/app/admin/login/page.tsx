import type { Metadata } from "next";
import { PasswordLoginForm } from "@/components/PasswordLoginForm";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default function AdminLogin() {
  return (
    <div className="mx-auto max-w-sm px-4 py-20">
      <h1 className="text-2xl font-bold">Admin</h1>
      <PasswordLoginForm redirectTo="/admin/" />
    </div>
  );
}
