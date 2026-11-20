# TalentQuery — AI-Powered Candidate Screening Assistant

TalentQuery is a full-stack AI application that helps HR professionals explore a candidate's qualifications through a conversational interface.

Instead of manually searching through a resume, recruiters can ask natural-language questions and receive AI-generated answers grounded in the candidate's resume.

## Features

- **AI-Powered Candidate Screening:** Ask questions about skills, experience, education, and projects.
- **Resume Parsing:** Extract structured information from a PDF resume using an LLM.
- **Resume Caching:** Store parsed resume information in JSON to avoid unnecessary API calls.
- **Streaming Responses:** Display AI-generated answers progressively.
- **Context-Aware Answers:** Generate answers based on resume information rather than inventing qualifications.
- **Modern Chat Interface:** Responsive UI with suggested questions, loading indicators, and error handling.
- **Retry and Stop:** Retry failed requests or stop response generation.

## Tech Stack

| Frontend | Backend | AI |
|---|---|---|
| Next.js | FastAPI | Groq API |
| TypeScript | Python | GPT-OSS 120B |
| Tailwind CSS | Pydantic | LLM-based resume parsing |
| shadcn/ui | pypdf | Streaming completions |

## How It Works

1. The backend reads a locally configured PDF resume.
2. The Groq model extracts structured candidate information.
3. The extracted information is cached in a local JSON file.
4. The recruiter asks a question through the Next.js interface.
5. FastAPI sends the question and candidate data to the LLM.
6. The answer is streamed back to the frontend.

## Project Structure

```text
hiremeai/
├── backend/
│   ├── main.py
│   ├── my_resume.pdf        # Local only; not committed
│   └── parsed_resume.json   # Generated locally; not committed
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   └── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Python
- Node.js
- Groq API key
- A PDF resume for local testing

### Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Install the Python dependencies used by the project:

```bash
uv add fastapi uvicorn groq python-dotenv pydantic pypdf
```

Create a `.env` file inside `backend/`:

```env
GROQ_API_KEY=your_groq_api_key_here
```

Place your test resume at `backend/my_resume.pdf`.

Start FastAPI:

```bash
uv run python -m uvicorn main:app --reload
```

Backend API documentation:

`http://127.0.0.1:8000/docs`

### Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Start the frontend:

```bash
npm run dev
```

Open `http://localhost:3000`.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Retrieve candidate information and API status |
| POST | `/chat` | Generate a complete AI response |
| POST | `/chat/stream` | Stream an AI response |
| POST | `/resume/refresh` | Reparse the PDF and update the cache |

## Example Questions

- What are the candidate's strongest technical skills?
- Does the candidate have React experience?
- Summarize the candidate's professional experience.
- What projects has the candidate worked on?
- Is Docker mentioned in the candidate's resume?

## Privacy and Limitations

TalentQuery currently supports a single locally configured resume and is designed as a portfolio demonstration.

Resume PDFs, parsed candidate data, and API keys should not be committed to Git.

The current MVP does not include authentication or access controls. It should not be deployed publicly with real candidate information without additional security measures.

AI-generated answers may contain errors and should be verified against the original resume. TalentQuery supports recruiter review; it does not make hiring decisions.

## Future Improvements

- Secure resume upload
- Multiple candidate support
- Authentication and authorization
- Candidate search and filtering
- Database-backed candidate management
- Retrieval-augmented generation (RAG) for larger document collections

## Project Status

**MVP Complete** — Core candidate screening, resume parsing, caching, and streaming chat functionality have been implemented and tested.