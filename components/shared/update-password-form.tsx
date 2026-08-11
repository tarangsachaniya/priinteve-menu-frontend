"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function UpdatePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/user/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not update password");
        return;
      }

      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-md border-border/80">
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-ink">
            <KeyRound className="size-4.5" />
          </span>
          <div>
            <p className="font-semibold">Change password</p>
            <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 border-t border-border/70 pt-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <Button type="submit" disabled={isSubmitting} size="lg" className="mt-1 w-fit">
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
