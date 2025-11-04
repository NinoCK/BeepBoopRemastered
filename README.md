# Personal AI Assistant

## Overview
The Personal AI Assistant is a local AI assistant web application inspired by Claude. It features a chat interface with context memory, Retrieval-Augmented Generation (RAG) capabilities, web search integration, and a terminal window for backend logs and AI inference information. The application is built using Laravel 12 for the backend and React with shadcn/ui for the frontend, styled with TailwindCSS.

## Features
- **Chat Interface**: A user-friendly chat window with smooth scrolling and message types (user, assistant, system).
- **RAG (Retrieval-Augmented Generation)**: Document-anchored answers using uploaded PDFs or text files.
- **Web Search Integration**: Real-time information retrieval from external search APIs.
- **Terminal Panel**: Displays backend logs and AI inference information in real-time.
- **Local Model Inference**: Interfaces with a local language model for generating responses.

## Tech Stack
- **Backend**: Laravel 12 (API + RAG + Web Search handling)
- **Frontend**: React + Vite + shadcn/ui
- **Styling**: TailwindCSS + custom color palette
- **Font**: JetBrainsMono Nerd Font
- **AI Engine**: Local model inference (e.g., Ollama / LM Studio / Local LLM endpoint)
- **Database**: MySQL (for chat history, document embeddings, etc.)
- **Optional**: Redis (for caching search results/sessions)

## Folder Structure
```
personal-ai-assistant/
├── backend/
│   ├── app/
│   │   ├── Console/
│   │   ├── Http/
│   │   ├── Models/
│   │   └── Services/
│   ├── config/
│   ├── database/
│   ├── routes/
│   ├── storage/
│   ├── .env.example
│   ├── artisan
│   ├── composer.json
│   └── composer.lock
├── frontend/
│   ├── public/
│   ├── src/
│   ├── components.json
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── .gitignore
└── README.md
```

## Setup Instructions

### Backend (Laravel 12)
1. **Installation**
   - Navigate to the backend directory:
     ```
     cd backend
     ```
   - Install dependencies:
     ```
     composer install
     ```
   - Copy the environment file:
     ```
     cp .env.example .env
     ```
   - Generate the application key:
     ```
     php artisan key:generate
     ```
   - Run migrations:
     ```
     php artisan migrate
     ```

2. **Local Model Endpoint**
   - Edit the `.env` file and add:
     ```
     LLM_ENDPOINT=http://localhost:11434/api/generate
     RAG_PATH=/storage/app/documents/
     ```

3. **Web Search**
   - Set up your preferred search API:
     ```
     SEARCH_API_KEY=your_api_key_here
     SEARCH_PROVIDER=tavily
     ```

### Frontend (React + shadcn)
1. **Setup**
   - Navigate to the frontend directory:
     ```
     cd frontend
     ```
   - Install dependencies:
     ```
     npm install
     ```
   - Initialize shadcn-ui:
     ```
     npx shadcn-ui init
     ```
   - Start the development server:
     ```
     npm run dev
     ```

### TailwindCSS Configuration
- Update `tailwind.config.js` with custom colors and font settings.
- Add global styles to `index.css`.

## Future Enhancements
- Voice input/output capabilities.
- Local embedding database for improved performance.
- WebSocket support for live typing simulation.
- Plugin-like commands for enhanced functionality.

## Aesthetic & UX Notes
- Use JetBrainsMono font with accent color for buttons and highlights.
- Implement glassmorphism for panels and a neon look for the terminal panel.

## License
This project is open-source and available for modification and distribution under the MIT License.