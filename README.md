# jevonlipsey.com

Personal academic portfolio and systems laboratory for **Jevon Lipsey**, Computer Science Ph.D. student at Colorado School of Mines in the MIRROЯLab (advised by Dr. Tom Williams).

Minimal, fast, editorial academic aesthetic built with [Astro v5](https://astro.build), Tailwind CSS, and TypeScript.

---

## 🧭 Site Structure & Routes

- `/` &mdash; Editorial homepage: intro, selected research, selected projects, recent writing, and direct contact links.
- `/research` &mdash; Full publications list (peer-reviewed papers, workshop articles, preprints).
- `/research/[id]` &mdash; Individual paper notes, abstracts, author details, and BibTeX citations.
- `/demos` &mdash; Systems, software tools, WebAssembly runtimes, and interactive demos.
- `/thoughts` &mdash; Field notes, essays, and research logs.
- `/thoughts/[id]` &mdash; Individual essays and notes rendered from Markdown.
- `/about` &mdash; Extended bio, academic background, coordinates, and curriculum vitae download.
- `/cv.pdf` &mdash; Direct static download of Jevon's CV.

---

## 🛠️ How to Maintain & Update Content

### 1. Adding a New Research Paper

Create a Markdown file in `src/content/research/<slug>.md`:

```markdown
---
title: 'Your Paper Title Here'
venue: "ACM/IEEE International Conference on Human-Robot Interaction (HRI '27)"
year: 2027
status: 'published' # 'published' | 'in-review' | 'preprint'
authors:
  - 'Jevon Lipsey'
  - 'Tom Williams'
abstract: 'A short 2-3 sentence overview of the research and findings.'
pdf: 'https://link-to-paper-or-arxiv.org' # or '/papers/your-paper.pdf'
code: 'https://github.com/jevonlipsey/repo'
bibtex: |
  @inproceedings{lipsey2027paper,
    title={Your Paper Title Here},
    author={Lipsey, Jevon and Williams, Tom},
    booktitle={Proceedings of HRI},
    year={2027}
  }
featured: true # Set to true to prioritize on the homepage
---

## Summary & Notes
Write any extended notes, methodology details, or figures here using standard Markdown.
```

Astro will automatically generate:
- A new row on `/research`
- An individual page at `/research/<slug>`
- BibTeX clipboard modal integration

---

### 2. Adding a New Blog Post / Field Note

Create a Markdown file in `src/content/thoughts/<slug>.md`:

```markdown
---
title: 'Your Post Title'
date: 2026-09-15
summary: 'A short one-line summary of your essay or field note.'
tags: ['hri', 'robotics', 'systems']
draft: false # Set to true while drafting
---

Your essay or notes go here in Markdown. Supports headers, code snippets, lists, and links.
```

Astro will automatically render this on `/thoughts` and create a dedicated page at `/thoughts/<slug>`.

---

### 3. Adding or Updating Demos & Projects

The demos list lives in:
- `src/pages/demos.astro` (the full grid of systems)
- `src/pages/index.astro` (the top 3 selected projects in the `projects` array)

To add a project, edit the array in `src/pages/demos.astro`:

```ts
{
  title: 'Project Name',
  tech: ['Python', 'Three.js', 'FastAPI'],
  desc: 'A concise description of what the project does and why it was built.',
  link: 'https://github.com/jevonlipsey/your-repo',
}
```

If you build interactive 3D WebGL / Three.js canvases, place the React component in `src/components/` and import it into `src/pages/demos.astro` with `client:visible`.

---

### 4. Hosting & Updating PDFs (CV / Resume / Papers)

Static files live in `public/`. Any file in `public/` is served directly at the root:

- Replace `public/cv.pdf` to update the site-wide `/cv.pdf` link.
- Replace `public/lipsey-resume.pdf` to update the resume link.
- To host full paper PDFs locally, place them in `public/papers/` (e.g. `public/papers/hri27.pdf` &rarr; accessible at `/papers/hri27.pdf`).

---

## ⚡ Development & Deployment

### Local Development

```bash
# install dependencies
npm install

# start dev server
npm run dev

# check build cleanly
npm run build
```

### Deploying to Cloudflare Pages (Custom Domain `jevonlipsey.com`)

1. **Push this repo to GitHub** (`git add . && git commit -m "site scaffold" && git push`).
2. Log into the **Cloudflare Dashboard** &rarr; **Workers & Pages** &rarr; **Create application** &rarr; **Pages** &rarr; **Connect to Git**.
3. Select your repository.
4. Set Build Settings:
   - **Framework preset:** `Astro`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node.js version:** `22` (set env var `NODE_VERSION = 22.12.0` if needed)
5. Click **Save and Deploy**.
6. Under **Custom domains**, add `jevonlipsey.com` (Cloudflare will automatically manage DNS, SSL, and edge CDN routing).

---

## 🏛️ Design Rules

- **Minimal & Editorial:** Dark background (`#09090b`), high-contrast typography (`#fafafa` / `#a1a1aa`), max width `max-w-3xl`.
- **Zero Scroll Hijacking:** 100% native scrolling.
- **Fast:** Zero heavy client JS on reading pages.
