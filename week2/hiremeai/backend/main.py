
import base64
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from groq import Groq
from pydantic import BaseModel, Field
from pypdf import PdfReader


# ==========================================
# 1. ENVIRONMENT & GROQ CLIENT
# ==========================================

BASE_DIR = Path(__file__).resolve().parent


# Load environment variables
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    raise RuntimeError(
        "GROQ_API_KEY is missing. "
        "Please check your .env file."
    )

client = Groq(api_key=api_key)

model = "openai/gpt-oss-120b"

PDF_PATH = BASE_DIR / "my_resume.pdf"
JSON_PATH = BASE_DIR / "parsed_resume.json"



# ==========================================
# 2. FASTAPI APPLICATION & CORS
# ==========================================

app = FastAPI(
    title="TalentQuery API",
    description="AI-powered candidate screening assistant",
    version="1.0.0",
)

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

frontend_url = os.getenv("FRONTEND_URL", "").rstrip("/")

if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ==========================================
# 3. PYDANTIC MODELS
# ==========================================

class Experience(BaseModel):
    company: str | None = None
    role: str | None = None
    duration: str | None = None
    description: str | None = None
    skills_used: list[str] = Field(default_factory=list)


class Resume(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None

    total_experience_years: float | None = None

    skills: list[str] = Field(default_factory=list)
    experiences: list[Experience] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1)


resume_schema = Resume.model_json_schema()


# ==========================================
# 4. PDF EXTRACTION
# ==========================================

def read_pdf(file_path: Path) -> str:
    reader = PdfReader(file_path)

    text = ""

    for page in reader.pages:
        page_text = page.extract_text()

        if page_text:
            text += page_text + "\n"

    return text


# ==========================================
# 5. RESUME PARSING USING GROQ
# ==========================================

def parse_resume(resume_text: str) -> Resume:

    system_prompt = f"""
You are an expert resume parser.

Extract information from the resume based on its meaning,
not only based on exact section headings.

Different resumes may use different headings.

For example:
- Experience
- Professional Experience
- Work History
- Employment
- Internships

These may all contain relevant experience.

Skills may also appear in the skills section, work experience,
internships or projects.

Return ONLY valid JSON matching this schema:

{resume_schema}

Important rules:

1. Do not invent information.
2. If a value is not available, return null.
3. If a list has no information, return an empty list.
4. Include internships inside experiences.
5. Extract skills mentioned across the entire resume.
"""

    user_prompt = f"""
Parse the following resume:

{resume_text}
"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        response_format={
            "type": "json_object"
        },
    )

    raw_output = response.choices[0].message.content

    if not raw_output:
        raise ValueError("Groq returned an empty resume.")

    data = json.loads(raw_output)

    resume = Resume.model_validate(data)

    return resume


# ==========================================
# 6. RESUME JSON CACHING
# ==========================================

def save_resume(resume: Resume):
    JSON_PATH.write_text(
        resume.model_dump_json(indent=2),
        encoding="utf-8",
    )

    print("Resume saved to JSON cache")


def load_resume() -> Resume | None:
    encoded_resume = os.getenv("RESUME_JSON_BASE64")

    if encoded_resume:
        decoded_resume = base64.b64decode(
            encoded_resume,
            validate=True,
        ).decode("utf-8")

        return Resume.model_validate_json(decoded_resume)

    if not JSON_PATH.exists():
        return None

    return Resume.model_validate_json(
        JSON_PATH.read_text(encoding="utf-8")
    )

def get_resume() -> Resume:
    cached_resume = load_resume()

    if cached_resume is not None:
        print("Resume loaded from JSON cache")
        return cached_resume

    print("Parsing resume using Groq...")

    resume_text = read_pdf(PDF_PATH)

    resume = parse_resume(resume_text)

    save_resume(resume)

    return resume


# ==========================================
# 7. SHARED HR SCREENING SYSTEM PROMPT
# ==========================================

def build_candidate_messages(
    question: str,
    resume: Resume,
):
    system_prompt = f"""
You are TalentQuery, a professional AI candidate screening
assistant helping HR recruiters understand a candidate's
qualifications.

CANDIDATE RESUME DATA:
{resume.model_dump_json(indent=2)}

INSTRUCTIONS:

1. Answer questions using ONLY the candidate's resume data.

2. Never invent skills, experience, qualifications,
   certifications, or projects.

3. If the resume clearly confirms a skill or experience:
   - Answer positively.
   - Briefly explain the supporting information.

4. If the resume does NOT mention a skill or technology:
   - Explain naturally that it is not mentioned in
     the candidate's resume.
   - Do NOT claim that the candidate has no experience.
   - Suggest confirming it during an interview when relevant.

5. If the resume explicitly confirms that the candidate
   lacks a qualification:
   - State that accurately and professionally.

6. If the question asks about something unrelated to
   the resume:
   - Explain politely that you can help with the
     candidate's qualifications and experience.

7. Keep responses concise, natural, and professional.

8. Avoid repeating generic responses such as:
   "I don't have enough information to answer that."

9. Do not make hiring or rejection decisions.

10. Speak as an HR screening assistant, not as the
    candidate.

EXAMPLE:

HR: Does this candidate have Docker experience?

AI: Docker experience is not mentioned in the candidate's
resume, so I cannot confirm whether they have worked with
it. This could be clarified during an interview.

HR: Does this candidate have React experience?

AI: Yes, React is listed among the candidate's technical
skills. The resume also describes relevant experience
where available.

11. Format responses using Markdown when helpful.

12. Use:
    - Short headings for longer answers.
    - Bullet points for skills, experience, and projects.
    - Bold text for important technologies and roles.
    - Short paragraphs for readability.

13. For simple questions, give a direct answer without
    unnecessary headings or long lists.

14. Avoid excessive formatting.
15. Do not use Markdown tables in responses.

16. For professional experience, use this format:

### Professional Experience

**Company:** Company name
**Role:** Job title
**Duration:** Employment period

**Key Responsibilities:**
- Responsibility one
- Responsibility two
- Responsibility three

17. Use bullet points instead of tables for skills,
    projects, education, and experience.

18. Do not generate HTML tags such as <br>, <div>,
    or <span>. Use Markdown formatting only.
"""

    return [
        {
            "role": "system",
            "content": system_prompt,
        },
        {
            "role": "user",
            "content": question,
        },
    ]


# ==========================================
# 8. NORMAL AI RESPONSE
# ==========================================

def ask_candidate(
    question: str,
    resume: Resume,
) -> str:

    messages = build_candidate_messages(
        question,
        resume,
    )

    response = client.chat.completions.create(
        model=model,
        messages=messages,
    )

    answer = response.choices[0].message.content

    if not answer:
        raise ValueError("Groq returned an empty answer.")

    return answer


# ==========================================
# 9. STREAMING AI RESPONSE
# ==========================================

def stream_candidate_answer(
    question: str,
    resume: Resume,
):
    messages = build_candidate_messages(
        question,
        resume,
    )

    stream = client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
    )

    for chunk in stream:
        if not chunk.choices:
            continue

        content = chunk.choices[0].delta.content

        if content:
            yield content


# ==========================================
# 10. API ENDPOINTS
# ==========================================

@app.get("/")
def home():
    resume = get_resume()

    return {
        "message": "TalentQuery API is running",
        "resume": resume,
    }


@app.post("/chat")
def chat(request: ChatRequest):
    resume = get_resume()

    answer = ask_candidate(
        request.question,
        resume,
    )

    return {
        "answer": answer,
    }


@app.post("/chat/stream")
def chat_stream(request: ChatRequest):
    resume = get_resume()

    return StreamingResponse(
        stream_candidate_answer(
            request.question,
            resume,
        ),
        media_type="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/resume/refresh")
def refresh_resume():
    if os.getenv("ENVIRONMENT") == "production":
      raise HTTPException(
        status_code=403,
        detail="Resume refresh is disabled in production.",
    )
    if not PDF_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Resume PDF not found.",
        )

    resume_text = read_pdf(PDF_PATH)

    resume = parse_resume(resume_text)

    save_resume(resume)

    return {
        "message": "Resume updated successfully",
        "resume": resume,
    }
