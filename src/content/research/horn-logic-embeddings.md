---
title: 'High Quality Embeddings for Horn Logic Reasoning'
venue: 'Proceedings of The 19th International Conference on Neurosymbolic Learning and Reasoning (PMLR)'
year: 2025
status: 'published'
authors:
  - 'Y. Zhang'
  - 'Y. White'
  - 'D. Clark'
  - 'J. Sanchez'
  - 'Jevon Lipsey'
  - 'A. Hirst'
  - 'J. Heflin'
abstract: 'Optimizing neurosymbolic backward-chaining reasoners via embedding model tuning, reducing computational waste in mean nodes explored by up to 99% compared to standard brute-force reasoners.'
pdf: 'https://proceedings.mlr.press/v284/zhang25a.html'
code: 'https://github.com/jevonlipsey'
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

## Summary

Deductive reasoning over complex Knowledge Bases (KBs) suffers from exponential node exploration in backward-chaining search spaces. In this paper, we demonstrate how embedding models can be tuned through tailored triplet generation and hard negative mining to score candidate deduction steps, slashing mean nodes explored by up to 99% across real-world benchmarks (such as the 2008 Olympics and Nobel Prize ontologies).

## Key Technical Contributions
1. **Rule Translation Pipeline:** Applied the Grosof et al. algorithm to translate complex Description Logic (OWL/RDF) axioms into tractable Datalog rules.
2. **Balanced Triplet Generation:** Synthesized structural mutation sets (easy, medium, hard negatives) to prevent embedding space crowding.
3. **Repeated-Term Atom Sampling:** Boosted reasoner alignment on variable unification constraints.
