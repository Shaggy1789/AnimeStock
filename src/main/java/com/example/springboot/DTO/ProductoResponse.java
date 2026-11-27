package com.example.springboot.DTO;

import java.math.BigDecimal;


public record ProductoResponse(
        int id,
        String sku,
        String name,
        String anime,
        String category,
        String emoji,
        BigDecimal cost,
        BigDecimal price,
        int stock,
        int minStock,
        boolean active,
        String imageUrl
) {
}
