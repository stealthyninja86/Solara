package com.solara.authservice.unit;

import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import com.solara.authservice.service.JwtService;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    static JwtService jwtService;
    static UUID userId;
    static String email;

    @BeforeAll
    static void setUp() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair keyPair = generator.generateKeyPair();

        RSAPublicKey publicKey = (RSAPublicKey) keyPair.getPublic();
        RSAPrivateKey privateKey = (RSAPrivateKey) keyPair.getPrivate();

        JWK jwk = new RSAKey.Builder(publicKey).privateKey(privateKey).build();
        JWKSource<SecurityContext> jwkSource = new ImmutableJWKSet<>(new JWKSet(jwk));
        JwtEncoder encoder = new NimbusJwtEncoder(jwkSource);

        JwtDecoder decoder = NimbusJwtDecoder.withPublicKey(publicKey).build();

        jwtService = new JwtService(encoder, decoder, 900000, 604800000);
        userId = UUID.randomUUID();
        email = "alice@test.com";
    }

    @Test
    void generateAndExtractAccessToken() {
        String token = jwtService.generateAccessToken(userId, email);

        assertThat(token).isNotNull();
        assertThat(token).startsWith("eyJ");
        assertThat(jwtService.extractUserId(token)).isEqualTo(userId);
        assertThat(jwtService.extractEmail(token)).isEqualTo(email);
    }

    @Test
    void generateAndExtractRefreshToken() {
        String token = jwtService.generateRefreshToken(userId, email);

        assertThat(token).isNotNull();
        assertThat(jwtService.extractUserId(token)).isEqualTo(userId);
        assertThat(jwtService.extractEmail(token)).isEqualTo(email);
    }

    @Test
    void validToken_isValidReturnsTrue() {
        String token = jwtService.generateAccessToken(userId, email);
        assertThat(jwtService.isTokenValid(token)).isTrue();
    }

    @Test
    void invalidToken_isValidReturnsFalse() {
        assertThat(jwtService.isTokenValid("eyJ.invalid.token")).isFalse();
    }

    @Test
    void expiredToken_isRejected() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair keyPair = generator.generateKeyPair();
        RSAPublicKey publicKey = (RSAPublicKey) keyPair.getPublic();
        RSAPrivateKey privateKey = (RSAPrivateKey) keyPair.getPrivate();

        JWK jwk = new RSAKey.Builder(publicKey).privateKey(privateKey).build();
        JWKSource<SecurityContext> source = new ImmutableJWKSet<>(new JWKSet(jwk));
        JwtEncoder encoder = new NimbusJwtEncoder(source);
        JwtDecoder decoder = NimbusJwtDecoder.withPublicKey(publicKey).build();

        JwtService expiredService = new JwtService(encoder, decoder, 0, 0);
        String token = expiredService.generateAccessToken(userId, email);

        Thread.sleep(1);

        assertThat(expiredService.isTokenValid(token)).isFalse();
    }

    @Test
    void tokensWithDifferentKeys_areRejected() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair keyPair2 = generator.generateKeyPair();
        RSAPublicKey publicKey2 = (RSAPublicKey) keyPair2.getPublic();

        JwtDecoder wrongDecoder = NimbusJwtDecoder.withPublicKey(publicKey2).build();

        String token = jwtService.generateAccessToken(userId, email);

        try {
            wrongDecoder.decode(token);
            assertThat(false).isTrue();
        } catch (Exception e) {
            assertThat(e).isInstanceOf(Exception.class);
        }
    }
}
