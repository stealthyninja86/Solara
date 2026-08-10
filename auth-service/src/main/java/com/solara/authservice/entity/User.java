package com.solara.authservice.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotBlank
    @Email
    @Column(unique = true, nullable = false)
    private String email;

    private String firstName;

    private String lastName;

    @NotBlank
    @Column(nullable = false, length = 60)
    private String password;

    @Column(nullable = false, length = 10)
    private String iconMode = "icons";

    @Column(nullable = false)
    private Boolean llmEnabled = true;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getIconMode() {
        return iconMode;
    }

    public void setIconMode(String iconMode) {
        this.iconMode = iconMode;
    }

    public Boolean getLlmEnabled() {
        return llmEnabled;
    }

    public void setLlmEnabled(Boolean llmEnabled) {
        this.llmEnabled = llmEnabled;
    }
}
