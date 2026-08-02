package com.solara.authservice.container;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AuthServiceIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("testdb")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
    }

    @Autowired
    TestRestTemplate rest;

    String registerPayload = """
            {
                "email": "alice@test.com",
                "password": "StrongPass1!",
                "firstName": "Alice",
                "lastName": "Smith"
            }
            """;

    String loginPayload = """
            {
                "email": "alice@test.com",
                "password": "StrongPass1!"
            }
            """;

    @Test
    void fullAuthFlow() {
        ResponseEntity<String> registerResponse = rest.postForEntity(
                "/auth/register",
                new HttpEntity<>(registerPayload, jsonHeaders()),
                String.class);

        assertThat(registerResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        String registerAccessToken = JsonPath.read(registerResponse.getBody(), "$.accessToken");
        String registerCookie = registerResponse.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(registerAccessToken).isNotNull();
        assertThat(registerCookie).contains("refreshToken").contains("HttpOnly");

        HttpHeaders cookieHeaders = jsonHeaders();
        cookieHeaders.set(HttpHeaders.COOKIE, extractCookieValue(registerCookie));
        ResponseEntity<String> loginResponse = rest.exchange(
                "/auth/login",
                HttpMethod.POST,
                new HttpEntity<>(loginPayload, cookieHeaders),
                String.class);

        assertThat(loginResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        String loginBody = loginResponse.getBody();
        assertThat(JsonPath.read(loginBody, "$.message").toString())
                .isEqualTo("Already logged in");

        ResponseEntity<String> freshLoginResponse = rest.postForEntity(
                "/auth/login",
                new HttpEntity<>(loginPayload, jsonHeaders()),
                String.class);

        assertThat(freshLoginResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        String accessToken = JsonPath.read(freshLoginResponse.getBody(), "$.accessToken");
        String refreshCookie = freshLoginResponse.getHeaders().getFirst(HttpHeaders.SET_COOKIE);

        HttpHeaders authHeaders = new HttpHeaders();
        authHeaders.setBearerAuth(accessToken);
        ResponseEntity<String> profileResponse = rest.exchange(
                "/auth/profile",
                HttpMethod.GET,
                new HttpEntity<>(authHeaders),
                String.class);

        assertThat(profileResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        String profileEmail = JsonPath.read(profileResponse.getBody(), "$.email");
        assertThat(profileEmail).isEqualTo("alice@test.com");

        HttpHeaders refreshHeaders = new HttpHeaders();
        refreshHeaders.set(HttpHeaders.COOKIE, extractCookieValue(refreshCookie));
        ResponseEntity<String> refreshResponse = rest.exchange(
                "/auth/token",
                HttpMethod.POST,
                new HttpEntity<>(refreshHeaders),
                String.class);

        assertThat(refreshResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        String newAccessToken = JsonPath.read(refreshResponse.getBody(), "$.accessToken");
        assertThat(newAccessToken).isNotNull();
        assertThat(newAccessToken).isNotEqualTo(accessToken);

        HttpHeaders newAuthHeaders = new HttpHeaders();
        newAuthHeaders.setBearerAuth(newAccessToken);
        ResponseEntity<String> newProfileResponse = rest.exchange(
                "/auth/profile",
                HttpMethod.GET,
                new HttpEntity<>(newAuthHeaders),
                String.class);

        assertThat(newProfileResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void register_duplicateEmail_returns409() {
        rest.postForEntity("/auth/register",
                new HttpEntity<>(registerPayload, jsonHeaders()), String.class);

        ResponseEntity<String> response = rest.postForEntity("/auth/register",
                new HttpEntity<>(registerPayload, jsonHeaders()), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void login_wrongPassword_returns401() {
        rest.postForEntity("/auth/register",
                new HttpEntity<>(registerPayload, jsonHeaders()), String.class);

        String wrongPayload = """
                { "email": "alice@test.com", "password": "WrongPass1!" }
                """;
        ResponseEntity<String> response = rest.postForEntity("/auth/login",
                new HttpEntity<>(wrongPayload, jsonHeaders()), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void profile_withoutToken_returns401() {
        ResponseEntity<String> response = rest.getForEntity("/auth/profile", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void profile_withExpiredToken_returns401() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("eyJ.expired.token");
        ResponseEntity<String> response = rest.exchange(
                "/auth/profile",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private String extractCookieValue(String setCookieHeader) {
        return setCookieHeader.split(";")[0];
    }
}
