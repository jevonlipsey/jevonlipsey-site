---
title: 'Evaluating Community of Interest Fractures with MCMC Dual Graphs'
date: 2026-08-01
summary: 'Notes on formulating Total Community Preservation (TCP) and running 20M+ ReCom Markov chain steps across Colorado legislative districts.'
tags: ['redistricting', 'mcmc', 'computational-fairness', 'python']
draft: false
---

During the MCURE program at Colorado College, our team investigated how Communities of Interest (COIs)—groups of residents with shared policy or cultural concerns—are preserved or fractured in congressional redistricting.

### The Total Community Preservation (TCP) Metric

Administrative boundaries often divide coherent communities without mathematical accountability. We formulated Total Community Preservation (TCP), an HHI-adapted metric that models the pairwise probability that two randomly selected community members remain in the same legislative district.

By proof, TCP provides an unbiased measure of cohesion that does not penalize large or dispersed communities disproportionately compared to traditional entropy or binary threshold cuts.

### Dual Graph Pipelines with GerryChain

Using GeoPandas, Census VTDs, and citizen submissions from Representable.org, we synthesized demographic-weighted dual graphs for Colorado. Running 20M+ ReCom Markov chain steps revealed that optimizing for unvetted COI collections can swing partisan seat shares by up to 5%, demonstrating significant potential for strategic manipulation if metrics are unverified.
