---
title: "An Evaluation of Approaches to Train Embeddings for Logical Inference"
venue: "Proceedings of the AAAI Conference on Artificial Intelligence (AAAI-25 Student Abstract)"
acronyms: ['AAAI']
year: 2025
status: "published"
authors:
  - "Y. White"
  - "Jevon Lipsey"
  - "J. Heflin"
abstract: "Knowledge bases traditionally require manual optimization to ensure reasonable performance when answering queries. We build on previous neurosymbolic approaches by improving the training of an embedding model for logical statements that maximizes similarity between unifying atoms and minimizes similarity of non-unifying atoms. In particular, we evaluate different approaches to training this model."
pdf: "https://doi.org/10.1609/aaai.v39i28.35313"
bibtex: |
  @inproceedings{white2025evaluation,
    title={An Evaluation of Approaches to Train Embeddings for Logical Inference},
    author={White, Y. and Lipsey, Jevon and Heflin, J.},
    booktitle={Proceedings of the AAAI Conference on Artificial Intelligence},
    volume={39},
    number={28},
    pages={29527--29528},
    year={2025},
    doi={10.1609/aaai.v39i28.35313}
  }
featured: true
---

Standard backward-chaining reasoners rely on brute-force search over first-order knowledge bases. In this work, we train embedding models to score candidate goal/rule pairs using triplet loss, testing whether structured generation techniques can prevent search space explosion during logical deduction.

## Key Methods

- **Structural Mutation:** Replaced uniform random triplet sampling with systematic argument substitutions, mutating anchor atoms into unifiable positive pairs and non-unifiable negative pairs.
- **Outlier Atoms:** Increased the probability of sampling repeated-term atoms (e.g., `mom(X, X)`) by 60% to teach the model variable unification consistency across multiple occurrences
- **Hard Samples:** Periodically retrained the embedding network on the top 50% highest-loss triplets to focus learning on difficult unification boundaries.

## Findings

Across synthetic knowledge bases of 250 and 375 statements, the structured embeddings reduced mean search nodes explored by up to 188× compared to standard unguided backward chaining, and between 2× to 6× compared to prior learned unification baselines.
