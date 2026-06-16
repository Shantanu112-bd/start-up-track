"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, Button } from "@cryptopay/ui";

export function Topbar() {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl border-b border-white/10 bg-black/40 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="text-muted-foreground rounded-full relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 bg-blue-500 rounded-full ring-2 ring-background" />
        </Button>
        <div className="h-8 w-px bg-white/10 mx-1" />
        <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-transparent hover:ring-blue-500 transition-all">
          <AvatarImage src="https://api.dicebear.com/7.x/notionists/svg?seed=cryptopay" />
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
