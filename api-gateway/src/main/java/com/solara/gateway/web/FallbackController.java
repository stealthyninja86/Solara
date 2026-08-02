package com.solara.gateway.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
public class FallbackController {

    @GetMapping("/fallback/auth")
    ResponseEntity<Map<String, Object>> authFallback() {
        return serviceUnavailable("Auth service is temporarily unavailable. Please try again.");
    }

    @GetMapping("/fallback/transactions")
    ResponseEntity<Map<String, Object>> transactionsFallback() {
        return serviceUnavailable("Transaction service is temporarily unavailable. Please try again.");
    }

    @GetMapping("/fallback/insight")
    ResponseEntity<Map<String, Object>> insightsFallback() {
        return serviceUnavailable("Insight service is temporarily unavailable. Please try again.");
    }

    private ResponseEntity<Map<String, Object>> serviceUnavailable(String message) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                        "error", "service_unavailable",
                        "message", message,
                        "retryAfter", "30s",
                        "timestamp", Instant.now().toString()
                ));
    }
}
