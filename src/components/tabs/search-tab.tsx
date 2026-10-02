"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { api, SearchResultItem } from "@/lib/api/client";
import { Search, Loader2, Copy, Check, FileText } from "lucide-react";
import { toast } from "sonner";

export function SearchTab() {
	const [query, setQuery] = useState("");
	const [loading, setLoading] = useState(false);
	const [results, setResults] = useState<SearchResultItem[]>([]);
	const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
	const [hasSearched, setHasSearched] = useState(false);

	const handleSearch = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!query.trim()) {
			toast.error("Please enter a search query.");
			return;
		}

		setLoading(true);
		setHasSearched(true);
		try {
			const res = await api.search({
				query: query.trim(),
				limit: 10,
			});

			if (res.success && Array.isArray(res.results)) {
				setResults(res.results);
				if (res.results.length === 0) {
					toast.info("No matching chunks found above the similarity threshold.");
				}
			}
		} catch (error: any) {
			console.error("Search error:", error);
			toast.error(error.message || "Failed to execute semantic search.");
			setResults([]);
		} finally {
			setLoading(false);
		}
	};

	const copyToClipboard = (text: string, idx: number) => {
		navigator.clipboard.writeText(text);
		setCopiedIdx(idx);
		toast.success("Snippet copied to clipboard");
		setTimeout(() => setCopiedIdx(null), 2000);
	};

	const getSimilarityBadge = (score: number) => {
		const pct = Math.round(score * 100);
		if (pct >= 75) {
			return (
				<Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
					{pct}% Match
				</Badge>
			);
		}
		if (pct >= 50) {
			return (
				<Badge variant="outline" className="bg-sky-500/10 text-sky-500 border-sky-500/20">
					{pct}% Match
				</Badge>
			);
		}
		return (
			<Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
				{pct}% Match
			</Badge>
		);
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="text-xl">Semantic Vector Search</CardTitle>
					<CardDescription>
						Query across your indexed documents using 768-dimensional embeddings and cosine similarity.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<form onSubmit={handleSearch} className="flex gap-2">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Ask or search for concepts (e.g. quantum teleportation, pricing plans)..."
								className="pl-9"
							/>
						</div>
						<Button type="submit" disabled={loading} className="px-5">
							{loading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Searching...
								</>
							) : (
								"Search"
							)}
						</Button>
					</form>

					<ScrollArea className="h-[520px] pr-4">
						{loading ? (
							<div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
								<Loader2 className="h-8 w-8 animate-spin text-primary" />
								<span>Retrieving vector matches from Neon PostgreSQL...</span>
							</div>
						) : results.length > 0 ? (
							<div className="space-y-4">
								<div className="text-xs text-muted-foreground font-medium">
									Found {results.length} relevant {results.length === 1 ? "chunk" : "chunks"}:
								</div>
								{results.map((res, i) => (
									<Card key={res.chunkId || i} className="border border-border/80 bg-card hover:border-border transition-colors">
										<CardContent className="p-4 space-y-3">
											<div className="flex items-center justify-between text-xs border-b pb-2">
												<div className="flex items-center gap-2 font-medium text-foreground">
													<FileText className="h-3.5 w-3.5 text-primary" />
													<span>{res.documentTitle}</span>
													<span className="text-muted-foreground">({res.fileName})</span>
												</div>
												<div className="flex items-center gap-2">
													{getSimilarityBadge(res.similarity)}
													<span className="text-muted-foreground">
														Chunk #{res.chunkIndex + 1}
														{res.pageNumber ? ` • p. ${res.pageNumber}` : ""}
													</span>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => copyToClipboard(res.content, i)}
														className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
														title="Copy chunk text"
													>
														{copiedIdx === i ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
													</Button>
												</div>
											</div>

											<div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed bg-muted/40 p-3 rounded-md font-mono text-xs">
												{res.content}
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						) : hasSearched ? (
							<div className="text-center text-muted-foreground py-16 border border-dashed rounded-lg">
								No semantic matches found for your query. Try broadening your terms or upload more documents.
							</div>
						) : (
							<div className="text-center text-muted-foreground py-16 border border-dashed rounded-lg">
								Enter a query above to explore semantic chunk matches.
							</div>
						)}
					</ScrollArea>
				</CardContent>
			</Card>
		</div>
	);
}
