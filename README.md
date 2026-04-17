# AI Rogan - Podcast Generator

This project is an AI-powered podcast generator that creates scripts and audio from uploaded documents. It features a Next.js frontend and a FastAPI backend.

## Features

- **Document Upload**: Upload PDF, DOCX, PPTX, and text files.
- **Script Generation**: Generates a podcast script in various styles (e.g., Joe Rogan) using Google Gemini.
- **Audio Generation**: Generates high-quality audio from the script using Google Cloud Text-to-Speech.

## Project Structure

```
ai-rogan/
├── app/                # Next.js frontend
├── backend/            # FastAPI backend
│   ├── main.py         # Main FastAPI application
│   ├── generator.py    # Script and audio generation logic
│   └── ingestor.py     # Document text extraction
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (for frontend)
- Python 3.12+ (for backend)
- `uv` (Python package manager)
- Google Cloud Project with enabled APIs:
  - Vertex AI / Gemini API
  - Text-to-Speech API

### Backend Setup

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies using `uv`:
   ```bash
   uv sync
   ```
3. Set up environment variables. Copy `.env.example` to `.env` and fill in your GCP details.
4. Run the backend server:
   ```bash
   uvicorn main:app --reload
   ```

### Frontend Setup

1. Navigate to the root directory:
   ```bash
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## License

MIT
