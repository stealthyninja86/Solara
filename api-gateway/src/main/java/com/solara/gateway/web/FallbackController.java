package com.solara.gateway.web;

import com.solara.gateway.dto.response.FallbackResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
public class FallbackController {

    private static final Logger log = LoggerFactory.getLogger(FallbackController.class);

    @RequestMapping("/fallback/auth")
    ResponseEntity<FallbackResponse> authFallback() {
        log.warn("Circuit breaker fallback triggered: service=auth");
        return serviceUnavailable("Auth service is temporarily unavailable. Please try again.");
    }

    @RequestMapping("/fallback/transactions")
    ResponseEntity<FallbackResponse> transactionsFallback() {
        log.warn("Circuit breaker fallback triggered: service=transaction");
        return serviceUnavailable("Transaction service is temporarily unavailable. Please try again.");
    }

    @RequestMapping("/fallback/insight")
    ResponseEntity<FallbackResponse> insightsFallback() {
        log.warn("Circuit breaker fallback triggered: service=insight");
        return serviceUnavailable("Insight service is temporarily unavailable. Please try again.");
    }

    private ResponseEntity<FallbackResponse> serviceUnavailable(String message) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new FallbackResponse(
                        "service_unavailable",
                        message,
                        "30s",
                        Instant.now()));
    }
}