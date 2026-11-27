package com.example.springboot.DTO;

import java.math.BigDecimal;

public record MovimientoCajaRequest(
        String type,
        BigDecimal amount,
        String description,
        String occurredAt
) {
}
