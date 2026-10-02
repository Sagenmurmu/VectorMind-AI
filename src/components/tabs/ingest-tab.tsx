"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api, DocumentItem } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Loader2, UploadCloud, FileText, Trash2, RefreshCw, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function IngestTab() {
	const { isAuthenticated } = useAuth();
	const [activeInputType, setActiveInputType] = useState<"file" | "text">("file");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [title, setTitle] = useState("");
	const [rawText, setRawText] = useState("");
	const [chunkingMethod, setChunkingMethod] = useState<"paragraph" | "fixed">("paragraph");
	const [fixedSize, setFixedSize] = useState("500");
	const [loading, setLoading] = useState(false);

	// Documents library state
	const [documents, setDocuments] = useState<DocumentItem[]>([]);
	const [loadingDocs, setLoadingDocs] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const loadDocuments = async () => {
		setLoadingDocs(true);
		try {
			const res = await api.documents.list();
			if (res.success && Array.isArray(res.documents)) {
				setDocuments(res.documents);
			}
		} catch (err: any) {
			console.error("Failed to load documents:", err);
		} finally {
			setLoadingDocs(false);
		}
	};

	useEffect(() => {
		loadDocuments();
	}, [isAuthenticated]);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files[0]) {
			const file = e.target.files[0];
			setSelectedFile(file);
			if (!title) {
				setTitle(file.name.replace(/\.[^/.]+$/, ""));
			}
		}
	};

	const handleUpload = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		const toastId = toast.loading("Uploading and vectorizing document...");

		try {
			const formData = new FormData();
			const finalTitle = title.trim() || (selectedFile ? selectedFile.name : "Pasted Document");
			formData.append("title", finalTitle);
			formData.append("chunkingMethod", chunkingMethod);

			if (chunkingMethod === "fixed" && fixedSize) {
				formData.append("fixedSize", fixedSize);
			}

			if (activeInputType === "file") {
				if (!selectedFile) {
					toast.error("Please select a file (.txt or .pdf)", { id: toastId });
					setLoading(false);
					return;
				}
				formData.append("file", selectedFile);
			} else {
				if (!rawText.trim()) {
					toast.error("Please provide text to ingest", { id: toastId });
					setLoading(false);
					return;
				}
				const textBlob = new Blob([rawText], { type: "text/plain" });
				const textFile = new File([textBlob], `${finalTitle.toLowerCase().replace(/\s+/g, "_")}.txt`, {
					type: "text/plain",
				});
				formData.append("file", textFile);
			}

			const res = await api.documents.upload(formData, true);
			if (res.success) {
				toast.success(
					`Ingested successfully! Created ${res.stats?.totalChunks ?? res.document._count?.chunks ?? "vector"} chunks.`,
					{ id: toastId }
				);
				// Reset inputs
				setSelectedFile(null);
				setTitle("");
				setRawText("");
				if (fileInputRef.current) fileInputRef.current.value = "";
				loadDocuments();
			}
		} catch (err: any) {
			console.error("Upload error:", err);
			toast.error(err.message || "Failed to upload and ingest document.", { id: toastId });
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async (docId: string, docTitle: string) => {
		if (!confirm(`Are you sure you want to delete "${docTitle}" and all its vector chunks?`)) {
			return;
		}

		try {
			await api.documents.delete(docId);
			toast.success(`Deleted "${docTitle}"`);
			setDocuments((prev) => prev.filter((d) => d.id !== docId));
		} catch (err: any) {
			console.error("Delete error:", err);
			toast.error(err.message || "Failed to delete document.");
		}
	};

	const renderStatusBadge = (status: string) => {
		switch (status) {
			case "COMPLETED":
				return (
					<Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 flex items-center gap-1">
						<CheckCircle2 className="h-3 w-3" /> Ready
					</Badge>
				);
			case "PROCESSING":
				return (
					<Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 flex items-center gap-1">
						<Clock className="h-3 w-3" /> Processing
					</Badge>
				);
			case "FAILED":
				return (
					<Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 flex items-center gap-1">
						<AlertCircle className="h-3 w-3" /> Failed
					</Badge>
				);
			default:
				return <Badge variant="secondary">{status}</Badge>;
		}
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-xl">Ingest Knowledge</CardTitle>
							<CardDescription>
								Upload files or paste text to generate embeddings and index chunks into PostgreSQL + pgvector.
							</CardDescription>
						</div>
						<div className="flex bg-muted p-1 rounded-lg text-xs font-medium">
							<button
								type="button"
								onClick={() => setActiveInputType("file")}
								className={`px-3 py-1 rounded-md transition-colors ${
									activeInputType === "file" ? "bg-background shadow text-foreground" : "text-muted-foreground"
								}`}
							>
								Upload File
							</button>
							<button
								type="button"
								onClick={() => setActiveInputType("text")}
								className={`px-3 py-1 rounded-md transition-colors ${
									activeInputType === "text" ? "bg-background shadow text-foreground" : "text-muted-foreground"
								}`}
							>
								Raw Text
							</button>
						</div>
					</div>
				</CardHeader>

				<CardContent>
					<form onSubmit={handleUpload} className="space-y-4">
						<div className="grid sm:grid-cols-2 gap-4">
							<div className="space-y-1.5">
								<label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									Document Title
								</label>
								<Input
									type="text"
									placeholder="e.g. Q3 Architecture Overview"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
								/>
							</div>

							<div className="grid grid-cols-2 gap-2">
								<div className="space-y-1.5">
									<label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										Chunking Method
									</label>
									<select
										value={chunkingMethod}
										onChange={(e) => setChunkingMethod(e.target.value as any)}
										className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
									>
										<option value="paragraph">Paragraph Split</option>
										<option value="fixed">Fixed Character Size</option>
									</select>
								</div>

								{chunkingMethod === "fixed" && (
									<div className="space-y-1.5">
										<label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											Chunk Size
										</label>
										<Input
											type="number"
											min={100}
											max={4000}
											value={fixedSize}
											onChange={(e) => setFixedSize(e.target.value)}
										/>
									</div>
								)}
							</div>
						</div>

						{activeInputType === "file" ? (
							<div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
								<input
									ref={fileInputRef}
									type="file"
									accept=".txt,.pdf"
									onChange={handleFileChange}
									className="hidden"
									id="file-upload"
								/>
								<label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center gap-2">
									<UploadCloud className="h-10 w-10 text-muted-foreground" />
									<span className="text-sm font-medium">
										{selectedFile ? selectedFile.name : "Choose a TXT or PDF file to upload"}
									</span>
									<span className="text-xs text-muted-foreground">
										{selectedFile
											? `${(selectedFile.size / 1024).toFixed(1)} KB`
											: "Supports .txt and .pdf up to 10MB"}
									</span>
								</label>
							</div>
						) : (
							<div className="space-y-1.5">
								<label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									Paste Text Content
								</label>
								<Textarea
									placeholder="Paste text or research notes here..."
									rows={6}
									value={rawText}
									onChange={(e) => setRawText(e.target.value)}
								/>
							</div>
						)}

						<Button type="submit" disabled={loading} className="w-full">
							{loading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Processing & Ingesting Embeddings...
								</>
							) : (
								"Upload & Ingest to Knowledge Base"
							)}
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* Document Library */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<div>
						<CardTitle className="text-lg">Document Library</CardTitle>
						<CardDescription>
							{isAuthenticated ? "Your isolated personal documents" : "Knowledge repository documents"}
						</CardDescription>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={loadDocuments}
						disabled={loadingDocs}
						className="h-8"
					>
						<RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingDocs ? "animate-spin" : ""}`} />
						Refresh
					</Button>
				</CardHeader>
				<CardContent>
					{loadingDocs && documents.length === 0 ? (
						<div className="py-8 text-center text-sm text-muted-foreground">Loading documents...</div>
					) : documents.length === 0 ? (
						<div className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-md">
							No documents uploaded yet. Upload a TXT or PDF file above to get started.
						</div>
					) : (
						<div className="divide-y border rounded-md overflow-hidden">
							{documents.map((doc) => (
								<div
									key={doc.id}
									className="flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors"
								>
									<div className="flex items-center gap-3">
										<div className="p-2 rounded-md bg-muted">
											<FileText className="h-4 w-4 text-primary" />
										</div>
										<div>
											<div className="font-medium text-sm text-foreground flex items-center gap-2">
												{doc.title}
												{renderStatusBadge(doc.status)}
											</div>
											<div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
												<span>{doc.fileName}</span>
												<span>•</span>
												<span>{doc._count?.chunks ?? 0} vector chunks</span>
												<span>•</span>
												<span>{new Date(doc.createdAt).toLocaleDateString()}</span>
											</div>
										</div>
									</div>

									<Button
										variant="ghost"
										size="sm"
										onClick={() => handleDelete(doc.id, doc.title)}
										className="text-muted-foreground hover:text-destructive h-8 px-2"
										title="Delete document"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
