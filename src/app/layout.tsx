import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth/auth-context";
import { Toaster } from "sonner";

export const metadata: Metadata = {
	title: "VectorMind - AI Knowledge & Vector Search",
	description: "Production-ready Vector Search & RAG Implementation with PostgreSQL + pgvector and Next.js",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased min-h-screen bg-background`}
			>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<AuthProvider>
						<Toaster richColors position="top-center" />
						{children}
					</AuthProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
