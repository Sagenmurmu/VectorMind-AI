"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { api, ConversationItem, MessageItem, CitationItem } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import {
	Send,
	Loader2,
	Plus,
	Trash2,
	MessageSquare,
	FileText,
	ChevronDown,
	ChevronUp,
	Bot,
	User,
	Sparkles,
	Zap,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export function ChatTab() {
	const { isAuthenticated } = useAuth();
	const [conversations, setConversations] = useState<ConversationItem[]>([]);
	const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
	const [messages, setMessages] = useState<MessageItem[]>([]);
	const [inputQuery, setInputQuery] = useState("");
	const [loadingChat, setLoadingChat] = useState(false);
	const [isStreamingTokens, setIsStreamingTokens] = useState(false);
	const [streamEnabled, setStreamEnabled] = useState(true);
	const [loadingConvs, setLoadingConvs] = useState(false);
	const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	// 1. Load conversation list
	const loadConversations = async () => {
		if (!isAuthenticated) {
			setConversations([]);
			return;
		}
		setLoadingConvs(true);
		try {
			const res = await api.conversations.list();
			if (res.success && Array.isArray(res.data)) {
				setConversations(res.data);
				// If no active conversation, select the most recent one
				if (!activeConversationId && res.data.length > 0) {
					selectConversation(res.data[0].id);
				}
			}
		} catch (err: any) {
			console.error("Failed to load conversations:", err);
		} finally {
			setLoadingConvs(false);
		}
	};

	useEffect(() => {
		loadConversations();
	}, [isAuthenticated]);

	useEffect(() => {
		scrollToBottom();
	}, [messages, loadingChat, isStreamingTokens]);

	// 2. Load messages for selected conversation
	const selectConversation = async (convId: string) => {
		setActiveConversationId(convId);
		try {
			const res = await api.conversations.get(convId);
			if (res.success && res.data?.messages) {
				setMessages(res.data.messages);
			}
		} catch (err: any) {
			console.error("Failed to fetch conversation messages:", err);
			toast.error("Failed to load conversation history.");
		}
	};

	// 3. Create a brand new conversation
	const handleNewChat = async () => {
		if (!isAuthenticated) {
			// In unauthenticated mode, simply reset messages state
			setActiveConversationId(null);
			setMessages([]);
			return;
		}

		try {
			const res = await api.conversations.create({ title: "New Conversation" });
			if (res.success && res.data) {
				setConversations((prev) => [res.data, ...prev]);
				setActiveConversationId(res.data.id);
				setMessages([]);
			}
		} catch (err: any) {
			console.error("Failed to create conversation:", err);
			toast.error("Failed to start new chat.");
		}
	};

	// 4. Delete conversation
	const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		if (!confirm("Are you sure you want to delete this conversation?")) return;

		try {
			await api.conversations.delete(convId);
			setConversations((prev) => prev.filter((c) => c.id !== convId));
			if (activeConversationId === convId) {
				setActiveConversationId(null);
				setMessages([]);
			}
			toast.success("Conversation deleted.");
		} catch (err: any) {
			console.error("Delete conversation error:", err);
			toast.error("Failed to delete conversation.");
		}
	};

	// 5. Send message (supports SSE real-time token streaming with fallback)
	const handleSendMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = inputQuery.trim();
		if (!trimmed) return;

		setInputQuery("");
		setLoadingChat(true);

		// Optimistic user message
		const optimisticUserMsg: MessageItem = {
			id: `temp_user_${Date.now()}`,
			conversationId: activeConversationId || "temp",
			role: "USER",
			content: trimmed,
			createdAt: new Date().toISOString(),
		};
		setMessages((prev) => [...prev, optimisticUserMsg]);

		if (streamEnabled) {
			const tempAsstId = `temp_asst_${Date.now()}`;
			let currentAsstContent = "";
			let currentCitations: CitationItem[] = [];

			try {
				await api.chatStream(
					{
						query: trimmed,
						conversationId: activeConversationId || undefined,
					},
					{
						onMetadata: (meta) => {
							setLoadingChat(false);
							setIsStreamingTokens(true);
							currentCitations = meta.citations || meta.sources || [];
							if (meta.conversationId && meta.conversationId !== activeConversationId) {
								setActiveConversationId(meta.conversationId);
								loadConversations();
							}
							setMessages((prev) => {
								const exists = prev.some((m) => m.id === tempAsstId);
								if (!exists) {
									return [
										...prev,
										{
											id: tempAsstId,
											conversationId: meta.conversationId || "temp",
											role: "ASSISTANT",
											content: "",
											citations: currentCitations,
											createdAt: new Date().toISOString(),
										},
									];
								}
								return prev.map((m) =>
									m.id === tempAsstId ? { ...m, citations: currentCitations } : m
								);
							});
						},
						onChunk: (chunk) => {
							setLoadingChat(false);
							setIsStreamingTokens(true);
							currentAsstContent += chunk;
							setMessages((prev) => {
								const exists = prev.some((m) => m.id === tempAsstId);
								if (!exists) {
									return [
										...prev,
										{
											id: tempAsstId,
											conversationId: activeConversationId || "temp",
											role: "ASSISTANT",
											content: currentAsstContent,
											citations: currentCitations,
											createdAt: new Date().toISOString(),
										},
									];
								}
								return prev.map((m) =>
									m.id === tempAsstId ? { ...m, content: currentAsstContent } : m
								);
							});
						},
						onDone: (done) => {
							setIsStreamingTokens(false);
							setLoadingChat(false);
							if (done.assistantMessageId) {
								setMessages((prev) =>
									prev.map((m) =>
										m.id === tempAsstId ? { ...m, id: done.assistantMessageId! } : m
									)
								);
							}
						},
						onError: (err) => {
							setIsStreamingTokens(false);
							setLoadingChat(false);
							console.error("Stream chunk error:", err);
							toast.error(err.message || "Streaming interrupted.");
						},
					}
				);
			} catch (err: any) {
				setIsStreamingTokens(false);
				setLoadingChat(false);
				console.error("Chat stream error:", err);
				toast.error(err.message || "Failed to stream answer. Please try again.");
				setMessages((prev) =>
					prev.filter((m) => m.id !== optimisticUserMsg.id && m.id !== tempAsstId)
				);
			} finally {
				setIsStreamingTokens(false);
				setLoadingChat(false);
			}
			return;
		}

		// Non-streaming synchronous fallback
		try {
			const res = await api.chat({
				query: trimmed,
				conversationId: activeConversationId || undefined,
			});

			if (res.success && res.data) {
				const responseData = res.data;
				const newConvId = responseData.conversationId;

				// Update active conversation ID if newly created
				if (newConvId && newConvId !== activeConversationId) {
					setActiveConversationId(newConvId);
					loadConversations();
				}

				const assistantMsg: MessageItem = {
					id: responseData.assistantMessageId || `temp_asst_${Date.now()}`,
					conversationId: newConvId || "temp",
					role: "ASSISTANT",
					content: responseData.answer,
					citations: responseData.citations || responseData.sources || [],
					createdAt: new Date().toISOString(),
				};

				setMessages((prev) => [...prev, assistantMsg]);
			}
		} catch (err: any) {
			console.error("Chat error:", err);
			toast.error(err.message || "Failed to generate answer. Please try again.");
			// Remove optimistic message if failed
			setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
		} finally {
			setLoadingChat(false);
		}
	};

	const toggleCitationExpand = (msgId: string) => {
		setExpandedCitations((prev) => ({
			...prev,
			[msgId]: !prev[msgId],
		}));
	};

	return (
		<div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[650px]">
			{/* Conversation Sidebar */}
			<Card className="col-span-1 border border-border/80 flex flex-col overflow-hidden">
				<div className="p-3 border-b flex items-center justify-between bg-muted/30">
					<span className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">
						Conversations
					</span>
					<Button
						variant="outline"
						size="sm"
						onClick={handleNewChat}
						className="h-7 px-2 text-xs flex items-center gap-1"
					>
						<Plus className="h-3.5 w-3.5" />
						New Chat
					</Button>
				</div>

				<ScrollArea className="flex-1 p-2">
					{loadingConvs ? (
						<div className="py-6 text-center text-xs text-muted-foreground">Loading chats...</div>
					) : conversations.length === 0 ? (
						<div className="py-8 text-center text-xs text-muted-foreground">
							{isAuthenticated ? "No chats yet. Start one above!" : "Sign in to persist your chat threads."}
						</div>
					) : (
						<div className="space-y-1">
							{conversations.map((conv) => (
								<div
									key={conv.id}
									onClick={() => selectConversation(conv.id)}
									className={`group flex items-center justify-between p-2 rounded-md cursor-pointer text-xs transition-colors ${
										activeConversationId === conv.id
											? "bg-primary text-primary-foreground font-medium"
											: "hover:bg-muted text-muted-foreground hover:text-foreground"
									}`}
								>
									<div className="flex items-center gap-2 truncate pr-2">
										<MessageSquare className="h-3.5 w-3.5 shrink-0" />
										<span className="truncate">{conv.title}</span>
									</div>
									<button
										type="button"
										onClick={(e) => handleDeleteConversation(conv.id, e)}
										className={`opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity ${
											activeConversationId === conv.id ? "hover:text-primary-foreground/80" : ""
										}`}
										title="Delete chat"
									>
										<Trash2 className="h-3.5 w-3.5" />
									</button>
								</div>
							))}
						</div>
					)}
				</ScrollArea>
			</Card>

			{/* Active Chat Conversation Area */}
			<Card className="col-span-1 md:col-span-3 border border-border/80 flex flex-col overflow-hidden">
				<div className="p-3 border-b flex items-center justify-between bg-muted/20">
					<div className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-primary" />
						<span className="font-semibold text-sm">VectorMind RAG Agent</span>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setStreamEnabled(!streamEnabled)}
							className={`text-[11px] px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 transition-colors ${
								streamEnabled
									? "border-primary/50 bg-primary/10 text-primary font-medium"
									: "border-border text-muted-foreground hover:bg-muted"
							}`}
							title="Toggle real-time token streaming"
						>
							<Zap className={`h-3 w-3 ${streamEnabled ? "fill-primary text-primary" : ""}`} />
							<span>Stream: {streamEnabled ? "ON" : "OFF"}</span>
						</button>
						<Badge variant="outline" className="text-xs">
							Gemini 2.5 Flash
						</Badge>
					</div>
				</div>

				<ScrollArea className="flex-1 p-4">
					{messages.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full min-h-[380px] text-center text-muted-foreground gap-3">
							<Bot className="h-10 w-10 text-primary/70" />
							<div className="max-w-md space-y-1">
								<h3 className="font-medium text-foreground">Ask anything about your knowledge base</h3>
								<p className="text-xs">
									Upload documents in the Ingest tab, then ask questions here. The AI will retrieve the most
									relevant vector chunks and ground its answer with verifiable citations.
								</p>
							</div>
						</div>
					) : (
						<div className="space-y-6">
							{messages.map((m) => {
								const isUser = m.role.toUpperCase() === "USER";
								const hasCitations = m.citations && m.citations.length > 0;
								const isExpanded = expandedCitations[m.id];

								return (
									<div
										key={m.id}
										className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
									>
										{!isUser && (
											<div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
												<Bot className="h-4 w-4" />
											</div>
										)}

										<div
											className={`max-w-[85%] rounded-lg p-3.5 ${
												isUser
													? "bg-primary text-primary-foreground font-normal text-sm"
													: "bg-muted/60 border border-border/60 text-foreground text-sm"
											}`}
										>
											{isUser ? (
												<div className="whitespace-pre-wrap">{m.content}</div>
											) : (
												<div className="space-y-3">
													<div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
														<ReactMarkdown>{m.content}</ReactMarkdown>
													</div>

													{/* Source Citations Section */}
													{hasCitations && (
														<div className="mt-3 pt-3 border-t border-border/50">
															<button
																type="button"
																onClick={() => toggleCitationExpand(m.id)}
																className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
															>
																<FileText className="h-3.5 w-3.5" />
																<span>
																	{m.citations!.length} Source {m.citations!.length === 1 ? "Citation" : "Citations"}
																</span>
																{isExpanded ? (
																	<ChevronUp className="h-3 w-3" />
																) : (
																	<ChevronDown className="h-3 w-3" />
																)}
															</button>

															{isExpanded && (
																<div className="mt-2.5 space-y-2">
																	{m.citations!.map((c: CitationItem, idx: number) => (
																		<div
																			key={c.chunkId || idx}
																			className="p-2.5 rounded-md bg-background/80 border text-xs space-y-1.5"
																		>
																			<div className="flex items-center justify-between text-muted-foreground font-medium">
																				<div className="flex items-center gap-1.5 truncate">
																					<Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
																						Source {idx + 1}
																					</Badge>
																					<span className="truncate font-semibold text-foreground">
																						{c.documentTitle}
																					</span>
																					<span className="truncate">({c.fileName})</span>
																				</div>
																				<Badge
																					variant="outline"
																					className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
																				>
																					{Math.round(c.similarity * 100)}% Match
																				</Badge>
																			</div>
																			<p className="text-muted-foreground font-mono text-[11px] bg-muted/40 p-2 rounded line-clamp-3">
																				{c.contentSnippet}
																			</p>
																		</div>
																	))}
																</div>
															)}
														</div>
													)}
												</div>
											)}
										</div>

										{isUser && (
											<div className="h-8 w-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0 border">
												<User className="h-4 w-4" />
											</div>
										)}
									</div>
								);
							})}

							{loadingChat && (
								<div className="flex gap-3 justify-start">
									<div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
										<Bot className="h-4 w-4" />
									</div>
									<div className="bg-muted/60 border border-border/60 rounded-lg p-3 text-xs text-muted-foreground flex items-center gap-2">
										<Loader2 className="h-4 w-4 animate-spin text-primary" />
										<span>Retrieving vector context & generating grounded response...</span>
									</div>
								</div>
							)}
							<div ref={messagesEndRef} />
						</div>
					)}
				</ScrollArea>

				<div className="p-3 border-t bg-muted/10">
					<form onSubmit={handleSendMessage} className="flex gap-2">
						<Input
							value={inputQuery}
							onChange={(e) => setInputQuery(e.target.value)}
							placeholder="Ask a question about your ingested documents..."
							disabled={loadingChat}
							className="flex-1"
						/>
						<Button type="submit" disabled={loadingChat || !inputQuery.trim()}>
							{loadingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
						</Button>
					</form>
				</div>
			</Card>
		</div>
	);
}
