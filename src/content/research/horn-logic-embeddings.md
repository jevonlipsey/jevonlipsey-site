---
title: "High Quality Embeddings for Horn Logic Reasoning"
venue: "Proceedings of The 19th International Conference on Neurosymbolic Learning and Reasoning (PMLR)"
acronyms: ['PMLR']
year: 2025
status: "published"
authors:
  - "Y. Zhang"
  - "Y. White"
  - "D. Clark"
  - "J. Sanchez"
  - "Jevon Lipsey"
  - "A. Hirst"
  - "J. Heflin"
abstract: "Neural networks can be trained to rank the choices made by logical reasoners, resulting in more efficient searches for answers. A key step in this process is creating useful embeddings, i.e., numeric representations of logical statements. This paper introduces and evaluates several approaches to creating embeddings that result in better downstream results. We train embeddings using triplet loss, which requires examples consisting of an anchor, a positive example, and a negative example. We introduce three ideas: generating anchors that are more likely to have repeated terms, generating positive and negative examples in a way that ensures a good balance between easy, medium, and hard examples, and periodically emphasizing the hardest examples during training. We conduct several experiments to evaluate this approach, including a comparison of different embeddings across different knowledge bases, in an attempt to identify what characteristics make an embedding well-suited to a particular reasoning task."
pdf: "https://proceedings.mlr.press/v284/zhang25a.html"
bibtex: |
  @inproceedings{zhang2025highquality,
    title={High Quality Embeddings for Horn Logic Reasoning},
    author={Zhang, Y. and White, Y. and Clark, D. and Sanchez, J. and Lipsey, Jevon and Hirst, A. and Heflin, J.},
    booktitle={Proceedings of The 19th International Conference on Neurosymbolic Learning and Reasoning},
    series={Proceedings of Machine Learning Research},
    volume={284},
    pages={116--129},
    year={2025},
    publisher={PMLR},
    url={https://proceedings.mlr.press/v284/zhang25a.html}
  }
featured: true
---

Deductive reasoning in first-order Horn logic suffers from exponential node expansion when navigating large, unoptimized knowledge bases. This paper develops methods to train neural embedding models that map unifying atoms close together and non-unifying atoms far apart in latent space, guiding a downstream heuristic scoring model.

## Core Contributions

- **Balanced Triplet Curriculum:** Synthesized triplets categorized across three difficulty levels (40% easy, 50% medium, 10% hard) by combining subtle argument modifications with deceptive negative transformations.
- **Repeated-Term Atom (RTA) Sampling:** Increased anchor repeat probabilities by 15%, forcing the embedding space to account for identical variable constraints (e.g., `loves(X, X)`).
- **Knowledge Base Translation:** Applied the Grosof et al. algorithm to translate complex Description Logic (OWL/RDF) axioms into Datalog rules, enabling evaluation on real-world ontologies including the 2008 Olympics and Nobel Prize datasets.

## Findings

In ablation experiments on 250-statement knowledge bases, increasing repeated terms reduced mean nodes explored by 89.9% (from 981.8 to 99.0), while balanced triplet difficulty reduced exploration by 82.8% (to 169.0). Combining all three strategies achieved an overall average of 76.2 nodes explored: a 92.2% reduction over the prior baseline and up to a 99% reduction over unguided search.
