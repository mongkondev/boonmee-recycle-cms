"use client";

import { useState, useTransition } from "react";
import { PasswordFields } from "@/components/password-fields";
import { Button, FormError } from "@/components/ui";
import { passwordProblems } from "@/lib/password-policy";
import { acceptInvite } from "../actions";

export function InviteForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const valid = passwordProblems(password).length === 0 && password === confirm;
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        start(async () => {
          const res = await acceptInvite(token, password, confirm);
          if (res?.error) setError(res.error);
        });
      }}
    >
      <PasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />
      <FormError message={error} />
      <Button type="submit" className="w-full" disabled={!valid || pending}>
        {pending ? "กำลังบันทึก…" : "ถัดไป: ตั้งค่า Google Authenticator"}
      </Button>
    </form>
  );
}
