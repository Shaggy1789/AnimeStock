package com.example.springboot.DTO;

import java.math.BigDecimal;
import java.time.LocalDateTime;


public record MovimientoCajaResponse(
        int id,
        String type,
        BigDecimal amount,
        String description,
        Integer saleId,
        LocalDateTime occurredAt,
        String receiptNumber,
        String customerName
) {
}
