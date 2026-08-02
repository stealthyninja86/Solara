package com.solara.authservice.service;

import com.solara.authservice.repository.UserRepository;
import com.solara.authservice.dto.request.RegisterRequest;
import com.solara.authservice.entity.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public User createUser(RegisterRequest registerRequest) {
        User user = new User();
        user.setEmail(registerRequest.email());
        user.setPassword(passwordEncoder.encode(registerRequest.password()));
        user.setFirstName(registerRequest.firstName());
        user.setLastName(registerRequest.lastName());
        return userRepository.save(user);
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public Optional<User> findById(UUID id) {
        return userRepository.findById(id);
    }

    public User updateProfile(UUID id, String firstName, String lastName) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new com.solara.authservice.exception.UserNotFoundException("User not found: " + id));
        if (firstName != null) {
            user.setFirstName(firstName);
        }
        if (lastName != null) {
            user.setLastName(lastName);
        }
        return userRepository.save(user);
    }

    public void changePassword(UUID id, String currentPassword, String newPassword) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new com.solara.authservice.exception.UserNotFoundException("User not found: " + id));
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new com.solara.authservice.exception.InvalidPasswordException("Current password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }
}
