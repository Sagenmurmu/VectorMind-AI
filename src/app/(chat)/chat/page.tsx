"use client";

import { Navbar } from "@/components/navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IngestTab } from "@/components/tabs/ingest-tab";
import { SearchTab } from "@/components/tabs/search-tab";
import { ChatTab } from "@/components/tabs/chat-tab";
import { Card } from "@/components/ui/card";
import { Database, Search, MessageSquare } from "lucide-react";

export default function PlaygroundPage() {
	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar />

			<main className="flex-1 max-w-6xl w-full mx-auto space-y-6 py-8 px-4">
				<div className="space-y-2">
					<h1 className="text-3xl font-bold tracking-tight">RAG Knowledge Studio</h1>
					<p className="text-muted-foreground text-sm">
						Multi-tenant Retrieval Augmented Generation studio with PostgreSQL + pgvector, Gemini 2.5 Flash,
						document chunking, and persistent conversation memory.
					</p>
				</div>

				<Card className="p-1 border border-border/80 shadow-sm">
					<Tabs defaultValue="chat" className="space-y-4">
						<TabsList className="grid w-full grid-cols-3 p-1">
							<TabsTrigger value="chat" className="font-medium flex items-center gap-2">
								<MessageSquare className="h-4 w-4" />
								<span>RAG Chat</span>
							</TabsTrigger>
							<TabsTrigger value="ingest" className="font-medium flex items-center gap-2">
								<Database className="h-4 w-4" />
								<span>Ingest Knowledge</span>
							</TabsTrigger>
							<TabsTrigger value="search" className="font-medium flex items-center gap-2">
								<Search className="h-4 w-4" />
								<span>Vector Search</span>
							</TabsTrigger>
						</TabsList>

						<div className="p-4 min-h-[620px]">
							<TabsContent value="chat" className="m-0 focus-visible:outline-none">
								<ChatTab />
							</TabsContent>

							<TabsContent value="ingest" className="m-0 focus-visible:outline-none">
								<IngestTab />
							</TabsContent>

							<TabsContent value="search" className="m-0 focus-visible:outline-none">
								<SearchTab />
							</TabsContent>
						</div>
					</Tabs>
				</Card>
			</main>
		</div>
	);
}
