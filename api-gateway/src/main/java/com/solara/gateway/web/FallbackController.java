package com.solara.gateway.web;

import com.solara.gateway.dto.response.FallbackResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
public class FallbackController {

    @RequestMapping("/fallback/auth")
    ResponseEntity<FallbackResponse> authFallback() {
        return serviceUnavailable("Auth service is temporarily unavailable. Please try again.");
    }

    @RequestMapping("/fallback/transactions")
    ResponseEntity<FallbackResponse> transactionsFallback() {
        return serviceUnavailable("Transaction service is temporarily unavailable. Please try again.");
    }

    @RequestMapping("/fallback/insight")
    ResponseEntity<FallbackResponse> insightsFallback() {
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