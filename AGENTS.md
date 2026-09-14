# Agent Identity & Behavior

You are an interactive, highly intelligent software engineering assistant.

## Communicating with the user

- Write your responses for a teammate who stepped away and is catching up, not for a log file.
- Lead with the outcome. Your first sentence after finishing should answer 'what happened' or 'what did you find' — the thing the user would ask for if they said 'just give me the TLDR.' Supporting detail and reasoning come after.
- Being readable and being concise are different things, and readable matters more. Keep text between tool calls to brief status notes.
- Write code that reads like the surrounding code: match its comment density, naming, and idiom.
- Only write a code comment to state a constraint the code itself can't show — never to say where it came from, what the next line does, or why your change is correct.

## Autonomy & Context Management

- When you have enough information to act, act. Do not re-derive facts already established in the conversation or narrate options you will not pursue.
- You are operating autonomously. Asking 'Want me to…?' or 'Shall I…?' will block the work. For reversible actions that follow from the original request, proceed without asking.

---

# Personal Coding Style

## Comments

- all comments must be lowercase. no capitalization ever.
- keep comments terse and conversational, like notes to yourself.
- comment the 'why', skip obvious comments. explain non-obvious decisions or domain logic inline.

## Docstrings & Functions

- lowercase docstrings, not title case.
- use this format for non-trivial functions:
  """
  brief description in lowercase

  inputs:
  param_name: short description
  outputs:
  return_name: short description
  """

- simple/obvious functions can skip docstrings entirely.
- keep functions small and focused — one job per function.
- prefer pragmatic defaults over verbose error handling.

## Formatting & Conventions

- ALWAYS use single quotes `'` instead of `"` for everything unless strictly required by syntax (e.g. valid JSON keys/values or HTML/JSX property requirements).
- `snake_case` for python/script utilities; standard JavaScript/TypeScript naming (`camelCase` variables/functions, `PascalCase` components/types) inside web source.
- two blank lines between top-level utility functions.

---

# Architecture & Content Layer

## 1. Page Shells & Design Philosophy
- **Aesthetic:** Minimalist, editorial academic / craft-engineer aesthetic (Karpathy / Paco / Linear feel). Pure dark background (`#09090b`), high-contrast typography (`#fafafa` headers, `#a1a1aa` / `#71717a` body and metadata), disciplined width (`max-w-3xl mx-auto`).
- **No scroll hijacking:** 100% native scrolling.
- **Default to `.astro`:** Zero client-side JavaScript on reading pages.
- **React Islands:** Only for interactive widgets requiring state or browser APIs (e.g., `BibtexButton.tsx` for clipboard copy). Use explicit client directives (`client:load` or `client:visible`).

## 2. Content Collections (`src/content.config.ts`)
Using modern Astro v5+ Content Layer API with `glob` loader:
- **`research`** (`src/content/research/*.{md,mdx}`):
  - `title` (string)
  - `venue` (string)
  - `year` (number)
  - `status` (`'published' | 'in-review' | 'preprint'`)
  - `authors` (array of strings)
  - `abstract` (string)
  - `pdf` (optional string)
  - `code` (optional string)
  - `bibtex` (optional string)
  - `featured` (boolean, default `false`)
  - Route mapping: `/research` (list), `/research/[id]` (individual paper note & abstract)
- **`thoughts`** (`src/content/thoughts/*.{md,mdx}`):
  - `title` (string)
  - `date` (coerce date)
  - `summary` (string)
  - `tags` (array of strings)
  - `draft` (boolean, default `false`)
  - Route mapping: `/thoughts` (archive), `/thoughts/[id]` (full essay/note)

## 3. Static Assets & PDFs (`public/`)
- Public static files live in `public/` and are copied as-is to the root of the build:
  - `public/cv.pdf` &rarr; served at `/cv.pdf`
  - `public/lipsey-resume.pdf` &rarr; served at `/lipsey-resume.pdf`
- When updating Jevon's CV, update `public/cv.pdf` (and optionally `public/lipsey-cv.pdf`).

## 4. Systems & Demos
- Project entries live on `/demos` and on the homepage `index.astro` selected projects section.
- Future WebGL / Three.js experiments can live as React islands in `src/components/` and be mounted in `src/pages/demos.astro` with `client:visible`.

## 5. Development & Verification Commands
- `npm run dev`: launch local dev server on `http://localhost:4321`.
- `npm run build`: compile production static site to `dist/`. Must produce zero TypeScript, Astro compiler, or Zod validation errors.
- `npm run preview`: test production build locally.
