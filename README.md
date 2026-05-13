# Fluid

Learn a language with an adaptive AI tutor.

Fluid is an open-source language learning app that pairs conversational AI with interactive exercises. An agent-driven tutor adapts to your level, explains concepts, and drills you with targeted practice.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) 16 (App Router) + React 19
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) v4
- **Auth & Database**: [Supabase](https://supabase.com/) (Postgres + Row Level Security)
- **AI**: Anthropic Claude via [`@earendil-works/pi-agent-core`](https://github.com/earendil-works/pi-agent)
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com/) project
- An [Anthropic](https://www.anthropic.com/) API key

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your credentials:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

Optional overrides:
- `LLM_PROVIDER` — defaults to `anthropic`
- `LLM_MODEL` — defaults to `claude-sonnet-4-6`

### Database Setup

Run the following SQL in your Supabase SQL Editor to create the required tables:

```sql
create table conversation_history (
  user_id uuid references auth.users not null,
  language text not null,
  messages jsonb default '[]',
  primary key (user_id, language)
);

create table language_memory (
  user_id uuid references auth.users not null,
  language text not null,
  data jsonb default '{}',
  primary key (user_id, language)
);

create table language_time (
  user_id uuid references auth.users not null,
  language text not null,
  total_seconds integer not null default 0,
  updated_at timestamp with time zone default now(),
  primary key (user_id, language)
);
```

Enable **Row Level Security** and add policies so users can only read/write their own rows.

### Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/                 # Next.js routes (pages, API, auth callbacks)
│   ├── api/agent/       # Agent SSE streaming endpoints
│   ├── learn/[language] # Language learning session page
│   └── login/           # Google OAuth login
├── framework/           # Shared framework code
│   ├── hooks/           # React hooks (useAgent, etc.)
│   ├── memory/          # Persistence logic
│   ├── provider/        # LLM provider config
│   ├── server/          # Server utilities
│   ├── ui/              # Shared UI components
│   └── types.ts         # Core framework types
├── lang-app/           # Language-learning domain logic
│   ├── config.ts        # Supported languages & LLM config
│   ├── memory/          # Language memory types
│   ├── system-prompt.ts # AI tutor system prompt
│   └── tools/           # Exercise tool definitions
└── lib/                # Client/server Supabase clients
```

## Contributing

We welcome contributions. A few guidelines:

1. **Open an issue first** for large changes or new features.
2. Keep changes focused — one concern per PR.
3. Follow existing TypeScript and Tailwind conventions.
4. Ensure the dev server starts and the build passes:
   ```bash
   npm run build
   ```

## License

[MIT](LICENSE)
