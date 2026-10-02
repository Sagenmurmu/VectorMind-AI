"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "./ui/button";
import { AuthModal } from "./auth-modal";
import { LogIn, LogOut, User } from "lucide-react";
import { toast } from "sonner";

const navItems = [
	{ href: "/", label: "Home" },
	{ href: "/docs", label: "Documentation" },
	{ href: "/chat", label: "Playground" },
];

export function Navbar() {
	const pathname = usePathname();
	const { user, isAuthenticated, logout } = useAuth();
	const [authModalOpen, setAuthModalOpen] = useState(false);
	const [authMode, setAuthMode] = useState<"login" | "register">("login");

	const handleOpenAuth = (mode: "login" | "register") => {
		setAuthMode(mode);
		setAuthModalOpen(true);
	};

	const handleLogout = () => {
		logout();
		toast.info("You have been signed out.");
	};

	return (
		<>
			<header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
				<div className="max-w-[1200px] mx-auto flex h-16 items-center justify-between px-4">
					<Link href="/" className="flex items-center space-x-2">
						<span className="font-mono font-bold text-lg tracking-tight">VectorMind</span>
					</Link>
					<div className="flex items-center gap-6">
						<nav className="flex items-center gap-4">
							{navItems.map((item) => (
								<Link
									key={item.href}
									href={item.href}
									className={`text-sm transition-colors hover:text-foreground/80 ${
										pathname === item.href
											? "text-foreground font-medium"
											: "text-muted-foreground"
									}`}
								>
									{item.label}
								</Link>
							))}
						</nav>

						<div className="flex items-center gap-2 pl-2 border-l">
							{isAuthenticated ? (
								<div className="flex items-center gap-3">
									<div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full border">
										<User className="h-3.5 w-3.5 text-primary" />
										<span className="font-medium text-foreground max-w-[120px] truncate">
											{user?.name || user?.email}
										</span>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={handleLogout}
										title="Sign Out"
										className="h-8 px-2 text-muted-foreground hover:text-destructive"
									>
										<LogOut className="h-4 w-4" />
									</Button>
								</div>
							) : (
								<div className="flex items-center gap-2">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => handleOpenAuth("login")}
										className="h-8 text-xs font-medium"
									>
										<LogIn className="mr-1.5 h-3.5 w-3.5" />
										Sign In
									</Button>
									<Button
										variant="default"
										size="sm"
										onClick={() => handleOpenAuth("register")}
										className="h-8 text-xs font-medium"
									>
										Register
									</Button>
								</div>
							)}
							<ThemeToggle />
						</div>
					</div>
				</div>
			</header>

			<AuthModal
				isOpen={authModalOpen}
				onClose={() => setAuthModalOpen(false)}
				defaultMode={authMode}
			/>
		</>
	);
}
