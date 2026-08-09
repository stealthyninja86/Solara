package com.solara.insightservice.controller;

import com.solara.insightservice.dto.response.CategorizedTransactionResponse;
import com.solara.insightservice.dto.request.RecategorizeRequest;
import com.solara.insightservice.dto.request.UpdateTransactionRequest;
import com.solara.insightservice.model.CategorizedTransaction;
import com.solara.insightservice.service.CategorizationService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/category/transaction")
public class CategorizationController {

    private final CategorizationService queryService;

    private static final Logger log = LoggerFactory.getLogger(CategorizationController.class);

    public CategorizationController(CategorizationService queryService) {
        this.queryService = queryService;
    }

    @GetMapping
    public ResponseEntity<Page<CategorizedTransactionResponse>> list(
            @RequestParam UUID userId,
            @RequestParam(required = false) Boolean needsReview,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false) String paymentMode,
            @RequestParam(required = false) BigDecimal amountMin,
            @RequestParam(required = false) BigDecimal amountMax,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate updatedAtFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate updatedAtTo,
            @RequestParam(required = false) Boolean bulkImport,
            @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        log.debug("list requested: userId={}, needsReview={}, category={}, bulkImport={}, page={}, size={}",
                userId, needsReview, category, bulkImport, pageable.getPageNumber(), pageable.getPageSize());
        Page<CategorizedTransaction> page = queryService.list(
                userId, needsReview, category, dateFrom, dateTo,
                paymentMode, amountMin, amountMax, updatedAtFrom, updatedAtTo, bulkImport, pageable);
        log.debug("list returned: userId={}, totalElements={}", userId, page.getTotalElements());
        return ResponseEntity.ok(page.map(CategorizedTransactionResponse::from));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CategorizedTransactionResponse> get(
            @PathVariable UUID id) {
        log.debug("get requested: id={}", id);
        return queryService.get(id)
                .map(transaction -> ResponseEntity.ok(CategorizedTransactionResponse.from(transaction)))
                .orElseGet(() -> {
                    log.warn("get not found: id={}", id);
                    return ResponseEntity.notFound().build();
                });
    }

    @PutMapping("/{id}/category")
    public ResponseEntity<CategorizedTransactionResponse> recategorize(
            @PathVariable UUID id,
            @Valid @RequestBody RecategorizeRequest request) {
        log.info("recategorize requested: id={}, category={}", id, request.category());
        CategorizedTransaction transaction = queryService.recategorize(id, request.category());
        return ResponseEntity.ok(CategorizedTransactionResponse.from(transaction));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CategorizedTransactionResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateTransactionRequest request) {
        log.info("update requested: id={}, merchant={}, category={}", id, request.merchant(), request.category());
        CategorizedTransaction transaction = queryService.update(id, request);
        return ResponseEntity.ok(CategorizedTransactionResponse.from(transaction));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        log.info("delete requested: id={}", id);
        try {
            queryService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            log.debug("delete not found: id={}", id);
            return ResponseEntity.notFound().build();
        }
    }
}
