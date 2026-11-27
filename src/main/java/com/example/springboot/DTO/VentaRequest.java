package com.example.springboot.DTO;

import java.math.BigDecimal;
import java.util.List;


public record VentaRequest(
        Integer customerId,
        List<VentaItemRequest> items,
        BigDecimal discount,
        String paymentMethod,
        String status,
        String reference,
        String notes,
        String soldAt,
        BigDecimal amountReceived
) {
}
