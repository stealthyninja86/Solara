package com.solara.gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.util.matcher.ServerWebExchangeMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Bean
    @Order(1)
    public SecurityWebFilterChain authSecurityFilterChain(ServerHttpSecurity http) {
        return http
                .securityMatcher(new ServerWebExchangeMatcher() {
                    @Override
                    public Mono<MatchResult> matches(ServerWebExchange exchange) {
                        String path = exchange.getRequest().getPath().value();
                        if (path.startsWith("/api/v1/auth/") || path.startsWith("/actuator/")) {
                            return MatchResult.match();
                        }
                        return MatchResult.notMatch();
                    }
                })
                .authorizeExchange(exchanges -> exchanges
                        .anyExchange().permitAll()
                )
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .build();
    }

    @Bean
    @Order(2)
    public SecurityWebFilterChain apiSecurityFilterChain(ServerHttpSecurity http) {
        return http
                .authorizeExchange(exchanges -> exchanges
                        .anyExchange().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> {})
                )
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .build();
    }
}
