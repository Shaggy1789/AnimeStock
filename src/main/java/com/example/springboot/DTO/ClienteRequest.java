package com.example.springboot.DTO;


public record ClienteRequest(
        String name,
        String email,
        String phone
) {
}