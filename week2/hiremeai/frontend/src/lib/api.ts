
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type ChatResponse = {
  answer: string;
};


export async function askCandidate(
  question: string
): Promise<string> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    });
  } catch {
    throw new Error(
      "Cannot connect to the server. Please check that FastAPI is running."
    );
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "The AI service is receiving too many requests. Please try again shortly."
      );
    }

    if (response.status >= 500) {
      throw new Error(
        "The AI service encountered an error. Please try again."
      );
    }

    throw new Error(
      `Unable to process your question (${response.status}).`
    );
  }

  let data: { answer?: unknown };

  try {
    data = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (
    typeof data.answer !== "string" ||
    !data.answer.trim()
  ) {
    throw new Error("The AI returned an empty response.");
  }

  return data.answer;
}

export type CandidateResume = {
  name: string | null;
  email: string | null;
  phone: string | null;
  total_experience_years: number | null;
  skills: string[];
  experiences: {
    company: string | null;
    role: string | null;
    duration: string | null;
    description: string | null;
    skills_used: string[];
  }[];
  education: string[];
  projects: string[];
  certifications: string[];
};

type CandidateResponse = {
  message: string;
  resume: CandidateResume;
};

export async function getCandidate(): Promise<CandidateResume> {
  const response = await fetch(`${API_URL}/`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load candidate resume.");
  }

  const data: CandidateResponse = await response.json();

  if (!data.resume) {
    throw new Error("Candidate resume is unavailable.");
  }

  return data.resume;
}



export async function streamCandidateAnswer(
  question: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }

    throw new Error(
      "Cannot connect to FastAPI. Please check that the server is running."
    );
  }

  if (!response.ok) {
    throw new Error(
      `AI request failed (${response.status}). Please try again.`
    );
  }

  if (!response.body) {
    throw new Error("The server did not return a response stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let fullAnswer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, {
        stream: true,
      });

      if (chunk) {
        fullAnswer += chunk;
        onChunk(chunk);
      }
    }

    const remaining = decoder.decode();

    if (remaining) {
      fullAnswer += remaining;
      onChunk(remaining);
    }

    if (!fullAnswer.trim()) {
      throw new Error("The AI returned an empty response.");
    }
  } finally {
    reader.releaseLock();
  }
}

