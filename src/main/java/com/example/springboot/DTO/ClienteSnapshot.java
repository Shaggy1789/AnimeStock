package com.example.springboot.DTO;


public record ClienteSnapshot(
        Integer id,
        String name,
        String email,
        String phone,
        String initials
) {
    public static ClienteSnapshot consumidorFinal() {
        return new ClienteSnapshot(null, "Consumidor final", "", "", "CF");
    }
}
