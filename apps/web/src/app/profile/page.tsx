"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, Avatar, AvatarImage, AvatarFallback, Button } from "@cryptopay/ui";
import { useAppStore } from "../../lib/store";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { setCurrentUserId } = useAppStore();
  const router = useRouter();

  const handleLogout = () => {
    setCurrentUserId(null);
    router.push("/");
  };

  return (
    <div className="max-w-3xl space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile & Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences.</p>
      </div>

      <Card>
        <CardContent className="p-6 flex items-center gap-6">
          <Avatar className="h-20 w-20">
            <AvatarImage src="https://api.dicebear.com/7.x/notionists/svg?seed=cryptopay" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold">Demo User</h2>
            <p className="text-muted-foreground">demo.user@example.com</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline">Edit Profile</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
            <div>
              <p className="font-medium">Freighter Wallet</p>
              <p className="text-sm text-muted-foreground">Primary Wallet • GABCD...123</p>
            </div>
            <Button variant="outline" size="sm" className="text-red-500 border-red-500/20 hover:bg-red-500/10">Disconnect</Button>
          </div>
        </CardContent>
      </Card>

      <div className="pt-4">
        <Button variant="destructive" onClick={handleLogout}>Log Out</Button>
      </div>
    </div>
  );
}
