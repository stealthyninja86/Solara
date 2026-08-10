package com.solara.insightservice.dto.internal;

import com.solara.insightservice.dto.internal.SimilarCategorization;

import java.util.List;

public record RAGContext(
    List<SimilarCategorization> userHistory,
    ConsensusStats consensus
) {}
