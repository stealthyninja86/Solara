package com.solara.authservice.service;

import com.solara.authservice.dto.request.LoginRequest;
import com.solara.authservice.dto.request.RegisterRequest;
import com.solara.authservice.dto.response.UserProfileResponse;
import com.solara.authservice.entity.User;
import com.solara.authservice.exception.InvalidCredentialsException;
import com.solara.authservice.exception.UserNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AuthService {

    Logger logger = LoggerFactory.getLogger(AuthService.class);

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserService userService, PasswordEncoder passwordEncoder) {
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
    }

    public UserProfileResponse registerUser(RegisterRequest registerRequest) {
        User user = userService.createUser(registerRequest);
        logger.info("User registered: {}", user.getEmail());
        return new UserProfileResponse(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName());
    }

    public UserProfileResponse loginUser(LoginRequest loginRequest) {
        User user = userService.findByEmail(loginRequest.email())
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        if (!passwordEncoder.matches(loginRequest.password(), user.getPassword())) {
            throw new InvalidCredentialsException("Invalid credentials");
        }

        logger.info("User logged in: {}", user.getEmail());
        return new UserProfileResponse(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName());
    }

    public UserProfileResponse getUserByEmail(String email) {
        User user = userService.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + email));
        return new UserProfileResponse(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName());
    }

    public UserProfileResponse getUserById(UUID id) {
        User user = userService.findById(id)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + id));
        return new UserProfileResponse(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName());
    }

    public UserProfileResponse updateProfile(UUID id, String firstName, String lastName) {
        User user = userService.updateProfile(id, firstName, lastName);
        logger.info("Profile updated for user: {}", user.getEmail());
        return new UserProfileResponse(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName());
    }

    public void changePassword(UUID id, String currentPassword, String newPassword) {
        userService.changePassword(id, currentPassword, newPassword);
        logger.info("Password changed for user id: {}", id);
    }
}
