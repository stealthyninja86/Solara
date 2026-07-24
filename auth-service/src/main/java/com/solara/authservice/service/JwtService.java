package com.solara.authservice.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class JwtService {

    private final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final JwtEncoder encoder;
    private final JwtDecoder decoder;
    private final long accessTokenValidity;
    private final long refreshTokenValidity;

    public JwtService(JwtEncoder encoder, JwtDecoder decoder,
                      @Value("${jwt.access-expiry}") long accessTokenValidity,
                      @Value("${jwt.refresh-expiry}") long refreshTokenValidity) {
        this.encoder = encoder;
        this.decoder = decoder;
        this.accessTokenValidity = accessTokenValidity;
        this.refreshTokenValidity = refreshTokenValidity;
    }

    public String generateAccessToken(UUID userId, String email) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(userId.toString())
                .claim("type", "access")
                .claim("email", email)
                .issuedAt(now)
                .expiresAt(now.plusMillis(accessTokenValidity))
                .build();
        return encoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();
    }

    public String generateRefreshToken(UUID userId, String email) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(userId.toString())
                .claim("type", "refresh")
                .claim("email", email)
                .issuedAt(now)
                .expiresAt(now.plusMillis(refreshTokenValidity))
                .build();
        return encoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();
    }

    public String extractEmail(String token) {
        return parseClaims(token).getClaimAsString("email");
    }

    public UUID extractUserId(String token) {
        return UUID.fromString(parseClaims(token).getSubject());
    }

    public boolean isTokenValid(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (Exception e) {
            log.error("Token is invalid", e);
            return false;
        }
    }

    private Jwt parseClaims(String token) {
        return decoder.decode(token);
    }
}
