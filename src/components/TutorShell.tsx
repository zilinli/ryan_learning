"use client";

import { useEffect, useState } from "react";
import { ChatThread } from "./ChatThread";
import { Composer } from "./Composer";
import { HistorySidebar } from "./HistorySidebar";
import { CodeAgentPanel } from "./CodeAgentPanel";
import { ThemePicker } from "./ThemePicker";
import { SetupPanel } from "./SetupPanel";
import AccountSwitcher from "./AccountSwitcher";
import { MessageBell } from "./MessageBell";
import { MessageList } from "./MessageList";
import { useTutorSession } from "./tutor/useTutorSession";
import {
  buildPracticeKickoffMessage,
  clearPracticeOffer,
  deferPracticeOffer,
  dismissPracticeOfferForToday,
  savePracticeOffer,
} from "@/lib/session-practice";
import {
  buildOpenerKickoffMessage,
  markOpenerShown,
  rotateSessionOpener,
} from "@/lib/session-opener";
import {
  clearTedChallengeResume,
  tedLabResumeHref,
} from "@/lib/entertain/ted-challenge-handoff";
import { engagementSummary } from "@/lib/engagement";
import { learningMemorySummary } from "@/lib/learning-memory";
import {
  buildChallengeKickoffMessage,
  getChallengeStreak,
  pickChallengeSkills,
  startChallengeSession,
} from "@/lib/challenge-mode";
import {
  buildDeepDivePrompt,
  type DeepDiveMode,
} from "@/lib/prompts";
import { interruptHint } from "@/lib/speech-barge-in";
import { buildQuoteFromMessage } from "@/lib/quote";
import type { ChatQuote } from "@/lib/types";

export function TutorShell() {
  const {
    ready, store, busy, error, setError, agentStatus, keyMissing, setKeyMissing,
    voiceEnabled, setVoiceEnabled, voiceId, setVoiceId, voiceIdRef,
    sidebarOpen, setSidebarOpen, desktopSidebarOpen, setDesktopSidebarOpen, isLg,
    agentPanelOpen, setAgentPanelOpen, agentPanelMinimized, setAgentPanelMinimized,
    engagement, learningMemory, practiceOffer, sessionOpener, tedReturn, setTedReturn,
    dailyBlurb, setDailyBlurb, emotionLine, setEmotionLine, accountName, accountId, accounts,
    ttsSpeaking, setTtsSpeaking, speakingMessageId, setSpeakingMessageId, checkMode, setCheckMode,
    scrollerRef, composerApiRef, speakApiRef, messagesOpen, setMessagesOpen,
    active, sessionId, messages,
    handleSwitchAccount, startNewSession, selectConversation, deleteConversation, handleSend,
    setSpeakApi, stopSpeakAll, handleOpenCodeAgent,
    setPracticeOffer, setSessionOpener,
    breakNudge, handleDismissBreakNudge,
  } = useTutorSession();

  const [quote, setQuote] = useState<ChatQuote | null>(null);
  useEffect(() => {
    setQuote(null);
  }, [sessionId]);

  if (!ready || !store) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[var(--ink-muted)]">
        {error ? (
          <div className="flex flex-col items-center gap-3 px-4 text-center">
            <div className="text-4xl">&#x26A0;</div>
            <p className="text-sm max-w-xs">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-[var(--teal)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--teal)]/90 active:scale-95"
            >
              Refresh Page
            </button>
          </div>
        ) : (
          <>Loading…</>
        )}
      </div>
    );
  }

  if (keyMissing) {
    return (
      <div className="relative min-h-dvh">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="atmosphere-blob atmosphere-blob-a" />
          <div className="atmosphere-blob atmosphere-blob-b" />
          <div className="atmosphere-grain" />
        </div>
        <SetupPanel onConfigured={() => setKeyMissing(false)} />
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh max-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="atmosphere-blob atmosphere-blob-a" />
        <div className="atmosphere-blob atmosphere-blob-b" />
        <div className="atmosphere-grain" />
      </div>

      <HistorySidebar
        open={sidebarOpen}
        desktopOpen={desktopSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onDesktopClose={() => setDesktopSidebarOpen(false)}
        conversations={store.conversations}
        activeId={store.activeId}
        disabled={busy}
        onOpenCodeAgent={handleOpenCodeAgent}
        engagementLabel={
          engagement
            ? [
                engagementSummary(engagement),
                learningMemory
                  ? learningMemorySummary(learningMemory)
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        learningMemory={learningMemory}
        checkMode={checkMode}
        onCheckModeChange={setCheckMode}
        onNew={startNewSession}
        onSelect={selectConversation}
        onDelete={deleteConversation}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg0)]">
        {checkMode ? (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--coral)]/30 bg-[var(--coral)]/10 px-3 py-2 sm:px-4">
            <p className="text-sm font-medium text-[var(--coral)]">
              Check mode — answers shown
            </p>
            <button
              type="button"
              onClick={() => setCheckMode(false)}
              className="min-h-11 shrink-0 rounded-lg border border-[var(--coral)]/40 px-3 text-sm font-medium text-[var(--coral)] focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
            >
              Exit
            </button>
          </div>
        ) : null}
        <header className="safe-top flex w-full shrink-0 items-center gap-2 px-3 py-2 sm:px-4" style={{ minHeight: 48 }}>
          <button
            type="button"
            onClick={() => {
              if (isLg) setDesktopSidebarOpen((p) => !p);
              else setSidebarOpen((p) => !p);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-muted)] transition hover:bg-[var(--mist)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
            aria-label={
              (isLg ? desktopSidebarOpen : sidebarOpen)
                ? "Close chat column"
                : "Open chat column"
            }
          >
            {(isLg ? desktopSidebarOpen : sidebarOpen) ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="3" y1="5" x2="17" y2="5" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="15" x2="17" y2="15" />
              </svg>
            )}
          </button>
          <span className="flex-1 truncate text-center font-[family-name:var(--font-display)] text-[17px] tracking-wide text-[var(--ink)] sm:text-lg">
            ✨ The Answer Book · AI Tutor
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setVoiceEnabled((v) => !v)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition focus-visible:ring-2 focus-visible:ring-[var(--teal)] ${
                voiceEnabled
                  ? "bg-[var(--teal)]/10 text-[var(--teal)]"
                  : "text-[var(--ink-muted)] hover:bg-[var(--mist)] hover:text-[var(--ink)]"
              }`}
              aria-label={voiceEnabled ? "Speak on" : "Speak off"}
              title={voiceEnabled ? "Speak on — tap to mute" : "Speak off — tap to speak"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
            <ThemePicker />
            <MessageBell accountId={accountId} onOpen={() => setMessagesOpen(true)} />
            <AccountSwitcher
              accounts={accounts}
              activeId={accountId}
              accountName={accountName}
              onSwitch={handleSwitchAccount}
              onManage={() => { window.location.href = "/account"; }}
            />
          </div>
        </header>

        <main
          ref={scrollerRef}
          className="mx-auto mt-0.5 w-full max-w-2xl min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 sm:px-0"
        >
          <ChatThread
            messages={messages}
            streaming={busy}
            worksheetPlan={active?.worksheetPlan ?? null}
            practiceOffer={
              messages.length === 0 ? practiceOffer : null
            }
            sessionOpener={
              messages.length === 0 && !practiceOffer ? sessionOpener : null
            }
            onPractice={() => {
              if (!practiceOffer) return;
              const text = buildPracticeKickoffMessage(practiceOffer.targets);
              clearPracticeOffer(accountId);
              setPracticeOffer(null);
              markOpenerShown(accountId);
              setSessionOpener(null);
              void handleSend({ text, attachments: [] });
            }}
            onPracticeTomorrow={() => {
              if (!practiceOffer) return;
              const deferred = deferPracticeOffer(practiceOffer);
              savePracticeOffer(deferred);
              setPracticeOffer(null);
            }}
            onPracticeDismiss={() => {
              dismissPracticeOfferForToday(accountId);
              setPracticeOffer(null);
            }}
            onOpenerTry={() => {
              if (!sessionOpener) return;
              const text = buildOpenerKickoffMessage(sessionOpener);
              markOpenerShown(accountId);
              setSessionOpener(null);
              void handleSend({ text, attachments: [] });
            }}
            onOpenerNext={() => {
              if (!sessionOpener) return;
              const next = rotateSessionOpener(sessionOpener);
              if (next) setSessionOpener(next);
            }}
            onChallenge={() => {
              if (!learningMemory) return;
              const top = pickChallengeSkills(learningMemory, 1)[0];
              if (!top) return;
              const streak = getChallengeStreak(accountId, top.id);
              const text = buildChallengeKickoffMessage(top, streak);
              markOpenerShown(accountId);
              setSessionOpener(null);
              startChallengeSession({
                accountId,
                skillId: top.id,
                label: top.label,
                startedAt: Date.now(),
              });
              void handleSend({ text, attachments: [] });
            }}
            canChallenge={Boolean(
              learningMemory && pickChallengeSkills(learningMemory, 1).length > 0,
            )}
            onDeepDive={(mode: DeepDiveMode) => {
              void handleSend({
                text: buildDeepDivePrompt(mode),
                attachments: [],
              });
            }}
            onSnapHomework={() => {
              if (sessionOpener) {
                markOpenerShown(accountId);
                setSessionOpener(null);
              }
              composerApiRef.current?.openCamera();
            }}
            dailyBlurb={dailyBlurb}
            onDismissDailyBlurb={() => {
              const dismissKey = `spark.dailyBlurbDismissed.${accountId}.${new Date().toISOString().slice(0, 10)}`;
              try {
                sessionStorage.setItem(dismissKey, "1");
              } catch {
                /* ignore */
              }
              setDailyBlurb(null);
            }}
            emotionLine={emotionLine}
            onDismissEmotionLine={() => setEmotionLine(null)}
            speakingMessageId={speakingMessageId}
            onSpeakMessage={(messageId, text) => {
              setSpeakingMessageId(messageId);
              void speakApiRef.current
                ?.speakOnce(text, voiceIdRef.current)
                .finally(() => {
                  setSpeakingMessageId((cur) =>
                    cur === messageId ? null : cur,
                  );
                });
            }}
            onStopSpeak={() => {
              stopSpeakAll();
            }}
            breakNudge={breakNudge}
            onDismissBreakNudge={handleDismissBreakNudge}
            onQuote={(m) => setQuote(buildQuoteFromMessage(m))}
          />
        </main>

        {agentStatus ? (
          <p
            className="mx-auto flex w-full max-w-3xl shrink-0 items-center gap-2 px-4 pb-1 text-xs text-[var(--teal)]"
            role="status"
            aria-live="polite"
          >
            <span className="inline-flex gap-0.5" aria-hidden>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--teal)]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--teal)] [animation-delay:200ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--teal)] [animation-delay:400ms]" />
            </span>
            {agentStatus}
          </p>
        ) : null}

        {error ? (
          <div className="mx-auto mb-1 w-full max-w-2xl shrink-0 rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/5 px-4 py-2.5">
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--coral)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </p>
            <button
              type="button"
              onClick={() => setError("")}
              className="mt-1 text-xs text-[var(--ink-muted)] underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="shrink-0 border-t border-[var(--line)]/60 bg-[color-mix(in_srgb,var(--bg0)_82%,transparent)] backdrop-blur-md">
        {tedReturn ? (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-snug text-[var(--ink-muted)] sm:text-sm">
              {tedReturn.coherent
                ? `Your thinking looks solid on “${tedReturn.talkTitle}” — ready for the next TED question when you are.`
                : `TED Challenge · “${tedReturn.talkTitle}” — keep chatting, or jump to the next question.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  window.location.href = tedLabResumeHref();
                }}
                className="min-h-9 rounded-lg bg-[var(--teal)] px-3 text-xs font-medium text-white sm:text-sm"
              >
                Next TED question
              </button>
              <button
                type="button"
                onClick={() => setTedReturn(null)}
                className="min-h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] sm:text-sm"
              >
                Keep chatting
              </button>
              <button
                type="button"
                onClick={() => {
                  clearTedChallengeResume();
                  setTedReturn(null);
                }}
                className="min-h-9 px-2 text-xs text-[var(--ink-muted)] underline-offset-2 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        <Composer
          disabled={busy}
          accountId={accountId}
          voiceEnabled={voiceEnabled}
          onVoiceEnabledChange={setVoiceEnabled}
          onVoiceIdChange={setVoiceId}
          onSpeakApi={setSpeakApi}
          onComposerApi={(api) => {
            composerApiRef.current = api;
          }}
          speakStatus={ttsSpeaking ? interruptHint(true) : undefined}
          onSpeakingChange={setTtsSpeaking}
          recentSkillIds={
            learningMemory
              ? [...learningMemory.skills]
                  .sort((a, b) => b.lastSeen - a.lastSeen)
                  .slice(0, 6)
                  .map((s) => s.id)
              : []
          }
          onPrepareSpeak={async () => {
            await speakApiRef.current?.prepare();
          }}
          quote={quote}
          onQuoteDismiss={() => setQuote(null)}
          onSend={(payload) => {
            handleSend(payload);
            setQuote(null);
          }}
        />
        </div>
      </div>

      <CodeAgentPanel
        open={agentPanelOpen && !agentPanelMinimized}
        onClose={() => { setAgentPanelOpen(false); setAgentPanelMinimized(false); }}
        onMinimize={() => setAgentPanelMinimized(true)}
      />

      {/* Floating bubble when minimized — click to restore */}
      {agentPanelOpen && agentPanelMinimized && (
        <button
          type="button"
          onClick={() => setAgentPanelMinimized(false)}
          className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--teal)] text-white shadow-lg hover:brightness-110 transition-all animate-fade-up"
          aria-label="Restore code agent"
          title="Code Agent"
        >
          <span className="text-lg">🤖</span>
        </button>
      )}

      {/* ── Messages overlay for student ── */}
      {messagesOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-12 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setMessagesOpen(false); }}>
          <div className="m-4 flex w-full max-w-lg max-h-[85dvh] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg0)] p-6 shadow-2xl">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <MessageList accountId={accountId} onClose={() => setMessagesOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

