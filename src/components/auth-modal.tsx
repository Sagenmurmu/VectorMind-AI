"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Loader2, X, Lock, Mail, User } from "lucide-react";
import { toast } from "sonner";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "login" | "register";
}

export function AuthModal({ isOpen, onClose, defaultMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login, register } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("Welcome back! Successfully logged in.");
      } else {
        await register(email, password, name || undefined);
        toast.success("Account created successfully!");
      }
      onClose();
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err?.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md">
        <Card className="border-border/80 shadow-2xl bg-card">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">
              {mode === "login" ? "Sign in to VectorMind" : "Create your account"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Enter your credentials to access your private documents and chat history."
                : "Register for an account to start isolating knowledge and vector embeddings."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full mt-2 font-medium">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === "login" ? "Signing In..." : "Creating Account..."}
                  </>
                ) : mode === "login" ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <div className="pt-2 text-center text-sm text-muted-foreground border-t">
              {mode === "login" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setError(null);
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
