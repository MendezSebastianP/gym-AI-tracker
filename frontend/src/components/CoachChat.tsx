import { useState, useRef, useEffect } from 'react';
import { MessageCircle, ChevronDown, ChevronUp, Send, Loader2, Check, X, ArrowRight, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { db } from '../db/schema';
import type { CoachChatMessage } from '../db/schema';

interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
	suggestions?: AISuggestion[];
}

interface AISuggestion {
	exercise_id: number;
	sets: number;
	reps: string;
	rest: number;
	replaces_exercise_id?: number;
	reason: string;
	// Resolved locally
	_exerciseName?: string;
	_replacesName?: string;
}

interface CoachChatProps {
	routineId: number;
	routineDays: any[];
}

export default function CoachChat({ routineId, routineDays }: CoachChatProps) {
	const [expanded, setExpanded] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const loadedRef = useRef(false);

	// Load saved chat on mount
	useEffect(() => {
		if (loadedRef.current) return;
		loadedRef.current = true;
		db.coachChats
			.where('routine_id')
			.equals(routineId)
			.sortBy('created_at')
			.then(async (saved) => {
				if (saved.length === 0) return;
				const loaded: ChatMessage[] = [];
				for (const msg of saved) {
					const chatMsg: ChatMessage = { role: msg.role, content: msg.content };
					if (msg.suggestions && msg.suggestions.length > 0) {
						chatMsg.suggestions = await resolveExerciseNames(msg.suggestions);
					}
					loaded.push(chatMsg);
				}
				setMessages(loaded);
			});
	}, [routineId]);

	// Save messages to Dexie whenever they change
	const saveMessages = async (msgs: ChatMessage[]) => {
		await db.coachChats.where('routine_id').equals(routineId).delete();
		const records: CoachChatMessage[] = msgs.map(m => ({
			routine_id: routineId,
			role: m.role,
			content: m.content,
			suggestions: m.suggestions?.map(s => ({
				exercise_id: s.exercise_id,
				sets: s.sets,
				reps: s.reps,
				rest: s.rest,
				replaces_exercise_id: s.replaces_exercise_id,
				reason: s.reason,
			})),
			created_at: new Date().toISOString(),
		}));
		if (records.length > 0) {
			await db.coachChats.bulkAdd(records);
		}
	};

	useEffect(() => {
		if (expanded && inputRef.current) {
			inputRef.current.focus();
		}
	}, [expanded]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	const resolveExerciseNames = async (suggestions: AISuggestion[]): Promise<AISuggestion[]> => {
		const ids = [
			...suggestions.map(s => s.exercise_id),
			...suggestions.filter(s => s.replaces_exercise_id).map(s => s.replaces_exercise_id!),
		];
		const exercises = await db.exercises.bulkGet(ids);
		const nameMap = new Map<number, string>();
		exercises.forEach((ex: any) => { if (ex) nameMap.set(ex.id, ex.name); });

		return suggestions.map(s => ({
			...s,
			_exerciseName: nameMap.get(s.exercise_id) || `Exercise #${s.exercise_id}`,
			_replacesName: s.replaces_exercise_id ? nameMap.get(s.replaces_exercise_id) : undefined,
		}));
	};

	const sendMessage = async () => {
		if (!input.trim() || loading) return;
		const userMsg = input.trim();
		setInput('');
		const newMessages = [...messages, { role: 'user' as const, content: userMsg }];
		setMessages(newMessages);
		setLoading(true);

		try {
			const res = await api.post('/progression/chat', {
				routine_id: routineId,
				message: userMsg,
			});
			const data = res.data;
			const resolvedSuggestions = await resolveExerciseNames(data.suggestions || []);

			const withResponse = [...newMessages, {
				role: 'assistant' as const,
				content: data.message,
				suggestions: resolvedSuggestions,
			}];
			setMessages(withResponse);
			saveMessages(withResponse);
		} catch (e: any) {
			const errorMsg = e?.response?.status === 429
				? 'Rate limit reached (5/hour). Please wait a bit.'
				: e?.response?.data?.detail || 'Failed to get a response. Please try again.';
			const withError = [...newMessages, {
				role: 'assistant' as const,
				content: errorMsg,
			}];
			setMessages(withError);
			saveMessages(withError);
		} finally {
			setLoading(false);
		}
	};

	const clearChat = async () => {
		await db.coachChats.where('routine_id').equals(routineId).delete();
		setMessages([]);
		setAppliedSuggestions(new Set());
	};

	const applySuggestion = async (suggestion: AISuggestion, msgIndex: number) => {
		const key = `${msgIndex}-${suggestion.exercise_id}`;
		if (appliedSuggestions.has(key)) return;

		// Update routine
		const updatedDays = JSON.parse(JSON.stringify(routineDays));
		let applied = false;

		for (const day of updatedDays) {
			for (let i = 0; i < day.exercises.length; i++) {
				const ex = day.exercises[i];
				if (suggestion.replaces_exercise_id && ex.exercise_id === suggestion.replaces_exercise_id) {
					// Replace exercise
					day.exercises[i] = {
						...ex,
						exercise_id: suggestion.exercise_id,
						sets: suggestion.sets,
						reps: String(suggestion.reps),
						rest: suggestion.rest,
					};
					applied = true;
					break;
				}
			}
			if (applied) break;
		}

		if (!applied && suggestion.replaces_exercise_id === undefined) {
			// Add to first day if not replacing
			if (updatedDays.length > 0) {
				updatedDays[0].exercises.push({
					exercise_id: suggestion.exercise_id,
					sets: suggestion.sets,
					reps: String(suggestion.reps),
					rest: suggestion.rest,
					weight_kg: 0,
					locked: false,
				});
				applied = true;
			}
		}

		if (applied) {
			try {
				await api.put(`/routines/${routineId}`, { days: updatedDays });
				await db.routines.update(routineId, { days: updatedDays, syncStatus: 'updated' as any });
			} catch { /* offline */ }
		}

		// Save feedback
		api.post('/progression/feedback', {
			exercise_id: suggestion.exercise_id,
			suggestion_type: suggestion.replaces_exercise_id ? 'exercise_swap' : 'ai_suggestion',
			suggested_value: { sets: suggestion.sets, reps: suggestion.reps, rest: suggestion.rest, new_exercise_id: suggestion.exercise_id },
			action: 'accepted',
		}).catch(() => {});

		setAppliedSuggestions(prev => new Set([...prev, key]));
	};

	return (
		<div style={{
			marginTop: '24px',
			borderRadius: '12px',
			border: '1px solid var(--border, #333)',
			overflow: 'hidden',
		}}>
			{/* Header bar */}
			<button
				onClick={() => setExpanded(!expanded)}
				style={{
					width: '100%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '12px 16px',
					background: 'var(--bg-secondary, #1a1a2e)',
					border: 'none',
					cursor: 'pointer',
					color: 'var(--text-primary)',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<MessageCircle size={16} />
					<span style={{ fontWeight: 600, fontSize: '14px' }}>Ask AI Coach</span>
					{messages.length > 0 && (
						<span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400 }}>
							({messages.length} messages)
						</span>
					)}
				</div>
				{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
			</button>

			{/* Chat panel */}
			{expanded && (
				<div style={{ background: 'var(--bg-primary)' }}>
					{/* Messages */}
					<div style={{
						maxHeight: '400px',
						overflowY: 'auto',
						padding: '12px 16px',
						display: 'flex',
						flexDirection: 'column',
						gap: '12px',
					}}>
						{messages.length === 0 && (
							<p style={{ color: 'var(--text-tertiary)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
								Ask about your routine, exercises, injuries, or get personalized advice.
							</p>
						)}

						{messages.map((msg, mIdx) => (
							<div key={mIdx}>
								<div style={{
									display: 'flex',
									justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
								}}>
									<div style={{
										maxWidth: '85%',
										padding: '8px 12px',
										borderRadius: '12px',
										fontSize: '13px',
										lineHeight: 1.5,
										background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-secondary, #1a1a2e)',
										color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
									}}>
										{msg.content}
									</div>
								</div>

								{/* Suggestion cards */}
								{msg.suggestions && msg.suggestions.length > 0 && (
									<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', marginLeft: '8px' }}>
										{msg.suggestions.map((s, sIdx) => {
											const key = `${mIdx}-${s.exercise_id}`;
											const isApplied = appliedSuggestions.has(key);

											return (
												<div key={sIdx} style={{
													background: 'var(--bg-secondary, #1a1a2e)',
													border: `1px solid ${isApplied ? 'var(--success)33' : 'var(--accent)33'}`,
													borderRadius: '8px',
													padding: '10px 12px',
												}}>
													<div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
														{s._replacesName && (
															<>
																<span style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
																	{s._replacesName}
																</span>
																<ArrowRight size={12} color="var(--accent)" />
															</>
														)}
														<span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
															{s._exerciseName}
														</span>
														<span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
															{s.sets}×{s.reps}
														</span>
													</div>
													<p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
														{s.reason}
													</p>
													{!isApplied ? (
														<button
															onClick={() => applySuggestion(s, mIdx)}
															style={{
																background: 'var(--accent)',
																color: '#fff',
																border: 'none',
																padding: '4px 12px',
																borderRadius: '6px',
																fontSize: '12px',
																fontWeight: 600,
																cursor: 'pointer',
																display: 'flex',
																alignItems: 'center',
																gap: '4px',
															}}
														>
															<Check size={12} /> Apply to Routine
														</button>
													) : (
														<span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>
															Applied
														</span>
													)}
												</div>
											);
										})}
									</div>
								)}
							</div>
						))}

						{loading && (
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
								<Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
								Thinking...
							</div>
						)}

						<div ref={messagesEndRef} />
					</div>

					{/* Input */}
					<div style={{
						display: 'flex',
						gap: '8px',
						padding: '12px 16px',
						borderTop: '1px solid var(--border, #333)',
					}}>
						{messages.length > 0 && (
							<button
								onClick={clearChat}
								title="Clear chat"
								style={{
									background: 'none',
									border: 'none',
									color: 'var(--text-tertiary)',
									cursor: 'pointer',
									padding: '10px 6px',
									display: 'flex',
									alignItems: 'center',
								}}
							>
								<Trash2 size={14} />
							</button>
						)}
						<input
							ref={inputRef}
							type="text"
							className="input"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
							placeholder="Ask about your routine, exercises, injuries..."
							style={{ flex: 1, fontSize: '14px', padding: '10px 12px' }}
							disabled={loading}
						/>
						<button
							onClick={sendMessage}
							disabled={loading || !input.trim()}
							style={{
								background: 'var(--accent)',
								color: '#fff',
								border: 'none',
								borderRadius: '8px',
								padding: '10px 14px',
								cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
								opacity: loading || !input.trim() ? 0.5 : 1,
								display: 'flex',
								alignItems: 'center',
							}}
						>
							<Send size={16} />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
