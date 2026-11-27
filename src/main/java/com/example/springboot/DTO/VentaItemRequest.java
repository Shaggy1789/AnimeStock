package com.example.springboot.DTO;

import java.math.BigDecimal;

public record VentaItemRequest(
        Integer productId,
        Integer quantity,
        BigDecimal unitPrice
) {
}
