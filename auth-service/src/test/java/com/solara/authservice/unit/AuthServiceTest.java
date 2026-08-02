package com.solara.authservice.unit;

import com.solara.authservice.dto.request.LoginRequest;
import com.solara.authservice.dto.request.RegisterRequest;
import com.solara.authservice.dto.response.UserProfileResponse;
import com.solara.authservice.entity.User;
import com.solara.authservice.exception.InvalidCredentialsException;
import com.solara.authservice.exception.UserNotFoundException;
import com.solara.authservice.service.AuthService;
import com.solara.authservice.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    UserService userService;

    @Mock
    PasswordEncoder passwordEncoder;

    AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userService, passwordEncoder);
    }

    @Test
    void registerUser_createsUserAndReturnsProfile() {
        var request = new RegisterRequest("alice@test.com", "pass123", "Alice", "Smith");
        var savedUser = createUser(UUID.randomUUID(), "alice@test.com", "encoded-pass", "Alice", "Smith");
        when(userService.createUser(request)).thenReturn(savedUser);

        UserProfileResponse result = authService.registerUser(request);

        assertThat(result.email()).isEqualTo("alice@test.com");
        assertThat(result.firstName()).isEqualTo("Alice");
        assertThat(result.lastName()).isEqualTo("Smith");
        verify(userService).createUser(request);
    }

    @Test
    void loginUser_validCredentials_returnsProfile() {
        var request = new LoginRequest("alice@test.com", "pass123");
        var user = createUser(UUID.randomUUID(), "alice@test.com", "$2a$10$...hashed...", "Alice", "Smith");
        when(userService.findByEmail("alice@test.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("pass123", user.getPassword())).thenReturn(true);

        UserProfileResponse result = authService.loginUser(request);

        assertThat(result.email()).isEqualTo("alice@test.com");
    }

    @Test
    void loginUser_unknownEmail_throwsUserNotFound() {
        var request = new LoginRequest("unknown@test.com", "pass123");
        when(userService.findByEmail("unknown@test.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.loginUser(request))
                .isInstanceOf(UserNotFoundException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    void loginUser_wrongPassword_throwsInvalidCredentials() {
        var request = new LoginRequest("alice@test.com", "wrongpass");
        var user = createUser(UUID.randomUUID(), "alice@test.com", "$2a$10$...hashed...", "Alice", "Smith");
        when(userService.findByEmail("alice@test.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongpass", user.getPassword())).thenReturn(false);

        assertThatThrownBy(() -> authService.loginUser(request))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessageContaining("Invalid credentials");
    }

    @Test
    void getUserByEmail_existingUser_returnsProfile() {
        var user = createUser(UUID.randomUUID(), "alice@test.com", "encoded", "Alice", "Smith");
        when(userService.findByEmail("alice@test.com")).thenReturn(Optional.of(user));

        UserProfileResponse result = authService.getUserByEmail("alice@test.com");

        assertThat(result.email()).isEqualTo("alice@test.com");
    }

    @Test
    void getUserByEmail_unknownUser_throws() {
        when(userService.findByEmail("unknown@test.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.getUserByEmail("unknown@test.com"))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    void getUserById_existingUser_returnsProfile() {
        var id = UUID.randomUUID();
        var user = createUser(id, "alice@test.com", "encoded", "Alice", "Smith");
        when(userService.findById(id)).thenReturn(Optional.of(user));

        UserProfileResponse result = authService.getUserById(id);

        assertThat(result.id()).isEqualTo(id);
    }

    @Test
    void getUserById_unknownUser_throws() {
        var id = UUID.randomUUID();
        when(userService.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.getUserById(id))
                .isInstanceOf(UserNotFoundException.class);
    }

    private User createUser(UUID id, String email, String password, String firstName, String lastName) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setPassword(password);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        return user;
    }
}
