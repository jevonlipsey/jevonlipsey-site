---
title: "featherweight"
tech: ["fastapi", "playwright", "vue.js", "sqlite"]
desc: "Full-stack platform that transforms eBird raw sighting frequency data into seasonal observation-likelihood rankings for birders."
links:
  github: "https://github.com/BrooktieFrogge/EBird_Hotspot_Ranker"
featured: true
---

Automated birding hotspot ranker built with FastAPI and Vue.js. Normalizes multi-year eBird observational bar charts across localized weekly windows to calculate relative sighting likelihoods. Integrates an automated headless Playwright scraping and caching layer with APScheduler to continuously ingest Cornell Lab of Ornithology hotspot reports into SQLite.
