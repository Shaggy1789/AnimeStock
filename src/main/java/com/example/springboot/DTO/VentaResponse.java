package com.example.springboot.DTO;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;


public record VentaResponse(
        int id,
        String receiptNumber,
        Integer customerId,
        ClienteSnapshot customer,
        List<VentaItemResponse> items,
        BigDecimal subtotal,
        BigDecimal discount,
        BigDecimal total,
        String paymentMethod,
        String status,
        String reference,
        String notes,
        BigDecimal amountReceived,
        BigDecimal change,
        LocalDateTime soldAt,
        LocalDateTime sentAt,
        LocalDateTime cancelledAt,
        MovimientoCajaResponse cashMovement
) {
}
