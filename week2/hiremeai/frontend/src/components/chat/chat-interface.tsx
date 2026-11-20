
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  ArrowUpRight,
  Bot,
  BriefcaseBusiness,
  Check,
  Code2,
  FileText,
  GraduationCap,
  Loader2,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRound,
  RefreshCw,
  AlertCircle,
  Square,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCandidate, streamCandidateAnswer, type CandidateResume } from "@/lib/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  retryQuestion?: string;
};

const suggestions = [
  {
    title: "Work experience",
    description: "Summarize previous roles and responsibilities",
    question: "Summarize the candidate's professional experience.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Technical skills",
    description: "Explore tools, languages and frameworks",
    question: "What are the candidate's technical skills?",
    icon: Code2,
  },
  {
    title: "Projects",
    description: "Discover what the candidate has built",
    question: "Which projects has the candidate worked on?",
    icon: FileText,
  },
  {
    title: "Education",
    description: "Review academic qualifications",
    question: "What is the candidate's educational background?",
    icon: GraduationCap,
  },
];

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

const [candidate, setCandidate] =
  useState<CandidateResume | null>(null);

const [candidateLoading, setCandidateLoading] = useState(true);

const [candidateError, setCandidateError] =
  useState<string | null>(null);

const [streamingMessageId, setStreamingMessageId] =
  useState<string | null>(null);

const abortControllerRef = useRef<AbortController | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);


useEffect(() => {
  let active = true;

  async function loadCandidate() {
    try {
      const resume = await getCandidate();

      if (active) {
        setCandidate(resume);
        setCandidateError(null);
      }
    } catch {
      if (active) {
        setCandidateError("Resume unavailable");
      }
    } finally {
      if (active) {
        setCandidateLoading(false);
      }
    }
  }

  loadCandidate();

  return () => {
    active = false;
  };
}, []);

 

async function handleSubmit(
  event?: FormEvent<HTMLFormElement>,
  suggestedQuestion?: string,
  retry = false
) {
  event?.preventDefault();

  const text = (suggestedQuestion ?? question).trim();

  if (!text || loading) return;

  const controller = new AbortController();
  abortControllerRef.current = controller;

  setLoading(true);

  if (!retry) {
    setQuestion("");

    setMessages((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      },
    ]);
  } else {
    // Remove the previous error before retrying.
    setMessages((previous) => {
      const updated = [...previous];

      const errorIndex = updated.findLastIndex(
        (message) =>
          message.isError &&
          message.retryQuestion === text
      );

      if (errorIndex !== -1) {
        updated.splice(errorIndex, 1);
      }

      return updated;
    });
  }

  const assistantId = crypto.randomUUID();
  setStreamingMessageId(assistantId);

  let fullAnswer = "";

  try {
    // Add an empty assistant message.
    setMessages((previous) => [
      ...previous,
      {
        id: assistantId,
        role: "assistant",
        content: "",
      },
    ]);

    await streamCandidateAnswer(
      text,
      (chunk) => {
        fullAnswer += chunk;

        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: fullAnswer,
                }
              : message
          )
        );
      },
      controller.signal
    );
  } catch (error) {
    if (controller.signal.aborted) {
      // Preserve text received before cancellation.
      if (!fullAnswer) {
        setMessages((previous) =>
          previous.filter(
            (message) => message.id !== assistantId
          )
        );
      }

      return;
    }

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to get an AI response.";

    // Remove any incomplete streamed answer.
    setMessages((previous) => [
      ...previous.filter(
        (message) => message.id !== assistantId
      ),
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: errorMessage,
        isError: true,
        retryQuestion: text,
      },
    ]);
  } finally {
    if (abortControllerRef.current === controller) {
      abortControllerRef.current = null;
    }

    setStreamingMessageId(null);
    setLoading(false);
  }
}


function handleStopGenerating() {
  abortControllerRef.current?.abort();
}



  function handleNewChat() {
    if (loading) return;

    setMessages([]);
    setQuestion("");
  }

  return (
    <div className="flex h-dvh flex-col bg-[#F8F9FC] font-sans text-slate-900">
      {/* Header */}
   
<header className="z-10 flex h-[76px] shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-5 md:px-10">
  {/* Logo */}
  <div className="flex items-center gap-3">
    <div className="flex size-11 items-center justify-center rounded-2xl bg-violet-600 shadow-sm shadow-violet-200">
      <Sparkles className="size-5 text-white" />
    </div>

    <div>
      <h1 className="text-[18px] font-bold tracking-tight text-slate-900">
        TalentQuery
      </h1>
      <p className="text-xs text-slate-500">
        AI Candidate Screening Assistant
      </p>
    </div>
  </div>

  {/* Candidate information and resume status */}
  <div className="hidden items-center gap-5 sm:flex">
    {candidate?.name && (
      <div className="text-right">
        <p className="text-[11px] text-slate-400">
          Currently screening
        </p>
        <p className="text-[13px] font-semibold text-slate-800">
          {candidate.name}
        </p>
      </div>
    )}

    <div
      className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium ${
        candidateError
          ? "border-red-200 bg-red-50 text-red-700"
          : candidateLoading
            ? "border-slate-200 bg-slate-50 text-slate-500"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      <span
        className={`size-2 rounded-full ${
          candidateError
            ? "bg-red-500"
            : candidateLoading
              ? "bg-slate-400"
              : "bg-emerald-500"
        }`}
      />

      {candidateLoading
        ? "Checking resume..."
        : candidateError
          ? candidateError
          : "Resume ready"}
    </div>
  </div>
</header>


      {/* Chat area */}
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto flex min-h-0 w-full max-w-[920px] flex-1 flex-col px-4 md:px-8">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-8">
              <div className="mb-6 flex size-[72px] items-center justify-center rounded-[24px] bg-violet-100 text-violet-600">
                <Bot className="size-9" strokeWidth={1.7} />
              </div>

              <div className="max-w-xl text-center">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700">
                  <Sparkles className="size-3.5" />
                  Your AI recruiting copilot
                </div>

                <h2 className="text-[28px] font-semibold tracking-tight text-slate-900 md:text-[36px]">
                  Get to know your candidate.
                </h2>

                <p className="mx-auto mt-3 max-w-[480px] text-[14px] leading-7 text-slate-500 md:text-[15px]">
                  Ask about experience, skills, projects, and
                  qualifications. Get answers based on the
                  candidate&apos;s resume.
                </p>
              </div>

              {/* Resume status */}
              <div className="mt-7 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <FileText className="size-5" />
                </div>

                <div>
                  <p className="text-[13px] font-semibold text-slate-800">
                    Candidate resume
                  </p>
                  
                  <p className="text-xs text-slate-500">
                    {candidate?.name
                    ? `Resume of ${candidate.name}`
                    : "Candidate resume"}
                  </p>

                </div>

                
<span
  className={`ml-5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
    candidateError
      ? "bg-red-50 text-red-700"
      : candidateLoading
        ? "bg-slate-100 text-slate-600"
        : "bg-emerald-50 text-emerald-700"
  }`}
>
  {candidateLoading
    ? "Loading"
    : candidateError
      ? "Unavailable"
      : "Ready"}
</span>

              </div>

              {/* Suggested questions */}
              <div className="mt-9 w-full max-w-[690px]">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-slate-700">
                    Explore candidate profile
                  </p>

                  <p className="text-xs text-slate-400">
                    Suggested questions
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {suggestions.map((item) => {
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.title}
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          handleSubmit(undefined, item.question)
                        }
                        className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md disabled:opacity-50"
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors group-hover:bg-violet-100 group-hover:text-violet-600">
                          <Icon className="size-[19px]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-slate-800">
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {item.description}
                          </p>
                        </div>

                        <ArrowUpRight className="size-4 shrink-0 text-slate-300 transition-colors group-hover:text-violet-600" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto py-8 [scrollbar-width:thin] [scrollbar-color:#CBD5E1_transparent]">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${
                    message.role === "user"
                      ? "flex-row-reverse"
                      : ""
                  }`}
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                      message.role === "assistant"
                        ? "bg-violet-100 text-violet-600"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <Bot className="size-5" />
                    ) : (
                      <UserRound className="size-5" />
                    )}
                  </div>

                  <div
                    className={`min-w-0 max-w-[90%] rounded-2xl px-4 py-3.5 text-[14px] leading-7 md:max-w-[75%] ${
                      message.role === "user"
                        ? "rounded-tr-md bg-violet-600 text-white"
                        : "rounded-tl-md border border-slate-200 bg-white text-slate-700 shadow-sm"
                    }`}
                  >


{message.isError ? (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-red-600">
      <AlertCircle className="size-4 shrink-0" />
      <span className="text-[13px] font-semibold">
        Unable to get an AI response
      </span>
    </div>

    <p className="text-[13px] leading-6 text-slate-600">
      {message.content}
    </p>

    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={() =>
        handleSubmit(
          undefined,
          message.retryQuestion,
          true
        )
      }
      className="gap-2 border-slate-200 text-slate-700 hover:bg-slate-50"
    >
      <RefreshCw className="size-3.5" />
      Retry
    </Button>
  </div> 
) : message.role === "assistant" ? (
  <div className="space-y-3">
    {message.content ? (
      <div className="space-y-3 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_p]:leading-7 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_a]:text-violet-600 [&_a]:underline [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-slate-100 [&_code]:break-words">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
      </div>
    ) : null}

    {loading && message.id === streamingMessageId && (
      <span className="inline-block animate-pulse text-violet-600">
        {message.content ? "▍" : "Thinking..."}
      </span>
    )}
  </div>
) : (
  message.content
)}




                  </div>
                </div>
              ))}


              <div ref={bottomRef} />
            </div>
          )}

          {/* Chat composer */}
          <div className="shrink-0 pb-5 pt-3">
            <form
              onSubmit={(event) => handleSubmit(event)}
              className="rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_4px_24px_rgba(15,23,42,0.05)] transition focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100"
            >
              <Textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask anything about this candidate..."
                className="max-h-40 min-h-[48px] resize-none border-0 bg-transparent px-2 py-2 text-[14px] text-slate-800 shadow-none placeholder:text-slate-400 focus-visible:ring-0"
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();

                    if (!loading && question.trim()) {
                      event.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
              />

              <div className="flex items-center justify-between px-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleNewChat}
                  disabled={loading}
                  className="gap-2 text-xs text-slate-500 hover:bg-slate-100"
                >
                  <Plus className="size-4" />
                  New chat
                </Button>

                <div className="flex items-center gap-3">
                  <span className="hidden text-[11px] text-slate-400 sm:block">
                    Enter to send
                  </span>

                  
{loading ? (
  <Button
    type="button"
    size="icon"
    onClick={handleStopGenerating}
    title="Stop generating"
    className="size-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
  >
    <Square className="size-4 fill-current" />
  </Button>
) : (
  <Button
    type="submit"
    size="icon"
    disabled={!question.trim()}
    title="Send message"
    className="size-10 rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
  >
    <ArrowUp className="size-5" />
  </Button>
)}

                </div>
              </div>
            </form>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
              <ShieldCheck className="size-3.5" />
              AI answers are based on resume information. Verify important details.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
