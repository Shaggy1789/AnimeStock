package com.example.springboot.DTO;

import java.math.BigDecimal;

public record VentaItemResponse(
        Integer productId,
        String name,
        String anime,
        String imageUrl,
        int quantity,
        BigDecimal unitPrice,
        BigDecimal subtotal
) {
}
